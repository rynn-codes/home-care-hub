import { useMemo, useState } from "react";
import { Eye, EyeOff, Info, Download, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { PACKET_CONTRADICTION, type Invoice } from "@/domain/billing/invoice";
import {
  planBillingRun,
  upcomingBillingWeek,
  RUN_EXCEPTION_LABELS,
} from "@/domain/billing/run";
import { approvalRefusals, APPROVAL_MESSAGES, linesFromInvoice } from "@/domain/billing/approval";
import {
  seedBillingAccounts,
  seedBillingAccountClients,
  seedRatePlanVersions,
} from "@/lib/billingAccountsSeed";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { invoiceBalance, BALANCE_LABELS, type BalanceState, type InvoiceBalance } from "@/domain/billing/receivables";
import { RecordPaymentDialog } from "@/components/billing/RecordPaymentDialog";
import { useDemo } from "@/context/DemoDataProvider";
import { seedVisits } from "@/lib/schedulingSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import { cn } from "@/lib/utils";

/**
 * Billing, in the updated mock's frame — Karynn's ruling, 24 August: adopt the
 * full updated design, "Invoices | Payers | Profitability", where Invoices is a
 * single list with a status filter (Needs review · Ready · Sent · Past due ·
 * Paid · Adjusted) and approve happens inline on the row.
 *
 * She had earlier (23 Aug) asked for a To send | Sent | Profitability split and
 * for the approval to stay one-click simple; the updated mock supersedes the
 * tab shape but not that simplicity, so every row still carries exactly one
 * primary action — Approve, then Send — and the batch banner still sends the
 * whole ready set at once.
 *
 * The engine underneath is unchanged: the Saturday run drafts from the standing
 * schedule, approval goes through the same refusals the database enforces, and
 * sending assigns the JH- number and lands the debt in Outstanding. Two
 * supersessions of the mock stand, both in MOCKUP_ALIGNMENT.md: the mock's "due
 * Wednesday" gives way to Karynn's Saturday-run answers, and neither
 * Profitability nor Payers prints a rate or a net figure — caregiver pay lives
 * in Gusto and client rates are e-mailed privately, never stored here, so the
 * columns that would need them say so instead of multiplying fiction.
 */

type Tab = "invoices" | "payers" | "profit";
type RowStatus = "Needs review" | "Ready" | "Sent" | "Past due" | "Paid" | "Adjusted";

const FILTERS: Array<RowStatus | "All"> = [
  "All",
  "Needs review",
  "Ready",
  "Sent",
  "Past due",
  "Paid",
  "Adjusted",
];

// The order the unified list falls into under "All": the work first, the
// settled last.
const STATUS_ORDER: RowStatus[] = ["Needs review", "Ready", "Sent", "Past due", "Adjusted", "Paid"];

const STATUS_PILL: Record<RowStatus, string> = {
  "Needs review": "bg-[#FFFAEB] text-[#B54708]",
  Ready: "bg-[#ECFDF3] text-[#027A48]",
  Sent: "bg-[#EEF0FE] text-primary",
  "Past due": "bg-[#FEF3F2] text-[#B42318]",
  Paid: "bg-[#F3F3F6] text-[#5B6274]",
  Adjusted: "bg-[#ECFDF7] text-[#0B7268]",
};

const BALANCE_PILL: Record<BalanceState, string> = {
  paid: "bg-[#ECFDF3] text-[#027A48]",
  part_paid: "bg-[#FFFAEB] text-[#B54708]",
  outstanding: "bg-[#EEF0FE] text-primary",
  overdue: "bg-[#FEF3F2] text-[#B42318]",
  written_off: "bg-[#F3F3F6] text-[#5B6274]",
  overpaid: "bg-[#ECFDF7] text-[#0B7268]",
};

const initialsOf = (name: string) =>
  name.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** The row model the Invoices list renders — a draft not yet sent, or an issued invoice. */
interface InvoiceRow {
  key: string;
  clientName: string;
  clientPersonId: string;
  period: string;
  status: RowStatus;
  amount: number | null;
  method: string;
  draft: Invoice | null;
  balance: InvoiceBalance | null;
}

export default function Billing() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [priv, setPriv] = useState(false);
  const [filter, setFilter] = useState<RowStatus | "All">("All");
  const [period, setPeriod] = useState<string>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [payingBalance, setPayingBalance] = useState<InvoiceBalance | null>(null);
  const { approvedDrafts, approveDraft, sendInvoice, recordedPayments, issuedInvoices, currentUser } = useDemo();

  const money = (n: number | null) =>
    n === null ? "—" : priv ? "••••••" : `${n < 0 ? "(" : ""}$${Math.abs(n).toFixed(2)}${n < 0 ? ")" : ""}`;

  const weekStart = useMemo(() => upcomingBillingWeek(new Date().toISOString()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  // The Saturday run, §7.2 steps 1–4. The demo's schedule seed carries only
  // the current week, so the run projects the standing weekly schedule into
  // the target week — billing in advance bills the schedule as it stands.
  const run = useMemo(() => {
    const seedMonday = new Date(seedVisits[0]?.startsAt ?? new Date().toISOString());
    seedMonday.setHours(0, 0, 0, 0);
    seedMonday.setDate(seedMonday.getDate() - ((seedMonday.getDay() + 6) % 7));
    const targetMonday = new Date(`${weekStart}T00:00:00`);
    targetMonday.setDate(targetMonday.getDate() + 2);
    const offsetDays = Math.round((targetMonday.getTime() - seedMonday.getTime()) / 86_400_000);

    const shift = (iso: string) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + offsetDays);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    };
    const projected: Visit[] = seedVisits.map((v) => ({
      ...v,
      id: `${v.id}-next`,
      startsAt: shift(v.startsAt),
      endsAt: shift(v.endsAt),
    }));

    return planBillingRun({
      periodStart: weekStart,
      periodEnd: weekEnd,
      visits: projected,
      accounts: seedBillingAccounts,
      accountClients: seedBillingAccountClients,
      rateVersions: seedRatePlanVersions,
    });
  }, [weekStart, weekEnd]);

  const draftKey = (draft: Invoice) =>
    `${draft.clientPersonId}:${draft.weekStart}:${draft.ratePlanVersionId ?? "no-rate"}`;

  const statusOf = (draft: Invoice): "needs_approval" | "approved" | "sent" => {
    const a = approvedDrafts[draftKey(draft)];
    if (a?.sentAs) return "sent";
    if (a) return "approved";
    return "needs_approval";
  };

  function approve(draft: Invoice) {
    const lines = linesFromInvoice(draft);
    const approvedTotal = draft.subtotal ?? 0;
    const refusals = approvalRefusals({
      state: "pending_approval",
      lines,
      total: approvedTotal,
      byUserId: currentUser.name,
    });
    if (refusals.length > 0) {
      toast.error(APPROVAL_MESSAGES[refusals[0]]);
      return;
    }
    approveDraft(draftKey(draft), {
      total: approvedTotal,
      lineCount: lines.length,
      ratePlanVersionId: draft.ratePlanVersionId,
    });
    toast.success(
      `${draft.clientName}'s invoice approved — $${approvedTotal.toFixed(2)} for the week of ${draft.weekStart}.`,
    );
  }

  function send(draft: Invoice) {
    sendInvoice({
      key: draftKey(draft),
      clientPersonId: draft.clientPersonId,
      clientName: draft.clientName,
      weekStart: draft.weekStart,
      weekEnd: draft.weekEnd,
      total: draft.subtotal ?? 0,
    });
    toast.success(
      `${draft.clientName}'s invoice is on its way — the family is told one exists, and the figures wait in the portal.`,
    );
  }

  const pending = run.drafts.filter((d) => statusOf(d) === "needs_approval").length;
  const approvedUnsent = run.drafts.filter((d) => statusOf(d) === "approved");
  const allClear = pending === 0 && run.drafts.length > 0;
  const batchTotal = run.drafts.reduce((t, d) => t + (d.subtotal ?? 0), 0);
  const batchHours = Math.round(
    run.drafts.reduce((t, d) => t + d.lines.reduce((h, l) => h + l.hours, 0), 0) * 100,
  ) / 100;

  // Issued invoices and every payment against them — the seeds plus anything
  // recorded through the app. One list, so this screen and the outstanding
  // report cannot disagree about who owes what.
  const balances = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const allPayments = [...seedPayments, ...recordedPayments];
    return [...issuedInvoices, ...seedIssuedInvoices].map((invoice) =>
      invoiceBalance({ invoice, payments: allPayments, asOf: today }),
    );
  }, [recordedPayments, issuedInvoices]);

  const openBalances = useMemo(
    () =>
      balances
        .filter((b) => b.balance > 0 && b.state !== "written_off")
        .sort((a, b) => b.daysOverdue - a.daysOverdue),
    [balances],
  );
  const unpaidTotal = Math.round(openBalances.reduce((t, b) => t + b.balance, 0) * 100) / 100;

  const methodFor = (clientPersonId: string) => {
    const method = seedBillingTerms.find((t) => t.clientPersonId === clientPersonId)?.paymentMethod;
    return method ? method.toUpperCase() : "—";
  };

  // ---- the unified Invoices list: drafts not yet sent + every issued invoice.
  const balanceStatus = (b: InvoiceBalance): RowStatus => {
    if (b.state === "paid" || b.state === "overpaid") return "Paid";
    if (b.state === "overdue") return "Past due";
    if (b.state === "written_off") return "Adjusted";
    return "Sent"; // outstanding — partial payment does not exist in this product
  };

  const rows = useMemo<InvoiceRow[]>(() => {
    const draftRows: InvoiceRow[] = run.drafts
      .filter((d) => statusOf(d) !== "sent") // sent drafts appear as issued invoices below
      .map((d) => ({
        key: draftKey(d),
        clientName: d.clientName,
        clientPersonId: d.clientPersonId,
        period: `${d.weekStart} – ${d.weekEnd}`,
        status: statusOf(d) === "approved" ? "Ready" : "Needs review",
        amount: d.subtotal,
        method: methodFor(d.clientPersonId),
        draft: d,
        balance: null,
      }));
    const issuedRows: InvoiceRow[] = balances.map((b) => ({
      key: b.invoice.id,
      clientName: b.invoice.clientName,
      clientPersonId: b.invoice.clientPersonId,
      period: `${b.invoice.weekStart} – ${b.invoice.weekEnd}`,
      status: balanceStatus(b),
      amount: b.invoice.total,
      method: methodFor(b.invoice.clientPersonId),
      draft: null,
      balance: b,
    }));
    return [...draftRows, ...issuedRows].sort(
      (a, z) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(z.status),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.drafts, balances, approvedDrafts]);

  // Service period options — Sat–Fri ranges present in the data, plus all.
  const periodOptions = useMemo(() => {
    const set = new Map<string, string>();
    set.set("all", "All periods");
    set.set(`${weekStart} – ${weekEnd}`, `${weekStart} – ${weekEnd} (this week)`);
    for (const r of rows) set.set(r.period, r.period);
    return Array.from(set, ([value, label]) => ({ value, label }));
  }, [rows, weekStart, weekEnd]);

  const visibleRows = rows
    .filter((r) => period === "all" || r.period === period)
    .filter((r) => filter === "All" || r.status === filter);

  const countByStatus = (s: RowStatus | "All") =>
    s === "All"
      ? rows.filter((r) => period === "all" || r.period === period).length
      : rows.filter((r) => (period === "all" || r.period === period) && r.status === s).length;

  const exportView = () => {
    const header = ["Client", "Period", "Status", "Method", "Amount"];
    const body = visibleRows.map((r) => [
      r.clientName,
      r.period,
      r.status,
      r.method,
      r.amount === null ? "" : r.amount.toFixed(2),
    ]);
    const csv = [header, ...body].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `joy-invoices-${filter.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visibleRows.length} ${visibleRows.length === 1 ? "row" : "rows"} as shown.`);
  };

  // Karynn's week, not the mock's: drafts Saturday, approve Sat–Mon, out
  // Monday, due the Sunday before care; the dunning rhythm fills the gaps.
  const weekday = new Date().getDay();
  const cycle = [
    { day: "Saturday", what: "Run drafts from the standing schedule", at: weekday === 6 },
    { day: "Sat – Mon", what: "Review and approve — nothing goes out unapproved", at: weekday === 0 || weekday === 1 || weekday === 6 },
    { day: "Monday", what: "Approved invoices go out", at: weekday === 1 },
    { day: "Wednesday", what: "Email reminder if unpaid — daily until paid", at: weekday === 3 },
    { day: "Thursday", what: "Text joins the emails", at: weekday === 4 },
    { day: "Friday", what: "Call and text if still unpaid", at: weekday === 5 },
    { day: "Sunday", what: "Payment gate — unpaid means care pauses", at: weekday === 0 },
  ];

  // Payers — who is responsible for each client's bill and how they pay, from
  // the real roster and billing terms. No rate column: rates are e-mailed
  // privately and never stored here (the agreement is corrected to say so).
  const payers = useMemo(
    () =>
      seedClients
        .filter((c) => c.status !== "discharged")
        .map((c) => {
          // The roster's payerLine names the method ("Weekly invoicing · ACH");
          // read it from there so the column and the line can never disagree.
          const line = c.payerLine ?? "";
          const method = /ach/i.test(line)
            ? "ACH"
            : /card/i.test(line)
              ? "CARD"
              : /check/i.test(line)
                ? "CHECK"
                : methodFor(c.personId);
          return {
            clientPersonId: c.personId,
            name: `${c.lastName}, ${c.preferredName || c.firstName}`,
            responsible: c.responsiblePartyName
              ? `${c.responsiblePartyName}${c.responsiblePartyLine ? ` · ${c.responsiblePartyLine.split(" · ")[0]}` : ""}`
              : "Self",
            type: c.payer ?? "Private Pay",
            method,
            terms: line || "—",
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <PageHeader
        title="Billing"
        description="Review this week's drafts, then approve and send. Out Monday, due the Sunday before care."
        actions={
          <>
            {tab === "invoices" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPeriodOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={periodOpen}
                  className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
                >
                  {periodOptions.find((o) => o.value === period)?.label ?? "All periods"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
                {periodOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPeriodOpen(false)} aria-hidden="true" />
                    <ul
                      role="listbox"
                      className="absolute right-0 z-20 mt-1 max-h-[280px] w-[240px] overflow-y-auto rounded-[10px] border border-[#ECECF1] bg-white p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]"
                    >
                      {periodOptions.map((o) => (
                        <li key={o.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={period === o.value}
                            onClick={() => {
                              setPeriod(o.value);
                              setPeriodOpen(false);
                            }}
                            className={cn(
                              "w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[#FAFAFB]",
                              period === o.value ? "font-medium text-primary" : "text-[#5B6274]",
                            )}
                          >
                            {o.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPriv((v) => !v)}
              aria-pressed={priv}
              className={cn(
                "flex h-[34px] items-center gap-[7px] rounded-[9px] border px-3 text-[13px] transition-colors",
                priv
                  ? "border-primary bg-[#EEF0FE] text-primary"
                  : "border-[#ECECF1] bg-white text-[#5B6274] hover:bg-[#FAFAFB] hover:text-foreground",
              )}
            >
              {priv ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              {priv ? "Amounts hidden" : "Hide amounts"}
            </button>
            <button
              type="button"
              onClick={exportView}
              className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3.5 text-[13px] font-medium text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
            >
              <Download className="h-[13px] w-[13px]" aria-hidden="true" />
              Export
            </button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-5 overflow-x-auto border-b border-[#ECECF1]" role="tablist" aria-label="Billing views">
        {(
          [
            ["invoices", "Invoices", String(rows.length)],
            ["payers", "Payers", String(payers.length)],
            ["profit", "Profitability", null],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setOpenCard(null);
            }}
            className={cn(
              "-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
              tab === value
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {count !== null && (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-[11px]",
                  tab === value ? "bg-[#EEF0FE] text-primary" : "bg-[#F3F3F6] text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------- Invoices -- */}
      {tab === "invoices" && (
        <section aria-label="Invoices" className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_296px]">
          <div className="flex flex-col gap-3.5">
            {/* The batch banner — one action for the whole ready set, the
                simplicity Karynn asked us to keep. */}
            {(pending > 0 || approvedUnsent.length > 0) && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-2xl border bg-white px-5 py-4",
                  allClear ? "border-[#D3F0DF]" : "border-[#ECECF1]",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    This week's batch
                  </span>
                  <span className="text-[15px] font-semibold tracking-[-.01em]">
                    {allClear ? "Ready to send" : `${pending} of ${run.drafts.length} need review`}
                  </span>
                  <span className="text-[12.5px] text-[#5B6274] [text-wrap:pretty]">
                    The Saturday run · care week {weekStart} – {weekEnd} · {batchHours} hrs · {money(batchTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!allClear || approvedUnsent.length === 0}
                  title={allClear ? undefined : "Approve every draft first"}
                  onClick={() => approvedUnsent.forEach(send)}
                  className={cn(
                    "ml-auto h-[38px] rounded-[10px] px-4 text-[13.5px] font-medium transition-colors",
                    allClear && approvedUnsent.length > 0
                      ? "bg-primary text-white hover:bg-[#2A1BD1]"
                      : "cursor-not-allowed bg-[#F1F2F6] text-muted-foreground/50",
                  )}
                >
                  {allClear && approvedUnsent.length > 0
                    ? `Send ${approvedUnsent.length} ${approvedUnsent.length === 1 ? "invoice" : "invoices"}`
                    : "Review first"}
                </button>
              </div>
            )}

            {/* Exceptions with nobody's draft to sit inside. */}
            {run.exceptions
              .filter((e) => !e.clientName)
              .map((e, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-[#FCE8B6] bg-[#FFFAEB] px-3.5 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
                  <span className="text-[12.5px] leading-[1.5] text-[#7A6320]">
                    <span className="font-medium text-foreground">{RUN_EXCEPTION_LABELS[e.kind]}.</span>{" "}
                    {e.detail}
                  </span>
                </div>
              ))}

            {/* The status filter. */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter invoices by status">
              {FILTERS.map((f) => {
                const count = countByStatus(f);
                return (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                      filter === f
                        ? "border-primary bg-[#EEF0FE] font-medium text-primary"
                        : "border-[#ECECF1] bg-white text-[#5B6274] hover:bg-[#FAFAFB]",
                    )}
                  >
                    {f}
                    <span className={cn("text-[11px]", filter === f ? "text-primary" : "text-muted-foreground")}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5">
              {visibleRows.length === 0 && (
                <div className="rounded-[14px] border border-[#ECECF1] bg-white px-[18px] py-10 text-center text-[13px] text-muted-foreground">
                  Nothing in “{filter}” for this period.
                </div>
              )}

              {visibleRows.map((row) => {
                const isOpen = openCard === row.key;
                const flags = row.draft
                  ? run.exceptions.filter((e) => e.clientPersonId === row.clientPersonId)
                  : [];
                const approved = row.draft ? approvedDrafts[draftKey(row.draft)] : undefined;
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "overflow-hidden rounded-[14px] border bg-white",
                      row.status === "Needs review" && flags.length > 0 ? "border-[#FCE8B6]" : "border-[#ECECF1]",
                    )}
                  >
                    <div className="flex items-center gap-3.5 px-[18px] py-4">
                      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
                        {initialsOf(row.clientName)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenCard(isOpen ? null : row.key)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                      >
                        <span className="flex min-w-0 flex-col gap-[3px]">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">{row.clientName}</span>
                            <span
                              className={cn(
                                "inline-flex whitespace-nowrap rounded-full px-2 py-[2px] text-[11px] font-medium",
                                STATUS_PILL[row.status],
                              )}
                            >
                              {row.status}
                              {row.balance && row.balance.daysOverdue > 0 && ` · ${row.balance.daysOverdue}d`}
                            </span>
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">
                            {row.draft
                              ? `${row.draft.lines.reduce((h, l) => h + l.hours, 0)} hrs · week of ${row.draft.weekStart}`
                              : `${row.balance?.invoice.invoiceNumber ?? "—"} · ${row.period} · ${row.method}`}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "ml-auto inline-block text-[13px] text-muted-foreground/50 transition-transform",
                            isOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        >
                          ⌄
                        </span>
                      </button>
                      <span className={cn("whitespace-nowrap text-[15px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                        {money(row.amount)}
                      </span>
                      {/* One primary action per row. */}
                      {row.status === "Needs review" && row.draft && (
                        <button
                          type="button"
                          onClick={() => approve(row.draft!)}
                          className="h-[34px] flex-none rounded-[9px] bg-primary px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                        >
                          Approve
                        </button>
                      )}
                      {row.status === "Ready" && row.draft && (
                        <span className="flex flex-none items-center gap-2">
                          <span className="whitespace-nowrap text-xs text-[#027A48]">✓ {approved?.by}</span>
                          <button
                            type="button"
                            onClick={() => send(row.draft!)}
                            className="h-[34px] rounded-[9px] bg-primary px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                          >
                            Send
                          </button>
                        </span>
                      )}
                      {(row.status === "Sent" || row.status === "Past due") && row.balance && (
                        <button
                          type="button"
                          onClick={() => setPayingBalance(row.balance)}
                          className="h-[34px] flex-none rounded-[9px] border border-[#ECECF1] bg-white px-3.5 text-[12.5px] text-primary transition-colors hover:bg-[#EEF0FE]"
                        >
                          Record payment
                        </button>
                      )}
                    </div>

                    {/* Draft review flags — the run's real exceptions. */}
                    {flags.length > 0 && (
                      <div className="flex flex-col gap-px px-[18px] pb-3.5">
                        {flags.map((f, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2.5 rounded-[10px] px-3 py-2",
                              f.blocksDraft ? "bg-[#FFFAEB]" : "bg-[#FAFAFB]",
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 flex-none rounded-full", f.blocksDraft ? "bg-[#F79009]" : "bg-[#12B76A]")}
                              aria-hidden="true"
                            />
                            <span className="flex flex-col gap-px leading-[1.4]">
                              <span className="text-[12.5px]">{RUN_EXCEPTION_LABELS[f.kind]}</span>
                              <span className="text-[11.5px] text-muted-foreground">{f.detail}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isOpen && (
                      <div className="flex flex-col gap-2 border-t border-[#F3F3F6] bg-[#FCFCFD] px-[18px] py-4">
                        {row.draft ? (
                          <>
                            <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                              Lines on this invoice
                            </span>
                            <div className="flex flex-col">
                              {row.draft.lines.map((l, i) => (
                                <div key={i} className="flex items-center gap-3 border-b border-[#F3F3F6] py-2 last:border-0">
                                  <span className="text-[12.5px] text-[#5B6274]">
                                    {l.description}
                                    {l.multiplier !== 1 && (
                                      <span className="ml-1.5 text-[11px] text-[#B54708]">{l.multiplier}×</span>
                                    )}
                                  </span>
                                  <span className="text-[11.5px] text-muted-foreground/60">
                                    {l.hours} h{l.rate != null ? ` × ${money(l.rate)}` : ""}
                                  </span>
                                  <span
                                    className={cn(
                                      "ml-auto text-[12.5px] tabular-nums",
                                      (l.amount ?? 0) < 0 ? "text-[#B42318]" : "text-foreground",
                                    )}
                                  >
                                    {money(l.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <Link
                              to="/scheduling"
                              className="self-start pt-1 text-[12px] text-primary hover:text-[#2A1BD1]"
                            >
                              View the shifts behind this →
                            </Link>
                          </>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
                            {[
                              ["Due", row.balance?.invoice.dueOn ?? "—"],
                              ["Received", row.balance && !priv ? `$${row.balance.paid.toFixed(2)}` : row.balance ? "••••" : "—"],
                              ["Last payment", row.balance?.lastPaymentOn ?? "—"],
                              ["Balance", money(row.balance?.balance ?? null)],
                            ].map(([label, value]) => (
                              <div key={label} className="flex flex-col gap-[2px]">
                                <span className="text-[11px] text-muted-foreground">{label}</span>
                                <span className="tabular-nums">{value}</span>
                              </div>
                            ))}
                            <Link to="/scheduling" className="col-span-2 pt-1 text-[12px] text-primary hover:text-[#2A1BD1]">
                              View the shifts behind this →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Skipped clients — a draft would be a guess wearing an
                  invoice's clothes, shown under review-focused filters. */}
              {(filter === "All" || filter === "Needs review") &&
                (period === "all" || period === `${weekStart} – ${weekEnd}`) &&
                run.skipped.map((s) => {
                  const because = run.exceptions.find(
                    (e) => e.clientPersonId === s.clientPersonId && e.blocksDraft,
                  );
                  return (
                    <div key={s.clientPersonId} className="overflow-hidden rounded-[14px] border border-[#FCE8B6] bg-white">
                      <div className="flex items-center gap-3.5 px-[18px] py-4">
                        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#FFFAEB] text-[11.5px] font-semibold text-[#B54708]">
                          {initialsOf(s.clientName)}
                        </span>
                        <span className="flex min-w-0 flex-col gap-[3px]">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">{s.clientName}</span>
                            <span className="inline-flex whitespace-nowrap rounded-full bg-[#FFFAEB] px-2 py-[2px] text-[11px] font-medium text-[#B54708]">
                              No draft
                            </span>
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">
                            {because?.detail ?? RUN_EXCEPTION_LABELS[s.because]}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* -------------------------------------------------- the rail -- */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                The week
              </h2>
              <div className="flex flex-col">
                {cycle.map((c) => (
                  <div key={c.day} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-2 last:border-0">
                    <span
                      className={cn("h-[7px] w-[7px] flex-none rounded-full", c.at ? "bg-primary" : "bg-[#E4E4EA]")}
                      aria-hidden="true"
                    />
                    <span className="flex flex-col leading-[1.3]">
                      <span className={cn("text-[12.5px]", c.at ? "font-semibold text-primary" : "font-normal")}>
                        {c.day}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">{c.what}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <section aria-label="Outstanding" className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
              <span className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
                <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                  Outstanding
                </h2>
                <span className={cn("ml-auto text-[12.5px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                  {money(unpaidTotal)}
                </span>
              </span>
              {openBalances.length === 0 ? (
                <p className="m-0 py-1 text-[12.5px] text-muted-foreground">Nothing is outstanding.</p>
              ) : (
                <div className="flex flex-col">
                  {openBalances.map((b) => (
                    <div key={b.invoice.id} className="flex flex-col gap-[3px] border-b border-[#F3F3F6] py-2.5 last:border-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px]">{b.invoice.clientName}</span>
                        <span className={cn("ml-auto text-[12.5px] font-medium tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                          {money(b.balance)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-[11.5px] leading-[1.4]",
                          b.state === "overdue" ? "text-[#B42318]" : "text-[#B54708]",
                        )}
                      >
                        {b.invoice.invoiceNumber ? `${b.invoice.invoiceNumber} · ` : ""}
                        Week of {b.invoice.weekStart} · {BALANCE_LABELS[b.state]}
                        {b.daysOverdue > 0 && ` · ${b.daysOverdue} days overdue`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPayingBalance(b)}
                        className="self-start text-[12px] text-primary hover:text-[#2A1BD1]"
                      >
                        Record a payment
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="m-0 border-t border-[#F3F3F6] pt-2 text-[11px] text-muted-foreground [text-wrap:pretty]">
                The dunning rhythm handles notices — email from Wednesday, text Thursday, call
                Friday, the Sunday gate. Sending them needs Spruce, which isn't wired.
              </p>
            </section>

            <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
              <span className="flex items-center gap-2">
                <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                  Stripe
                </h2>
                <span className="ml-auto rounded-full bg-[#F3F3F6] px-2 py-[2px] text-[11px] font-medium text-[#5B6274]">
                  Not connected
                </span>
              </span>
              <div className="flex flex-col">
                {[
                  ["Next payout", "—"],
                  ["In transit", "—"],
                  ["Failed payments", "None recorded"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-2 last:border-0">
                    <span className="text-[12.5px] text-muted-foreground">{label}</span>
                    <span className="ml-auto text-[12.5px]">{value}</span>
                  </div>
                ))}
              </div>
              <p className="m-0 text-[11px] text-muted-foreground [text-wrap:pretty]">
                The plumbing is ready (payment authorizations, event receipts, payment-method
                views); the developer connects the live account.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- Payers -- */}
      {tab === "payers" && (
        <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  {["Client", "Responsible party", "Payer type", "Method", "Authorization"].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payers.map((p) => (
                  <tr key={p.clientPersonId} className="border-t border-[#F3F3F6] hover:bg-[#FAFAFB]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">
                          {initialsOf(p.name)}
                        </span>
                        <span className="text-[13px]">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#5B6274]">{p.responsible}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium",
                          p.type.includes("LTC") ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#EEF0FE] text-primary",
                        )}
                      >
                        {p.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">{p.method}</td>
                    <td className="px-4 py-3 text-[12.5px] text-muted-foreground [text-wrap:pretty]">{p.terms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 border-t border-[#ECECF1] bg-[#FCFCFD] px-4 py-3 text-[11px] text-muted-foreground [text-wrap:pretty]">
            Everyone is private pay; a long-term care policy reimburses the client after they
            have paid Joy, so LTC never appears as a payer Joy bills. Hourly rates are e-mailed
            privately and deliberately not stored here, so there is no rate column.
          </p>
        </div>
      )}

      {/* ------------------------------------------------- Profitability -- */}
      {tab === "profit" && (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white px-[18px] py-4">
            <span className="flex flex-col gap-[3px]">
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Net profit · week of {weekStart}
              </span>
              <span className="flex items-baseline gap-2.5">
                <span className="text-2xl font-semibold tracking-[-.01em] text-muted-foreground">
                  Can't compute yet
                </span>
              </span>
            </span>
            <span className="ml-auto max-w-[380px] text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
              Net needs the caregiver cost of each week, and pay rates live in Gusto, not Joy.
              The billed side below is real; the cost side says so instead of multiplying
              placeholder rates into something that reads like a margin.
            </span>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    {["Client", "Billable hrs", "Billed", "Caregiver cost", "Net", "Net %"].map((label, i) => (
                      <th
                        key={label}
                        className={cn(
                          "whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground",
                          i === 0 ? "text-left" : "text-right",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.drafts.map((draft) => (
                    <tr key={draft.clientPersonId} className="border-t border-[#F3F3F6]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">
                            {initialsOf(draft.clientName)}
                          </span>
                          <span className="text-[13px]">{draft.clientName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] text-[#5B6274] tabular-nums">
                        {draft.lines.reduce((h, l) => h + l.hours, 0)}
                      </td>
                      <td className={cn("px-4 py-3 text-right text-[13px] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                        {money(draft.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">In Gusto</td>
                      <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">—</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ECECF1] bg-[#FCFCFD]">
                    <td className="px-4 py-3 text-[12.5px] font-semibold">
                      Total · {run.drafts.length} clients
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums">{batchHours}</td>
                    <td className={cn("px-4 py-3 text-right text-[13px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                      {money(batchTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right text-[12.5px] text-muted-foreground">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="m-0 text-xs text-muted-foreground [text-wrap:pretty]">
            The moment real pay rates exist — in Joy or read from Gusto — this table fills in.
            That is a developer decision, deliberately not faked here.
          </p>
        </div>
      )}

      <RecordPaymentDialog
        balance={payingBalance}
        open={payingBalance !== null}
        onOpenChange={(open) => {
          if (!open) setPayingBalance(null);
        }}
      />

      <div className="mt-8 rounded-[14px] border border-[#FCE8B6] bg-[#FFFAEB] p-4">
        <p className="m-0 flex items-start gap-2 text-[13px]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" aria-hidden="true" />
          <span className="text-[#7A6320]">
            <span className="font-medium text-foreground">The agreement is corrected.</span>{" "}
            {PACKET_CONTRADICTION}
          </span>
        </p>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Rates shown are placeholders, not Joy's pricing. Time and a half applies over 40 hours and
        on the seven holidays named in the agreement, and never twice for the same hour. Suspending
        care for non-payment is permitted by the agreement and is deliberately not automatic.
      </p>
    </>
  );
}
