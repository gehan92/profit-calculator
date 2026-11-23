-- 0011_account_settings.sql
-- The Account page (spec D6): settings a person keeps about THEMSELVES, whatever
-- their role in a shop. Shop settings stay in /dashboard/settings (Owner only).
--
--   [+] profiles: date format, default currency for new shops, notification choices
--   [+] my_sessions(): the person's own signed-in devices (for "Log out of all devices")
--   [+] a profile photo goes in a Storage bucket "avatars" that only its owner may write to
--
-- Nothing here lets a person touch their role or status: the column grants below
-- list exactly what may change (migration 0005 did the same for photo, language
-- and text size).

-- ===== PROFILES: more settings the person owns ================================
alter table profiles
  add column date_format      text not null default 'ymd'
    check (date_format in ('ymd', 'dmy', 'mdy')),
  add column default_currency char(3)
    check (default_currency in ('LKR', 'INR', 'USD', 'EUR', 'GBP', 'AUD', 'AED')),
  add column notify_daily     boolean not null default false,
  add column notify_daily_time time not null default '20:00',
  add column notify_weekly    boolean not null default false,
  add column notify_payments  boolean not null default true;

comment on column profiles.date_format is 'How dates are written in files and lists: ymd 2026-11-23, dmy 23/11/2026, mdy 11/23/2026.';
comment on column profiles.default_currency is 'Currency pre-selected when this person creates a shop; null = ask.';

grant update (date_format, default_currency, notify_daily, notify_daily_time, notify_weekly, notify_payments)
  on profiles to authenticated;


-- ===== MY SIGNED-IN DEVICES ===================================================
-- Supabase keeps one row per login in auth.sessions. A person may see only their
-- own, and only what helps them recognise a device: when it signed in, when it was
-- last used and the browser description. No network address is returned.
create function my_sessions()
returns table (
  session_id   uuid,
  created_at   timestamptz,
  last_seen_at timestamptz,
  user_agent   text,
  is_current   boolean
)
language sql stable security definer set search_path = public, auth as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at),
         s.user_agent,
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by 3 desc;
$$;

revoke all on function my_sessions() from public, anon;
grant execute on function my_sessions() to authenticated;


-- ===== PROFILE PHOTO (Storage bucket "avatars") ===============================
-- One small picture per person, stored under their own id: avatars/<user id>/<random>.webp.
-- The app uploads each new picture under a new random name and removes the old one, so
-- a picture's address cannot be guessed and a removed file is gone (Supabase's public
-- cache may keep showing a removed picture for a while, up to about an hour). A person can
-- list only their own folder. Only the owner of the folder can add, replace or remove
-- files in it, and only a small image (500 KB, webp / jpeg / png).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A person may see (list) only the files in their own folder. Replacing or removing a
-- file looks it up first, so this is needed for those too. Showing a picture to anyone
-- needs no policy: a public bucket serves files by their (unguessable) address.
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
