-- Joy Health — the audit trail as evidence, and the outbox as a queue
--
-- Two properties that only exist in the database, and would be untestable
-- anywhere else:
--
--   an authenticated session cannot sign somebody else's name to an action
--   two workers cannot claim the same event
--
-- Every assertion runs as `authenticated` unless it is explicitly testing the
-- worker, which connects with a role that bypasses row level security.

\set ON_ERROR_STOP on
set client_min_messages to notice;

create or replace function assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'FAILED: %', description; end if;
  raise notice '  ok  %', description;
end; $$;

create or replace function act_as(auth_id uuid)
returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', auth_id::text, true); end; $$;

create temporary table outbox_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — outbox') returning id
),
other_org as (
  insert into organizations (name) values ('Somebody Else Home Care') returning id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'owner@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sched@x.com') returning id),
u_owner as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_owner.id, 'Karynn', 'V', 'owner@x.com', 'ceo_admin', 'active'
  from org, auth_owner returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sched@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
)
select org.id as org_id, other_org.id as other_org_id,
       auth_owner.id as auth_owner, auth_sched.id as auth_sched,
       u_owner.id as u_owner, u_sched.id as u_sched
from org, other_org, auth_owner, auth_sched, u_owner, u_sched;

do $$
declare
  f record;
  visible int;
  claimed int;
  evt uuid;
begin
  select * into f from outbox_fixture;
  set local role authenticated;

  -- ============================================== the audit trail ======= --

  raise notice 'A session writes in its own name and nobody else''s';
  perform act_as(f.auth_sched);

  insert into audit_entries (organization_id, actor_type, actor_user_id, action, entity_type)
  values (f.org_id, 'user', f.u_sched, 'schedule.changed', 'visit');
  perform assert(true, 'a scheduler records their own action');

  begin
    insert into audit_entries (organization_id, actor_type, actor_user_id, action, entity_type)
    values (f.org_id, 'user', f.u_owner, 'admission.approved', 'admission');
    perform assert(false, 'a scheduler cannot sign the owner''s name to an approval');
  exception when insufficient_privilege then
    perform assert(true, 'a scheduler cannot sign the owner''s name to an approval');
  end;

  raise notice 'And cannot claim to be the machine';
  begin
    -- The more useful lie of the two: attributing a human action to "system"
    -- makes it nobody's, which is the whole thing an audit trail is against.
    insert into audit_entries (organization_id, actor_type, action, entity_type)
    values (f.org_id, 'system', 'payroll.approved', 'payroll_run');
    perform assert(false, 'a browser session cannot write a system actor');
  exception when insufficient_privilege then
    perform assert(true, 'a browser session cannot write a system actor');
  end;

  raise notice 'Nor into another organization';
  begin
    insert into audit_entries (organization_id, actor_type, actor_user_id, action, entity_type)
    values (f.other_org_id, 'user', f.u_sched, 'schedule.changed', 'visit');
    perform assert(false, 'and not into another organization''s trail');
  exception when insufficient_privilege then
    perform assert(true, 'and not into another organization''s trail');
  end;

  raise notice 'The trail is append-only';
  perform act_as(f.auth_owner);
  select count(*) into visible from audit_entries where organization_id = f.org_id;
  perform assert(visible = 1, 'the owner reads the trail');

  -- Refused at the GRANT, not by a policy — 0003 grants `authenticated` select
  -- and insert on audit_entries and nothing else. That is the stronger of the
  -- two guarantees: a missing policy silently matches zero rows, whereas a
  -- missing grant refuses the statement outright, so a bug that tries to edit
  -- the trail fails loudly instead of appearing to succeed.
  begin
    update audit_entries set action = 'nothing.happened' where organization_id = f.org_id;
    perform assert(false, 'the trail cannot be edited, even by the owner');
  exception when insufficient_privilege then
    perform assert(true, 'the trail cannot be edited, even by the owner');
  end;

  begin
    delete from audit_entries where organization_id = f.org_id;
    perform assert(false, 'nor deleted');
  exception when insufficient_privilege then
    perform assert(true, 'nor deleted');
  end;

  select count(*) into visible from audit_entries
  where organization_id = f.org_id and action = 'schedule.changed';
  perform assert(visible = 1, 'and the entry is still there afterwards');

  raise notice 'A scheduler does not read it at all';
  perform act_as(f.auth_sched);
  select count(*) into visible from audit_entries where organization_id = f.org_id;
  perform assert(visible = 0, 'reading the trail is the owner''s, per 0003');

  -- =============================================== the outbox =========== --

  raise notice 'An application session may queue work and may not take it';
  perform act_as(f.auth_owner);

  insert into domain_events (organization_id, event_type, aggregate_type, idempotency_key)
  values (f.org_id, 'assessment.scheduled', 'admission', 'adm-1:2026-08-24')
  returning id into evt;
  perform assert(evt is not null, 'a session queues an event');

  begin
    insert into domain_events (organization_id, event_type, aggregate_type, idempotency_key)
    values (f.org_id, 'assessment.scheduled', 'admission', 'adm-1:2026-08-24');
    perform assert(false, 'a double-clicked button does not queue the same work twice');
  exception when unique_violation then
    perform assert(true, 'a double-clicked button does not queue the same work twice');
  end;

  begin
    perform claim_domain_events(10, now());
    perform assert(false, 'a browser session cannot claim work off the queue');
  exception when insufficient_privilege then
    -- A tab that claims an event and is then closed has silently swallowed it.
    perform assert(true, 'a browser session cannot claim work off the queue');
  end;

  begin
    perform finish_domain_event(evt, true, now());
    perform assert(false, 'nor mark it done');
  exception when insufficient_privilege then
    perform assert(true, 'nor mark it done');
  end;

  reset role;
end;
$$;

-- ---------------------------------------------------------------------------
-- The worker, which connects with a role that bypasses row level security
-- ---------------------------------------------------------------------------

do $$
declare
  f record;
  first_pass int;
  second_pass int;
  evt uuid;
  st text;
  n int;
begin
  select * into f from outbox_fixture;

  raise notice 'Claiming marks processing in the same statement that selects';
  -- Counted within this fixture's organization. The claim itself is deliberately
  -- org-blind — one worker serves the whole deployment — so when this file runs
  -- after the other suites it also picks up their events, and an unscoped count
  -- would assert the order the suites happened to run in.
  select count(*) into first_pass
  from claim_domain_events(100, now()) where organization_id = f.org_id;
  perform assert(first_pass = 1, 'the worker claims the pending event');

  -- The second worker, running the same minute. It must find nothing, because
  -- the first claim already moved the row out of `pending` — not because it
  -- blocked waiting for a lock.
  select count(*) into second_pass
  from claim_domain_events(100, now()) where organization_id = f.org_id;
  perform assert(second_pass = 0, 'a second worker in the same minute claims nothing');

  select id, status, attempts into evt, st, n
  from domain_events where organization_id = f.org_id limit 1;
  perform assert(st = 'processing', 'the claimed row is processing');
  perform assert(
    n = 1,
    'attempts counted at claim time, so an event that crashes the worker still runs out'
  );

  raise notice 'A failure records where to pick it up again';
  perform finish_domain_event(evt, false, now(), 'Spruce returned 500', now() + interval '5 minutes');
  select status, attempts into st, n from domain_events where id = evt;
  perform assert(st = 'failed', 'the row is failed');
  perform assert(
    (select retry_at from domain_events where id = evt) is not null,
    'and carries when to try again — the column markFailed had nowhere to write to before 0012'
  );

  select count(*) into second_pass
  from claim_domain_events(100, now()) where organization_id = f.org_id;
  perform assert(second_pass = 0, 'and is not re-claimed before its backoff has passed');

  select count(*) into second_pass
  from claim_domain_events(100, now() + interval '6 minutes') where organization_id = f.org_id;
  perform assert(second_pass = 1, 'and is re-claimed once it has');

  raise notice 'Giving up is a real outcome, not a missing value';
  perform finish_domain_event(evt, false, now(), 'Gave up after 5 attempts', null);
  select count(*) into second_pass
  from claim_domain_events(100, now() + interval '1 year') where organization_id = f.org_id;
  perform assert(
    second_pass = 0,
    'an abandoned event is never claimed again — it waits for a person, not a timer'
  );

  raise notice 'Succeeding clears the retry and stamps the time';
  perform finish_domain_event(evt, true, now());
  select status into st from domain_events where id = evt;
  perform assert(st = 'processed', 'a processed event is processed');
  perform assert(
    (select retry_at is null and processed_at is not null from domain_events where id = evt),
    'with no stale retry left behind it'
  );

  raise notice 'ALL AUDIT TRAIL AND OUTBOX ASSERTIONS PASSED';
end;
$$;
