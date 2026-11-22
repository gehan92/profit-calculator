-- =============================================================================
-- 0006 — Feature switches and entry history
-- Source: updated Development Document, Part D7 (feature switches), E5
-- ("Never lose work") and F3 (its migration 0003).
--
-- Feature switches: the admin turns each feature Off / Beta / On, for everyone,
-- chosen roles / languages / countries, a % of users, or single testers.
--   * Core features are always on and can't be switched off.
--   * "Free forever" can never be moved to Pro and the mark can't be removed.
--   * Off beats everything (kill switch). Beta = only users switched on by hand.
--   * Switching off never deletes data.
--
-- Entry history: every change or delete of an entry is kept (30 days, 1 year
-- for Pro shops), so a mistake can be undone. Deleting a shop deletes its history.
--
-- Added to the document's SQL:
--   [+] restore_entry_from_history(): the owner's "undo".
--   [+] purge_old_entry_history(): the daily cleanup job (30 days / 1 year).
-- =============================================================================


-- ===== FEATURE SWITCHES =======================================================
create table feature_flags (
  key             text primary key,
  name            text not null,
  description     text,
  category        text not null default 'general',
  status          text not null default 'off' check (status in ('off', 'beta', 'on')),
  min_plan        text not null default 'free' check (min_plan in ('free', 'pro', 'business')),
  locked_free     boolean not null default false,   -- promised free forever
  always_on       boolean not null default false,   -- core: can't be switched off
  roles           text[],                           -- null = all roles, e.g. '{owner,viewer}'
  locales         text[],                           -- null = all languages
  countries       text[],                           -- null = all countries (ISO codes)
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  whats_new       text,                             -- short "What's new" note
  updated_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  check (not locked_free or min_plan = 'free'),
  check (not always_on or status = 'on')
);

-- Turn a feature on or off for one user (beta testers, support cases).
create table feature_overrides (
  feature_key text references feature_flags (key) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  enabled     boolean not null,
  primary key (feature_key, user_id)
);

-- A "free forever" promise can never be taken back or moved to Pro.
create function keep_free_promise() returns trigger
language plpgsql as $$
begin
  if old.locked_free and not new.locked_free then
    raise exception 'locked_free_cannot_be_removed';
  end if;
  if old.always_on and (not new.always_on or new.status <> 'on') then
    raise exception 'core_feature_always_on';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger feature_flags_guard before update on feature_flags
  for each row execute function keep_free_promise();

-- Is this feature on for this user?
create function feature_enabled(p_key text, uid uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f feature_flags;
  o boolean;
  t text;
begin
  select * into f from feature_flags where key = p_key;
  if not found then return false; end if;
  if f.always_on then return true; end if;
  if f.status = 'off' then return false; end if;       -- kill switch beats everything

  select enabled into o from feature_overrides
   where feature_key = p_key and user_id = uid;
  if o is not null then return o; end if;
  if f.status = 'beta' then return false; end if;      -- beta: only chosen users

  t := user_tier(uid);
  if f.min_plan = 'pro' and t not in ('pro', 'business') then return false; end if;
  if f.min_plan = 'business' and t <> 'business' then return false; end if;

  if f.rollout_percent < 100 then
    if uid is null then return false; end if;
    return abs(hashtext(p_key || uid::text)) % 100 < f.rollout_percent;
  end if;
  return true;
end $$;

-- All features that are on for the current user (loaded once per page).
-- Role, language and country limits (roles / locales / countries) are checked
-- by the app with the columns of feature_flags.
create function my_features() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(key order by key), '{}')
  from feature_flags
  where feature_enabled(key);
$$;

alter table feature_flags     enable row level security;
alter table feature_overrides enable row level security;

create policy flags_read on feature_flags for select
  using (true);
create policy flags_write on feature_flags for all
  using (is_admin()) with check (is_admin());
create policy overrides_read on feature_overrides for select
  using (user_id = (select auth.uid()) or is_admin());
create policy overrides_write on feature_overrides for all
  using (is_admin()) with check (is_admin());


-- ===== ENTRY HISTORY (undo mistakes, never lose data) =========================
create table entry_history (
  id          bigint generated always as identity primary key,
  entry_id    uuid not null,
  business_id uuid not null,
  action      text not null check (action in ('update', 'delete')),
  old_row     jsonb not null,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index entry_history_business on entry_history (business_id, changed_at);

create function log_entry_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- While a whole shop (or account) is being deleted, its entries are changed
  -- and removed by the cascade (for example "created by" is set to null). That
  -- needs no history: the shop's history is deleted too. The shop row is
  -- already gone at that point.
  if not exists (select 1 from businesses b where b.id = old.business_id) then
    return coalesce(new, old);
  end if;

  insert into entry_history (entry_id, business_id, action, old_row, changed_by)
  values (old.id, old.business_id, lower(tg_op), to_jsonb(old), auth.uid());
  return coalesce(new, old);
end $$;

create trigger entries_history after update or delete on entries
  for each row execute function log_entry_change();

-- When a shop is deleted, its history goes too.
create function purge_shop_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from entry_history where business_id = old.id;
  return old;
end $$;

create trigger businesses_purge_history after delete on businesses
  for each row execute function purge_shop_history();

alter table entry_history enable row level security;
create policy history_owner on entry_history for select
  using (my_role(business_id) = 'owner');

-- The owner's "undo": bring back a deleted entry, or the values before a change.
create function restore_entry_from_history(p_history_id bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h entry_history;
begin
  select * into h from entry_history where id = p_history_id;
  if not found or my_role(h.business_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;

  if h.action = 'delete' then
    insert into entries
    select * from jsonb_populate_record(null::entries, h.old_row);
  else
    update entries e
       set type = r.type, category = r.category, amount_cents = r.amount_cents,
           entry_date = r.entry_date, note = r.note
      from jsonb_populate_record(null::entries, h.old_row) r
     where e.id = h.entry_id and e.business_id = h.business_id;
    if not found then
      raise exception 'entry_not_found';
    end if;
  end if;

  return h.entry_id;
end $$;

-- The daily cleanup job (run from Supabase cron or a scheduled call with the
-- secret key): history older than 30 days goes, 1 year for Pro shops.
create function purge_old_entry_history() returns int
language plpgsql security definer set search_path = public as $$
declare
  removed int;
begin
  delete from entry_history h
   using businesses b
   where b.id = h.business_id
     and h.changed_at < now() - case when is_pro(b.owner_id) then interval '1 year'
                                     else interval '30 days' end;
  get diagnostics removed = row_count;

  -- History of shops that no longer exist (defensive).
  delete from entry_history h
   where h.changed_at < now() - interval '30 days'
     and not exists (select 1 from businesses b where b.id = h.business_id);
  return removed;
end $$;

revoke all on function restore_entry_from_history(bigint) from public, anon;
revoke all on function purge_old_entry_history()          from public, anon, authenticated;
grant execute on function restore_entry_from_history(bigint) to authenticated;


-- ===== SEED: core features (always on, free forever) ==========================
insert into feature_flags (key, name, category, status, min_plan, locked_free, always_on) values
  ('calculators',     'Free calculators',     'core', 'on', 'free', true, true),
  ('daily_records',   'Daily income/expense', 'core', 'on', 'free', true, true),
  ('monthly_summary', 'Monthly summary',      'core', 'on', 'free', true, true),
  ('csv_export',      'Export my data',       'core', 'on', 'free', true, true),
  ('real_profit',     'Real profit check',    'core', 'on', 'free', true, false),
  ('entry_history',   'Undo and history',     'core', 'on', 'free', true, false);

-- New features: added switched OFF; the admin turns them on when they are ready.
insert into feature_flags (key, name, category, min_plan, locked_free) values
  ('products',        'Products and margins',       'money',   'free',     true),
  ('credit_book',     'Credit book (naya pota)',    'money',   'free',     false),
  ('supplier_book',   'Supplier book (what I owe)', 'money',   'free',     false),
  ('cash_count',      'Daily cash count',           'money',   'free',     false),
  ('goals',           'Monthly profit goal',        'habits',  'free',     false),
  ('streaks',         'Recording streaks',          'habits',  'free',     false),
  ('daily_reminder',  'Daily reminder',             'habits',  'free',     false),
  ('weekly_summary',  'Weekly summary message',     'habits',  'free',     false),
  ('app_lock',        'PIN lock',                   'safety',  'free',     false),
  ('dark_mode',       'Dark mode',                  'look',    'free',     false),
  ('referrals',       'Invite a friend',            'growth',  'free',     false),
  ('payments',        'Pro upgrade and billing',    'billing', 'free',     false),
  ('pdf_reports',     'PDF and bank-ready report',  'pro',     'pro',      false),
  ('multi_shop',      'More than one shop',         'pro',     'business', false),
  ('team',            'Staff and Viewer invites',   'pro',     'business', false),
  ('ai_insights',     'AI tips (Gemini)',           'pro',     'pro',      false),
  ('receipt_scan',    'Scan a bill photo',          'pro',     'pro',      false),
  ('voice_entry',     'Voice entry (si/ta/en)',     'pro',     'pro',      false),
  ('tax_helper',      'VAT / sales tax helper',     'pro',     'pro',      false);
