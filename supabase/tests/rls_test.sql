-- Joy Health — row level security tests
--
-- Covers two of the Sprint 1 failure tests the brief names directly:
-- "unauthorized role" and "cross-organization access attempt". Each assertion
-- raises an exception on failure, so the script exits non-zero under
-- ON_ERROR_STOP and can gate a deploy.
--
-- Run after the shim and all migrations. See local_shim.sql for the sequence.

\set ON_ERROR_STOP on

create or replace function assert(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', description;
  end if;
  raise notice '  ok  %', description;
end;
$$;

-- Impersonate a Supabase session for the given auth user.
create or replace function act_as(auth_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', auth_id::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixture: two organizations that must never see each other
-- ---------------------------------------------------------------------------

do $$
declare
  org_a uuid; org_b uuid;
  auth_admin_a uuid; auth_billing_a uuid; auth_admin_b uuid;
  person_a uuid; person_b uuid;
begin
  insert into auth.users default values returning id into auth_admin_a;
  insert into auth.users default values returning id into auth_billing_a;
  insert into auth.users default values returning id into auth_admin_b;

  insert into organizations (name) values ('Joy Healthcare Services') returning id into org_a;
  insert into organizations (name) values ('Rival Home Care') returning id into org_b;

  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  values (org_a, auth_admin_a, 'Karynn', 'Verrett', 'admin@joy.test', 'ceo_admin', 'active'),
         (org_a, auth_billing_a, 'Bill', 'Ingham', 'billing@joy.test', 'billing', 'active'),
         (org_b, auth_admin_b, 'Rival', 'Admin', 'admin@rival.test', 'ceo_admin', 'active');

  insert into people (organization_id, first_name, last_name)
  values (org_a, 'Marcus', 'Bell') returning id into person_a;
  insert into people (organization_id, first_name, last_name)
  values (org_b, 'Someone', 'Else') returning id into person_b;

  insert into client_profiles (person_id, client_status) values (person_a, 'prospect');

  -- Stash ids for the tests below.
  create temp table fixture as
  select org_a as org_a, org_b as org_b, auth_admin_a as auth_admin_a,
         auth_billing_a as auth_billing_a, auth_admin_b as auth_admin_b,
         person_a as person_a, person_b as person_b;
end
$$;

-- ---------------------------------------------------------------------------
-- Tests run as `authenticated`, the role PostgREST actually uses.
-- ---------------------------------------------------------------------------

do $$
declare
  f record;
  visible int;
  blocked boolean;
begin
  select * into f from fixture;

  raise notice 'Cross-organization isolation';
  set local role authenticated;

  perform act_as(f.auth_admin_a);
  select count(*) into visible from people;
  perform assert(visible = 1, 'org A admin sees only org A people');

  select count(*) into visible from people where id = f.person_b;
  perform assert(visible = 0, 'org A admin cannot read an org B person');

  perform act_as(f.auth_admin_b);
  select count(*) into visible from people;
  perform assert(visible = 1, 'org B admin sees only org B people');

  select count(*) into visible from client_profiles;
  perform assert(visible = 0, 'org B admin cannot read org A client profiles');

  reset role;
end
$$;

do $$
declare
  f record;
  blocked boolean := false;
begin
  select * into f from fixture;
  raise notice 'Writing across the organization boundary';

  set local role authenticated;
  perform act_as(f.auth_admin_a);

  begin
    insert into people (organization_id, first_name, last_name)
    values (f.org_b, 'Injected', 'Record');
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'org A admin cannot insert a person into org B');

  -- An update that would move a row to another organization must also fail.
  begin
    update people set organization_id = f.org_b where id = f.person_a;
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'org A admin cannot move a person into org B');

  reset role;
end
$$;

do $$
declare
  f record;
  blocked boolean := false;
  visible int;
begin
  select * into f from fixture;
  raise notice 'Role enforcement';

  set local role authenticated;
  perform act_as(f.auth_billing_a);

  select count(*) into visible from people;
  perform assert(visible = 1, 'billing role can read people in its own org');

  begin
    insert into people (organization_id, first_name, last_name)
    values (f.org_a, 'Should', 'Fail');
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'billing role cannot create people');

  select count(*) into visible from audit_entries;
  perform assert(visible = 0, 'non-admin cannot read the audit log');

  reset role;
end
$$;

do $$
declare
  f record;
  blocked boolean := false;
  comm_id uuid;
  new_status communication_status;
begin
  select * into f from fixture;
  raise notice 'Audit is append-only; messages cannot be faked as sent';

  set local role authenticated;
  perform act_as(f.auth_admin_a);

  insert into audit_entries (organization_id, actor_user_id, actor_type, action, entity_type, entity_id)
  select f.org_a, u.id, 'user', 'person.created', 'people', f.person_a
  from users u where u.auth_user_id = f.auth_admin_a;

  begin
    update audit_entries set action = 'tampered' where organization_id = f.org_a;
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'audit entries cannot be updated from the application');

  begin
    delete from audit_entries where organization_id = f.org_a;
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'audit entries cannot be deleted from the application');

  insert into communication_events
    (organization_id, entity_type, entity_id, channel, provider, template_key, status)
  values (f.org_a, 'assessment', f.person_a, 'sms', 'spruce', 'assessment_scheduled', 'queued')
  returning id into comm_id;

  -- The application must not be able to declare a message delivered.
  --
  -- Two distinct mechanisms protect this, and both are checked. A row the USING
  -- clause excludes is invisible to the UPDATE, so it silently affects zero rows
  -- rather than raising — asserting only on an exception would pass a policy
  -- that did nothing at all, so assert on the row itself.
  update communication_events set status = 'sent' where id = comm_id;
  select status into new_status from communication_events where id = comm_id;
  perform assert(new_status = 'queued',
    'a queued message is untouched by an application attempt to mark it sent');

  reset role;

  update communication_events
     set status = 'failed', error_code = 'provider_timeout'
   where id = comm_id;

  -- Now the row IS visible to the retry policy. The WITH CHECK clause is what
  -- stops the transition going anywhere other than back to queued.
  set local role authenticated;
  perform act_as(f.auth_admin_a);
  begin
    update communication_events set status = 'sent' where id = comm_id;
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'a failed message cannot be marked sent by the application');
  reset role;

  -- Only the worker, holding the provider's confirmation, may do that.
  set local role authenticated;
  perform act_as(f.auth_admin_a);
  update communication_events set status = 'queued' where id = comm_id;
  select status into new_status from communication_events where id = comm_id;
  perform assert(new_status = 'queued', 'a failed message can be retried back to queued');
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- Constraints that protect the data model regardless of who is writing
-- ---------------------------------------------------------------------------

do $$
declare
  f record;
  blocked boolean := false;
  other_person uuid;
begin
  select * into f from fixture;
  raise notice 'Data model constraints';

  insert into people (organization_id, first_name, last_name)
  values (f.org_a, 'Susan', 'Bell') returning id into other_person;

  insert into relationships (subject_person_id, related_person_id, relationship_type, is_primary_contact)
  values (f.person_a, other_person, 'child', true);

  -- The same person in two roles must remain one person, so a second
  -- relationship is fine — a second PRIMARY contact is not.
  begin
    insert into relationships (subject_person_id, related_person_id, relationship_type, is_primary_contact)
    values (f.person_a, f.person_b, 'friend', true);
    blocked := false;
  exception when unique_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a person cannot have two primary contacts');

  begin
    insert into relationships (subject_person_id, related_person_id, relationship_type)
    values (f.person_a, f.person_a, 'other');
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a person cannot be their own relation');

  begin
    insert into communication_events
      (organization_id, entity_type, channel, provider, template_key, status)
    values (f.org_a, 'assessment', 'sms', 'spruce', 'x', 'sent');
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a message cannot be sent without provider confirmation');

  begin
    insert into audit_entries (organization_id, actor_type, action, entity_type)
    values (f.org_a, 'user', 'x', 'people');
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a user-actor audit entry must identify the user');

  -- Idempotency: the same key cannot enqueue the same event twice.
  insert into domain_events (organization_id, event_type, aggregate_type, aggregate_id, idempotency_key)
  values (f.org_a, 'assessment.scheduled', 'admission', f.person_a, 'sched-1');
  begin
    insert into domain_events (organization_id, event_type, aggregate_type, aggregate_id, idempotency_key)
    values (f.org_a, 'assessment.scheduled', 'admission', f.person_a, 'sched-1');
    blocked := false;
  exception when unique_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a double-clicked Schedule cannot enqueue two events');
end
$$;

\echo 'All RLS and constraint tests passed.'
