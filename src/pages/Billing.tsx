import { useMemo, useState } from "react";
import { AlertCircle, Check, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  PACKET_CONTRADICTION,
  ageing,
  buildInvoice,
  type Invoice,
} from "@/domain/billing/invoice";
import { seedBillingTerms, seedPaidWeeks } from "@/lib/billingSeed";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { invoiceBalance, BALANCE_LABELS, type InvoiceBalance } from "@/domain/billing/receivables";
import { RecordPaymentDialog } from "@/components/billing/RecordPaymentDialog";
import { SaturdayRunCard } from "@/components/billing/SaturdayRunCard";
import { useDemo } from "@/context/DemoDataProvider";
import { seedVisits } from "@/lib/schedulingSeed";
import { cn } from "@/lib/utils";

/**
 * Billing.
 *
 * Every rule here comes from the service agreement the client signs, not from a
 * general idea of invoicing — see `domain/billing/invoice.ts` for the clause
 * behind each one. Weekly in advance, one day to pay, time and a half on the
 * seven named holidays and over forty hours, the deposit applied rather than
 * charged, 2.9% on cards and $5 on ACH.
 *
 * The screen's job is to make two things impossible to miss: an invoice that
 * cannot be sent because Joy has no rate, and an invoice old enough that the
 * agreement permits suspending care. Neither is acted on automatically.
 */

function money(n: number | null): string {
  return n === null ? "—" : `$${n.toFixed(2)}`;
}

function currentBillingWeek(): string {
  // The week being billed NOW is next Saturday's — the invoice goes out five
  // days ahead of the care it covers. See BILLING_CALENDAR.
  return upcomingBillingWeek(new Date().toISOString());
}

function InvoiceCard({ invoice, paid }: { invoice: Invoice; paid: boolean }) {
  const age = ageing({
    dueOn: invoice.dueOn,
    paid,
    total: invoice.total,
    asOf: new Date().toISOString().slice(0, 10),
  });
  const blocked = invoice.state === "cannot_bill";

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-5",
        blocked ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{invoice.clientName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Week of {invoice.weekStart} · due {invoice.dueOn}
          </p>
        </div>
        <p className={cn("text-lg font-semibold", blocked && "text-muted-foreground")}>
          {money(invoice.total)}
        </p>
      </div>

      {blocked ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {invoice.blockedReason}
        </p>
      ) : (
        <>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    {line.description}
                    {line.multiplier !== 1 && (
                      <span className="ml-1.5 text-xs text-[hsl(var(--warning))]">
                        {line.multiplier}×
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{line.hours} h</td>
                  <td className="py-2 text-right">{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 text-sm">
            {invoice.depositApplied > 0 && (
              <div className="flex justify-between">
                {/* Applied, not charged. The packet is explicit. */}
                <dt className="text-muted-foreground">Deposit applied</dt>
                <dd className="text-[hsl(var(--success))]">−{money(invoice.depositApplied)}</dd>
              </div>
            )}
            {invoice.convenienceFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Convenience fee</dt>
                <dd>{money(invoice.convenienceFee)}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p
          className={cn(
            "text-xs",
            paid
              ? "text-[hsl(var(--success))]"
              : age.suspensionPermitted
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {paid && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
          {age.message}
        </p>
        {!blocked && !paid && <Button size="sm">Send invoice</Button>}
        {blocked && (
          <Button size="sm" variant="outline">
            Add rate
          </Button>
        )}
      </div>
    </li>
  );
}

export default function Billing() {
  const weekStart = useMemo(currentBillingWeek, []);
  const { recordedPayments, issuedInvoices } = useDemo();
  const [payingBalance, setPayingBalance] = useState<InvoiceBalance | null>(null);

  // Issued invoices and every payment against them — the seeds plus anything
  // recorded through the app. One list, so this screen and the outstanding
  // report cannot disagree about who owes what.
  const openBalances = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const allPayments = [...seedPayments, ...recordedPayments];
    // Seeds plus everything sent from the Saturday run — one list, so this
    // screen, the run card and the reports cannot disagree about who owes what.
    return [...issuedInvoices, ...seedIssuedInvoices]
      .map((invoice) => invoiceBalance({ invoice, payments: allPayments, asOf: today }))
      .filter((b) => b.balance > 0 && b.state !== "written_off")
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [recordedPayments, issuedInvoices]);

  const invoices = useMemo(
    () =>
      seedBillingTerms.map((terms) =>
        buildInvoice({ terms, visits: seedVisits, weekStart }),
      ),
    [weekStart],
  );

  const billable = invoices.filter((i) => i.state !== "cannot_bill");
  const blocked = invoices.filter((i) => i.state === "cannot_bill");
  const total = billable.reduce((sum, i) => sum + (i.total ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Invoiced weekly in advance, on the terms in the service agreement."
      />

      <SaturdayRunCard />

      <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Week of {weekStart}
            </p>
            <p className="mt-0.5 text-sm">
              {billable.length} {billable.length === 1 ? "invoice" : "invoices"} ready,{" "}
              {money(Math.round(total * 100) / 100)} in total
              {blocked.length > 0 && (
                <span className="text-destructive">
                  {" "}
                  · {blocked.length} cannot be billed
                </span>
              )}
            </p>
          </div>
          <Button disabled={blocked.length > 0}>Send all</Button>
        </div>

        {blocked.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Add the missing rates first. Joy will not send an invoice it cannot price — a zero
            would tell a family they owe nothing.
          </p>
        )}
      </section>

      <ul className="space-y-4">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.clientPersonId}
            invoice={invoice}
            paid={seedPaidWeeks.has(invoice.clientPersonId)}
          />
        ))}
      </ul>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Outstanding</h2>
          <p className="text-xs text-muted-foreground">
            Money owed on invoices already sent. A cheque or a bank transfer is recorded here —
            the trail gets an entry the moment it lands.
          </p>
        </div>

        {openBalances.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing is outstanding.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {openBalances.map((b) => (
              <li
                key={b.invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{b.invoice.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    Week of {b.invoice.weekStart} · {BALANCE_LABELS[b.state]}
                    {b.daysOverdue > 0 && ` · ${b.daysOverdue} days overdue`}
                    {b.paid > 0 && ` · ${money(b.paid)} received`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{money(b.balance)}</span>
                  <Button size="sm" variant="outline" onClick={() => setPayingBalance(b)}>
                    Record a payment
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecordPaymentDialog
        balance={payingBalance}
        open={payingBalance !== null}
        onOpenChange={(open) => {
          if (!open) setPayingBalance(null);
        }}
      />

      <div className="mt-8 rounded-2xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
        <p className="flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" aria-hidden="true" />
          <span>
            <span className="font-medium">The agreement is corrected.</span>{" "}
            {PACKET_CONTRADICTION}
          </span>
        </p>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Rates shown are placeholders, not Joy's pricing. Time and a half applies over 40 hours and
        on the seven holidays named in the agreement, and never twice for the same hour. The RN's
        admission assessment is free unless a visit is marked otherwise. Suspending care for
        non-payment is permitted by the agreement and is deliberately not automatic.
      </p>
    </>
  );
}
