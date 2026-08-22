-- Joy Health — widened portal grants, and the family finance read
--
-- §9.1 of the billing specification: "A portal user's access derives from
-- explicit authorization grants linking user, client, billing account, role,
-- allowed actions, effective dates, and revocation state." 0006 built the
-- grant with person, subject, state and revocation; this adds the rest.
--
-- THE ASSERTIONS FOR THIS FILE WERE WRITTEN FIRST. 0013 gives families nothing,
-- which is safe. Widening is the risky direction — the failure mode is not "a
-- daughter cannot see an invoice", which she reports, but "a neighbour can",
-- which nobody reports. widened_grants_test.sql existed before this policy did.
--
-- NUMBERING. Stripe mapping (blocked on the §8.1 server layer) moves to 0019.

-- ---------------------------------------------------------------------------
-- What a grant says
-- ---------------------------------------------------------------------------

alter table portal_grants
  -- responsible_party | family_viewer | client (§5's last two rows).
  add column role            text,
  add column allowed_actions text[] not null default '{}',
  -- Inclusive dates. Null from = since granted; null to = until revoked.
  add column effective_from  date,
  add column effective_to    date;

alter table portal_grants
  add constraint portal_grants_role_known check (
    role is null or role in ('responsible_party', 'family_viewer', 'client')
  ),
  -- A family grant is an authorization, and an authorization that does not say
  -- what it authorizes is a blank cheque with a name on it. NOT VALID so this
  -- migration applies over pre-0018 rows — legacy grants keep working exactly
  -- as before (they allow no finance actions, because their action list is
  -- empty), while every grant issued from now on says who the person is.
  add constraint portal_grants_family_has_role check (
    audience <> 'family' or role is not null
  ) not valid,
  -- The workforce portal is not a finance surface. A caregiver grant that
  -- quietly carried view_invoices would be J-06 undone by a default.
  add constraint portal_grants_workforce_carries_no_finance check (
    audience <> 'workforce' or (role is null and allowed_actions = '{}')
  ),
  -- A closed vocabulary. An open one is how a typo becomes a permission.
  add constraint portal_grants_actions_known check (
    allowed_actions <@ array[
      'view_invoices',
      'pay_invoice',
      'manage_payment_methods',
      'download_documents',
      'view_care_updates'
    ]::text[]
  ),
  add constraint portal_grants_window_ordered check (
    effective_from is null or effective_to is null or effective_to >= effective_from
  );

comment on column portal_grants.allowed_actions is
  '§9.1. What this person may DO, distinct from what they may see. Two family members of one client routinely differ: the daughter pays, the son follows along.';

-- Is this grant good today, for this action?
create or replace function grant_allows(grant_row portal_grants, action text)
returns boolean
language sql
stable
as $$
  select grant_row.active
    and grant_row.audience = 'family'
    and action = any(grant_row.allowed_actions)
    and (grant_row.effective_from is null or grant_row.effective_from <= current_date)
    and (grant_row.effective_to is null or grant_row.effective_to >= current_date);
$$;

-- Does the calling portal user hold a live grant for this client and action?
create or replace function has_family_action(client uuid, action text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from portal_grants g
    where g.person_id = current_person_id()
      and g.subject_person_id = client
      and grant_allows(g, action)
  );
$$;

-- ---------------------------------------------------------------------------
-- §9.2's state, on the client record
-- ---------------------------------------------------------------------------

create type payment_setup_state as enum (
  'not_started', 'method_needed', 'ready', 'complete', 'needs_attention'
);

-- Stored for now; computed from the billing account once the developer wires
-- accounts live (paymentSetupFrom in domain/billing/paymentSetup.ts is the
-- computation). §4.2 wants gates computed, and this column is the seam.
alter table client_profiles
  add column payment_setup payment_setup_state not null default 'not_started';

-- ---------------------------------------------------------------------------
-- The family finance read
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER VIEWS, deliberately, and this is the one place the pattern
-- is right rather than a hole. Everywhere else in Joy a view runs as the
-- invoker so RLS applies; here the point is COLUMN control as much as row
-- control. A family row policy on issued_invoices itself would let a family
-- SELECT the internal columns — who approved, the snapshot hash, the write-off
-- reason — because RLS gates rows, never columns. So there is no family policy
-- on the base table at all: the view is the only door, the access check is
-- inside it, and the columns it lacks cannot leak (§9.3's exclusion list).

create view family_invoices
with (security_invoker = off)
as
select
  i.id,
  i.client_person_id,
  i.week_start,
  i.week_end,
  i.total,
  i.issued_on,
  i.due_on,
  i.status,
  invoice_balance(i.id) as balance_due
from issued_invoices i
where has_family_action(i.client_person_id, 'view_invoices')
  -- A family sees what Joy has SENT. Drafts and approvals-in-progress are the
  -- office's; uncollectible and written off are collection judgements that a
  -- balance simply stops showing, not states to explain on a portal.
  and i.status in ('issued', 'processing', 'settled', 'disputed');

create view family_payments
with (security_invoker = off)
as
select
  p.id,
  p.invoice_id,
  i.client_person_id,
  p.amount,
  p.received_on,
  p.method,
  -- Their own cheque number — the reference identifies THEIR payment on THEIR
  -- statement. Who recorded it is internal and absent.
  p.reference
from payments p
join issued_invoices i on i.id = p.invoice_id
where has_family_action(i.client_person_id, 'view_invoices')
  and i.status in ('issued', 'processing', 'settled', 'disputed');

comment on view family_invoices is
  '§9.3. The ONLY financial read a family has. Sanitized by column omission: no approver, no snapshot, no run id, no rate version, no write-off reason. Access is the grant, checked inside the view.';

grant select on family_invoices, family_payments to authenticated;

-- No insert, update or delete on either view, and no new policy on the base
-- tables: paying an invoice is a Stripe flow through the server layer (§8.1),
-- never a family writing rows.
