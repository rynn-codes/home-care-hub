import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { invoiceBalance, BALANCE_LABELS } from "@/domain/billing/receivables";
import {
  PAYMENT_MODE_BLURBS,
  modeFromCollectionMethod,
  type PaymentMode,
} from "@/domain/billing/paymentAuthorization";
import { grantAllows, type PortalGrant } from "@/domain/portal/identity";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { seedBillingAccounts, seedBillingAccountClients } from "@/lib/billingAccountsSeed";
import { cn } from "@/lib/utils";

/**
 * The family's billing area — addendum §8, at prototype fidelity.
 *
 * What it shows is §9.3's allowed list and nothing beyond it: balance, open
 * invoices by their human number, the payment preference in the addendum's own
 * copy, the method summary ("Visa •••• 4242" is the ceiling), and history.
 * What it will not do is pretend: the Pay button initiates and then says so —
 * payment state changes only from a verified processor event (§10), and
 * Stripe is not connected in this prototype, so nothing here ever shows a
 * success it did not receive.
 *
 * ACCESS IS THE GRANT. No `view_invoices` on the caller's grant, no billing
 * card at all — not an empty card, no card, because rendering the frame of a
 * thing somebody may not see confirms the thing exists (§14).
 */
export function FamilyBillingCard({
  grant,
  clientName,
}: {
  grant: PortalGrant;
  clientName: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [paying, setPaying] = useState<string | null>(null);

  const account = useMemo(() => {
    const link = seedBillingAccountClients.find((c) => c.clientName === clientName);
    return link
      ? seedBillingAccounts.find((a) => a.id === link.billingAccountId) ?? null
      : null;
  }, [clientName]);

  const balances = useMemo(
    () =>
      seedIssuedInvoices
        .filter((i) => i.clientName === clientName)
        .map((invoice) => invoiceBalance({ invoice, payments: seedPayments, asOf: today })),
    [clientName, today],
  );

  if (!grantAllows(grant, "view_invoices", today)) return null;

  const open = balances.filter((b) => b.balance > 0 && b.state !== "written_off");
  const history = seedPayments
    .filter((p) => balances.some((b) => b.invoice.id === p.invoiceId))
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
  const currentBalance = Math.round(open.reduce((t, b) => t + b.balance, 0) * 100) / 100;
  const mode: PaymentMode = account ? modeFromCollectionMethod(account.collectionMethod) : "pay_invoice";

  function payInvoice(invoiceNumber: string) {
    setPaying(invoiceNumber);
    // Honest: initiation is all a browser may claim. §10 — a redirect is not
    // proof of payment, and the prototype has no processor behind it.
    toast.info(
      `Payment for ${invoiceNumber} would start here. Joy records the result only when the processor confirms it — Stripe is not connected in this prototype.`,
    );
    setTimeout(() => setPaying(null), 1500);
  }

  return (
    <section aria-label="Billing" className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing</p>

      <div className="mt-2 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p className="text-xl font-semibold tabular-nums">${currentBalance.toFixed(2)}</p>
        </div>

        {open.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {open.map((b) => (
              <li key={b.invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">Invoice #{b.invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.invoice.weekStart} – {b.invoice.weekEnd} · {BALANCE_LABELS[b.state]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">${b.balance.toFixed(2)}</span>
                  {mode === "pay_invoice" && grantAllows(grant, "pay_invoice", today) ? (
                    <Button
                      size="sm"
                      disabled={paying === b.invoice.invoiceNumber}
                      onClick={() => payInvoice(b.invoice.invoiceNumber ?? b.invoice.id)}
                    >
                      {paying === b.invoice.invoiceNumber ? "Starting…" : `Pay $${b.balance.toFixed(2)}`}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {mode === "autopay" ? "AutoPay scheduled" : "Review only"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {open.length === 0 && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            Nothing is owed right now.
          </p>
        )}

        {/* --------------------------------------------- preference (§5) -- */}
        <div className="mt-4 rounded-xl bg-surface-muted p-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment preference
          </p>
          <p className="mt-1 text-sm font-medium">
            {mode === "autopay" ? "AutoPay" : "Pay Invoice"}
            {account?.paymentMethod === "card" && " · Card on file"}
            {account?.paymentMethod === "ach" && " · Bank account on file"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{PAYMENT_MODE_BLURBS[mode]}</p>
        </div>

        {/* ------------------------------------------------ history (§8) -- */}
        {history.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment history
            </p>
            <ul className="mt-1.5 space-y-1">
              {history.slice(0, 4).map((p) => (
                <li
                  key={p.id}
                  className={cn("flex justify-between text-sm", "text-muted-foreground")}
                >
                  <span>
                    {p.receivedOn}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="tabular-nums">${p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
