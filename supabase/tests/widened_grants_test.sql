-- Joy Health — widened portal grants and the family finance read
--
-- WRITTEN BEFORE THE MIGRATION, deliberately. 0013 gives families nothing,
-- which is safe; widening is the risky direction, and the Phase 0 plan
-- requires these assertions to exist before any policy widens. The claims:
--
--   a family member with view_invoices reads their client's SENT invoices
--   a draft is internal and never reaches a family
--   the family view carries no approver, snapshot, run or write-off column
--   a grant without view_invoices reads nothing financial
--   a revoked, expired, or not-yet-effective grant reads nothing
--   another family's grant reads nothing of this client
--   a workforce grant carries no finance role or actions at all
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

create temporary table wg_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — grants') returning id
),
-- Clients are fictional. Being a care recipient is health information.
client_a as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
client_b as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Evelyn', 'Carter' from org returning id
),
daughter as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
son as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Tom', 'Bell' from org returning id
),
neighbour as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Lian', 'Huang' from org returning id
),
cp_a as (
  insert into client_profiles (person_id, client_status) select id, 'active' from client_a returning person_id
),
cp_b as (
  insert into client_profiles (person_id, client_status) select id, 'active' from client_b returning person_id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'own@x.com') returning id),
auth_bill as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_dau  as (insert into auth.users (id, email) values (gen_random_uuid(), 'susan@x.com') returning id),
auth_son  as (insert into auth.users (id, email) values (gen_random_uuid(), 'tom@x.com') returning id),
auth_nei  as (insert into auth.users (id, email) values (gen_random_uuid(), 'lian@x.com') returning id),
u_owner as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_owner.id, 'Karynn', 'V', 'own@x.com', 'ceo_admin', 'active'
  from org, auth_owner returning id
),
u_bill as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_bill.id, 'Bill', 'Ing', 'bill@x.com', 'billing', 'active'
  from org, auth_bill returning id
),
u_dau as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_dau.id, daughter.id, 'Susan', 'Bell', 'susan@x.com', 'client_contact', 'active'
  from org, auth_dau, daughter returning id
),
u_son as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_son.id, son.id, 'Tom', 'Bell', 'tom@x.com', 'client_contact', 'active'
  from org, auth_son, son returning id
),
u_nei as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_nei.id, neighbour.id, 'Lian', 'Huang', 'lian@x.com', 'client_contact', 'active'
  from org, auth_nei, neighbour returning id
),
-- Susan pays for her father and may see and pay invoices.
g_dau as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state,
                             role, allowed_actions, effective_from)
  select org.id, 'family', daughter.id, client_a.id, 'active',
         'responsible_party', array['view_invoices', 'pay_invoice'], current_date - 30
  from org, daughter, client_a returning id
),
-- Tom sees care updates only. Money is not his lane, on purpose.
g_son as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state,
                             role, allowed_actions, effective_from)
  select org.id, 'family', son.id, client_a.id, 'active',
         'family_viewer', array['view_care_updates'], current_date - 30
  from org, son, client_a returning id
),
-- Lian is authorised for Evelyn, and for Evelyn only.
g_nei as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state,
                             role, allowed_actions, effective_from)
  select org.id, 'family', neighbour.id, client_b.id, 'active',
         'responsible_party', array['view_invoices'], current_date - 30
  from org, neighbour, client_b returning id
),
inv_sent as (
  insert into issued_invoices (organization_id, client_person_id, week_start, week_end,
                               total, status, issued_on, issued_by_user_id, due_on)
  select org.id, client_a.id, '2026-08-10', '2026-08-16', 480, 'issued',
         '2026-08-10', u_bill.id, '2026-08-11'
  from org, client_a, u_bill returning id
),
inv_draft as (
  insert into issued_invoices (organization_id, client_person_id, week_start, week_end,
                               total, status)
  select org.id, client_a.id, '2026-08-24', '2026-08-30', 360, 'draft'
  from org, client_a returning id
),
pay as (
  insert into payments (organization_id, invoice_id, amount, received_on, method,
                        reference, recorded_by_user_id)
  select org.id, inv_sent.id, 200, '2026-08-12', 'check', 'chq 1042', u_bill.id
  from org, inv_sent, u_bill returning id
)
select org.id as org_id, client_a.id as client_a, client_b.id as client_b,
       daughter.id as daughter, son.id as son, neighbour.id as neighbour,
       g_dau.id as g_dau, inv_sent.id as inv_sent, inv_draft.id as inv_draft,
       u_owner.id as u_owner,
       auth_owner.id as auth_owner, auth_bill.id as auth_bill, auth_dau.id as auth_dau,
       auth_son.id as auth_son, auth_nei.id as auth_nei
from org, client_a, client_b, daughter, son, neighbour, cp_a, cp_b,
     auth_owner, auth_bill, auth_dau, auth_son, auth_nei,
     u_owner, u_bill, u_dau, u_son, u_nei, g_dau, g_son, g_nei, inv_sent, inv_draft, pay;

do $$
declare
  f record;
  visible int;
  cols int;
begin
  select * into f from wg_fixture;
  set local role authenticated;

  -- ------------------------------------------------- the grant's own shape --
  -- Issuing a portal stayed where 0006 put it: ceo_admin, hr, intake. Billing
  -- collects money; it does not mint access.
  perform act_as(f.auth_owner);

  raise notice 'A grant says what it allows, in a closed vocabulary';
  begin
    insert into portal_grants (organization_id, audience, person_id, subject_person_id,
                               state, role, allowed_actions)
    values (f.org_id, 'family', f.daughter, f.client_b, 'active',
            'responsible_party', array['view_invoices', 'transfer_funds']);
    perform assert(false, 'an unknown allowed action was refused');
  exception when check_violation then
    -- 'transfer_funds' is not a thing Joy offers. An open vocabulary is how a
    -- typo becomes a permission.
    perform assert(true, 'an unknown allowed action was refused');
  end;

  begin
    insert into portal_grants (organization_id, audience, person_id, subject_person_id,
                               state, allowed_actions)
    values (f.org_id, 'family', f.daughter, f.client_b, 'active', array['view_invoices']);
    perform assert(false, 'a family grant with no role was refused');
  exception when check_violation then
    perform assert(true, 'a family grant with no role was refused');
  end;

  begin
    insert into portal_grants (organization_id, audience, person_id, state, role)
    values (f.org_id, 'workforce', f.daughter, 'active', 'responsible_party');
    perform assert(false, 'a finance role on a workforce grant was refused');
  exception when check_violation then
    -- The workforce portal is not a finance surface. A caregiver grant that
    -- quietly carried view_invoices would be J-06 undone by a default.
    perform assert(true, 'a finance role on a workforce grant was refused');
  end;

  begin
    update portal_grants set effective_to = effective_from - 1 where id = f.g_dau;
    perform assert(false, 'a backwards effective window was refused');
  exception when check_violation then
    perform assert(true, 'a backwards effective window was refused');
  end;

  -- --------------------------------------------------- the family read --
  perform act_as(f.auth_dau);

  raise notice 'Susan, who pays for her father';
  select count(*) into visible from family_invoices where id = f.inv_sent;
  perform assert(visible = 1, 'reads his sent invoice');

  select count(*) into visible from family_invoices where id = f.inv_draft;
  perform assert(visible = 0, 'and never a draft — unapproved is internal (§7.2 step 7)');

  perform assert(
    (select balance_due from family_invoices where id = f.inv_sent) = 280,
    'sees the balance after her cheque, computed from the same function billing uses'
  );

  select count(*) into visible from family_payments;
  perform assert(visible = 1, 'reads the payment history on her own invoices');

  raise notice 'And the view is the sanitisation (§9.3)';
  select count(*) into cols from information_schema.columns
   where table_name = 'family_invoices'
     and column_name in ('issued_by_user_id', 'approved_by_user_id', 'submitted_by_user_id',
                         'source_snapshot_hash', 'billing_run_id', 'written_off_reason',
                         'rate_plan_version_id');
  perform assert(cols = 0, 'no approver, no snapshot, no run, no write-off reason, no rate version');

  raise notice 'Tom, who is authorised for care updates only';
  perform act_as(f.auth_son);
  select count(*) into visible from family_invoices;
  perform assert(visible = 0, 'reads no invoice — his grant does not say view_invoices');
  select count(*) into visible from family_payments;
  perform assert(visible = 0, 'and no payments');

  raise notice 'Lian, authorised for a different client';
  perform act_as(f.auth_nei);
  select count(*) into visible from family_invoices;
  perform assert(visible = 0, 'reads nothing of Marcus — the grant is per client');

  raise notice 'A grant that has lapsed reads nothing';
  perform act_as(f.auth_owner);
  update portal_grants set effective_to = current_date - 1 where id = f.g_dau;
  perform act_as(f.auth_dau);
  select count(*) into visible from family_invoices;
  perform assert(visible = 0, 'an expired grant reads nothing');

  perform act_as(f.auth_owner);
  update portal_grants
  set effective_to = null, effective_from = current_date + 7 where id = f.g_dau;
  perform act_as(f.auth_dau);
  select count(*) into visible from family_invoices;
  perform assert(visible = 0, 'a grant that has not started yet reads nothing either');

  perform act_as(f.auth_owner);
  -- Revocation is attributed — 0009's rule, and this suite honours it.
  update portal_grants
  set effective_from = current_date - 30, active = false,
      revoked_at = now(), revoked_by_user_id = f.u_owner,
      revoked_reason = 'no_longer_involved'
  where id = f.g_dau;
  perform act_as(f.auth_dau);
  select count(*) into visible from family_invoices;
  perform assert(visible = 0, 'a revoked grant reads nothing, immediately');

  raise notice 'ALL WIDENED GRANT ASSERTIONS PASSED';
end;
$$;
