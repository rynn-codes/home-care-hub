-- Joy Health — employee documents and credentials
--
-- The claim worth proving is §19's: a scheduler who needs an eligibility answer
-- does not thereby get permission to read the background check behind it. That
-- boundary is easy to assert in prose and easy to lose in a policy, so it is
-- tested rather than described.
--
-- Also covers the rules from §30 that the schema is supposed to enforce:
-- credential history survives a renewal, and requirements are per-organization
-- data rather than hard-coded.
--
-- Run after the shim, all migrations, and with the helpers from rls_test.sql.
--
-- Every assertion runs as `authenticated`, the role PostgREST actually connects
-- as. Run as the table owner instead and RLS is bypassed entirely — the whole
-- file passes while proving nothing, which is worse than having no tests.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------

do $$
declare
  org        uuid;
  other_org  uuid;
  auth_admin uuid := gen_random_uuid();
  auth_sched uuid := gen_random_uuid();
  auth_rn    uuid := gen_random_uuid();
  auth_other uuid := gen_random_uuid();
  emp        uuid;
  doc_bg     uuid;
  doc_cpr    uuid;
  cred       uuid;
begin
  insert into organizations (name) values ('Joy Docs Test') returning id into org;
  insert into organizations (name) values ('Rival Docs') returning id into other_org;

  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  values (org, auth_admin, 'Karynn', 'Verrett', 'admin@docs.test', 'ceo_admin', 'active'),
         (org, auth_sched, 'Sam', 'Scheduler', 'sched@docs.test', 'scheduler', 'active'),
         (org, auth_rn, 'Kelsey', 'Westley', 'rn@docs.test', 'rn_clinical', 'active'),
         (other_org, auth_other, 'Rival', 'Admin', 'admin@rival2.test', 'ceo_admin', 'active');

  insert into people (organization_id, first_name, last_name)
  values (org, 'Jamal', 'Carter') returning id into emp;

  -- A background check: the sensitive one.
  insert into documents (
    organization_id, owner_type, owner_id, document_type, folder_type, sensitivity,
    storage_key, original_filename, mime_type, file_size, checksum, processing_state
  ) values (
    org, 'employee', emp, 'background_check', 'background', 'background_sensitive',
    'org/docs/bg.pdf', 'background.pdf', 'application/pdf', 12345, 'sha256:aaa', 'verified'
  ) returning id into doc_bg;

  -- A CPR card: an ordinary credential.
  insert into documents (
    organization_id, owner_type, owner_id, document_type, folder_type, sensitivity,
    storage_key, original_filename, mime_type, file_size, checksum, processing_state
  ) values (
    org, 'employee', emp, 'cpr_bls', 'credentials_licenses', 'general_credential',
    'org/docs/cpr.pdf', 'cpr.pdf', 'application/pdf', 4242, 'sha256:bbb', 'verified'
  ) returning id into doc_cpr;

  insert into employee_credentials (
    organization_id, employee_id, credential_type, status, issuer,
    issued_at, expires_at, verification_status, current_document_id
  ) values (
    org, emp, 'cpr_bls', 'current', 'American Heart Association',
    '2025-06-01', '2027-06-01', 'verified', doc_cpr
  ) returning id into cred;

  insert into credential_requirements (
    organization_id, credential_type, display_name, blocks_scheduling_when_expired
  ) values (org, 'cpr_bls', 'CPR/BLS', true);

  create temp table docs_fx (k text primary key, v uuid);
  insert into docs_fx values
    ('org', org), ('other_org', other_org),
    ('auth_admin', auth_admin), ('auth_sched', auth_sched),
    ('auth_rn', auth_rn), ('auth_other', auth_other),
    ('emp', emp), ('doc_bg', doc_bg), ('doc_cpr', doc_cpr), ('cred', cred);
  -- Read from inside role-switched blocks below.
  grant select on docs_fx to authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- §19 — eligibility is not the same permission as evidence
-- ---------------------------------------------------------------------------

do $$
declare n int;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_sched'));

  -- The scheduler gets the answer they need to do their job.
  select count(*) into n from employee_credentials;
  perform assert(n = 1, 'a scheduler can read the credential record for eligibility');

  -- And the ordinary credential document behind it.
  select count(*) into n from documents where sensitivity = 'general_credential';
  perform assert(n = 1, 'a scheduler can read a general credential document');

  -- But not the background check.
  select count(*) into n from documents where sensitivity = 'background_sensitive';
  perform assert(n = 0, 'a scheduler CANNOT read a background-sensitive document');
  reset role;
end $$;

do $$
declare n int;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_rn'));

  select count(*) into n from documents where sensitivity = 'clinical_credential';
  perform assert(n = 0, 'no clinical document exists yet, so the RN sees none');

  -- An RN is clinical staff, not HR. The background check stays out of reach.
  select count(*) into n from documents where sensitivity = 'background_sensitive';
  perform assert(n = 0, 'an RN CANNOT read a background-sensitive document');
  reset role;
end $$;

do $$
declare n int;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_admin'));
  select count(*) into n from documents;
  perform assert(n = 2, 'the owner can read every document in their organization');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Tenancy — the rival organization sees nothing at all
-- ---------------------------------------------------------------------------

do $$
declare n int;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_other'));

  select count(*) into n from documents;
  perform assert(n = 0, 'another organization sees no documents');

  select count(*) into n from employee_credentials;
  perform assert(n = 0, 'another organization sees no credentials');

  select count(*) into n from credential_requirements;
  perform assert(n = 0, 'another organization sees no credential requirements');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- §30 rule 7 — a renewal must not erase what was true before
-- ---------------------------------------------------------------------------

do $$
declare
  cred_id uuid := (select v from docs_fx where k = 'cred');
  org_id  uuid := (select v from docs_fx where k = 'org');
  doc_id  uuid := (select v from docs_fx where k = 'doc_cpr');
  n int;
  prior_expiry date;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_admin'));

  -- Archive the standing card, then renew in place.
  insert into employee_credential_versions (
    organization_id, employee_credential_id, document_id,
    issuer, issued_at, expires_at, verification_status, superseded_at
  )
  select organization_id, id, current_document_id,
         issuer, issued_at, expires_at, verification_status, now()
  from employee_credentials where id = cred_id;

  update employee_credentials
  set issued_at = '2027-05-01', expires_at = '2029-05-01', updated_at = now()
  where id = cred_id;

  select count(*) into n from employee_credential_versions where employee_credential_id = cred_id;
  perform assert(n = 1, 'the prior credential version survives the renewal');

  select expires_at into prior_expiry
  from employee_credential_versions where employee_credential_id = cred_id;
  perform assert(prior_expiry = date '2027-06-01', 'the prior expiry is preserved exactly');

  select count(*) into n from employee_credentials where id = cred_id and expires_at = '2029-05-01';
  perform assert(n = 1, 'the live credential carries the new expiry');

  -- The prior evidence is still reachable, not orphaned.
  select count(*) into n
  from employee_credential_versions v join documents d on d.id = v.document_id
  where v.employee_credential_id = cred_id;
  perform assert(n = 1, 'the prior evidence document is still attached to its version');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- §6 — one live credential per type, so truth is not duplicated
-- ---------------------------------------------------------------------------

do $$
declare
  org_id uuid := (select v from docs_fx where k = 'org');
  emp_id uuid := (select v from docs_fx where k = 'emp');
  failed boolean := false;
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_admin'));
  begin
    insert into employee_credentials (organization_id, employee_id, credential_type, status)
    values (org_id, emp_id, 'cpr_bls', 'current');
  exception when unique_violation then
    failed := true;
  end;
  perform assert(failed, 'a second live CPR credential for the same person is refused');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- §6 — requirements are data, and only an owner changes policy
-- ---------------------------------------------------------------------------

do $$
declare
  org_id uuid := (select v from docs_fx where k = 'org');
  n int;
  warned integer[];
begin
  set local role authenticated;
  perform act_as((select v from docs_fx where k = 'auth_sched'));

  -- Everyone needs to know what is owed.
  select count(*) into n from credential_requirements;
  perform assert(n = 1, 'a scheduler can read credential requirements');

  -- But policy is the owner's to set.
  update credential_requirements set blocks_scheduling_when_expired = false;
  get diagnostics n = row_count;
  perform assert(n = 0, 'a scheduler CANNOT change what blocks scheduling');

  perform act_as((select v from docs_fx where k = 'auth_admin'));
  select warning_days into warned from credential_requirements limit 1;
  perform assert(warned = '{90,60,30,14,7}'::integer[], 'warning points are configurable data');
  reset role;
end $$;

do $$ begin raise notice 'credentials_test.sql: all assertions passed'; end $$;
