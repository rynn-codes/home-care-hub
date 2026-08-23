import { useMemo, useState } from "react";
import { Eye, EyeOff, Info, Plus } from "lucide-react";
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
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { invoiceBalance, BALANCE_LABELS, type BalanceState, type InvoiceBalance } from "@/domain/billing/receivables";
import { RecordPaymentDialog } from "@/components/billing/RecordPaymentDialog";
import { useDemo } from "@/context/DemoDataProvider";
import { seedVisits } from "@/lib/schedulingSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import { cn } from "@/lib/utils";

/**
 * Billing, in the approved mock's frame — Karynn's ruling, 23 August:
 * "adopt the mock's To send | Sent | Profitability framing."
 *
 * The engine underneath is unchanged: the Saturday run drafts from the
 * standing schedule, approval goes through the same refusals the database
 * enforces, and sending assigns the JH- number and lands the debt in
 * Outstanding. What the framing changes is the shape of the morning — one
 * batch card, one card per client with its review flags, and the week's
 * rhythm on the rail.
 *
 * Two supersessions of the mock, both recorded in MOCKUP_ALIGNMENT.md:
 * the mock's "due Wednesday" gives way to Karynn's Saturday-run answers
 * (drafts Saturday, approve Sat–Mon, out Monday, due Sunday before care),
 * and Profitability refuses to print a net figure — caregiver pay rates
 * live in Gusto and are not in Joy, so the cost side of the mock's table
 * says so instead of multiplying fiction.
 */

type Tab = "review" | "invoices" | "profit";

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

export default function Billing() {
  const [tab, setTab] = useState<Tab>("review");
  const [priv, setPriv] = useState(false);
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
    // The stored draft's total IS its lines (0016 enforces the sum). The
    // computed invoice's `total` also carries deposit and fees, which are
    // collection-time arithmetic, not approval-time content.
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
  const sentCount = run.drafts.filter((d) => statusOf(d) === "sent").length;
  const allClear = pending === 0 && run.drafts.length > 0;
  const allSent = run.drafts.length > 0 && sentCount === run.drafts.length;
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

  return (
    <>
      <PageHeader
        title="Billing"
        description="Review this week's drafts, then approve and send. Out Monday, due the Sunday before care."
        actions={
          <>
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
              disabled
              title="Invoices come from the Saturday run — ad-hoc invoices aren't built yet"
              className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] bg-[#F1F2F6] px-3.5 text-[13px] font-medium text-muted-foreground/50"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              Create invoice
            </button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-5 overflow-x-auto border-b border-[#ECECF1]" role="tablist" aria-label="Billing views">
        {(
          [
            ["review", "To send", String(pending || run.drafts.length)],
            ["invoices", "Sent", String(balances.length)],
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

      {/* ------------------------------------------------------ To send -- */}
      {tab === "review" && (
        <section aria-label="This week's batch" className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_296px]">
          <div className="flex flex-col gap-3.5">
            <div
              className={cn(
                "rounded-2xl border bg-white px-5 py-5",
                allClear && !allSent ? "border-[#D3F0DF]" : "border-[#ECECF1]",
              )}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    This week's batch
                  </span>
                  <span className="text-xl font-semibold tracking-[-.02em]">
                    {allSent
                      ? `${sentCount} ${sentCount === 1 ? "invoice" : "invoices"} sent`
                      : allClear
                        ? "Ready to send"
                        : `${pending} of ${run.drafts.length} need approval`}
                  </span>
                  <span className="text-[13px] text-[#5B6274] [text-wrap:pretty]">
                    The Saturday run · care week {weekStart} – {weekEnd} · drafted from the
                    standing schedule, priced from each agreement
                  </span>
                </div>
                <div className="ml-auto flex flex-none items-center gap-3">
                  <span className="flex flex-col items-end gap-[3px]">
                    <span className={cn("whitespace-nowrap text-[21px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                      {money(batchTotal)}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">{batchHours} hrs billed</span>
                  </span>
                  <button
                    type="button"
                    disabled={!allClear || approvedUnsent.length === 0}
                    title={
                      allSent
                        ? undefined
                        : allClear
                          ? undefined
                          : "Approve every draft first"
                    }
                    onClick={() => {
                      approvedUnsent.forEach(send);
                    }}
                    className={cn(
                      "h-[38px] rounded-[10px] px-4 text-[13.5px] font-medium transition-colors",
                      allSent
                        ? "cursor-default bg-[#ECFDF3] text-[#027A48]"
                        : allClear && approvedUnsent.length > 0
                          ? "bg-primary text-white hover:bg-[#2A1BD1]"
                          : "cursor-not-allowed bg-[#F1F2F6] text-muted-foreground/50",
                    )}
                  >
                    {allSent
                      ? "Sent ✓"
                      : allClear && approvedUnsent.length > 0
                        ? `Send ${approvedUnsent.length} ${approvedUnsent.length === 1 ? "invoice" : "invoices"}`
                        : "Review first"}
                  </button>
                </div>
              </div>
            </div>

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

            <div className="flex flex-col gap-2.5">
              {run.drafts.map((draft) => {
                const status = statusOf(draft);
                const key = draftKey(draft);
                const isOpen = openCard === key;
                const approved = approvedDrafts[key];
                const flags = run.exceptions.filter(
                  (e) => e.clientPersonId === draft.clientPersonId,
                );
                return (
                  <div
                    key={key}
                    className={cn(
                      "overflow-hidden rounded-[14px] border bg-white",
                      status === "needs_approval" && flags.length > 0 ? "border-[#FCE8B6]" : "border-[#ECECF1]",
                    )}
                  >
                    <div className="flex items-center gap-3.5 px-[18px] py-4">
                      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
                        {initialsOf(draft.clientName)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenCard(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                      >
                        <span className="flex min-w-0 flex-col gap-[3px]">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">{draft.clientName}</span>
                            <span
                              className={cn(
                                "inline-flex whitespace-nowrap rounded-full px-2 py-[2px] text-[11px] font-medium",
                                status === "sent"
                                  ? "bg-[#EEF0FE] text-primary"
                                  : status === "approved"
                                    ? "bg-[#ECFDF3] text-[#027A48]"
                                    : "bg-[#FFFAEB] text-[#B54708]",
                              )}
                            >
                              {status === "sent" ? "Sent" : status === "approved" ? "Approved" : "Needs approval"}
                            </span>
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">
                            {draft.lines.reduce((h, l) => h + l.hours, 0)} hrs · week of {draft.weekStart}
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
                        {money(draft.subtotal)}
                      </span>
                      {status === "needs_approval" && (
                        <button
                          type="button"
                          onClick={() => approve(draft)}
                          className="h-[34px] flex-none rounded-[9px] bg-primary px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                        >
                          Approve
                        </button>
                      )}
                      {status === "approved" && (
                        <span className="flex flex-none items-center gap-2">
                          <span className="whitespace-nowrap text-xs text-[#027A48]">✓ {approved?.by}</span>
                          <button
                            type="button"
                            onClick={() => send(draft)}
                            className="h-[34px] rounded-[9px] bg-primary px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                          >
                            Send
                          </button>
                        </span>
                      )}
                      {status === "sent" && (
                        <span className="whitespace-nowrap text-xs text-[#027A48]">
                          Sent as {approved?.sentAs}
                        </span>
                      )}
                    </div>

                    {/* The review flags — the mock's "overtime captured",
                        "shifts added after the schedule was set". Ours are
                        the run's real exceptions for this client. */}
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
                              className={cn(
                                "h-1.5 w-1.5 flex-none rounded-full",
                                f.blocksDraft ? "bg-[#F79009]" : "bg-[#12B76A]",
                              )}
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
                        <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                          Lines on this invoice
                        </span>
                        <div className="flex flex-col">
                          {draft.lines.map((l, i) => (
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
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Skipped clients — a draft would be a guess wearing an
                  invoice's clothes, so the card says what clears it. */}
              {run.skipped.map((s) => {
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
                        {b.paid > 0 && !priv && ` · $${b.paid.toFixed(2)} received`}
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

      {/* --------------------------------------------------------- Sent -- */}
      {tab === "invoices" && (
        <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  {["Client", "Period", "Status", "Pay method", "Amount", "Due", "Last payment"].map((label, i) => (
                    <th
                      key={label}
                      className={cn(
                        "whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground",
                        i === 4 ? "text-right" : "text-left",
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                      Nothing sent yet — approve and send this week's batch first.
                    </td>
                  </tr>
                )}
                {balances.map((b) => (
                  <tr key={b.invoice.id} className="border-t border-[#F3F3F6] hover:bg-[#FAFAFB]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">
                          {initialsOf(b.invoice.clientName)}
                        </span>
                        <span className="flex flex-col leading-[1.35]">
                          <span className="text-[13px]">{b.invoice.clientName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {b.invoice.invoiceNumber ?? "—"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                      {b.invoice.weekStart} – {b.invoice.weekEnd}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium",
                          BALANCE_PILL[b.state],
                        )}
                      >
                        {BALANCE_LABELS[b.state]}
                        {b.daysOverdue > 0 && ` · ${b.daysOverdue}d`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                      {methodFor(b.invoice.clientPersonId)}
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right text-[13px] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                      {money(b.invoice.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                      {b.invoice.dueOn}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted-foreground">
                      {b.lastPaymentOn ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2.5 border-t border-[#ECECF1] bg-[#FCFCFD] px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {balances.length} {balances.length === 1 ? "invoice" : "invoices"}
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs text-[#5B6274]">
              Unpaid
              <span className={cn("text-[12.5px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                {money(unpaidTotal)}
              </span>
            </span>
          </div>
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
