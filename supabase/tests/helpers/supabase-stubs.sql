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
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase grants table access to these roles by default; RLS then decides rows.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
