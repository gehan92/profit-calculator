-- =============================================================================
-- Profit Calculator — initial database schema
-- Source: Development Document, Part F3 ("Complete database schema").
--
-- Creates all 10 tables for MVP and later phases, so Staff, Viewer and
-- Support need no data migration later.
--
-- Rules this file enforces (Part B):
--   * Money is stored in cents (bigint). Currency is per business.
--   * Every table has Row Level Security (RLS) switched on.
--   * Admin has NO policy on entries/products: admin numbers come only
--     from admin_stats(), which returns totals and never one shop.
--   * Staff see only their own entries from today, so totals can't be worked out.
--
-- Changes from the document's SQL (all keep its behaviour):
--   [+] Time zone set to Asia/Colombo (Part F3, schema notes).
--   [+] Indexes on the columns used by RLS checks and admin lists.
--   [+] Policies use (select auth.uid()) — Supabase's faster form; same meaning.
--   [+] accept_invite() requires a logged-in, active (not blocked) user.
--   [+] Seed rows for admin settings listed in Part D4 (defaults, support).
--   [fix] biz_read also allows owner_id, so creating a shop with RETURNING works.
-- =============================================================================


-- "Today" in the Staff policy must match Sri Lanka time. Revisit when going global.
alter database postgres set timezone to 'Asia/Colombo';


-- =============================================================================
-- TYPES
-- =============================================================================
create type platform_role as enum ('user', 'support', 'admin');
create type member_role   as enum ('owner', 'staff', 'viewer');
create type entry_type    as enum ('income', 'expense');


-- =============================================================================
-- TABLES
-- =============================================================================

-- One row per login user.
create table profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text,
  platform_role        platform_role not null default 'user',
  status               text not null default 'active' check (status in ('active', 'blocked')),
  support_access_until timestamptz,
  last_active_at       timestamptz,
  created_at           timestamptz not null default now()
);
comment on table profiles is 'One per login user: name, platform role, status, support access.';
comment on column profiles.support_access_until is 'Support may view this user''s data until this time (user switch, 7 days).';

-- Shops.
create table businesses (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'My Shop' check (char_length(name) <= 60),
  currency   char(3) not null default 'LKR',
  locale     text not null default 'en' check (locale in ('si', 'en', 'ta')),
  plan       text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);
comment on table businesses is 'Shops: name, currency, language, owner.';
create index businesses_owner_id on businesses (owner_id);

-- Who belongs to which shop, and as what.
create table business_members (
  business_id uuid not null references businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        member_role not null,
  invited_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
comment on table business_members is 'Who belongs to which shop as owner / staff / viewer.';
create index business_members_user_id on business_members (user_id);

-- Every income and expense.
create table entries (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  type         entry_type not null,
  category     text not null,                       -- key such as 'stock', 'family_use'
  amount_cents bigint not null check (amount_cents > 0),
  entry_date   date not null,                       -- the user's local date
  note         text check (char_length(note) <= 200),
  client_id    uuid,                                -- guest/offline id, stops duplicates
  created_by   uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now(),
  unique (business_id, client_id)
);
comment on table entries is 'Every income and expense. Money in cents.';
create index entries_business_date on entries (business_id, entry_date);

-- Items with cost and price.
create table products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name        text not null check (char_length(name) <= 80),
  cost_cents  bigint not null check (cost_cents >= 0),
  price_cents bigint not null check (price_cents >= 0),
  created_at  timestamptz not null default now()
);
comment on table products is 'Items with cost and price (cents).';
create index products_business_id on products (business_id);

-- Pending Staff/Viewer invites (Pro, Phase 4).
create table invites (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  role        member_role not null check (role in ('staff', 'viewer')),
  token       text not null unique
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by  uuid not null default auth.uid() references auth.users (id),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
comment on table invites is 'Pending Staff/Viewer invites. Token valid for 7 days.';
create index invites_business_id on invites (business_id);

-- Feedback and bug reports (guests may send too).
create table feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  message    text not null check (char_length(message) between 1 and 2000),
  contact    text,
  page       text,
  status     text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);
comment on table feedback is 'Feedback and bug reports.';
create index feedback_status_created on feedback (status, created_at desc);

-- Every admin/support action.
create table audit_log (
  id             bigint generated always as identity primary key,
  actor_id       uuid references auth.users (id),
  action         text not null,                     -- e.g. 'user.block'
  target_user_id uuid,
  details        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
comment on table audit_log is 'Every admin/support action. Written only by server code with the secret key.';
create index audit_log_created_at on audit_log (created_at desc);
create index audit_log_target_user on audit_log (target_user_id);

-- Feature flags, maintenance mode, limits.
create table app_settings (
  key        text primary key,                      -- e.g. 'maintenance'
  value      jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
comment on table app_settings is 'Feature flags, maintenance mode, limits (admin-editable).';

-- Tips, announcements, page texts (admin-editable, Phase 2).
create table content (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('tip', 'announcement', 'page_text', 'faq')),
  locale     text not null check (locale in ('si', 'en', 'ta')),
  key        text not null,
  body       jsonb not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (kind, locale, key)
);
comment on table content is 'Tips, announcements, page texts and FAQ per language.';


-- =============================================================================
-- HELPER FUNCTIONS
-- `security definer` lets RLS policies read profiles/business_members
-- without recursive policy checks. search_path is pinned for safety.
-- =============================================================================

-- Is the current user an active admin?
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and platform_role = 'admin' and status = 'active'
  );
$$;

-- Is the current user active support or admin ("team")?
create function is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and platform_role in ('support', 'admin') and status = 'active'
  );
$$;

-- Is the current user not blocked?
create function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- The current user's role in shop `b` (null when not a member).
create function my_role(b uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from business_members where business_id = b and user_id = auth.uid();
$$;


-- =============================================================================
-- TRIGGERS AND RPC FUNCTIONS
-- =============================================================================

-- New login user -> profile row.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- New business -> its creator becomes the owner member.
create function add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end $$;

create trigger on_business_created
  after insert on businesses
  for each row execute function add_owner_member();

-- Accept a Staff/Viewer invite (Pro). Returns the business id.
create function accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites;
begin
  -- [+] Only a logged-in, non-blocked user may accept.
  if auth.uid() is null or not is_active() then
    raise exception 'not_allowed';
  end if;

  select * into inv
  from invites
  where token = p_token and accepted_at is null and expires_at > now();

  if not found then
    raise exception 'invite_invalid';
  end if;

  insert into business_members (business_id, user_id, role, invited_by)
  values (inv.business_id, auth.uid(), inv.role, inv.created_by)
  on conflict (business_id, user_id) do nothing;

  update invites set accepted_at = now() where id = inv.id;

  return inv.business_id;
end $$;

-- Admin dashboard numbers: totals only, never one shop.
create function admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  return json_build_object(
    'users_total',      (select count(*) from profiles),
    'signups_today',    (select count(*) from profiles where created_at::date = current_date),
    'signups_7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'weekly_active',    (select count(distinct created_by) from entries
                         where created_at > now() - interval '7 days'),
    'entries_today',    (select count(*) from entries where created_at::date = current_date),
    'businesses_total', (select count(*) from businesses),
    'feedback_new',     (select count(*) from feedback where status = 'new')
  );
end $$;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table profiles         enable row level security;
alter table businesses       enable row level security;
alter table business_members enable row level security;
alter table entries          enable row level security;
alter table products         enable row level security;
alter table invites          enable row level security;
alter table feedback         enable row level security;
alter table audit_log        enable row level security;
alter table app_settings     enable row level security;
alter table content          enable row level security;

-- profiles: self or team can read; a user can change only their name and support access.
create policy profiles_read on profiles for select
  using (id = (select auth.uid()) or is_team());
create policy profiles_update_self on profiles for update
  using (id = (select auth.uid()));

revoke update on profiles from anon, authenticated;
grant update (full_name, support_access_until) on profiles to authenticated;

-- businesses
-- [fix] `owner_id = auth.uid()` lets the creator read the new row in
-- `insert ... returning` (supabase-js `.insert().select()`): Postgres checks
-- this policy before the AFTER trigger has added the owner as a member.
create policy biz_read on businesses for select
  using (owner_id = (select auth.uid()) or my_role(id) is not null or is_team());
create policy biz_insert on businesses for insert
  with check (owner_id = (select auth.uid()) and is_active());
create policy biz_update on businesses for update
  using (my_role(id) = 'owner');
create policy biz_delete on businesses for delete
  using (my_role(id) = 'owner');

-- business_members (rows are added only by triggers / accept_invite)
create policy members_read on business_members for select
  using (user_id = (select auth.uid()) or my_role(business_id) = 'owner' or is_team());
create policy members_remove on business_members for delete
  using (my_role(business_id) = 'owner' and role <> 'owner');

-- entries: Owner all; Viewer read; Staff add + own entries today. Admin: NO policy.
-- Note: a Staff entry dated before today is saved but is not readable by Staff,
-- so Staff inserts of past dates must not ask for the row back (no RETURNING).
create policy entries_read on entries for select using (
  my_role(business_id) in ('owner', 'viewer')
  or (my_role(business_id) = 'staff'
      and created_by = (select auth.uid())
      and entry_date = current_date)
);
create policy entries_insert on entries for insert with check (
  my_role(business_id) in ('owner', 'staff')
  and created_by = (select auth.uid())
  and is_active()
);
-- No separate WITH CHECK: Postgres re-applies USING to the new row,
-- so Staff cannot move an entry to another day or another person.
create policy entries_update on entries for update using (
  my_role(business_id) = 'owner'
  or (my_role(business_id) = 'staff'
      and created_by = (select auth.uid())
      and entry_date = current_date)
);
create policy entries_delete on entries for delete
  using (my_role(business_id) = 'owner');

-- products
create policy products_read on products for select
  using (my_role(business_id) in ('owner', 'viewer'));
create policy products_write on products for all
  using (my_role(business_id) = 'owner')
  with check (my_role(business_id) = 'owner');

-- invites (owner manages; accepting goes through accept_invite())
create policy invites_owner on invites for all
  using (my_role(business_id) = 'owner')
  with check (my_role(business_id) = 'owner');

-- feedback: anyone can send; sender or team can read; team updates status
create policy feedback_insert on feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy feedback_read on feedback for select
  using (user_id = (select auth.uid()) or is_team());
create policy feedback_update on feedback for update
  using (is_team());

-- audit_log: admin reads; rows are written only by server code with the secret key
create policy audit_read on audit_log for select
  using (is_admin());

-- app_settings + content: everyone reads (active content); admin writes
create policy settings_read on app_settings for select
  using (true);
create policy settings_write on app_settings for all
  using (is_admin()) with check (is_admin());

create policy content_read on content for select
  using (active or is_admin());
create policy content_write on content for all
  using (is_admin()) with check (is_admin());


-- =============================================================================
-- SEED
-- =============================================================================
insert into app_settings (key, value) values
  ('maintenance', '{"on": false}'),
  ('features',    '{"products": true, "team": false, "pdf": false}'),
  ('pro_limits',  '{"staff": 3, "viewers": 2}'),
  -- [+] Part D4 admin settings
  ('defaults',    '{"locale": "en", "currency": "LKR"}'),
  ('support',     '{"whatsapp": ""}');

-- Make yourself admin AFTER your first login, then turn on MFA:
--   update profiles set platform_role = 'admin' where id = '<your-user-id>';
