import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  PERIOD_LABELS,
  resolvePeriod,
  type ReportPeriod,
} from "@/domain/reports/period";
import {
  REPORT_LABELS,
  caregiverUtilization,
  hoursByService,
  netMarginByClient,
  revenueByMonth,
  outstandingInvoices,
  unbillableHours,
  type ReportKey,
  type ReportResult,
} from "@/domain/reports/reports";
import { csvFilename, reportToCsv } from "@/domain/reports/csv";
import { adjustmentsLog, investorShare, paymentsReceived, payrollCost, reimbursements, revenueByClient, revenueSummary } from "@/domain/reports/financials";
import { useAgencySettings } from "@/lib/agencyStore";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedPayrollPeople, seedTimeEntries } from "@/lib/payrollSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { useDemo } from "@/context/DemoDataProvider";
import { canView, type Area } from "@/domain/access/roles";
import { cn } from "@/lib/utils";

/**
 * Reports.
 *
 * The six Karynn asked for, each computed from the engine that owns the data —
 * `buildInvoice`'s terms, the payroll clock, the schedule, the authorisations.
 * Nothing here has its own copy of anything, so a figure on this page that
 * disagreed with Billing or Payroll would be a bug in one of those rather than
 * a difference of emphasis.
 *
 * The page this replaced had four charts reading `mockData.ts`: hours by
 * caregiver, revenue by client, visit compliance and a hardcoded overtime
 * trend. They looked like reports and were illustrations. That is a worse
 * failure on a reports page than anywhere else in the app, because a reports
 * page is where somebody goes specifically to be told a number they will act
 * on.
 *
 * Two of the five cannot be computed today, and each says exactly which input
 * is missing rather than showing a plausible figure. Net margin in particular
 * returns nothing: it is the single most decision-shaped number here, somebody
 * prices a contract off it, and Joy has neither client rates nor pay rates.
 *
 * THE SIXTH SLOT. The design had an authorisation burn rate; Karynn retired it
 * on 21 August — a policy reimburses the client after the client has paid Joy,
 * so there are no authorised units and no payer to bill — and asked for
 * outstanding invoices in its place. For an agency with no payers that is the
 * report that matters: every dollar owed is a family, and nothing arrives on its
 * own.
 */

/** The nav, in groups: the money first, then the work, then what it cost. */
const GROUPS: Array<{ title: string; keys: ReportKey[] }> = [
  { title: "Money", keys: ["revenue_summary", "revenue_by_client", "outstanding", "payments_received", "adjustments_log", "investor_share"] },
  { title: "Care delivered", keys: ["revenue_by_month", "hours_by_service", "caregiver_utilization", "unbillable", "net_margin"] },
  { title: "Cost", keys: ["payroll_cost", "reimbursements"] },
];

const PERIODS: ReportPeriod[] = ["week", "month", "last_month", "quarter"];

function Bar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  const shown = unit === "$" ? `$${Math.round(value).toLocaleString()}` : `${value}${unit}`;

  return (
    <li className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-right text-sm text-muted-foreground">
        {label}
      </span>
      <span className="flex h-6 flex-1 items-center gap-2">
        <span
          className="h-6 rounded-md bg-primary/85"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        <span className="shrink-0 text-sm font-medium tabular-nums">{shown}</span>
      </span>
    </li>
  );
}

function ReportBody({ report }: { report: ReportResult }) {
  if (report.state === "needs_input") {
    return (
      <div className="rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" aria-hidden="true" />
          Joy cannot produce this yet
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {report.missing?.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (report.state === "empty") {
    return (
      <p className="rounded-xl border border-border bg-surface-muted p-6 text-center text-sm text-muted-foreground">
        Nothing in this period.
      </p>
    );
  }

  const max = report.chart
    ? Math.max(...report.rows.map((r) => Number(r[report.chart!.valueKey]) || 0), 0)
    : 0;

  return (
    <>
      {report.chart && (
        <ul className="mb-6 space-y-2">
          {report.rows.map((row) => (
            <Bar
              key={String(row[report.chart!.labelKey])}
              label={String(row[report.chart!.labelKey])}
              value={Number(row[report.chart!.valueKey]) || 0}
              max={max}
              unit={report.chart!.unit}
            />
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {report.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                {report.columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-2",
                      c.numeric ? "text-right tabular-nums" : "text-left",
                    )}
                  >
                    {c.money
                      ? `$${Number(row[c.key]).toLocaleString(undefined, {
                          minimumFractionDigits: Number.isInteger(Number(row[c.key])) ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}`
                      : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Reports() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [selected, setSelected] = useState<ReportKey>("revenue_summary");
  const { recordedPayments, issuedInvoices, invoiceEdits, refunds, visitExpenses, currentUser } = useDemo();
  const agency = useAgencySettings();

  // The seeds plus anything recorded through the app, with edits to seeded
  // invoices applied — the same list Billing reads, so a figure here and a
  // figure there are the same fact.
  const invoices = useMemo(
    () => [...issuedInvoices, ...seedIssuedInvoices].map((i) => ({ ...i, ...(invoiceEdits[i.id] ?? {}) })),
    [issuedInvoices, invoiceEdits],
  );
  const payments = useMemo(() => [...seedPayments, ...recordedPayments], [recordedPayments]);
  const rateFor = useMemo(() => {
    const byName = new Map(seedEmployees.map((e) => [e.name, typeof e.baseRate === "number" ? e.baseRate : null]));
    return (name: string) => byName.get(name) ?? null;
  }, []);

  const range = useMemo(() => resolvePeriod(period, today), [period, today]);

  const nameFor = useMemo(() => {
    const byId = new Map(seedPayrollPeople.map((p) => [p.personId, p.name]));
    return (personId: string) => byId.get(personId) ?? personId;
  }, []);

  const reports = useMemo<Record<ReportKey, ReportResult>>(
    () => ({
      revenue_by_month: revenueByMonth({ visits: seedVisits, terms: seedBillingTerms, range }),
      hours_by_service: hoursByService({ visits: seedVisits, range }),
      caregiver_utilization: caregiverUtilization({
        visits: seedVisits,
        entries: seedTimeEntries,
        nameFor,
        range,
      }),
      net_margin: netMarginByClient({
        terms: seedBillingTerms,
        // The base rate on each employee's record, by name — the same figure
        // Payroll prices a week with. Placeholders until Karynn enters the
        // real ones, and said so on the Employees screen.
        payRates: new Map(
          seedEmployees.filter((e) => typeof e.baseRate === "number").map((e) => [e.name, e.baseRate as number]),
        ),
        visits: seedVisits,
        range,
      }),
      unbillable: unbillableHours({ visits: seedVisits, terms: seedBillingTerms, range }),
      // Deliberately not filtered by the period. "Who owes us money" is a
      // question about now — narrowing it to last month would hide the
      // ninety-day debt, which is the only one that really matters.
      outstanding: outstandingInvoices({ invoices, payments, asOf: today }),
      revenue_summary: revenueSummary({ invoices, payments, range }),
      revenue_by_client: revenueByClient({ invoices, payments, range }),
      payments_received: paymentsReceived({ invoices, payments, range }),
      adjustments_log: adjustmentsLog({ invoices, refunds, range }),
      investor_share: investorShare({ payments, range, percent: agency.investor.sharePercent, basis: agency.investor.basis, investorName: agency.investor.name }),
      payroll_cost: payrollCost({ entries: seedTimeEntries, nameFor, rateFor, range }),
      reimbursements: reimbursements({ visitExpenses, visits: seedVisits, mileageRatePerMile: agency.mileageRatePerMile, range }),
    }),
    [range, today, nameFor, invoices, payments, refunds, visitExpenses, rateFor, agency.investor.sharePercent, agency.investor.basis, agency.investor.name, agency.mileageRatePerMile],
  );

  const report = reports[selected];

  function exportCsv() {
    const blob = new Blob([reportToCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename(report, today);
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${report.title} exported`);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Financial and operational analytics, computed from the same engines the screens read."
        actions={
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === period ? "default" : "outline"}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Reports">
          {GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
          <ul className="space-y-1.5">
            {group.keys.map((key) => {
              const r = reports[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-current={key === selected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                      key === selected
                        ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                        : "border-border bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <span>{REPORT_LABELS[key]}</span>
                    {r.state === "needs_input" && (
                      <AlertCircle
                        className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]"
                        aria-label="Cannot be produced yet"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
          ))}

          {/* The reports that are screens of their own. Each card is the
              link, not a card with a button in it. */}
          <div className="mt-6 space-y-2">
            {(
              [
                { to: "/reports/investor", area: "reports", title: "Investor report", blurb: "One month's collected revenue and the share due. No client information." },
                { to: "/reports/supervision", area: "supervision", title: "Supervision", blurb: "Every RN supervisory visit, and who is due." },
                { to: "/reports/incidents", area: "incidents", title: "Incidents", blurb: "The agency-wide incident log and each one's obligations." },
                { to: "/reports/incidents/annual", area: "incidents", title: "Yearly incident report", blurb: "Every incident in the year, and whether Joy met each obligation." },
                { to: "/reports/audit", area: "audit", title: "Audit", blurb: "Who did what, when — the trail a surveyor reads." },
              ] as ReadonlyArray<{ to: string; area: Area; title: string; blurb: string }>
            )
              // Only the screens this role may open. A card that leads to a
              // refusal is a promise the page cannot keep.
              .filter((card) => canView(currentUser.role, card.area))
              .map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {card.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{card.blurb}</p>
              </Link>
            ))}
          </div>
        </nav>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{report.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{report.subtitle}</p>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>

          <ReportBody report={report} />

          {report.note && report.state === "computed" && (
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              {report.note}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
