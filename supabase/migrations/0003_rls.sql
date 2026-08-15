-- Joy Health — row level security and organization scoping
--
-- Section 28 requires organization scoping on EVERY query and server-enforced
-- RBAC. A guard in React is decoration: anyone holding an anon key can call
-- PostgREST directly. This file is where the boundary is actually enforced.
--
-- Two of the brief's own Sprint 1 failure tests — "unauthorized role" and
-- "cross-organization access attempt" — are tests of this file.

-- ---------------------------------------------------------------------------
-- Table privileges
--
-- RLS narrows what a role may see; it does not grant access in the first place.
-- PostgREST connects as `authenticated` (or `anon`), so without these grants the
-- API returns permission errors regardless of how correct the policies are.
--
-- anon is granted nothing. There is no unauthenticated read path into client or
-- employee data.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on organizations, users, people, client_profiles, employee_profiles,
                relationships, audit_entries, domain_events, communication_events
  to authenticated;

grant insert, update, delete on users, people, client_profiles, employee_profiles,
                                relationships
  to authenticated;

-- Append-only from the application's side. No update, no delete.
grant insert on audit_entries, domain_events to authenticated;

-- Insert to queue, update only to retry — the policy below constrains which
-- transitions that update may actually make.
grant insert, update on communication_events to authenticated;

-- ---------------------------------------------------------------------------
-- Who is asking
-- ---------------------------------------------------------------------------

-- The Joy user row for the current Supabase session.
--
-- security definer so it can read users without recursing into that table's own
-- policies. search_path is pinned because a definer function that resolves names
-- through a caller-controlled search_path is a privilege escalation.
create or replace function current_app_user()
returns users
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.* from users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
  limit 1;
$$;

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from current_app_user();
$$;

create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from current_app_user();
$$;

-- Does the caller hold any of these roles?
create or replace function has_role(variadic roles user_role[])
returns boolean
language sql
stable
as $$
  select current_user_role() = any(roles);
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. A table without RLS in a multi-tenant database is a
-- data leak waiting for its first bug.
-- ---------------------------------------------------------------------------

alter table organizations        enable row level security;
alter table users                enable row level security;
alter table people               enable row level security;
alter table client_profiles      enable row level security;
alter table employee_profiles    enable row level security;
alter table relationships        enable row level security;
alter table audit_entries        enable row level security;
alter table domain_events        enable row level security;
alter table communication_events enable row level security;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create policy organizations_read_own on organizations
  for select using (id = current_org_id());

create policy organizations_update_admin on organizations
  for update using (id = current_org_id() and has_role('ceo_admin'))
  with check (id = current_org_id());

create policy users_read_same_org on users
  for select using (organization_id = current_org_id());

-- Only admins and HR may create or change staff accounts, and never across
-- an organization boundary. The with check clause is what stops a caller
-- moving a row into someone else's organization.
create policy users_write_admin on users
  for all
  using (organization_id = current_org_id() and has_role('ceo_admin', 'hr'))
  with check (organization_id = current_org_id() and has_role('ceo_admin', 'hr'));

-- ---------------------------------------------------------------------------
-- People and profiles
-- ---------------------------------------------------------------------------

create policy people_read_same_org on people
  for select using (organization_id = current_org_id());

create policy people_write_staff on people
  for all
  using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler', 'hr')
  )
  with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler', 'hr')
  );

-- Profiles inherit their tenancy from the person they hang off, which keeps the
-- organization_id in exactly one place.
create policy client_profiles_read_same_org on client_profiles
  for select using (
    exists (select 1 from people p
            where p.id = client_profiles.person_id
              and p.organization_id = current_org_id())
  );

create policy client_profiles_write_staff on client_profiles
  for all
  using (
    exists (select 1 from people p
            where p.id = client_profiles.person_id
              and p.organization_id = current_org_id())
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler')
  )
  with check (
    exists (select 1 from people p
            where p.id = client_profiles.person_id
              and p.organization_id = current_org_id())
  );

create policy employee_profiles_read_same_org on employee_profiles
  for select using (
    exists (select 1 from people p
            where p.id = employee_profiles.person_id
              and p.organization_id = current_org_id())
  );

create policy employee_profiles_write_hr on employee_profiles
  for all
  using (
    exists (select 1 from people p
            where p.id = employee_profiles.person_id
              and p.organization_id = current_org_id())
    and has_role('ceo_admin', 'hr')
  )
  with check (
    exists (select 1 from people p
            where p.id = employee_profiles.person_id
              and p.organization_id = current_org_id())
  );

create policy relationships_read_same_org on relationships
  for select using (
    exists (select 1 from people p
            where p.id = relationships.subject_person_id
              and p.organization_id = current_org_id())
  );

create policy relationships_write_staff on relationships
  for all
  using (
    exists (select 1 from people p
            where p.id = relationships.subject_person_id
              and p.organization_id = current_org_id())
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler')
  )
  with check (
    exists (select 1 from people p
            where p.id = relationships.subject_person_id
              and p.organization_id = current_org_id())
  );

-- ---------------------------------------------------------------------------
-- Audit and events
--
-- Audit is readable by admins and append-only to everyone else. There is
-- deliberately no update or delete policy on audit_entries: an audit trail that
-- can be edited from the application is not evidence of anything.
-- ---------------------------------------------------------------------------

create policy audit_entries_read_admin on audit_entries
  for select using (organization_id = current_org_id() and has_role('ceo_admin'));

create policy audit_entries_insert_same_org on audit_entries
  for insert with check (organization_id = current_org_id());

-- The outbox is worker territory. Application sessions may see their own
-- organization's events for status display, but must not mark work processed.
create policy domain_events_read_same_org on domain_events
  for select using (organization_id = current_org_id());

create policy domain_events_insert_same_org on domain_events
  for insert with check (organization_id = current_org_id());

create policy communication_events_read_same_org on communication_events
  for select using (organization_id = current_org_id());

create policy communication_events_insert_same_org on communication_events
  for insert with check (organization_id = current_org_id());

-- Retrying a failed notification is a user action, so it is allowed — but only
-- back to queued, and only on a row that actually failed. Nothing in the
-- application may declare a message sent; that transition belongs to the worker
-- confirming with the provider.
create policy communication_events_retry on communication_events
  for update
  using (organization_id = current_org_id() and status = 'failed')
  with check (organization_id = current_org_id() and status = 'queued');
