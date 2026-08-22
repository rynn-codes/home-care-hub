-- Joy Health — split payers, and the agreed weekly hours
--
-- Two of Karynn's answers on 22 August land here.
--
-- SPLIT PAYERS HAPPEN. §18.9 was an open question and 0014 refused a second
-- payer per client until it was answered. Asked directly — "does one client
-- ever have two people splitting the bill, say two siblings each paying half
-- for their mother?" — Karynn: "Yes, it happens." So the refusal comes out and
-- shares come in. The rule that replaces it: shares are explicit percentages,
-- they can never total more than the whole bill, and the billing run refuses
-- to draft while they total less — a silently unbilled remainder is revenue
-- nobody notices losing.
--
-- THE INVOICE BILLS THE AGREEMENT. Karynn, same day, on what the invoice
-- carries: "What is on the service agreement (12 hours/week), the week we bill
-- for" — plus last week's overtime, additions and credits as their own lines.
-- The agreed hours are a fact about the client's service agreement, so they
-- live on the client-account link, not on the rate (a rate is a price, not a
-- quantity) and not on the visit (the schedule is a plan, not the agreement).

-- One payer per client is no longer the rule.
drop index billing_account_clients_one_payer_per_client;

alter table billing_account_clients
  -- Of the client's bill, the percentage this account pays. 100 for the
  -- ordinary sole payer, which is why it defaults rather than asks.
  add column share_percent numeric(5, 2) not null default 100,
  -- §4.2's rate agreement gate names a quantity; this is it. Null means the
  -- agreement's hours have not been recorded, and the billing run treats an
  -- advance invoice as undraftable without them.
  add column agreed_weekly_hours numeric(5, 2);

alter table billing_account_clients
  add constraint bac_share_is_a_share check (share_percent > 0 and share_percent <= 100),
  add constraint bac_agreed_hours_positive check (
    agreed_weekly_hours is null or agreed_weekly_hours > 0
  );

-- Shares for one client can never exceed the whole bill. A constraint trigger,
-- deferred, so a 100% payer can be rebalanced to 50/50 in one transaction —
-- checked row-by-row the intermediate state would always be refused.
--
-- Deliberately <= 100 rather than = 100: the moment between "first sibling
-- added at 50" and "second sibling added at 50" is a real editing state, and
-- refusing it would force the office to build both halves in one breath. The
-- billing run holds the other side of the bargain: it refuses to DRAFT while
-- shares total less than 100, so the gap can exist but cannot bill.
create or replace function refuse_overcommitted_shares()
returns trigger
language plpgsql
as $$
declare
  committed numeric;
  client uuid := coalesce(new.client_person_id, old.client_person_id);
begin
  select coalesce(sum(share_percent), 0) into committed
  from billing_account_clients
  where client_person_id = client;

  if committed > 100 then
    raise exception
      'The payers for this client would cover % percent of the bill. Shares can total at most 100.',
      committed
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger billing_account_clients_shares_bounded
  after insert or update on billing_account_clients
  deferrable initially deferred
  for each row execute function refuse_overcommitted_shares();

-- Rebalancing a share is an ordinary edit; 0014 granted insert and delete only.
grant update on billing_account_clients to authenticated;

create policy billing_account_clients_update on billing_account_clients
  for update using (
    exists (
      select 1 from billing_accounts a
      where a.id = billing_account_id and a.organization_id = current_org_id()
    )
    and has_role('ceo_admin', 'billing')
  )
  with check (
    exists (
      select 1 from billing_accounts a
      where a.id = billing_account_id and a.organization_id = current_org_id()
    )
    and has_role('ceo_admin', 'billing')
  );

-- ---------------------------------------------------------------------------
-- One invoice per client per week becomes one per PAYER per week
-- ---------------------------------------------------------------------------

-- With two siblings each paying half, a week legitimately has two invoices for
-- one client — one per account. The uniqueness moves down a level: one live
-- invoice per client-week PER ACCOUNT. The all-zeros uuid stands in for the
-- pre-0014 invoices that carry no account, so two of those still collide.
drop index issued_invoices_one_per_client_week;
create unique index issued_invoices_one_per_client_week
  on issued_invoices (
    client_person_id,
    week_start,
    coalesce(billing_account_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'written_off';

comment on column billing_account_clients.share_percent is
  'Of this client''s bill, the percentage this account pays. Karynn, 22 Aug: split payers happen. Shares may total under 100 while the office is editing; the billing run refuses to draft until they reach it.';
