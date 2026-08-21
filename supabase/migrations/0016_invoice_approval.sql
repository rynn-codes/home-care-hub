-- Joy Health — invoice approval, lines, adjustments, and what cannot change
--
-- §7.2 and §7.3 of the billing specification, Phase 1 step 3.
--
-- 0013 records an invoice at the moment it is SENT, which was the right first
-- cut: a computed week is not a debt. What it cannot represent is everything
-- before the send — §7.2's flow, where a draft is generated from a snapshot,
-- somebody reviews it, somebody approves it, and only then does it go out.
-- Step 7 of that flow is the rule with teeth: nothing is collected on an
-- invoice nobody approved. Today the gap between "computed" and "sent" lives in
-- Karynn's head, which works until the week it doesn't.
--
-- A DELIBERATE DEPARTURE FROM THE PHASE 0 PROPOSAL. PROPOSED_MIGRATIONS.md
-- suggested replacing the update policy with one permitting updates only while
-- draft or pending_approval. Read literally, that forbids the transitions the
-- flow needs — approving IS an update, so is issuing, so is a write-off — and
-- would have broken the 0013 write-off path the day it landed. The intent is
-- narrower and better said as a trigger: after approval, the FINANCIAL CONTENT
-- is frozen and only whitelisted state transitions move. Same shape as
-- confirmed charts (0008), live care plans (0010) and verified units (0015).

-- ---------------------------------------------------------------------------
-- The lifecycle
-- ---------------------------------------------------------------------------

-- 0013's enum was issued → settled / written_off. §7.2 adds everything before
-- the send, §7.4 adds what a charge in flight and a dispute look like.
alter type invoice_status add value 'draft'            before 'issued';
alter type invoice_status add value 'pending_approval' before 'issued';
alter type invoice_status add value 'approved'         before 'issued';
alter type invoice_status add value 'processing'       after  'issued';
alter type invoice_status add value 'disputed'         after  'settled';
alter type invoice_status add value 'uncollectible'    after  'disputed';

-- A draft has not been issued, so the issue-time facts cannot be not-null any
-- more. The check below keeps the old guarantee exactly where it applied: from
-- 'issued' onward, all three are present.
alter table issued_invoices alter column issued_on         drop not null;
alter table issued_invoices alter column issued_by_user_id drop not null;
alter table issued_invoices alter column due_on            drop not null;

-- billing_account_id and rate_plan_version_id arrived in 0014.
alter table issued_invoices
  -- Hash of the inputs the draft was generated from, so "has anything changed
  -- since this was reviewed" is a comparison rather than a memory.
  add column source_snapshot_hash text,
  add column submitted_by_user_id uuid references users (id) on delete restrict,
  add column submitted_at         timestamptz,
  add column approved_by_user_id  uuid references users (id) on delete restrict,
  add column approved_at          timestamptz,
  add column finalized_at         timestamptz;

alter table issued_invoices
  add constraint issued_invoices_issue_facts_present check (
    status in ('draft', 'pending_approval', 'approved')
    or (issued_on is not null and issued_by_user_id is not null and due_on is not null)
  ),
  -- Attribution comes in pairs: a name with no time, or a time with no name,
  -- is half a fact.
  add constraint issued_invoices_submission_is_attributed check (
    (submitted_by_user_id is null) = (submitted_at is null)
  ),
  add constraint issued_invoices_approval_is_attributed check (
    (approved_by_user_id is null) = (approved_at is null)
  ),
  -- Nothing past pending_approval without an approval on record — except the
  -- pre-0016 path, where an invoice is recorded at the moment of sending by
  -- the person sending it. That path stays legal on INSERT only; the trigger
  -- below refuses it as a transition.
  add constraint issued_invoices_pending_is_submitted check (
    status <> 'pending_approval' or submitted_by_user_id is not null
  );

-- One invoice per client per week — among invoices that still count. 0013's
-- index had no predicate, which quietly made §7.3's void-and-reissue
-- impossible: the corrected invoice could never be created because the
-- written-off one still occupied the week.
drop index issued_invoices_one_per_client_week;
create unique index issued_invoices_one_per_client_week
  on issued_invoices (client_person_id, week_start)
  where status <> 'written_off';

-- ---------------------------------------------------------------------------
-- Lines
-- ---------------------------------------------------------------------------

create table invoice_lines (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations (id) on delete cascade,
  -- Cascade: lines are part of the invoice, and the only deletable invoice is
  -- a draft nobody has acted on.
  invoice_id           uuid not null references issued_invoices (id) on delete cascade,

  -- SANITIZED, and that is a rule, not a hope. §12: a line says "Personal care,
  -- 4 hours" — it never carries a diagnosis, a task detail, a chart narrative
  -- or a wage. There is deliberately no column for any of those, which is the
  -- strongest sanitisation available: what is not there cannot leak.
  description          text not null,
  service_date         date,

  quantity             numeric(7, 2) not null,
  unit_label           text not null default 'hours',
  -- The CLIENT rate, possibly multiplied (time and a half is a higher rate on
  -- the line, said in the description). Never a wage — §6.3.
  unit_rate            numeric(10, 2) not null,
  amount               numeric(10, 2) not null,

  -- Where the figure came from: the verified unit, mostly. "manual" is a line
  -- somebody typed, which is allowed and visible as itself.
  source_type          text not null default 'manual',
  source_record_id     uuid,
  rate_plan_version_id uuid references rate_plan_versions (id) on delete restrict,

  created_at           timestamptz not null default now(),

  constraint invoice_lines_quantity_positive check (quantity > 0),
  constraint invoice_lines_says_something check (length(btrim(description)) > 0),
  -- The line must be its own arithmetic. A stated amount that is not
  -- quantity × rate is a number nobody can check from the page it is on.
  constraint invoice_lines_amount_is_the_arithmetic check (
    amount = round(quantity * unit_rate, 2)
  )
);

create index invoice_lines_invoice_idx on invoice_lines (invoice_id);

comment on table invoice_lines is
  'What an invoice says, line by line. Sanitized by construction: there is no column for a wage, a diagnosis or a chart detail, per §12 of the billing specification.';

-- Lines change only while the invoice is a draft. Once submitted, the reviewer
-- must be looking at what will be approved; once approved, §7.3 applies and
-- corrections are adjustments.
create or replace function invoice_lines_only_while_draft()
returns trigger
language plpgsql
as $$
declare
  st invoice_status;
begin
  select status into st from issued_invoices where id = coalesce(new.invoice_id, old.invoice_id);
  -- Parent already gone: this is the cascade from deleting a draft.
  if st is null then return coalesce(new, old); end if;
  if st <> 'draft' then
    raise exception
      'This invoice is % — its lines are settled. Send it back to draft to edit, or correct it with an adjustment.', st
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger invoice_lines_draft_only
  before insert or update or delete on invoice_lines
  for each row execute function invoice_lines_only_while_draft();

-- ---------------------------------------------------------------------------
-- Adjustments
-- ---------------------------------------------------------------------------

create type adjustment_kind as enum ('credit', 'debit', 'write_off');

-- §7.3: after approval, an invoice is corrected by adjustment, in the open,
-- with a reason — never by editing what was approved.
create table invoice_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  invoice_id          uuid not null references issued_invoices (id) on delete restrict,

  kind                adjustment_kind not null,
  -- Always positive; the kind carries the direction. A signed amount and a
  -- kind would be two ways to say the same thing, which is one way to disagree.
  amount              numeric(10, 2) not null,
  reason              text not null,

  created_by_user_id  uuid not null references users (id) on delete restrict,
  created_at          timestamptz not null default now(),

  constraint invoice_adjustments_amount_positive check (amount > 0),
  constraint invoice_adjustments_reason_given check (length(btrim(reason)) > 0)
);

create index invoice_adjustments_invoice_idx on invoice_adjustments (invoice_id);

comment on table invoice_adjustments is
  'The only way a figure changes after approval. Append-only: an adjustment that was wrong is corrected by another adjustment, so the record of what Joy told a family is never rewritten.';

-- An adjustment corrects a settled statement. While the invoice is a draft
-- there is nothing to correct — edit the draft.
create or replace function adjustment_needs_an_approved_invoice()
returns trigger
language plpgsql
as $$
declare
  st invoice_status;
begin
  select status into st from issued_invoices where id = new.invoice_id;
  if st in ('draft', 'pending_approval') then
    raise exception
      'This invoice is %. Adjustments correct approved invoices — edit the draft instead.', st
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger invoice_adjustments_after_approval
  before insert on invoice_adjustments
  for each row execute function adjustment_needs_an_approved_invoice();

-- ---------------------------------------------------------------------------
-- The lifecycle guard
-- ---------------------------------------------------------------------------

create or replace function guard_invoice_lifecycle()
returns trigger
language plpgsql
as $$
declare
  line_total numeric;
  line_count int;
begin
  -- Attribution, once written, is history.
  if (old.submitted_at is not null
      and (new.submitted_at is distinct from old.submitted_at
           or new.submitted_by_user_id is distinct from old.submitted_by_user_id))
     or (old.approved_at is not null
         and (new.approved_at is distinct from old.approved_at
              or new.approved_by_user_id is distinct from old.approved_by_user_id)) then
    raise exception 'Who submitted or approved an invoice, and when, is not editable.'
      using errcode = 'check_violation';
  end if;

  -- After approval — or from 'issued' onward, which covers pre-0016 invoices
  -- that never had an approval step — the financial content is frozen.
  if old.approved_at is not null or old.status not in ('draft', 'pending_approval') then
    if new.total is distinct from old.total
       or new.week_start is distinct from old.week_start
       or new.week_end is distinct from old.week_end
       or new.client_person_id is distinct from old.client_person_id
       or new.billing_account_id is distinct from old.billing_account_id
       or new.rate_plan_version_id is distinct from old.rate_plan_version_id
       or new.source_snapshot_hash is distinct from old.source_snapshot_hash then
      raise exception
        'This invoice is approved. What it says is what was approved — correct it with an adjustment, or void it and reissue.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'            and new.status = 'pending_approval')
      or (old.status = 'pending_approval' and new.status in ('draft', 'approved'))
      or (old.status = 'approved'      and new.status = 'issued')
      or (old.status = 'issued'        and new.status in ('processing', 'settled', 'disputed', 'uncollectible', 'written_off'))
      or (old.status = 'processing'    and new.status in ('issued', 'settled', 'disputed'))
      -- A settled invoice reopens when the money that settled it is corrected.
      or (old.status = 'settled'       and new.status = 'issued')
      or (old.status = 'disputed'      and new.status in ('issued', 'settled', 'uncollectible', 'written_off'))
      -- Uncollectible is a judgement, not a grave: collection can resume, or
      -- the balance is written off properly, with a name and a reason.
      or (old.status = 'uncollectible' and new.status in ('issued', 'written_off'))
    ) then
      raise exception 'An invoice does not go from % to %.', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Approving is the step with teeth. An invoice with no lines is a bare
    -- number nobody can check; lines that do not sum to the total are two
    -- different invoices wearing one id.
    if new.status = 'approved' then
      select coalesce(sum(amount), 0), count(*) into line_total, line_count
      from invoice_lines where invoice_id = old.id;
      if line_count = 0 then
        raise exception 'An invoice with no lines cannot be approved. What would the family be agreeing to?'
          using errcode = 'check_violation';
      end if;
      if line_total <> new.total then
        raise exception 'The lines sum to % but the invoice says %. One of them is wrong.',
          line_total, new.total
          using errcode = 'check_violation';
      end if;
      if new.approved_by_user_id is null then
        raise exception 'Approving an invoice is somebody''s decision and needs their name.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger issued_invoices_lifecycle
  before update on issued_invoices
  for each row execute function guard_invoice_lifecycle();

-- ---------------------------------------------------------------------------
-- Money against an unissued invoice, and the balance
-- ---------------------------------------------------------------------------

-- 0013's version had a hole this migration opens up: with issued_on nullable,
-- `received_on < sent` against a null issue date is NULL, the branch is
-- skipped, and a payment lands on a draft. §7.2 step 7 is the rule: nothing is
-- collected on an invoice that has not been approved and issued.
create or replace function payment_after_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv record;
begin
  select issued_on, status into inv from issued_invoices where id = new.invoice_id;
  if inv is null then
    raise exception 'That invoice is not on file.' using errcode = 'foreign_key_violation';
  end if;
  if inv.issued_on is null or inv.status in ('draft', 'pending_approval', 'approved') then
    raise exception
      'This invoice has not been issued. Nothing is collected on an invoice nobody approved and sent.'
      using errcode = 'check_violation';
  end if;
  if new.received_on < inv.issued_on then
    raise exception
      'A payment cannot arrive before the invoice was sent (invoice issued %, payment dated %). Check the date, or the invoice.',
      inv.issued_on, new.received_on
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- What is left to pay: the approved total, moved only by adjustments — the
-- open, attributed corrections — and by money. Same reasoning as 0013 for not
-- caching it: two records of one fact is one disagreement waiting.
create or replace function invoice_balance(invoice uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.total
    + coalesce((select sum(a.amount) from invoice_adjustments a
                where a.invoice_id = i.id and a.kind = 'debit'), 0)
    - coalesce((select sum(a.amount) from invoice_adjustments a
                where a.invoice_id = i.id and a.kind in ('credit', 'write_off')), 0)
    - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)
  from issued_invoices i
  where i.id = invoice;
$$;

-- The settle rule now has more states to respect. 0013's version flattened
-- everything that was not written off to issued-or-settled — with disputes in
-- the model, a partial payment on a disputed invoice must not quietly close
-- the dispute.
create or replace function settle_invoice_when_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update issued_invoices
  set status = case
        when invoice_balance(target) <= 0 and status in ('issued', 'processing') then 'settled'
        when invoice_balance(target) > 0 and status = 'settled' then 'issued'
        else status
      end::invoice_status
  where id = target;
  return null;
end;
$$;

-- An adjustment moves the balance, so it can settle or reopen an invoice
-- exactly as money can.
create trigger adjustments_settle_invoice
  after insert on invoice_adjustments
  for each row execute function settle_invoice_when_paid();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table invoice_lines       enable row level security;
alter table invoice_adjustments enable row level security;

-- Lines carry the CLIENT RATE, and payroll does not read rates — the same
-- boundary billing_accounts_test proves for rate_plan_versions, kept
-- consistent here. Payroll still reads the invoice and its total (0013);
-- what an hour costs a family is not payroll's business.
grant select on invoice_lines to authenticated;
grant insert, update, delete on invoice_lines to authenticated;

create policy invoice_lines_read on invoice_lines
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy invoice_lines_write on invoice_lines
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );
create policy invoice_lines_update on invoice_lines
  for update using (organization_id = current_org_id() and has_role('ceo_admin', 'billing'))
  with check (organization_id = current_org_id() and has_role('ceo_admin', 'billing'));
create policy invoice_lines_delete on invoice_lines
  for delete using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

-- Adjustments: append-only. SELECT and INSERT are granted; UPDATE and DELETE
-- are not, the same rule as payments and the audit trail — a correction that
-- was wrong is corrected by another correction, on the record.
grant select, insert on invoice_adjustments to authenticated;

create policy invoice_adjustments_read on invoice_adjustments
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy invoice_adjustments_write on invoice_adjustments
  for insert with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing')
    and created_by_user_id = (select id from current_app_user())
  );

-- A draft is Joy's scratchpad — the one lifecycle stage nobody outside has
-- acted on, so the one stage that may be deleted. Everything after it is
-- history and moves only forward.
grant delete on issued_invoices to authenticated;
create policy issued_invoices_delete_drafts on issued_invoices
  for delete using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing')
    and status = 'draft'
  );
