-- Joy Health — the weekly billing run's record
--
-- The claims only the database can hold:
--
--   a run is append-only — what Joy did on a date is not editable
--   a hold requires a reason, and a lifted hold does not keep a stale one
--   a run's exceptions carry words, not just a kind
--   a scheduler reads none of it; a caregiver reads none of it
--
-- Every assertion runs as `authenticated`. RLS is bypassed for the table owner.

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

create temporary table run_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — runs') returning id
),
client_p as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
payer as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
auth_bill  as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
u_bill as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_bill.id, 'Bill', 'Ing', 'bill@x.com', 'billing', 'active'
  from org, auth_bill returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sch@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
),
acct as (
  insert into billing_accounts (organization_id, payer_person_id, billing_email)
  select org.id, payer.id, 'susan@example.com' from org, payer returning id
)
select org.id as org_id, client_p.id as client_p, acct.id as acct,
       auth_bill.id as auth_bill, auth_sched.id as auth_sched, u_bill.id as u_bill
from org, client_p, payer, acct, auth_bill, auth_sched, u_bill, u_sched;

do $$
declare
  f record;
  run uuid;
  visible int;
begin
  select * into f from run_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  raise notice 'A run is a fact about a date';
  insert into billing_runs (organization_id, period_start, period_end, snapshot_hash,
                            drafts_created, exceptions_found, created_by_user_id)
  values (f.org_id, '2026-08-24', '2026-08-30', 'a1b2c3d4', 3, 1, f.u_bill)
  returning id into run;

  insert into billing_run_exceptions (organization_id, billing_run_id, kind,
                                      client_person_id, detail, blocks_draft)
  values (f.org_id, run, 'missing_rate', f.client_p,
          'No rate is in effect for the week of 2026-08-24.', true);

  begin
    update billing_runs set drafts_created = 99 where id = run;
    perform assert(
      (select drafts_created from billing_runs where id = run) = 3,
      'a run cannot be rewritten'
    );
  exception when insufficient_privilege then
    perform assert(true, 'a run cannot be rewritten');
  end;

  begin
    delete from billing_runs where id = run;
    perform assert(
      (select count(*) from billing_runs where id = run) = 1,
      'nor deleted'
    );
  exception when insufficient_privilege then
    perform assert(true, 'nor deleted');
  end;

  begin
    insert into billing_run_exceptions (organization_id, billing_run_id, kind, detail, blocks_draft)
    values (f.org_id, run, 'account_hold', '   ', true);
    perform assert(false, 'an exception with no words was refused');
  exception when check_violation then
    perform assert(true, 'an exception with no words was refused');
  end;

  raise notice 'A hold explains itself';
  begin
    update billing_accounts set on_hold = true where id = f.acct;
    perform assert(false, 'a hold with no reason was refused');
  exception when check_violation then
    -- Three weeks later, a pause with no reason is indistinguishable from a bug.
    perform assert(true, 'a hold with no reason was refused');
  end;

  update billing_accounts
  set on_hold = true, hold_reason = 'Family conversation in progress.'
  where id = f.acct;
  perform assert(
    (select on_hold from billing_accounts where id = f.acct),
    'with the reason written down, the hold stands'
  );

  begin
    update billing_accounts set on_hold = false where id = f.acct;
    perform assert(false, 'lifting the hold but keeping the reason was refused');
  exception when check_violation then
    -- A stale reason on a lifted hold reads as a live one.
    perform assert(true, 'lifting the hold but keeping the reason was refused');
  end;

  update billing_accounts set on_hold = false, hold_reason = null where id = f.acct;
  perform assert(
    (select hold_reason from billing_accounts where id = f.acct) is null,
    'lifted cleanly, nothing lingers'
  );

  raise notice 'A run is billing''s business';
  perform act_as(f.auth_sched);
  select count(*) into visible from billing_runs;
  perform assert(visible = 0, 'a scheduler reads no runs');
  select count(*) into visible from billing_run_exceptions;
  perform assert(visible = 0,
    'and no exceptions — who was not billed and why is not scheduling information');

  raise notice 'ALL BILLING RUN ASSERTIONS PASSED';
end;
$$;
