-- Joy Health — issued invoices, and the money that comes in against them
--
-- Joy computes each week's invoice from visits, on demand, every time. That is
-- right for showing what a week costs and it cannot answer "who owes us money",
-- because a computed invoice has no identity: nothing records that it was sent,
-- nothing records that $400 arrived against it in two payments, and re-running
-- the calculation next month produces a fresh object with no memory of either.
--
-- WHY THIS MATTERS MORE FOR JOY THAN FOR MOST AGENCIES. Karynn, 21 August: "We
-- are all private pay." There is no payer to chase and no remittance advice
-- arriving on its own. Every dollar is a family, and the only thing standing
-- between a late payment and a bad debt is somebody noticing.

-- ---------------------------------------------------------------------------
-- Issued invoices
-- ---------------------------------------------------------------------------

create type invoice_status as enum ('issued', 'settled', 'written_off');

-- How the money arrived. Mirrors `PaymentMethod` in domain/billing/invoice.ts;
-- `payment_source` in 0004 is a different question — who is paying, asked at
-- intake — and conflating the two would put "LTC insurance" in a column that
-- means "card, ACH or cheque".
create type payment_method as enum ('card', 'ach', 'check');

create table issued_invoices (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  client_person_id    uuid not null references people (id) on delete restrict,

  -- The week it covers, for the conversation about what it is for.
  week_start          date not null,
  week_end            date not null,

  -- What was billed. An invoice for nothing is not issuable — `buildInvoice`
  -- refuses to send a zero rather than pretending a week cost nothing, and the
  -- table agrees with it.
  total               numeric(10, 2) not null,

  issued_on           date not null,
  issued_by_user_id   uuid not null references users (id) on delete restrict,
  due_on              date not null,

  status              invoice_status not null default 'issued',
  written_off_on      date,
  written_off_by_user_id uuid references users (id) on delete restrict,
  written_off_reason  text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint issued_invoices_total_positive check (total > 0),
  constraint issued_invoices_week_ordered check (week_end >= week_start),
  constraint issued_invoices_due_after_issue check (due_on >= issued_on),

  -- A write-off is a decision with a name and a reason on it. A balance that
  -- simply disappears from the report the moment somebody gives up on it is a
  -- balance nobody can later ask why Joy gave up on — and the pattern of
  -- write-offs is the more useful thing to be able to see.
  constraint issued_invoices_write_off_is_attributed check (
    status <> 'written_off'
    or (written_off_on is not null
        and written_off_by_user_id is not null
        and length(btrim(coalesce(written_off_reason, ''))) > 0)
  ),
  constraint issued_invoices_clean_unless_written_off check (
    status = 'written_off'
    or (written_off_on is null and written_off_by_user_id is null and written_off_reason is null)
  )
);

-- One invoice per client per week. A second one for the same week is either a
-- double-send — the family gets two bills and rings — or a correction that
-- should supersede rather than sit alongside.
create unique index issued_invoices_one_per_client_week
  on issued_invoices (client_person_id, week_start);

create index issued_invoices_open_idx on issued_invoices (organization_id, due_on)
  where status = 'issued';
create index issued_invoices_client_idx on issued_invoices (client_person_id, week_start desc);

comment on table issued_invoices is
  'An invoice becomes a debt when it is SENT. A week Joy computed and never billed is not money anybody owes, and a receivables report that counted unsent weeks would turn every quiet Friday into an accounts problem.';

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table payments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  -- Restrict, not cascade. Deleting an invoice that has money against it would
  -- delete the record of the money.
  invoice_id        uuid not null references issued_invoices (id) on delete restrict,

  amount            numeric(10, 2) not null,
  received_on       date not null,
  method            payment_method not null,
  -- The last four, the cheque number — whatever identifies it on a statement
  -- when somebody rings to ask what a line on their card is.
  reference         text,

  recorded_by_user_id uuid not null references users (id) on delete restrict,
  created_at        timestamptz not null default now(),

  -- Partial payments are normal and expected. Zero and negative are not: a
  -- refund is its own act with its own record, not a payment with a minus sign.
  constraint payments_amount_positive check (amount > 0)
);

create index payments_invoice_idx on payments (invoice_id, received_on);
create index payments_org_received_idx on payments (organization_id, received_on desc);

-- A payment cannot arrive before the invoice was sent.
--
-- Almost always somebody keying it against the wrong invoice, and it is worth
-- catching because the money then sits against a week that is already settled
-- while the week that is actually owed keeps ageing.
create or replace function payment_after_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sent date;
begin
  select issued_on into sent from issued_invoices where id = new.invoice_id;
  if sent is null then
    raise exception 'That invoice is not on file.' using errcode = 'foreign_key_violation';
  end if;
  if new.received_on < sent then
    raise exception
      'A payment cannot arrive before the invoice was sent (invoice issued %, payment dated %). Check the date, or the invoice.',
      sent, new.received_on
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_after_invoice
  before insert or update on payments
  for each row execute function payment_after_invoice();

/**
 * What is left on an invoice.
 *
 * A function rather than a stored `balance` column, deliberately. A cached
 * balance and a payments table are two records of the same fact, and the day
 * they disagree is the day somebody chases a family who has already paid.
 */
create or replace function invoice_balance(invoice uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)
  from issued_invoices i
  where i.id = invoice;
$$;

-- Keep `status` in step with the money without ever computing the balance
-- twice. `settled` is derived here and nowhere else.
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
        when status = 'written_off' then 'written_off'
        -- Zero or below: an overpayment settles it too. The credit is the
        -- negative balance, which the report shows separately rather than
        -- netting off against somebody's arrears.
        when invoice_balance(target) <= 0 then 'settled'
        else 'issued'
      end::invoice_status
  where id = target;
  return null;
end;
$$;

create trigger payments_settle_invoice
  after insert or update or delete on payments
  for each row execute function settle_invoice_when_paid();

create trigger issued_invoices_set_updated_at before update on issued_invoices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table issued_invoices enable row level security;
alter table payments        enable row level security;

grant select on issued_invoices, payments to authenticated;
grant insert, update on issued_invoices to authenticated;
grant insert on payments to authenticated;

-- Deliberately NO update or delete grant on payments.
--
-- The same reasoning as the audit trail. A payment is a statement that money
-- arrived; editing one afterwards changes what Joy says a family paid, and
-- there is no version of that which is not either a mistake or a cover-up. A
-- payment keyed wrongly is corrected by recording the correction, which leaves
-- both facts on the record.

-- Staff who have business with money. A scheduler does not need to know what a
-- family owes, and a caregiver certainly does not — arriving at somebody's
-- house knowing they are three invoices behind changes the visit.
create policy issued_invoices_read on issued_invoices
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing', 'payroll')
  );

create policy issued_invoices_write on issued_invoices
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy issued_invoices_update on issued_invoices
  for update using (organization_id = current_org_id() and has_role('ceo_admin', 'billing'))
  with check (organization_id = current_org_id() and has_role('ceo_admin', 'billing'));

create policy payments_read on payments
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing', 'payroll')
  );

create policy payments_write on payments
  for insert with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing')
    -- Recorded in the name of whoever is recording it, the same rule as the
    -- audit trail: money arriving is a fact somebody attests to.
    and recorded_by_user_id = (select id from current_app_user())
  );

-- ---------------------------------------------------------------------------
-- What this migration does not decide
-- ---------------------------------------------------------------------------

-- Nothing here issues an invoice. `buildInvoice` computes one and a person
-- decides to send it; that decision, and the e-mail or the card charge that
-- follows it, is not modelled. The table records the outcome.
--
-- And a family cannot see their own balance. That is not an oversight: §24
-- keeps internal records off the family portal and nobody has asked for a
-- payments view there. It is worth asking about — a daughter who could see what
-- was outstanding might simply pay it — but it is a decision, not a default.
