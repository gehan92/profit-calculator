-- =============================================================================
-- 0005 — Accounts, languages and tighter privacy
-- Source: updated Development Document, Part B4 (admin access and user
-- privacy), C1.7 (create account), D6 (account page), F3 (its migration 0002).
--
-- What changes:
--   * Shops get a business type (shop setup page).
--   * Profiles get a photo, a saved language and a text-size setting.
--   * 11 language codes are allowed (admin switches each one on).
--   * PRIVACY: the team can no longer read profiles, shops or members
--     directly. Support and Admin find users through masked, exact-search
--     functions; the full profile is shown only while the user's support
--     access switch is on, and every such view is written to the audit log.
--   * The old admin_users() / admin_user_detail() (full email and phone) go.
--
-- Differences from the document's SQL (same behaviour, safer):
--   [+] The user's access log is a function (my_access_log) that returns only
--       the time of each permitted view. Letting users read audit_log rows
--       directly would also show the admin's email kept in `details`.
-- =============================================================================


-- ===== SHOPS: business type, and the 11 languages ============================
alter table businesses
  add column business_type text
    check (business_type in ('shop', 'home', 'transport', 'service', 'other'));

alter table businesses drop constraint businesses_locale_check;
alter table businesses add constraint businesses_locale_check
  check (locale in ('en', 'en-GB', 'si', 'ta', 'hi', 'zh', 'es', 'fr', 'de', 'ru', 'uk'));

alter table content drop constraint content_locale_check;
alter table content add constraint content_locale_check
  check (locale in ('en', 'en-GB', 'si', 'ta', 'hi', 'zh', 'es', 'fr', 'de', 'ru', 'uk'));


-- ===== PROFILES: photo, saved language, text size ============================
alter table profiles
  add column avatar_url text,
  add column locale     text
    check (locale in ('en', 'en-GB', 'si', 'ta', 'hi', 'zh', 'es', 'fr', 'de', 'ru', 'uk')),
  add column text_size  text not null default 'normal' check (text_size in ('normal', 'large'));

-- People may change these about themselves (never their role or status).
grant update (avatar_url, locale, text_size) on profiles to authenticated;


-- ===== PRIVACY: the team reads nothing directly ==============================
drop policy profiles_read on profiles;
create policy profiles_read on profiles for select
  using (id = (select auth.uid()));

drop policy biz_read on businesses;
create policy biz_read on businesses for select
  using (owner_id = (select auth.uid()) or my_role(id) is not null);

drop policy members_read on business_members;
create policy members_read on business_members for select
  using (user_id = (select auth.uid()) or my_role(business_id) = 'owner');


-- ===== ADMIN: masked user list (no permission needed) ========================
drop function admin_users(text, int, int);
drop function admin_user_detail(uuid);

-- Find users. With no text it lists the newest users; with text it finds the
-- ONE user whose email, phone or user ID is exactly that text. Contact details
-- come back masked (k***@gmail.com, +947 *** **12); names are not returned.
-- `total_count` is the number of matches, the same on every row, for paging.
create function admin_find_users(p_query text default null, p_limit int default 25, p_offset int default 0)
returns table (
  user_id        uuid,
  email_masked   text,
  phone_masked   text,
  created_at     timestamptz,
  last_active_at timestamptz,
  platform_role  platform_role,
  status         text,
  tier           text,
  shops_count    int,
  entries_count  bigint,
  total_count    bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  needle text := btrim(coalesce(p_query, ''));
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  return query
  select p.id,
         case when coalesce(u.email::text, '') = '' then null
              else left(u.email::text, 1) || '***@' || split_part(u.email::text, '@', 2) end,
         case when coalesce(u.phone::text, '') = '' then null
              when length(u.phone::text) < 8 then '*** **'
              else left(u.phone::text, 4) || ' *** **' || right(u.phone::text, 2) end,
         p.created_at,
         p.last_active_at,
         p.platform_role,
         p.status,
         user_tier(p.id),
         (select count(*)::int from businesses b where b.owner_id = p.id),
         (select count(*) from entries e
            join businesses b on b.id = e.business_id
           where b.owner_id = p.id),
         count(*) over ()
  from profiles p
  join auth.users u on u.id = p.id
  where needle = ''
     or lower(coalesce(u.email::text, '')) = lower(needle)
     or coalesce(u.phone::text, '') = needle
     or p.id::text = lower(needle)
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- One user, masked, counts only (Part C2 "Admin - User detail"). Returns null
-- when there is no such user. Shop names and the user's name need permission.
create function admin_user_summary(p_user_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  return (
    select json_build_object(
      'id',                   p.id,
      'email_masked',         case when coalesce(u.email::text, '') = '' then null
                                   else left(u.email::text, 1) || '***@' || split_part(u.email::text, '@', 2) end,
      'phone_masked',         case when coalesce(u.phone::text, '') = '' then null
                                   when length(u.phone::text) < 8 then '*** **'
                                   else left(u.phone::text, 4) || ' *** **' || right(u.phone::text, 2) end,
      'created_at',           p.created_at,
      'last_active_at',       p.last_active_at,
      'platform_role',        p.platform_role,
      'status',               p.status,
      'tier',                 user_tier(p.id),
      'support_access_until', p.support_access_until,
      'support_access_on',    coalesce(p.support_access_until > now(), false),
      'shops_count',          (select count(*) from businesses b where b.owner_id = p.id),
      'memberships_count',    (select count(*) from business_members m where m.user_id = p.id),
      'entries_count',        (select count(*) from entries e
                                 join businesses b on b.id = e.business_id
                                where b.owner_id = p.id)
    )
    from profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user_id
  );
end $$;

-- ===== ADMIN: full view ONLY with the user's permission (logged) =============
-- Works only while the user's "allow support to view my account" switch is on
-- (support_access_until in the future). The view is written to the audit log
-- before anything is returned. Money records are never part of it.
create function admin_view_user(target uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  allowed boolean;
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  select support_access_until > now() into allowed from profiles where id = target;
  if not coalesce(allowed, false) then
    raise exception 'no_permission';
  end if;

  insert into audit_log (actor_id, action, target_user_id)
  values (auth.uid(), 'user.view_with_permission', target);

  return json_build_object(
    'profile', (select json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
                                         'created_at', p.created_at, 'last_active_at', p.last_active_at,
                                         'support_access_until', p.support_access_until)
                from profiles p where p.id = target),
    'email',   (select email from auth.users where id = target),
    'phone',   (select phone from auth.users where id = target),
    'shops',   (select json_agg(json_build_object('id', b.id, 'name', b.name, 'currency', b.currency,
                                                  'business_type', b.business_type))
                from businesses b where b.owner_id = target)
  );
end $$;

-- ===== USER: "who on your team viewed my account, and when" ==================
create function my_access_log() returns table (viewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.created_at
  from audit_log a
  where a.target_user_id = auth.uid()
    and a.action = 'user.view_with_permission'
  order by a.created_at desc
  limit 100;
$$;


-- ===== ADMIN DASHBOARD: "Pro" now means a paid / trial subscription ===========
-- Same keys as in 0003; only pro_businesses changed (it used businesses.plan,
-- which is no longer set: Pro comes from is_pro()).
create or replace function admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  return json_build_object(
    'users_total',      (select count(*) from profiles),
    'signups_today',    (select count(*) from profiles where created_at::date = current_date),
    'signups_7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'signups_30d',      (select count(*) from profiles where created_at > now() - interval '30 days'),
    'weekly_active',    (select count(distinct created_by) from entries
                         where created_at > now() - interval '7 days'),
    'entries_today',    (select count(*) from entries where created_at::date = current_date),
    'businesses_total', (select count(*) from businesses),
    'pro_businesses',   (select count(*) from businesses b where is_pro(b.owner_id)),
    'blocked_users',    (select count(*) from profiles where status = 'blocked'),
    'feedback_new',     (select count(*) from feedback where status = 'new'),
    'language_split',   coalesce((select json_object_agg(locale, shops) from (
                          select locale, count(*) as shops from businesses group by locale
                        ) per_language), '{}'::json)
  );
end $$;


-- Only logged-in people may call these (each admin one also checks the role inside).
revoke all on function admin_find_users(text, int, int) from public, anon;
revoke all on function admin_user_summary(uuid)         from public, anon;
revoke all on function admin_view_user(uuid)            from public, anon;
revoke all on function my_access_log()                  from public, anon;
grant execute on function admin_find_users(text, int, int) to authenticated;
grant execute on function admin_user_summary(uuid)         to authenticated;
grant execute on function admin_view_user(uuid)            to authenticated;
grant execute on function my_access_log()                  to authenticated;
