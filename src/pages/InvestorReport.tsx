import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { INVESTOR_BASIS_LABELS } from "@/domain/agency/settings";
import { investorReportText, investorShareRows } from "@/domain/reports/financials";
import { seedPayments } from "@/lib/receivablesSeed";
import { addMonths } from "@/domain/dates";

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleString([], { month: "long", year: "numeric" });

/**
 * The investor's monthly report: one month, five figures, nobody's name.
 *
 * Collected revenue only, by the month it arrived, less refunds when the
 * setting says so. Nothing about a client is on this page or in the text it
 * produces — it is a report about money, and it has to be safe to forward.
 * "Record as sent" writes the month and amount to the trail; the email
 * itself waits on Spruce, so the text is here to copy.
 */
export default function InvestorReport() {
  const { recordedPayments, investorReportsSent, recordInvestorReportSent } = useDemo();
  const { investor, profile } = useAgencySettings();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonths(`${today.slice(0, 7)}-01`, -i)!.slice(0, 7)), [today]);
  const payments = useMemo(() => [...seedPayments, ...recordedPayments], [recordedPayments]);
  // Last month by default — the report is for a finished month — unless
  // nothing arrived then, in which case the latest month that has money in it.
  const [month, setMonth] = useState(() => {
    const withMoney = new Set(payments.map((p) => p.receivedOn.slice(0, 7)));
    return withMoney.has(months[1]) ? months[1] : months.find((m) => withMoney.has(m)) ?? months[1] ?? months[0];
  });
  const row = useMemo(() => {
    const start = `${month}-01`;
    const end = addMonths(start, 1)!;
    const endDate = new Date(`${end}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    return investorShareRows({ payments, range: { start, end: endDate.toISOString().slice(0, 10), label: month }, percent: investor.sharePercent, basis: investor.basis })[0];
  }, [payments, month, investor.sharePercent, investor.basis]);

  const text = row ? investorReportText({ row, agencyName: profile.name, investorName: investor.name, basis: investor.basis }) : null;
  const sentForMonth = investorReportsSent.filter((r) => r.month === month);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(`${text.subject}\n\n${text.body}`);
      toast.success("Copied", { description: "Paste it into an email." });
    } catch {
      toast.error("Could not copy here. Select the text and copy it.");
    }
  };

  return (
    <>
      <PageHeader
        parents={[{ label: "Reports", to: "/reports" }]}
        title="Investor report"
        description="Collected revenue for one month and the investor's share of it. Figures only; no client information."
        actions={
          <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {months.map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        }
      />

      {!(investor.sharePercent > 0) ? (
        <p className="rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4 text-sm">
          No investor share is set. <Link to="/settings" className="font-medium text-primary underline-offset-4 hover:underline">Settings → Agency → Investor share</Link> holds the percentage and what it is a percentage of.
        </p>
      ) : (
        row && text && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-border bg-surface p-6">
              <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{profile.name} · {monthName(month)}</p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Collected", row.collected],
                    ["Refunded", row.refunded],
                    [INVESTOR_BASIS_LABELS[investor.basis], row.basisAmount],
                    [`Share · ${row.percent}%`, row.due],
                  ] as const
                ).map(([label, value], i) => (
                  <div key={label} className={i === 3 ? "rounded-xl bg-[hsl(var(--primary-soft))] p-4 sm:col-span-2" : "rounded-xl bg-surface-muted p-4"}>
                    <dt className="text-xs text-muted-foreground">{i === 3 ? `Due to ${investor.name || "the investor"}` : label}</dt>
                    <dd className={i === 3 ? "m-0 mt-1 text-3xl font-semibold tabular-nums tracking-tight" : "m-0 mt-1 text-xl font-semibold tabular-nums"}>{usd(value)}</dd>
                    {i === 3 && <p className="m-0 mt-1 text-xs text-muted-foreground">{row.percent}% of {INVESTOR_BASIS_LABELS[investor.basis].toLowerCase()}</p>}
                  </div>
                ))}
              </dl>
              <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                Collected money by the date it arrived, from the same payments Billing shows. Nothing billed and unpaid is in it. Reports → Investor share shows the same figures month by month.
              </p>
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="m-0 text-sm font-semibold">Send it</h2>
                <p className="m-0 mt-1 text-xs text-muted-foreground">
                  {investor.email ? `To ${investor.email}.` : "No address is set in Settings → Agency → Investor share."} Email is not connected yet, so copy the text and send it from your mail; recording it here keeps the trail.
                </p>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-muted p-3 text-xs leading-relaxed">{text.subject}{"\n\n"}{text.body}</pre>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={copy}>
                    <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      recordInvestorReportSent({ month, amount: row.due, percent: row.percent, basis: investor.basis, to: investor.email || investor.name || "investor" });
                      toast.success(`Recorded as sent for ${monthName(month)}`, { description: `${usd(row.due)} to ${investor.email || investor.name || "the investor"}.` });
                    }}
                  >
                    <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Record as sent
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="m-0 text-sm font-semibold">Sent</h2>
                {investorReportsSent.length === 0 ? (
                  <p className="m-0 mt-1 text-xs text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                  <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-xs">
                    {investorReportsSent.slice(0, 12).map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>
                          {monthName(r.month)} · {usd(r.amount)} · {r.percent}%
                        </span>
                        <span className="text-muted-foreground">{new Date(r.sentAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sentForMonth.length > 0 && <p className="m-0 mt-2 text-xs text-[#B54708]">Already recorded for {monthName(month)} {sentForMonth.length === 1 ? "once" : `${sentForMonth.length} times`}.</p>}
              </section>
            </aside>
          </div>
        )
      )}
    </>
  );
}
