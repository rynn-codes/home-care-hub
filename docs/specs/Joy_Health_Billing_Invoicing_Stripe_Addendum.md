# Joy Health — Billing, Invoicing & Stripe Addendum

**Purpose:** Capture only the newly established billing/payment decisions for coding. This supplements the existing Admissions, Payroll, Client Portal, and document specifications.

## 1. Locked Architecture

**FreshBooks is removed.**

Joy owns the billing workflow and is the invoicing system of record. Stripe is the secure payment processor/payment-method vault.

```text
JOY
Clients + Responsible Parties
Verified Visits
Rates + Billing Rules
Invoices + Balances
Payment Preference
Client Portal
Billing/Payment History
        |
        v
STRIPE
Customer / Payment Method
Card + ACH Processing
Payment Transactions
Processor Events
        |
        v
Bank / Card Network
```

Joy must not store raw card numbers or raw bank-account credentials.

## 2. Admissions → Payment Setup

Admissions already has a Payment Setup readiness requirement. Keep Admissions focused on readiness rather than turning it into the Billing page.

Conceptual states:

```text
Not Started
Payment Method Needed
Ready
Complete
Needs Attention
```

If another person is financially responsible, use the existing Responsible Party / Billing Contact record.

Before requesting a payment method, show the applicable approved service/pricing terms. Do not make the family's first billing interaction simply “enter your card.”

Example:

```text
YOUR CARE COST

Scheduled care
20 hours / week

Rate
$32.00 / hour

Estimated weekly care
$640.00

Other applicable charges
Per your Service Agreement
```

Actual UI values must come from the client's approved service/rate data.

## 3. Payment Authorization

The existing Service Agreement establishes billing obligations and terms. Joy should additionally capture a concise electronic-payment authorization during Payment Setup.

Record:

- who authorized;
- client/account;
- responsible party when applicable;
- authorization date/time;
- selected payment mode;
- authorization text/version;
- Stripe customer/payment-method reference where applicable;
- authorization status;
- revocation/change history.

Do not store raw card/bank credentials. Final authorization wording should use Joy Health's approved legal language.

## 4. BOTH Payment Modes Are Required

Joy Health clients use both.

### Pay Invoice

```text
Verified services
  ↓
Joy calculates charges
  ↓
Draft invoice
  ↓
Review/validation
  ↓
Final invoice
  ↓
CLIENT SEES ITEMIZED INVOICE
  ↓
Client taps Pay Invoice
  ↓
Stripe processes
  ↓
Joy receives confirmed result
  ↓
Invoice/balance/history update
```

The client explicitly initiates collection after reviewing the invoice.

### AutoPay

```text
Verified services
  ↓
Joy calculates charges
  ↓
Draft invoice
  ↓
Review/validation
  ↓
Final invoice
  ↓
CLIENT SEES ITEMIZED INVOICE
  ↓
Payment occurs according to authorized billing terms
  ↓
Stripe processes
  ↓
Joy receives confirmed result
  ↓
Invoice/balance/history update
```

**AutoPay does not mean charging without an invoice.** The finalized invoice must be available for review before scheduled automatic collection under the agreed terms.

## 5. Payment Preference

Each billing account has an explicit preference:

```text
pay_invoice
autopay
```

Client-facing example:

```text
PAYMENT PREFERENCE

AutoPay
Visa •••• 4242

Your invoices are available for review
before your scheduled payment.
```

or:

```text
PAYMENT PREFERENCE

Pay Invoice

You'll receive an update when a new invoice is ready.

[Pay Invoice]
```

Preference changes must be auditable.

## 6. Joy Creates the Invoice

Stripe does **not** create the authoritative Joy invoice.

```text
Verified/Completed Visits
        +
Client Rate
        +
Applicable Billing Rules
        +
Approved Adjustments
        =
JOY INVOICE
```

Payroll and client billing remain separate calculations even if both consume the same verified visit.

```text
Verified Visit
    ├── Payroll → employee compensation
    └── Billing → client invoice
```

Never assume caregiver pay rate equals client bill rate.

## 7. Itemized Invoice Requirement

The client/responsible party must understand what they are paying for before collection.

Example:

```text
JOY HEALTH
Invoice #JH-10428

Care Period
Aug 24 – Aug 30

Personal Care
20.0 hours × $32.00       $640.00

Transportation
12 miles × $0.70            $8.40

-------------------------------
TOTAL DUE                 $648.40

[Pay $648.40]
```

Depending on approved billing rules, invoices may show service dates, service type, billable hours, agreed rate, transportation/mileage, approved adjustments/charges, total, due date, and status.

Never expose caregiver payroll data or internal margins.

## 8. Client Portal Billing

The mobile-first Client/Family Portal should include:

- Current Balance
- Open Invoices
- Invoice Details
- Payment Preference
- Payment Method Summary
- Pay Invoice
- AutoPay status
- Payment History
- Paid Invoices / Receipts

Example:

```text
BILLING

Current balance
$648.40

Invoice #JH-10428
Aug 24 – Aug 30

Payment preference
Pay Invoice

[Review & Pay]
```

AutoPay example:

```text
BILLING

Invoice #JH-10428
$648.40

AutoPay
Scheduled according to your billing terms

[Review Invoice]
```

Show Joy business language—not Stripe implementation details.

## 9. Stripe Integration Boundary

Use a payment service/adapter rather than putting Stripe calls throughout UI code.

```text
Joy Billing Service
      ↓
Joy Payment Service
      ↓
Stripe Adapter
      ↓
Stripe API
```

Joy may retain Stripe references such as customer, payment-method, and transaction/payment identifiers, but Stripe IDs are not Joy's primary business IDs.

Use Stripe-secure/hosted payment components for card/ACH entry.

Joy may display safe metadata such as:

```text
Visa •••• 4242
Checking •••• 4821
```

Never store/display complete payment credentials.

## 10. Pay Invoice Transaction

```text
Client opens finalized invoice
  ↓
Joy verifies invoice access
  ↓
Client reviews itemization
  ↓
Client selects Pay
  ↓
Joy initiates Stripe payment
  ↓
Stripe processes
  ↓
Verified Stripe event/webhook
  ↓
Joy payment record updates
  ↓
Invoice balance recalculates
  ↓
Portal + receipt/history update
```

Do not treat a browser redirect as proof of successful payment.

## 11. AutoPay Transaction

```text
Final invoice
  ↓
Invoice available to client
  ↓
AutoPay authorization verified
  ↓
Usable authorized payment method verified
  ↓
Collection under agreed billing terms
  ↓
Stripe processes
  ↓
Verified event/webhook
  ↓
Joy payment + invoice update
```

If authorization is revoked or the method becomes unusable, Joy must not silently continue unauthorized collection.

## 12. Webhooks / Reconciliation

Stripe webhook handling is required.

Implementation must:

- verify webhook signatures;
- be idempotent;
- persist processor event identifiers;
- prevent duplicate payment/ledger entries;
- safely retry failed event processing;
- audit consequential state changes;
- update Joy only from confirmed processor results.

Claude Code should verify current Stripe API objects/events against current Stripe documentation during implementation rather than relying on stale event names in a static spec.

## 13. Payment Failure

Client example:

```text
PAYMENT NEEDS ATTENTION

Invoice #JH-10428
$648.40

We couldn't complete the payment
using Visa •••• 4242.

[Update Payment Method]
[Try Again]
```

Admin example:

```text
Needs You

Marcus Bell
Invoice JH-10428
AutoPay failed

[Review]
```

Do not expose raw processor errors to clients.

## 14. Privacy + Permissions

Billing access is private and relationship-based. Do not assume every family portal user can see financial information.

Potential permissions:

```text
view_billing
view_invoice
pay_invoice
manage_payment_method
manage_autopay
view_payment_history
```

Responsible-party billing access may differ from other family access.

Never expose:

- caregiver pay rates;
- payroll calculations;
- internal margins;
- internal billing notes;
- Stripe secrets/internal details;
- full card/bank credentials;
- staff-only adjustments/comments;
- another client's financial data.

Enforce authorization server-side.

## 15. Billing Audit Trail

Audit important actions such as:

```text
billing_contact.updated
payment_authorization.created
payment_authorization.revoked
payment_preference.changed
payment_method.added
payment_method.updated
invoice.created
invoice.finalized
invoice.sent
invoice.viewed
payment.initiated
payment.succeeded
payment.failed
refund.initiated
refund.completed
```

Retain actor, client, invoice/payment reference, timestamp, before/after state where relevant, source, and safe processor reference. Never log raw payment credentials.

## 16. Admissions Connection

Admissions should display only enough billing information to determine readiness:

```text
PAYMENT SETUP

Billing contact
Susan Bell

Pricing reviewed
✓

Payment preference
AutoPay

Payment method
Visa •••• 4242

Authorization
✓ Complete

Billing readiness
READY
```

The full invoice/billing workspace remains outside Admissions.

## 17. Payroll Connection

Payroll and Billing remain separate domains.

```text
Employee clocks in/out
        ↓
Visit/time verified
        ↓
     ┌──┴──┐
     ↓     ↓
 Payroll  Billing
```

If a verified visit is later changed, Joy should trigger the appropriate payroll/billing review or recalculation rather than silently rewriting historical financial records.

## 18. Spruce Notifications

**Joy Portal = persistent source of truth. Spruce = notification/communication channel.**

Examples:

> Your new Joy Health invoice is ready to review.

> Your Joy Health payment was received.

> Your Joy Health payment needs attention. Please open your portal to review.

Avoid unnecessary sensitive financial detail in SMS.

## 19. Required V1 Screens

### Admin
1. Client Billing Account
2. Billing Contact / Responsible Party
3. Payment Setup Status
4. Invoice List
5. Draft Invoice Review
6. Invoice Detail
7. Finalize / Send Invoice
8. Payment Status
9. Failed Payment / Needs Attention
10. Payment History

### Client Portal
1. Billing Summary
2. Open Invoices
3. Invoice Detail
4. Pay Invoice
5. Payment Method Setup
6. Pay Invoice / AutoPay Preference
7. AutoPay Authorization
8. Payment Confirmation
9. Payment Failure
10. Paid Invoice / Receipt History

## 20. V1 Acceptance Criteria

A successful implementation must allow:

1. Joy to create invoices from verified billing data.
2. Authorized staff to review/finalize invoices.
3. The authorized client/responsible party to see the finalized itemized invoice before collection.
4. Pay Invoice clients to explicitly initiate payment.
5. AutoPay clients to have valid authorization and a usable payment method.
6. AutoPay clients to access the invoice before automatic collection under agreed terms.
7. Stripe to securely process card and ACH payments.
8. Joy to update payment state from verified Stripe events.
9. The portal to show balances, invoices, preference, payment method summary, and history.
10. Failed payments to create client/admin exceptions.
11. Billing access to respect responsible-party/family permissions.
12. Joy to avoid storing raw card/bank credentials.
13. Payroll to remain separate from client billing.
14. FreshBooks to have **no dependency** in this workflow.

## 21. Locked Product Rule

> **Joy creates the invoice. The client sees the invoice. Stripe processes the money.**

Joy supports both:

```text
PAY INVOICE
Review invoice → client initiates payment

AUTOPAY
Review invoice → collection occurs under
previously authorized billing terms
```

Neither mode should feel like Joy is charging an unexplained amount.
