-- Minimal stand-ins for what a real Supabase database already has, so our
-- migrations can run in PGlite (Postgres in Node) for fast RLS tests.
-- Mirrors Supabase: the `anon` and `authenticated` roles, the `auth.users`
-- table and `auth.uid()`, which reads the logged-in user's id from the JWT.

create role anon nologin noinherit;
create role authenticated nologin noinherit;

create schema auth;

create table auth.users (
  id                 uuid primary key,
  email              text,
  phone              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- The login token's claims; tests may set `request.jwt.claim.session_id`.
create function auth.jwt() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
    'session_id', nullif(current_setting('request.jwt.claim.session_id', true), '')
  );
$$;

-- One row per signed-in device (Supabase GoTrue keeps these).
create table auth.sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  refreshed_at timestamp,
  user_agent   text,
  ip           inet,
  not_after    timestamptz
);

-- Supabase Storage: buckets and files, with Row Level Security on the files.
create schema storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid
);
alter table storage.objects enable row level security;

-- Same as Supabase: "a/b/c.png" → {a,b}.
create function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;

-- Supabase grants table access to these roles by default; RLS then decides rows.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
