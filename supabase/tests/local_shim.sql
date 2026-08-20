-- Local-only shim for verifying migrations outside Supabase.
--
-- Supabase provides the auth schema, auth.users and auth.uid(). A plain
-- Postgres does not, so migrations that reference them cannot be applied or
-- tested locally without this. It is NOT part of the migration sequence and
-- must never run against a Supabase project.
--
-- Usage:
--   psql -f supabase/tests/local_shim.sql
--   psql -f supabase/migrations/0001_foundation.sql
--   psql -f supabase/migrations/0002_audit_and_events.sql
--   psql -f supabase/migrations/0003_rls.sql
--   psql -f supabase/tests/rls_test.sql
--   psql -f supabase/tests/credentials_test.sql   (needs rls_test.sql's helpers)

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase derives this from the request JWT. Locally we drive it from a
-- session setting so a test can impersonate a user.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Supabase ships these roles; a local Postgres does not. PostgREST connects as
-- `authenticated` for a signed-in caller and `anon` otherwise.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;
