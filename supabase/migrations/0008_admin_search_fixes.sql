-- 0008: two fixes to the masked admin user functions of 0005, found by the
-- browser test against the real Supabase database.
--
-- 1. PHONE SEARCH. Supabase stores a phone number as digits only
--    ("94771234567", no "+"), so an exact search for "+94771234567" never
--    matched. The search now compares DIGITS ONLY, so "+94 77 123 4567",
--    "94771234567" and the local "077 123 4567" all find the same one user.
--    It is still an exact match of the whole number: part of a number (or
--    anything with letters) finds nobody. The masked phone is shown the way
--    the spec writes it: "+947 *** **67".
-- 2. MEMBERSHIPS. "Shops joined as Staff or Viewer" also counted the owner's
--    own membership row (every owner has one), so a plain owner showed 1.
--    Now only Staff and Viewer rows are counted.


-- "+947 *** **67" from "94771234567" or "+94771234567"; numbers with fewer
-- than 7 digits are hidden completely. Used only inside the functions below.
create function mask_phone(p_phone text) returns text
language sql immutable set search_path = public as $$
  select case
           when coalesce(p_phone, '') = '' then null
           when length(regexp_replace(p_phone, '\D', '', 'g')) < 7 then '*** **'
           else '+' || left(regexp_replace(p_phone, '\D', '', 'g'), 3)
                || ' *** **' || right(regexp_replace(p_phone, '\D', '', 'g'), 2)
         end;
$$;
revoke all on function mask_phone(text) from public, anon, authenticated;


-- Same columns as in 0005 (so `create or replace` is allowed).
create or replace function admin_find_users(p_query text default null, p_limit int default 25, p_offset int default 0)
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
  needle     text := btrim(coalesce(p_query, ''));
  digits     text := regexp_replace(btrim(coalesce(p_query, '')), '\D', '', 'g');
  -- Only text that looks like a phone number (digits, +, spaces, brackets,
  -- dashes) and has at least 8 digits is compared with phone numbers.
  as_phone   boolean;
  -- Sri Lanka's local form 0771234567 is the same number as 94771234567.
  local_form text;
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;

  as_phone   := needle ~ '^[+0-9 ()-]+$' and length(digits) >= 8;
  local_form := case when left(digits, 1) = '0' then '94' || substr(digits, 2) end;

  return query
  select p.id,
         case when coalesce(u.email::text, '') = '' then null
              else left(u.email::text, 1) || '***@' || split_part(u.email::text, '@', 2) end,
         mask_phone(u.phone::text),
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
     or (as_phone and coalesce(u.phone::text, '') <> ''
         and regexp_replace(u.phone::text, '\D', '', 'g') in (digits, coalesce(local_form, digits)))
     or p.id::text = lower(needle)
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;


create or replace function admin_user_summary(p_user_id uuid) returns json
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
      'phone_masked',         mask_phone(u.phone::text),
      'created_at',           p.created_at,
      'last_active_at',       p.last_active_at,
      'platform_role',        p.platform_role,
      'status',               p.status,
      'tier',                 user_tier(p.id),
      'support_access_until', p.support_access_until,
      'support_access_on',    coalesce(p.support_access_until > now(), false),
      'shops_count',          (select count(*) from businesses b where b.owner_id = p.id),
      -- Staff and Viewer only: every owner also has an 'owner' row for their own shop.
      'memberships_count',    (select count(*) from business_members m
                                where m.user_id = p.id and m.role <> 'owner'),
      'entries_count',        (select count(*) from entries e
                                 join businesses b on b.id = e.business_id
                                where b.owner_id = p.id)
    )
    from profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user_id
  );
end $$;
