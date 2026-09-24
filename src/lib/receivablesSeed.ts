import type { IssuedInvoice, Payment } from "@/domain/billing/receivables";
import type { PaymentFailure } from "@/domain/billing/invoiceActions";
import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { seedBillingTerms } from "@/lib/billingSeed";

/**
 * Issued invoices and the payments against them.
 *
 * Only two seeded clients carry invoices here — the two whose rates come
 * first — and the amounts are placeholder money on placeholder rates, like
 * everything financial in this repository until Karynn's real figures
 * arrive.
 *
 * Seven invoices, because a receivables screen where everything is settled
 * proves nothing: paid in full, part paid and overdue with a failed card
 * behind it, sent and not yet due, overdue and untouched, paid, paid, and
 * one paid after a credit brought it down.
 *
 * Dates are relative to today so the ageing always means something, rather
 * than every row drifting into "over 90 days" as the demo gets older.
 */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAhead(n: number): string {
  return daysAgo(-n);
}

/** The agency week N weeks before this one. */
function weekAgo(weeksAgo: number): { weekStart: string; weekEnd: string } {
  const start = new Date(`${agencyWeekStart(daysAgo(0))}T12:00:00`);
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
}

const priced = seedBillingTerms.filter((t) => t.hourlyRate !== null);

function invoice(input: {
  id: string;
  rate: number | null;
  client: { clientPersonId: string; clientName: string };
  total: number;
  weeksAgo: number;
  issuedDaysAgo: number;
  dueDaysAgo: number;
}): IssuedInvoice {
  const rate = input.rate ?? null;
  const hours = rate ? Math.round((input.total / rate) * 100) / 100 : 0;
  return {
    id: input.id,
    // The 0020 shape: "JH-" and a boring sequential number.
    invoiceNumber: `JH-${10420 + Number(input.id.replace(/\D/g, ""))}`,
    clientPersonId: input.client.clientPersonId,
    clientName: input.client.clientName,
    ...weekAgo(input.weeksAgo),
    total: input.total,
    lines: [{ description: "Regular care", hours, rate, amount: input.total }],
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
      // Settled the week it was sent.
      invoice({ id: "inv-1", rate: first.hourlyRate, client: first, total: 1280, weeksAgo: 3, issuedDaysAgo: 28, dueDaysAgo: 21 }),
      // Part paid, then the card declined on the rest.
      invoice({ id: "inv-2", rate: first.hourlyRate, client: first, total: 1280, weeksAgo: 1, issuedDaysAgo: 13, dueDaysAgo: 6 }),
      // Sent this week, not yet due, and must not read as late.
      invoice({ id: "inv-3", rate: first.hourlyRate, client: first, total: 960, weeksAgo: 0, issuedDaysAgo: 3, dueDaysAgo: -4 }),
      ...(second !== first
        ? [
            // Overdue and untouched.
            invoice({ id: "inv-4", rate: second.hourlyRate, client: second, total: 720, weeksAgo: 0, issuedDaysAgo: 10, dueDaysAgo: 3 }),
            invoice({ id: "inv-5", rate: second.hourlyRate, client: second, total: 720, weeksAgo: 2, issuedDaysAgo: 21, dueDaysAgo: 15 }),
            invoice({ id: "inv-6", rate: second.hourlyRate, client: second, total: 1200, weeksAgo: 1, issuedDaysAgo: 14, dueDaysAgo: 8 }),
            // Billed at 1200, credited 120 after a correction, paid at 1080.
            {
              ...invoice({ id: "inv-7", rate: second.hourlyRate, client: second, total: 1080, weeksAgo: 3, issuedDaysAgo: 28, dueDaysAgo: 21 }),
              lines: [{ description: "Regular care", hours: second.hourlyRate ? Math.round((1200 / second.hourlyRate) * 100) / 100 : 0, rate: second.hourlyRate, amount: 1200 }],
              adjustments: [
                {
                  id: "adj-1",
                  invoiceId: "inv-7",
                  kind: "credit" as const,
                  amount: 120,
                  reason: "4 service hours removed after a caregiver correction",
                  createdByUserId: "Karynn V",
                  createdAt: `${daysAgo(26)}T09:14:00`,
                },
              ],
            },
          ]
        : []),
    ]
  : [];

export const seedPayments: Payment[] = first
  ? [
      { id: "pay-1", invoiceId: "inv-1", amount: 1280, receivedOn: daysAgo(22), method: "card", reference: "•••• 4242" },
      { id: "pay-2", invoiceId: "inv-2", amount: 400, receivedOn: daysAgo(8), method: "ach", reference: "ACH 1043" },
      ...(second !== first
        ? [
            { id: "pay-3", invoiceId: "inv-5", amount: 720, receivedOn: daysAgo(16), method: "ach" as const, reference: "ACH standing order" },
            { id: "pay-5", invoiceId: "inv-6", amount: 1200, receivedOn: daysAgo(13), method: "ach" as const, reference: "ACH 2210" },
            { id: "pay-6", invoiceId: "inv-7", amount: 1080, receivedOn: daysAgo(22), method: "ach" as const, reference: "ACH 1187" },
          ]
        : []),
    ]
  : [];

/** The card that declined on the balance of inv-2. Joy records the attempt; Stripe reports the outcome. */
export const seedPaymentFailures: PaymentFailure[] = first
  ? [
      {
        invoiceId: "inv-2",
        clientPersonId: first.clientPersonId,
        clientName: first.clientName,
        amount: 880,
        failedOn: daysAgo(2),
        reason: "Card payment failed — insufficient funds",
        attempts: 1,
        lastAttemptAt: `${daysAgo(2)}T09:14:00`,
      },
    ]
  : [];
