-- Joy Health — invoice approval, and what cannot change afterwards
--
-- §7.2 and §7.3. The claims only the database can hold:
--
--   nothing is collected on an invoice nobody approved and issued
--   an invoice with no lines, or lines that do not sum, cannot be approved
--   after approval the financial content is frozen; corrections are adjustments
--   adjustments are append-only and carry a reason and a name
--   the lifecycle moves along its edges only — no jumps
--   void-and-reissue works: a written-off week can be billed again
--   payroll reads the invoice but not the lines, because lines carry the rate
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

create temporary table appr_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — approvals') returning id
),
-- Fictional, as clients must be.
client_p as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Evelyn', 'Carter' from org returning id
),
payer as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Diane', 'Miller' from org returning id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'own@x.com') returning id),
auth_bill  as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_pay   as (insert into auth.users (id, email) values (gen_random_uuid(), 'pay@x.com') returning id),
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
u_pay as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_pay.id, 'Pay', 'Roll', 'pay@x.com', 'payroll', 'active'
  from org, auth_pay returning id
),
acct as (
  insert into billing_accounts (organization_id, payer_person_id, billing_email)
  select org.id, payer.id, 'diane@example.com' from org, payer returning id
)
select org.id as org_id, client_p.id as client_p, payer.id as payer, acct.id as acct,
       auth_owner.id as auth_owner, auth_bill.id as auth_bill, auth_pay.id as auth_pay,
       u_owner.id as u_owner, u_bill.id as u_bill
from org, client_p, payer, acct, auth_owner, auth_bill, auth_pay, u_owner, u_bill, u_pay;

do $$
declare
  f record;
  inv uuid;
  reissued uuid;
  visible int;
begin
  select * into f from appr_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  raise notice 'A draft is not yet a debt';
  insert into issued_invoices (
    organization_id, client_person_id, billing_account_id,
    week_start, week_end, total, status
  )
  values (f.org_id, f.client_p, f.acct, '2026-08-24', '2026-08-30', 480, 'draft')
  returning id into inv;

  perform assert(
    (select issued_on from issued_invoices where id = inv) is null,
    'a draft needs no issue date — it has not been sent'
  );

  begin
    insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
    values (f.org_id, inv, 480, current_date, 'ach', f.u_bill);
    perform assert(false, 'money against a draft was refused');
  exception when check_violation then
    -- §7.2 step 7. This exact hole existed for one migration: with issued_on
    -- nullable, 0013''s date comparison went NULL and waved the payment through.
    perform assert(true, 'money against a draft was refused');
  end;

  begin
    insert into invoice_adjustments (organization_id, invoice_id, kind, amount, reason, created_by_user_id)
    values (f.org_id, inv, 'credit', 50, 'testing', f.u_bill);
    perform assert(false, 'an adjustment on a draft was refused');
  exception when check_violation then
    perform assert(true, 'an adjustment on a draft was refused — edit the draft instead');
  end;

  raise notice 'Approval needs lines that add up';
  begin
    update issued_invoices
    set status = 'pending_approval', submitted_by_user_id = f.u_bill, submitted_at = now()
    where id = inv;
    update issued_invoices
    set status = 'approved', approved_by_user_id = f.u_bill, approved_at = now()
    where id = inv;
    perform assert(false, 'approving an invoice with no lines was refused');
  exception when check_violation then
    perform assert(true, 'approving an invoice with no lines was refused');
  end;

  -- Back to draft to add the lines (the failed approval rolled the whole
  -- block back, including the submission — resubmit below).
  insert into invoice_lines (organization_id, invoice_id, description, service_date,
                             quantity, unit_label, unit_rate, amount)
  values
    (f.org_id, inv, 'Personal care', '2026-08-24', 8, 'hours', 30, 240),
    (f.org_id, inv, 'Personal care', '2026-08-26', 8, 'hours', 30, 240);

  begin
    insert into invoice_lines (organization_id, invoice_id, description,
                               quantity, unit_rate, amount)
    values (f.org_id, inv, 'Care', 4, 30, 999);
    perform assert(false, 'a line whose amount is not its own arithmetic was refused');
  exception when check_violation then
    perform assert(true, 'a line whose amount is not its own arithmetic was refused');
  end;

  update issued_invoices
  set status = 'pending_approval', submitted_by_user_id = f.u_bill, submitted_at = now()
  where id = inv;

  begin
    update issued_invoices set total = 500 where id = inv;
    update issued_invoices
    set status = 'approved', approved_by_user_id = f.u_bill, approved_at = now()
    where id = inv;
    perform assert(false, 'lines summing to 480 against a total of 500 was refused');
  exception when check_violation then
    perform assert(true, 'lines summing to 480 against a total of 500 was refused');
  end;

  update issued_invoices set total = 480 where id = inv;
  update issued_invoices
  set status = 'approved', approved_by_user_id = f.u_bill, approved_at = now()
  where id = inv;
  perform assert(
    (select status from issued_invoices where id = inv) = 'approved',
    'with lines that sum, approval goes through with a name on it'
  );

  raise notice 'After approval, the content is frozen';
  begin
    update issued_invoices set total = 400 where id = inv;
    perform assert(false, 'changing an approved total was refused');
  exception when check_violation then
    perform assert(true, 'changing an approved total was refused');
  end;

  begin
    insert into invoice_lines (organization_id, invoice_id, description, quantity, unit_rate, amount)
    values (f.org_id, inv, 'One more hour', 1, 30, 30);
    perform assert(false, 'adding a line after approval was refused');
  exception when check_violation then
    perform assert(true, 'adding a line after approval was refused');
  end;

  begin
    update issued_invoices set approved_by_user_id = f.u_owner where id = inv;
    perform assert(false, 'rewriting who approved it was refused');
  exception when check_violation then
    perform assert(true, 'rewriting who approved it was refused');
  end;

  raise notice 'The lifecycle moves along its edges only';
  begin
    update issued_invoices set status = 'settled' where id = inv;
    perform assert(false, 'approved jumping straight to settled was refused');
  exception when check_violation then
    perform assert(true, 'approved jumping straight to settled was refused');
  end;

  update issued_invoices
  set status = 'issued', issued_on = current_date, issued_by_user_id = f.u_bill,
      due_on = current_date + 1, finalized_at = now()
  where id = inv;
  perform assert(
    (select status from issued_invoices where id = inv) = 'issued',
    'approved becomes issued, with the issue facts present'
  );

  raise notice 'Corrections are adjustments, in the open';
  insert into invoice_adjustments (organization_id, invoice_id, kind, amount, reason, created_by_user_id)
  values (f.org_id, inv, 'credit', 80, 'One visit ran short; the family should not pay for the missing hours.', f.u_bill);

  perform assert(invoice_balance(inv) = 400, 'a credit moves the balance without touching the total');

  begin
    update invoice_adjustments set amount = 100 where invoice_id = inv;
    perform assert(
      (select count(*) from invoice_adjustments where invoice_id = inv and amount = 100) = 0,
      'an adjustment cannot be edited'
    );
  exception when insufficient_privilege then
    perform assert(true, 'an adjustment cannot be edited');
  end;

  insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
  values (f.org_id, inv, 400, current_date, 'ach', f.u_bill);
  perform assert(
    (select status from issued_invoices where id = inv) = 'settled',
    'the adjusted balance is what the payment settles'
  );

  raise notice 'And a debit adjustment reopens what it unsettles';
  -- The reason settled → issued is a legal edge at all: the balance moved back
  -- above zero, and a settled status over an open balance is a lie the ageing
  -- report would repeat.
  insert into invoice_adjustments (organization_id, invoice_id, kind, amount, reason, created_by_user_id)
  values (f.org_id, inv, 'debit', 30,
          'Card fee passed through per the agreement; missed from the draft.', f.u_bill);
  perform assert(
    (select status from issued_invoices where id = inv) = 'issued',
    'a debit on a settled invoice reopens it'
  );
  perform assert(invoice_balance(inv) = 30, 'and the balance says exactly what is left');
end;
$$;

do $$
declare
  f record;
  inv uuid;
  reissued uuid;
  visible int;
begin
  select * into f from appr_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  raise notice 'Void and reissue';
  insert into issued_invoices (
    organization_id, client_person_id, billing_account_id,
    week_start, week_end, total, status,
    issued_on, issued_by_user_id, due_on
  )
  values (f.org_id, f.client_p, f.acct, '2026-08-31', '2026-09-06', 300, 'issued',
          current_date, f.u_bill, current_date + 1)
  returning id into inv;

  update issued_invoices
  set status = 'written_off', written_off_on = current_date,
      written_off_by_user_id = f.u_bill,
      written_off_reason = 'Priced from the wrong week — voided and reissued.'
  where id = inv;

  insert into issued_invoices (
    organization_id, client_person_id, billing_account_id,
    week_start, week_end, total, status,
    issued_on, issued_by_user_id, due_on
  )
  values (f.org_id, f.client_p, f.acct, '2026-08-31', '2026-09-06', 240, 'issued',
          current_date, f.u_bill, current_date + 1)
  returning id into reissued;

  perform assert(reissued is not null,
    'the corrected invoice takes the week — 0013''s index made this impossible');

  begin
    insert into issued_invoices (
      organization_id, client_person_id, billing_account_id,
      week_start, week_end, total, status, issued_on, issued_by_user_id, due_on
    )
    values (f.org_id, f.client_p, f.acct, '2026-08-31', '2026-09-06', 240, 'issued',
            current_date, f.u_bill, current_date + 1);
    perform assert(false, 'but two LIVE invoices for one week are still refused');
  exception when unique_violation then
    perform assert(true, 'but two live invoices for one week are still refused');
  end;

  raise notice 'A draft can be deleted; anything acted on cannot';
  insert into issued_invoices (
    organization_id, client_person_id, billing_account_id,
    week_start, week_end, total, status
  )
  values (f.org_id, f.client_p, f.acct, '2026-09-07', '2026-09-13', 100, 'draft')
  returning id into inv;

  delete from issued_invoices where id = inv;
  perform assert(
    (select count(*) from issued_invoices where id = inv) = 0,
    'a draft nobody acted on can be thrown away'
  );

  delete from issued_invoices where id = reissued;
  perform assert(
    (select count(*) from issued_invoices where id = reissued) = 1,
    'an issued invoice cannot — the policy matches no row'
  );

  raise notice 'Lines carry the rate, so payroll does not read them';
  perform act_as(f.auth_pay);
  select count(*) into visible from issued_invoices;
  perform assert(visible > 0, 'payroll reads invoices, as 0013 decided');
  select count(*) into visible from invoice_lines;
  perform assert(visible = 0,
    'but no lines — a line says what an hour costs a family, which is a rate');
  select count(*) into visible from invoice_adjustments;
  perform assert(visible = 0, 'and no adjustments');

  raise notice 'ALL INVOICE APPROVAL ASSERTIONS PASSED';
end;
$$;
