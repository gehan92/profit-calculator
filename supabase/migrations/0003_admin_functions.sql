-- =============================================================================
-- 0003 — Functions for the admin panel (Part D4, Part B3).
--
-- The admin panel needs facts that live in `auth.users` (email, phone) and
-- counts across shops. Admin and Support have NO policy on entries or
-- products (Part B3: "Admin sees totals only"), so everything here returns
-- ACCOUNT INFO AND COUNTS, never an amount, a note or a single record:
--
--   admin_stats()        more totals (replaces the one from 0001; same keys + new)
--   admin_daily_stats()  signups and active people per day, for the chart
--   admin_users()        searchable user list for Support and Admin
--   admin_user_detail()  one user: account info, shops + roles, entry COUNTS
--   touch_last_active()  a user marks themselves active (at most once an hour)
--
-- Each function checks the caller itself (`is_admin()` / `is_team()`) and
-- raises 'forbidden' otherwise, like admin_stats() already did.
-- =============================================================================


-- Dashboard totals. Same keys as before, plus a few more.
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
    'pro_businesses',   (select count(*) from businesses where plan = 'pro'),
    'blocked_users',    (select count(*) from profiles where status = 'blocked'),
    'feedback_new',     (select count(*) from feedback where status = 'new'),
    -- Shops per language, e.g. {"en": 12, "si": 30, "ta": 4}.
    'language_split',   coalesce((select json_object_agg(locale, shops) from (
                          select locale, count(*) as shops from businesses group by locale
                        ) per_language), '{}'::json)
  );
end $$;


-- New sign-ups and active people for each of the last `p_days` days (1–366), oldest first.
-- "Active" = someone who added at least one entry that day.
create function admin_daily_stats(p_days int default 30)
returns table (day date, signups int, active_users int)
language plpgsql stable security definer set search_path = public as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 1), 366);
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select series.d::date,
         (select count(*)::int from profiles p where p.created_at::date = series.d::date),
         (select count(distinct e.created_by)::int from entries e where e.created_at::date = series.d::date)
  from generate_series(current_date - (days - 1), current_date, interval '1 day') as series(d)
  order by series.d;
end $$;


-- Searchable user list (Part D4 Users): name, contact, joined, last active, plan,
-- number of entries in their own shops, status. Search matches part of the email,
-- phone or name (no wildcards: the text is looked for as it is typed).
-- `total_count` is the number of matching users, the same on every row, for paging.
create function admin_users(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  phone          text,
  created_at     timestamptz,
  last_active_at timestamptz,
  platform_role  platform_role,
  status         text,
  plan           text,
  entries_count  bigint,
  total_count    bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  needle text := lower(btrim(coalesce(p_search, '')));
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  return query
  select p.id,
         p.full_name,
         u.email::text,
         u.phone::text,
         p.created_at,
         p.last_active_at,
         p.platform_role,
         p.status,
         case when exists (select 1 from businesses b where b.owner_id = p.id and b.plan = 'pro')
              then 'pro' else 'free' end,
         (select count(*) from entries e
            join businesses b on b.id = e.business_id
           where b.owner_id = p.id),
         count(*) over ()
  from profiles p
  join auth.users u on u.id = p.id
  where needle = ''
     or position(needle in lower(coalesce(u.email::text, ''))) > 0
     or position(needle in lower(coalesce(u.phone::text, ''))) > 0
     or position(needle in lower(coalesce(p.full_name, ''))) > 0
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;


-- One user (Part C2 "Admin — User detail"): account info, support-access status,
-- and every shop they belong to with their role and the NUMBER of entries in it.
-- Returns null when there is no such user.
create function admin_user_detail(p_user_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  return (
    select json_build_object(
      'id',                   p.id,
      'full_name',            p.full_name,
      'email',                u.email,
      'phone',                u.phone,
      'created_at',           p.created_at,
      'last_active_at',       p.last_active_at,
      'platform_role',        p.platform_role,
      'status',               p.status,
      'support_access_until', p.support_access_until,
      'shops', coalesce((
        select json_agg(json_build_object(
                 'id',            b.id,
                 'name',          b.name,
                 'plan',          b.plan,
                 'role',          m.role,
                 'entries_count', (select count(*) from entries e where e.business_id = b.id)
               ) order by b.created_at)
        from business_members m
        join businesses b on b.id = m.business_id
        where m.user_id = p.id
      ), '[]'::json)
    )
    from profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user_id
  );
end $$;


-- "Last active" (Part D4 Users): a logged-in person marks themselves active.
-- At most once an hour, so it costs one tiny write per hour, not per page.
-- Users cannot update `last_active_at` directly (only name + support access are
-- granted), which is why this is a function.
create function touch_last_active() returns void
language sql security definer set search_path = public as $$
  update profiles
  set last_active_at = now()
  where id = auth.uid()
    and (last_active_at is null or last_active_at < now() - interval '1 hour');
$$;


-- Only logged-in people may call these (each also checks the role inside).
revoke all on function admin_daily_stats(int)             from public, anon;
revoke all on function admin_users(text, int, int)        from public, anon;
revoke all on function admin_user_detail(uuid)            from public, anon;
revoke all on function touch_last_active()                from public, anon;
grant execute on function admin_daily_stats(int)          to authenticated;
grant execute on function admin_users(text, int, int)     to authenticated;
grant execute on function admin_user_detail(uuid)         to authenticated;
grant execute on function touch_last_active()             to authenticated;
