import type { IssuedInvoice, Payment } from "@/domain/billing/receivables";
import { seedBillingTerms } from "@/lib/billingSeed";

/**
 * Issued invoices and the payments against them.
 *
 * Clients are fictional, as everywhere in this repository.
 *
 * WHY THERE ARE SO FEW. Only two seeded clients have an hourly rate, and an
 * invoice cannot be issued without one — `buildInvoice` refuses rather than
 * sending a zero. Inventing rates here so the report had more rows would put
 * fabricated money on a financial screen, which is the thing the whole Reports
 * page is written against. The report shows what Joy can actually invoice
 * today, and that is a small number because the rates are not in yet.
 *
 * Five states, because a receivables report where everything is settled proves
 * nothing: one paid in full, one part paid, one badly overdue, one not yet due,
 * and one overpaid — the family who paid twice, whose money Joy owes back.
 *
 * Dates are relative to today so the ageing buckets always mean something,
 * rather than every row drifting into "over 90 days" as the demo gets older.
 */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAhead(n: number): string {
  return daysAgo(-n);
}

/** The two clients with a rate on file. Anything else cannot be invoiced. */
const priced = seedBillingTerms.filter((t) => t.hourlyRate !== null);

function invoice(input: {
  id: string;
  client: { clientPersonId: string; clientName: string };
  total: number;
  issuedDaysAgo: number;
  dueDaysAgo: number;
}): IssuedInvoice {
  return {
    id: input.id,
    clientPersonId: input.client.clientPersonId,
    clientName: input.client.clientName,
    weekStart: daysAgo(input.issuedDaysAgo),
    weekEnd: daysAgo(input.issuedDaysAgo - 6),
    total: input.total,
    issuedOn: daysAgo(input.issuedDaysAgo),
    dueOn: input.dueDaysAgo >= 0 ? daysAgo(input.dueDaysAgo) : daysAhead(-input.dueDaysAgo),
    writtenOffOn: null,
    writtenOffReason: null,
  };
}

const first = priced[0];
const second = priced[1] ?? priced[0];

export const seedIssuedInvoices: IssuedInvoice[] = first
  ? [
      // Settled the week it was sent. Drops out of the report entirely.
      invoice({ id: "inv-1", client: first, total: 1280, issuedDaysAgo: 28, dueDaysAgo: 21 }),
      // The one that has gone quiet: nearly a hundred days, part paid once and
      // nothing since.
      invoice({ id: "inv-2", client: first, total: 1280, issuedDaysAgo: 98, dueDaysAgo: 91 }),
      // Sent on Monday, due Friday. Not late, and must not read as late.
      invoice({ id: "inv-3", client: first, total: 960, issuedDaysAgo: 3, dueDaysAgo: -4 }),
      ...(second !== first
        ? [
            invoice({ id: "inv-4", client: second, total: 720, issuedDaysAgo: 40, dueDaysAgo: 33 }),
            // Paid twice by a family setting up a standing order. Joy owes this
            // back; it is a credit, not a reduction in somebody's arrears.
            invoice({ id: "inv-5", client: second, total: 720, issuedDaysAgo: 12, dueDaysAgo: 5 }),
          ]
        : []),
    ]
  : [];

export const seedPayments: Payment[] = first
  ? [
      { id: "pay-1", invoiceId: "inv-1", amount: 1280, receivedOn: daysAgo(22), method: "card", reference: "•••• 4242" },
      { id: "pay-2", invoiceId: "inv-2", amount: 400, receivedOn: daysAgo(88), method: "check", reference: "Cheque 1043" },
      ...(second !== first
        ? [
            { id: "pay-3", invoiceId: "inv-5", amount: 720, receivedOn: daysAgo(6), method: "ach" as const, reference: "ACH standing order" },
            { id: "pay-4", invoiceId: "inv-5", amount: 720, receivedOn: daysAgo(5), method: "card" as const, reference: "•••• 1881" },
          ]
        : []),
    ]
  : [];
