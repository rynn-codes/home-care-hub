# Electronic Payment Authorization — version joy-epay-v1

Supplied by Karynn, 22 August 2026, as the recommended portal language.
Recorded verbatim. Every `payment_authorizations` row cites the version it was
signed under (`authorization_text_version`); this file is what `joy-epay-v1`
means. A future wording change is a NEW version and a new file — this one
never changes, because signatures point at it.

> Final legal sign-off on this wording is the attorney's; the build treats it
> as v1 as supplied.

---

**Electronic Payment Authorization**

I authorize Joy Healthcare Services, LLC ("Joy Health") to use the payment
method I provide through Joy Health's secure payment system to pay amounts due
under my Client Agreement for Care.

I understand that Joy Health will provide an itemized invoice showing the
services and charges before payment is collected. Charges may vary based on
the services actually provided and may include authorized service hours,
overtime or holiday charges, transportation or mileage, and other charges
permitted under my signed Client Agreement.

Choose your payment preference:

○ **Pay Invoice**
I will review each invoice and authorize payment by selecting Pay Invoice in
the Joy Health Client Portal. Joy Health will not automatically charge my
saved payment method unless I later enroll in AutoPay.

○ **AutoPay**
I authorize Joy Health to automatically charge or debit my saved payment
method for finalized invoices according to the billing terms in my Client
Agreement. I understand that each itemized invoice will be made available to
me for review before the scheduled payment is processed.

I understand that my payment method may be a credit card, debit card, or
eligible bank account/ACH payment method. My payment information will be
processed securely by Joy Health's payment processor, Stripe, and Joy Health
will not store my complete card number or bank-account credentials.

I understand that I remain responsible for amounts due under my Client
Agreement if a payment is declined, returned, disputed, or otherwise
unsuccessful.

I may request to update my payment method or change my payment preference. If
I revoke AutoPay, the revocation will apply to future automatic payments after
Joy Health has had a reasonable opportunity to process my request; amounts
already due remain my responsibility under my Client Agreement.

By signing below, I acknowledge that I have reviewed the applicable rates and
billing terms and authorize electronic payments according to the payment
preference I selected above.

---

## Why this wording and the build agree, clause by clause

- "itemized invoice … before payment is collected" — `autopayCollectionRefusals`
  refuses an unfinalized or unshown invoice; the locked §21 rule.
- "will not automatically charge … unless I later enroll in AutoPay" —
  `wrong_mode` refusal: Pay Invoice authority is not AutoPay authority.
- "revocation will apply to future automatic payments" — a revoked
  authorization stops future collection (`authorization_revoked`); amounts
  already due stay owed, which is why revoking never voids an invoice.
- "will not store my complete card number" — `payment_method_summaries` cannot
  hold one; `last_four` refuses a fifth digit by constraint.
- "reviewed the applicable rates and billing terms" — the YOUR CARE COST
  review (`paymentMethodRequestGate`) comes before the form.
