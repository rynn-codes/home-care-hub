import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { buildClientRoster } from "@/lib/clientRoster";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedBillingAccountClients, seedBillingAccounts, seedRatePlanVersions } from "@/lib/billingAccountsSeed";
import { seedIssuedInvoices, seedPaymentFailures, seedPayments } from "@/lib/receivablesSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import { isBillable, servedPeople, type Invoice, type InvoiceLine } from "@/domain/billing/invoice";
import { hasCompanions, householdOf } from "@/domain/billing/households";
import { rateInEffect } from "@/domain/billing/accounts";
import { planBillingRun, RUN_EXCEPTION_LABELS, upcomingBillingWeek } from "@/domain/billing/run";
import { approvalRefusals, APPROVAL_MESSAGES, linesFromInvoice } from "@/domain/billing/approval";
import { invoiceBalance, type InvoiceBalance } from "@/domain/billing/receivables";
import { dunningDatesFor } from "@/domain/billing/dunning";
import { retryRefusals, RETRY_MESSAGES, type PaymentFailure } from "@/domain/billing/invoiceActions";
import { releaseFromAdmission, buildPacket, packetPeriod, PACKET_WEEKS_BACK, assertSendable, destinations, PACKET_STATE_LABELS, type LtciPacket, type PacketSent } from "@/domain/billing/ltci";
import { applyRateChanges, authorizationLine, billingContactLine } from "@/domain/billing/payerSetup";
import { repriceDraft, TECHNOLOGY_FEE, type ManualDraft } from "@/domain/billing/manualInvoice";
import { startBatch, reviewRecommendation, type ReviewBatch, type ReviewItem } from "@/domain/billing/reviewBatch";
import { MORE_STATUS_FILTERS, PACKET_PILL, PRIMARY_STATUS_FILTERS, STATUS_ORDER, STATUS_PILL, initialsOf, periodLabel, shortDay, weekdayDay, type RowStatus } from "@/domain/billing/invoiceStatus";
import { billedByClient, costByClient, hoursOfVisit, inRange, MARGIN_TARGET, marginTone, PROFIT_SCOPES, PROFIT_SCOPE_LABELS, scopeRange, weekStartsBetween, type ProfitScope } from "@/domain/billing/profitability";
import { StepStrip, type StripStep } from "@/components/billing/StepStrip";
import { ReviewBatchDialog } from "@/components/billing/ReviewBatchDialog";
import { InvoiceSheet } from "@/components/billing/InvoiceSheet";
import { PayerSheet, type PayerRow } from "@/components/billing/PayerSheet";
import { PayerSetupDialog } from "@/components/billing/PayerSetupDialog";
import { EditDraftDialog } from "@/components/billing/EditDraftDialog";
import { FirstPaymentDialog } from "@/components/billing/FirstPaymentDialog";
import { InvoicePreviewDialog } from "@/components/billing/InvoicePreviewDialog";
import { CreateInvoiceDialog } from "@/components/billing/CreateInvoiceDialog";
import { LtciWorkspace } from "@/components/billing/LtciWorkspace";
import { CarrierSheet } from "@/components/billing/CarrierSheet";
import { AdjustmentDialog, RefundDialog, VoidDialog } from "@/components/billing/InvoiceCorrections";

/**
 * Billing — Invoices | Payers | Profitability.
 *
 * Karynn's week: the Saturday run drafts the coming care week from the
 * standing schedule; she approves Saturday to Monday; the invoices go out
 * Monday, due the Sunday before care. Every draft is checked by Joy and
 * decided by a person. Sending assigns the JH- number and lands the debt in
 * Outstanding. LTCI packets follow two weeks behind, on paid invoices only.
 *
 * Rates shown are placeholders. Payments settle through Stripe, which is
 * not connected; reminders go through Spruce, which is not wired. Both say
 * so on the screen rather than pretending.
 */

type Tab = "invoices" | "payers" | "profit";

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
  /** The primary's name when this person's care sits on their invoice. */
  noChargeOn: string | null;
  edit?: ReturnType<typeof useDemo>["draftEdits"][string] | null;
  scheduledHours?: number;
  rate?: number | null;
  editedLines?: InvoiceLine[] | null;
  manualLines?: Array<{ description: string; amount: number }>;
}

/**
 * The standing week, moved onto the week beginning `weekStart`. The demo's
 * schedule seed carries only the current week, and billing in advance bills
 * the schedule as it stands.
 */
function projectedWeek(weekStart: string): Visit[] {
  const seedMonday = new Date(seedVisits[0]?.startsAt ?? new Date().toISOString());
  seedMonday.setHours(0, 0, 0, 0);
  seedMonday.setDate(seedMonday.getDate() - ((seedMonday.getDay() + 6) % 7));
  const targetMonday = new Date(`${weekStart}T00:00:00`);
  targetMonday.setDate(targetMonday.getDate() + 2);
  const offsetDays = Math.round((targetMonday.getTime() - seedMonday.getTime()) / 864e5);
  const shift = (iso: string) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };
  return seedVisits.map((v) => ({ ...v, id: `${v.id}-${weekStart}`, startsAt: shift(v.startsAt), endsAt: shift(v.endsAt) }));
}

const TH = "whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";
const MENU_BUTTON = "flex h-[36px] items-center gap-[7px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground";
const MENU = "absolute z-20 mt-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]";

export default function Billing() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [priv, setPriv] = useState(false);
  const [filter, setFilter] = useState<RowStatus | "All">("All");
  const invoicesRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [batch, setBatch] = useState<ReviewBatch | null>(null);
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openPayerId, setOpenPayerId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mode, setMode] = useState<"invoices" | "ltci">("invoices");
  const [quickOpen, setQuickOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [rowsOpen, setRowsOpen] = useState(false);
  const [carrierEditId, setCarrierEditId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [payerSetupId, setPayerSetupId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewEdit, setPreviewEdit] = useState<{ hours: number; rate: number | null; charges: Array<{ id: string; type: string; description: string; amount: number }>; method: "ach" | "card" } | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const dismiss = (key: string) => setDismissed((d) => ({ ...d, [key]: true }));
  const [scope, setScope] = useState<ProfitScope>("week");
  const [offset, setOffset] = useState(0);
  const [retried, setRetried] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [firstOpen, setFirstOpen] = useState(false);
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([]);
  const [packetsSent, setPacketsSent] = useState<Record<string, PacketSent>>({});
  const [held, setHeld] = useState<Record<string, true>>({});
  const [profitSort, setProfitSort] = useState<{ key: "name" | "hours" | "billed" | "cost" | "net" | "margin"; dir: 1 | -1 }>({ key: "margin", dir: 1 });
  const [invoiceSort, setInvoiceSort] = useState<{ key: "client" | "period" | "amount" | "method" | "paid" | "status"; dir: 1 | -1 }>({ key: "status", dir: 1 });

  const {
    approvedDrafts,
    approveDraft,
    sendInvoice,
    recordedPayments,
    issuedInvoices,
    currentUser,
    households,
    setHouseholdBilling,
    pairHousehold,
    ltciEnrollments,
    saveLtciEnrollment,
    people,
    admissions,
    consentSessions,
    adjustInvoice,
    voidInvoice,
    refundInvoice,
    refunds,
    savePayerSetup,
    saveDraftEdit,
    saveFirstPayment,
    firstPayments,
    draftEdits,
    payerEdits,
    rateChanges,
    resendInvoice,
    invoiceEdits,
  } = useDemo();

  const today = new Date().toISOString().slice(0, 10);

  // The release from the signing packet, per client, for the packets.
  const releaseByPerson = useMemo(() => {
    const map = new Map<string, ReturnType<typeof releaseFromAdmission>>();
    for (const c of buildClientRoster({ people, admissions, consentSessions })) {
      map.set(c.personId, releaseFromAdmission({ signedAt: c.signedAt ?? null, decisions: c.decisions, today }));
    }
    return map;
  }, [people, admissions, consentSessions, today]);
  const enrollments = useMemo(
    () =>
      ltciEnrollments.map((e) => {
        if (e.releaseOnFile) return e;
        const release = releaseByPerson.get(e.clientPersonId);
        return release?.onFile ? { ...e, releaseOnFile: true, releaseExpiresOn: release.expiresOn } : e;
      }),
    [ltciEnrollments, releaseByPerson],
  );

  const money = (n: number | null) => (n === null ? "—" : priv ? "••••••" : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  const weekStart = useMemo(() => upcomingBillingWeek(new Date().toISOString()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);
  const weekLabel = useMemo(() => `${shortDay(weekStart)} – ${shortDay(weekEnd)}, ${new Date(`${weekEnd}T12:00:00`).getFullYear()}`, [weekStart, weekEnd]);
  const dueLabel = useMemo(() => new Date(`${dunningDatesFor(weekStart).servicesStopIfUnpaidBy}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }), [weekStart]);

  const accountIdFor = (clientPersonId: string) => seedBillingAccountClients.find((c) => c.clientPersonId === clientPersonId)?.billingAccountId ?? null;
  const rateVersions = useMemo(() => applyRateChanges({ versions: seedRatePlanVersions, changes: rateChanges, accountIdFor }), [rateChanges]);
  const responsibleLine = (personId: string) => {
    const c = seedClients.find((x) => x.personId === personId);
    if (!c) return null;
    const name = c.responsiblePartyName ?? null;
    const line = c.responsiblePartyLine ?? null;
    return name ? (line ? `${name} · ${line}` : name) : line;
  };
  const rateFor = (personId: string, at: string) => {
    const accountId = accountIdFor(personId);
    return accountId ? (rateInEffect({ versions: rateVersions, billingAccountId: accountId, clientPersonId: personId, on: at.slice(0, 10) })?.hourlyRate ?? null) : null;
  };
  const rateNow = (personId: string) => rateFor(personId, weekStart);
  const accounts = useMemo(
    () =>
      Object.keys(payerEdits).length === 0
        ? seedBillingAccounts
        : seedBillingAccounts.map((a) => {
            const links = seedBillingAccountClients.filter((c) => c.billingAccountId === a.id);
            if (links.length !== 1) return a;
            const method = payerEdits[links[0].clientPersonId]?.paymentMethod;
            return method ? { ...a, paymentMethod: method } : a;
          }),
    [payerEdits],
  );
  // Households whose members share a visit this week — the ones billing has to decide about.
  const householdsThisWeek = useMemo(() => {
    const visits = projectedWeek(weekStart);
    return households.filter((h) => visits.some((v) => h.members.filter((m) => servedPeople(v).some((p) => p.personId === m.personId)).length > 1));
  }, [households, weekStart]);
  const run = useMemo(() => {
    const visits = projectedWeek(weekStart);
    return { ...planBillingRun({ periodStart: weekStart, periodEnd: weekEnd, visits, accounts, accountClients: seedBillingAccountClients, rateVersions, households: householdsThisWeek }), visits };
  }, [weekStart, weekEnd, householdsThisWeek, rateVersions, accounts]);

  const scheduledHoursOf = (draft: Invoice) => Math.round(draft.lines.filter((l) => l.kind === "standard").reduce((t, l) => t + l.hours, 0) * 100) / 100;
  const methodLabel = (personId: string) => {
    const link = seedBillingAccountClients.find((c) => c.clientPersonId === personId);
    const account = accounts.find((a) => a.id === link?.billingAccountId);
    const method = payerEdits[personId]?.paymentMethod ?? account?.paymentMethod ?? seedBillingTerms.find((t) => t.clientPersonId === personId)?.paymentMethod;
    return method === "ach" ? "ACH · Stripe" : method === "card" ? "Card · Stripe" : "—";
  };
  const reprice = (draft: Invoice, hours: number, charges: Array<{ description: string; amount: number }>, method?: "ach" | "card", rate?: number) => {
    const inForce = rate ?? rateFor(draft.clientPersonId, draft.weekStart);
    const card = method ? method === "card" : methodLabel(draft.clientPersonId).startsWith("Card");
    return repriceDraft({ scheduledHours: scheduledHoursOf(draft), hours, rate: inForce, charges: charges.map((c, i) => ({ id: String(i), type: "custom", description: c.description, amount: c.amount })), method: card ? "card" : "ach" });
  };
  const draftKey = (draft: Invoice) => `${draft.clientPersonId}:${draft.weekStart}:${draft.ratePlanVersionId ?? "no-rate"}`;
  const statusOf = (draft: Invoice): "needs_approval" | "approved" | "sent" => {
    const a = approvedDrafts[draftKey(draft)];
    return a?.sentAs ? "sent" : a ? "approved" : "needs_approval";
  };

  function approve(draft: Invoice) {
    const lines = linesFromInvoice(draft);
    const total = draft.subtotal ?? 0;
    const refusals = approvalRefusals({ state: "pending_approval", lines, total, byUserId: currentUser.name });
    if (refusals.length > 0) {
      toast.error(APPROVAL_MESSAGES[refusals[0]]);
      return;
    }
    approveDraft(draftKey(draft), { total, lineCount: lines.length, ratePlanVersionId: draft.ratePlanVersionId });
    toast.success(`${draft.clientName}'s invoice approved — ${money(total)}.`);
  }
  function send(draft: Invoice) {
    sendInvoice({
      key: draftKey(draft),
      clientPersonId: draft.clientPersonId,
      clientName: draft.clientName,
      weekStart: draft.weekStart,
      weekEnd: draft.weekEnd,
      total: draft.total ?? draft.subtotal ?? 0,
      lines: draft.lines.map((l) => ({ description: l.description, hours: l.hours, rate: l.rate === null ? null : l.rate * l.multiplier, amount: l.amount ?? 0 })),
    });
  }
  function sendApprovedManual() {
    for (const d of manualDrafts.filter((m) => approvedDrafts[m.key] && !approvedDrafts[m.key]?.sentAs)) {
      sendInvoice({ key: d.key, clientPersonId: d.clientPersonId, clientName: d.clientName, weekStart, weekEnd, total: d.total, lines: d.lines.map((l) => ({ description: l.description, hours: 0, rate: null, amount: l.amount })) });
    }
    setManualDrafts((ds) => ds.filter((d) => !approvedDrafts[d.key]));
  }
  function sendAll(drafts: Invoice[]) {
    drafts.forEach(send);
    sendApprovedManual();
    const manual = manualDrafts.filter((d) => approvedDrafts[d.key]).length;
    const n = drafts.length + manual;
    toast.success(`${n} ${n === 1 ? "invoice" : "invoices"} sent`, { description: `Payment links delivered through Stripe · due ${dueLabel}` });
  }

  /** The primary's name when a household member's care sits on the primary's invoice. */
  const noChargeOn = (draft: Invoice): string | null => {
    if ((draft.subtotal ?? 0) !== 0) return null;
    const h = householdOf(householdsThisWeek, draft.clientPersonId);
    if (!h || h.billing !== "combined" || h.primaryPersonId === draft.clientPersonId) return null;
    return h.members.find((m) => m.personId === h.primaryPersonId)?.name ?? null;
  };
  const needsReview = run.drafts.filter((d) => statusOf(d) === "needs_approval" && !held[draftKey(d)] && !noChargeOn(d));
  const approved = run.drafts.filter((d) => statusOf(d) === "approved");
  const sent = run.drafts.filter((d) => statusOf(d) === "sent");
  const allSent = run.drafts.length > 0 && needsReview.length === 0 && approved.length === 0 && sent.length > 0;

  // Issued invoices and every payment against them — one list, so this
  // screen and the outstanding report cannot disagree about who owes what.
  const balances = useMemo(() => {
    const payments = [...seedPayments, ...recordedPayments];
    return [...issuedInvoices, ...seedIssuedInvoices].map((i) => ({ ...i, ...(invoiceEdits[i.id] ?? {}) })).map((invoice) => invoiceBalance({ invoice, payments, asOf: today }));
  }, [recordedPayments, issuedInvoices, invoiceEdits, today]);

  const failures = useMemo(() => {
    const now = new Date().toISOString();
    return seedPaymentFailures
      .filter((f) => !retried[f.invoiceId])
      .map((failure) => {
        const account = seedBillingAccounts.find((a) => seedBillingAccountClients.some((c) => c.clientPersonId === failure.clientPersonId && c.billingAccountId === a.id));
        const authorization =
          account && account.authorizationStatus === "captured"
            ? {
                id: `auth-${account.id}`,
                billingAccountId: account.id,
                authorizedByPersonId: failure.clientPersonId,
                authorizedByName: failure.clientName,
                paymentMode: "autopay" as const,
                authorizationTextVersion: "v1",
                authorizedAt: account.authorizationCapturedAt ?? now,
                stripeCustomerRef: null,
                stripePaymentMethodRef: null,
                status: "active" as const,
                revokedAt: null,
                revokedByPersonId: null,
                revokedReason: null,
              }
            : null;
        return { failure, refusals: retryRefusals({ failure, authorization, asOf: now }).map((r) => RETRY_MESSAGES[r]) };
      });
  }, [retried]);
  const failureFor = (invoiceId: string) => failures.find((f) => f.failure.invoiceId === invoiceId) ?? null;
  function retry(failure: PaymentFailure) {
    setRetried((r) => ({ ...r, [failure.invoiceId]: new Date().toISOString() }));
    toast.success(`Retrying ${failure.clientName}'s card`, { description: "Stripe will charge the saved method again and report the result. Joy records the attempt, not the outcome." });
  }

  const rowStatus = (b: InvoiceBalance): RowStatus => {
    if (b.state === "written_off") return "Void";
    if (b.balance <= 0 && refunds.some((r) => r.invoiceId === b.invoice.id)) return "Refunded";
    if ((b.invoice.adjustments?.length ?? 0) > 0) return "Adjusted";
    if (b.state === "paid" || b.state === "overpaid") return "Paid";
    if (b.state === "overdue") return "Past due";
    return "Sent";
  };

  const rows = useMemo<InvoiceRow[]>(() => {
    const draftRows: InvoiceRow[] = run.drafts
      .filter((d) => statusOf(d) !== "sent")
      .map((d) => {
        const key = draftKey(d);
        const edit = draftEdits[key];
        const scheduled = scheduledHoursOf(d);
        const rate = rateFor(d.clientPersonId, d.weekStart);
        const repriced = edit ? reprice(d, edit.hours ?? scheduled, edit.charges ?? [], edit.method, edit.rate) : null;
        return {
          key,
          clientName: d.clientName,
          clientPersonId: d.clientPersonId,
          period: `${d.weekStart} – ${d.weekEnd}`,
          status: statusOf(d) === "approved" ? "Ready" : "Needs review",
          amount: repriced ? repriced.total : (d.total ?? d.subtotal),
          method: edit?.method ? (edit.method === "card" ? "Card · Stripe" : "ACH · Stripe") : methodLabel(d.clientPersonId),
          draft: d,
          balance: null,
          noChargeOn: noChargeOn(d),
          edit: edit ?? null,
          scheduledHours: scheduled,
          rate,
          editedLines: repriced ? repriced.lines : null,
        };
      });
    const issuedRows: InvoiceRow[] = balances.map((b) => ({
      key: b.invoice.id,
      clientName: b.invoice.clientName,
      clientPersonId: b.invoice.clientPersonId,
      period: `${b.invoice.weekStart} – ${b.invoice.weekEnd}`,
      status: rowStatus(b),
      amount: b.invoice.total,
      method: methodLabel(b.invoice.clientPersonId),
      draft: null,
      balance: b,
      noChargeOn: null,
    }));
    const manualRows: InvoiceRow[] = manualDrafts.map((d) => ({
      key: d.key,
      clientName: d.clientName,
      clientPersonId: d.clientPersonId,
      period: d.incurred,
      status: approvedDrafts[d.key] ? "Ready" : "Needs review",
      amount: d.total,
      method: d.method === "card" ? "Card · Stripe" : "ACH · Stripe",
      draft: null,
      balance: null,
      noChargeOn: null,
      manualLines: d.lines,
    }));
    return [...draftRows, ...manualRows, ...issuedRows].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.drafts, balances, approvedDrafts, manualDrafts, weekStart, weekEnd, draftEdits, rateVersions, payerEdits, refunds, held, householdsThisWeek]);

  const thisPeriod = `${weekStart} – ${weekEnd}`;
  const periodOptions = useMemo(() => {
    const set = new Set([thisPeriod, ...rows.map((r) => r.period)]);
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
    return [{ value: "all", label: "All periods" }, ...sorted.map((p) => ({ value: p, label: p === thisPeriod ? `${periodLabel(p)} · this week` : periodLabel(p) }))];
  }, [rows, thisPeriod]);
  const activePeriod = period || thisPeriod;
  const inPeriod = rows.filter((r) => activePeriod === "all" || r.period === activePeriod);
  const q = query.trim().toLowerCase();
  const responsibleName = (personId: string) => seedClients.find((c) => c.personId === personId)?.responsiblePartyName ?? "";

  const sortedRows = useMemo(() => {
    const keyOf = (r: InvoiceRow): string | number => {
      switch (invoiceSort.key) {
        case "client":
          return r.clientName;
        case "period":
          return r.period;
        case "amount":
          return r.amount ?? -Infinity;
        case "method":
          return r.method;
        case "paid":
          return r.balance?.paid ?? -Infinity;
        default:
          return STATUS_ORDER.indexOf(r.status);
      }
    };
    return rows.slice().sort((a, b) => {
      const x = keyOf(a);
      const y = keyOf(b);
      return x === y ? a.clientName.localeCompare(b.clientName) : (x > y ? 1 : -1) * invoiceSort.dir;
    });
  }, [rows, invoiceSort]);
  const visible = sortedRows.filter((r) => activePeriod === "all" || r.period === activePeriod).filter((r) => filter === "All" || r.status === filter).filter((r) => !q || r.clientName.toLowerCase().includes(q) || responsibleName(r.clientPersonId).toLowerCase().includes(q));
  const visibleOutstanding = useMemo(() => Math.round(visible.reduce((t, r) => t + (r.balance && r.balance.balance > 0 && r.balance.state !== "written_off" ? r.balance.balance : 0), 0) * 100) / 100, [visible]);
  const selectedCount = visible.filter((r) => selected[r.key]).length;
  const pageCount = Math.max(1, Math.ceil(visible.length / rowsPerPage));
  const pageIndex = Math.min(page, pageCount - 1);
  const pageStart = pageIndex * rowsPerPage;
  const pageRows = visible.slice(pageStart, pageStart + rowsPerPage);
  const grandTotal = Math.round(visible.reduce((t, r) => t + (r.noChargeOn ? 0 : (r.amount ?? 0)), 0) * 100) / 100;
  const overdueTotal = Math.round(balances.filter((b) => b.state === "overdue").reduce((t, b) => t + b.balance, 0) * 100) / 100;
  const outstandingTotal = Math.round(balances.filter((b) => b.balance > 0 && b.state !== "written_off").reduce((t, b) => t + b.balance, 0) * 100) / 100;
  const notSentTotal = Math.round(rows.filter((r) => !r.balance && !r.noChargeOn && (r.status === "Needs review" || r.status === "Ready")).reduce((t, r) => t + (r.amount ?? 0), 0) * 100) / 100;
  const bigMoney = (n: number) => (priv ? "••••" : n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(n).toLocaleString("en-US")}`);
  const lastTouched = (r: InvoiceRow) =>
    r.balance
      ? ([r.balance.lastPaymentOn, r.balance.invoice.issuedOn].filter(Boolean).sort().at(-1) ?? r.balance.invoice.issuedOn)
      : ([approvedDrafts[r.key]?.at, draftEdits[r.key]?.editedAt].filter((x): x is string => !!x).map((x) => x.slice(0, 10)).sort().at(-1) ?? r.period.split(" – ")[0]);
  const recent = rows.slice().sort((a, b) => lastTouched(b).localeCompare(lastTouched(a))).slice(0, 8);
  const hoursOfRow = (r: InvoiceRow) => {
    const lines = r.editedLines ?? r.draft?.lines ?? r.balance?.invoice.lines;
    if (!lines) return null;
    const h = lines.reduce((t, l) => t + (l.hours ?? 0), 0);
    return h > 0 ? Math.round(h * 100) / 100 : null;
  };
  const issuedLabel = (r: InvoiceRow) => (r.balance ? shortDay(r.balance.invoice.issuedOn) : "Not sent yet");
  const dueLine = (r: InvoiceRow) => {
    if (r.balance) {
      const b = r.balance;
      if (b.state === "paid" || b.state === "overpaid") return `Paid${b.lastPaymentOn ? ` ${shortDay(b.lastPaymentOn)}` : ""}`;
      if (b.state === "written_off") return "Void";
      return `${b.daysOverdue > 0 ? "Was due" : "Due"} ${shortDay(b.invoice.dueOn)}`;
    }
    return r.draft ? `Due ${shortDay(r.draft.dueOn)}` : "—";
  };
  const countByStatus = (s: RowStatus | "All") => (s === "All" ? inPeriod.length : inPeriod.filter((r) => r.status === s).length);
  const manualNeedingReview = manualDrafts.filter((d) => !approvedDrafts[d.key] && !held[d.key]);

  const reviewItems = useMemo(() => {
    const items: Record<string, ReviewItem> = {};
    const payerType = (personId: string) => seedClients.find((c) => c.personId === personId)?.payer ?? "Not recorded";
    for (const d of manualDrafts) {
      const a = approvedDrafts[d.key];
      items[d.key] = {
        key: d.key,
        draft: null,
        lines: d.lines.map((l) => ({ description: l.description, detail: null, amount: l.amount })),
        clientName: d.clientName,
        payerType: payerType(d.clientPersonId),
        hours: 0,
        rate: null,
        amount: d.total,
        status: a ? "Ready" : "Needs review",
        recommendation: a ? "Approved. It goes out with the week's send." : "This invoice was raised by hand, so there is no schedule for Joy to check it against. Read the charges before approving — nothing else has.",
        checks: [{ key: "manual", ok: false, label: "Raised by hand", detail: "Not from the Saturday run — Joy has not verified these charges against anything.", amount: null }],
      };
    }
    for (const d of run.drafts) {
      if (statusOf(d) === "sent") continue;
      const key = draftKey(d);
      const row = rows.find((r) => r.key === key);
      const exceptions = run.exceptions.filter((e) => e.clientPersonId === d.clientPersonId);
      const hours = Math.round(d.lines.reduce((t, l) => t + l.hours, 0) * 100) / 100;
      const rate = d.lines.find((l) => l.rate !== null)?.rate ?? null;
      const overtime = d.lines.filter((l) => l.multiplier > 1);
      const type = payerType(d.clientPersonId);
      const isApproved = statusOf(d) === "approved";
      items[key] = {
        key,
        draft: d,
        lines: (row?.editedLines ?? d.lines).map((l) => ({ description: l.description, detail: `${l.hours} hrs${l.rate !== null ? ` × $${(l.rate * l.multiplier).toFixed(2)}` : ""}`, amount: l.amount })),
        clientName: d.clientName,
        payerType: type,
        hours: row?.editedLines ? Math.round(row.editedLines.reduce((t, l) => t + l.hours, 0) * 100) / 100 : hours,
        rate,
        amount: row?.amount ?? d.subtotal,
        status: isApproved ? "Ready" : "Needs review",
        recommendation: isApproved ? `Approved${approvedDrafts[key]?.by ? ` by ${approvedDrafts[key].by}` : ""}. It goes out with the week's send.` : reviewRecommendation(exceptions, overtime.length > 0),
        checks: [
          { key: "hours", ok: true, label: "Hours verified", detail: `${hours} hours across the care week confirmed against schedule`, amount: null },
          { key: "rate", ok: rate !== null, label: rate === null ? "No rate on file" : "Rate verified", detail: rate === null ? "This invoice cannot be priced." : `$${rate.toFixed(2)}/hr · ${type}`, amount: null },
          ...overtime.map((l, i) => ({ key: `ot-${i}`, ok: false, label: `${l.hours} overtime ${l.hours === 1 ? "hour" : "hours"}`, detail: `Billed at ${l.multiplier}× · over 40 hours in the agency week`, amount: l.amount === null ? null : `+${money(l.amount)}` })),
          ...exceptions.map((e, i) => ({ key: `ex-${i}`, ok: false, label: RUN_EXCEPTION_LABELS[e.kind], detail: e.detail, amount: null })),
        ],
      };
    }
    for (const r of rows) {
      if (items[r.key] || !r.balance) continue;
      const b = r.balance;
      const inv = b.invoice;
      const hours = Math.round((inv.lines ?? []).reduce((t, l) => t + (l.hours ?? 0), 0) * 100) / 100;
      const rate = (inv.lines ?? []).find((l) => l.rate !== null && l.rate !== undefined)?.rate ?? null;
      const settled = b.state === "paid" || b.state === "overpaid";
      items[r.key] = {
        key: r.key,
        draft: null,
        lines: (inv.lines ?? []).map((l) => ({ description: l.description, detail: l.hours && l.rate !== null && l.rate !== undefined ? `${l.hours} hrs × $${l.rate.toFixed(2)}` : null, amount: l.amount })),
        clientName: r.clientName,
        payerType: payerType(r.clientPersonId),
        hours,
        rate,
        amount: inv.total,
        status: r.status,
        invoiceNumber: inv.invoiceNumber ?? null,
        recommendation: settled
          ? `Paid${b.lastPaymentOn ? ` on ${shortDay(b.lastPaymentOn)}` : ""}. The record is closed; a correction now is a refund or an adjustment, never an edit.`
          : b.state === "written_off"
            ? "Voided. The original stays on the record for the history."
            : `Sent ${shortDay(inv.issuedOn)} · due ${shortDay(inv.dueOn)}${b.daysOverdue > 0 ? ` · ${b.daysOverdue} days past due` : ""}. Changes go through an adjustment so the family's copy and the record agree.`,
        checks: [
          ...(hours > 0 ? [{ key: "hours", ok: true, label: "Hours verified", detail: `${hours} hours across the care week confirmed against schedule`, amount: null }] : []),
          ...(rate !== null ? [{ key: "rate", ok: true, label: "Rate verified", detail: `$${rate.toFixed(2)}/hr · ${payerType(r.clientPersonId)}`, amount: null }] : []),
          {
            key: "money",
            ok: settled || b.balance <= 0,
            label: settled ? "Paid in full" : b.balance <= 0 ? "Nothing owed" : "Outstanding",
            detail: settled ? `${money(b.paid)} received${b.lastPaymentOn ? ` · ${shortDay(b.lastPaymentOn)}` : ""}` : `${money(b.balance)} still owed · due ${shortDay(inv.dueOn)}`,
            amount: null,
          },
        ],
      };
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, run.drafts, run.exceptions, manualDrafts, approvedDrafts, priv]);
  const itemFor = useCallback((key: string) => reviewItems[key] ?? null, [reviewItems]);
  const needsReviewBatch = () => startBatch({ kind: "invoice", source: "needs_review", ids: [...manualNeedingReview.map((d) => d.key), ...needsReview.map(draftKey)] });
  const chargeable = (r: InvoiceRow) => !r.noChargeOn;
  const periodBatch = () => startBatch({ kind: "invoice", source: "period", ids: sortedRows.filter((r) => (activePeriod === "all" || r.period === activePeriod) && chargeable(r)).map((r) => r.key) });
  const selectedBatch = () => startBatch({ kind: "invoice", source: "selected", ids: visible.filter((r) => selected[r.key] && chargeable(r)).map((r) => r.key) });

  // Payers — everyone on the roster and how they pay.
  const payers = useMemo<PayerRow[]>(
    () =>
      seedClients
        .filter((c) => c.status !== "discharged")
        .map((c) => {
          const terms = seedBillingTerms.find((t) => t.clientPersonId === c.personId);
          const edit = payerEdits[c.personId] ?? {};
          const link = seedBillingAccountClients.find((l) => l.clientPersonId === c.personId);
          const account = seedBillingAccounts.find((a) => a.id === link?.billingAccountId) ?? null;
          const method = edit.paymentMethod ?? account?.paymentMethod ?? terms?.paymentMethod;
          return {
            clientPersonId: c.personId,
            name: `${c.preferredName || c.firstName} ${c.lastName}`,
            type: edit.payer ?? c.payer ?? "Not recorded",
            method: method === "ach" ? "ACH" : method === "card" ? "Card" : "—",
            terms: c.payerLine ?? "—",
            rate: rateNow(c.personId) ?? terms?.hourlyRate ?? null,
            authorization: authorizationLine(account),
            billingContact: billingContactLine(account),
            ltci: enrollments.find((e) => e.clientPersonId === c.personId) ?? null,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrollments, payerEdits, rateVersions, weekStart],
  );

  // LTCI packets, two weeks behind the billing week.
  const packetRange = useMemo(() => packetPeriod(weekStart, PACKET_WEEKS_BACK), [weekStart]);
  const packets = useMemo<LtciPacket[]>(() => {
    const visits = projectedWeek(packetRange.start);
    return enrollments.map((e) => {
      const mine = visits.filter((v) => isBillable(v) && servedPeople(v).some((p) => p.personId === e.clientPersonId));
      return buildPacket({
        enrollment: e,
        periodStart: packetRange.start,
        periodEnd: packetRange.end,
        balances,
        visits: mine.map((v) => ({ date: v.startsAt.slice(0, 10), hours: Math.round(hoursOfVisit(v) * 100) / 100, noteFiled: true })),
        asOf: today,
        sent: packetsSent[e.clientPersonId] ?? null,
      });
    });
  }, [packetRange, balances, packetsSent, enrollments, today]);
  const readyPackets = packets.filter((p) => p.state === "ready").length;
  const stuckPackets = packets.filter((p) => p.state === "incomplete" || p.state === "needs_release" || p.state === "blocked").length;
  const sentPackets = packets.filter((p) => p.state === "sent").length;
  const waitingTotal = Math.round(packets.filter((p) => p.state !== "ready" && p.state !== "sent").reduce((t, p) => t + (p.invoiceTotal ?? 0), 0) * 100) / 100;
  const readyTotal = Math.round(packets.filter((p) => p.state === "ready").reduce((t, p) => t + (p.invoiceTotal ?? 0), 0) * 100) / 100;
  const sentTotal = Math.round(packets.filter((p) => p.state === "sent").reduce((t, p) => t + (p.invoiceTotal ?? 0), 0) * 100) / 100;
  const packetsClear = packets.length === 0 || (readyPackets === 0 && stuckPackets === 0);
  const weekComplete = allSent && packetsClear;
  const liveFailures = failures.filter(({ failure }) => !dismissed[`failure:${failure.invoiceId}`]);

  const goToFilter = useCallback((s: RowStatus | "All") => {
    setTab("invoices");
    setFilter(s);
    requestAnimationFrame(() => invoicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const steps = useMemo<StripStep[]>(() => {
    const drafted = run.drafts.length;
    const pending = needsReview.length;
    const ready = approved.length;
    const gone = sent.length;
    return [
      { key: "priced", label: "Drafted", note: `${drafted} ${drafted === 1 ? "client" : "clients"}`, state: "done", onClick: drafted === 0 ? undefined : () => goToFilter("All") },
      { key: "review", label: "Reviewed", note: pending === 0 ? "Cleared" : `${pending} remaining`, state: pending === 0 ? "done" : "open", onClick: pending > 0 ? () => goToFilter("Needs review") : drafted === 0 ? undefined : () => goToFilter("All") },
      {
        key: "ltci",
        label: "LTCI packets",
        note: packets.length === 0 ? "None this week" : sentPackets > 0 && readyPackets === 0 && stuckPackets === 0 ? `${sentPackets} sent` : stuckPackets > 0 ? `${stuckPackets} need something first` : `${readyPackets} ready`,
        state: packets.length === 0 || (readyPackets === 0 && stuckPackets === 0) ? "done" : stuckPackets > 0 ? "open" : "todo",
        onClick: packets.length === 0 ? undefined : () => setWorkspaceOpen(true),
      },
      {
        key: "sent",
        label: "Invoices sent",
        note: gone > 0 ? `${gone} sent` : ready > 0 ? `${ready} ready` : "Pending",
        state: gone > 0 && pending === 0 && ready === 0 ? "done" : ready > 0 ? "open" : "todo",
        onClick: gone > 0 ? () => goToFilter("Sent") : ready > 0 ? () => goToFilter("Ready") : undefined,
      },
      {
        key: "payments",
        label: "Payments",
        note: liveFailures.length > 0 ? `${liveFailures.length} failed` : visibleOutstanding > 0 ? `${money(visibleOutstanding)} outstanding` : "All settled",
        state: liveFailures.length > 0 ? "open" : visibleOutstanding > 0 ? "todo" : "done",
        onClick: liveFailures.length > 0 ? () => setOpenKey(liveFailures[0].failure.invoiceId) : visibleOutstanding > 0 ? () => setFilter("Past due") : undefined,
      },
      { key: "complete", label: "Complete", note: weekComplete ? "Done" : "Pending", state: weekComplete ? "done" : "todo", onClick: weekComplete ? () => goToFilter("Sent") : undefined },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.drafts, needsReview, approved, sent, liveFailures, visibleOutstanding, packets, sentPackets, readyPackets, stuckPackets, weekComplete, priv]);

  function sendPackets(list: LtciPacket[]) {
    const stamp: Record<string, PacketSent> = {};
    for (const p of list) {
      try {
        assertSendable(p);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That packet cannot be sent.");
        return;
      }
      const e = ltciEnrollments.find((x) => x.clientPersonId === p.clientPersonId);
      stamp[p.clientPersonId] = { on: today, by: currentUser.name, to: e ? destinations(e) : [] };
    }
    setPacketsSent((s) => ({ ...s, ...stamp }));
    toast.success(`${list.length} LTCI ${list.length === 1 ? "packet" : "packets"} sent`, { description: `Fax and email · ${periodLabel(`${packetRange.start} – ${packetRange.end}`)} · transmission recorded` });
  }

  // Profitability over the chosen scope, projected from the standing schedule.
  const range = useMemo(() => scopeRange({ scope, offset, weekAnchor: weekStart, today }), [scope, offset, weekStart, today]);
  const rangeVisits = useMemo(() => weekStartsBetween(range.start, range.end).flatMap((w) => projectedWeek(w)).filter((v) => inRange(v.startsAt, range)), [range]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const billed = useMemo(() => billedByClient({ visits: rangeVisits, households: householdsThisWeek, rateFor }), [rangeVisits, householdsThisWeek, rateVersions]);
  const cost = useMemo(() => costByClient({ visits: rangeVisits, households: householdsThisWeek, payRates: new Map(seedEmployees.map((e) => [e.name, e.baseRate])) }), [rangeVisits, householdsThisWeek]);
  const totals = useMemo(() => {
    let hours = 0;
    let billedSum = 0;
    let costSum = 0;
    let unknown = 0;
    for (const p of payers) {
      const b = billed.get(p.clientPersonId);
      hours += b?.hours ?? 0;
      billedSum += b?.billed ?? 0;
      const c = cost.get(p.clientPersonId);
      if (!c || c.unknown) unknown += c ? 1 : 0;
      else costSum += c.cost;
    }
    return { hours: Math.round(hours * 100) / 100, billed: billedSum, cost: costSum, net: billedSum - costSum, unknown };
  }, [payers, billed, cost]);
  const profitRows = useMemo(() => {
    const list = payers.map((p) => {
      const b = billed.get(p.clientPersonId);
      const c = cost.get(p.clientPersonId);
      const costed = c && !c.unknown;
      const billedAmount = b?.billed ?? null;
      const costAmount = costed ? c.cost : null;
      const net = billedAmount !== null && costAmount !== null ? billedAmount - costAmount : null;
      const h = householdOf(householdsThisWeek, p.clientPersonId);
      const billedOn = b?.billedElsewhere && h ? (h.members.find((m) => m.personId === h.primaryPersonId)?.name ?? null) : null;
      return { clientPersonId: p.clientPersonId, name: p.name, hours: Math.round((b?.hours ?? 0) * 100) / 100, billed: billedAmount, cost: costAmount, net, billedOn, margin: net !== null && billedAmount ? (net / billedAmount) * 100 : null };
    });
    const { key, dir } = profitSort;
    return list.sort((a, b) => {
      if (key === "name") return a.name.localeCompare(b.name) * dir;
      const x = a[key] ?? -Infinity;
      const y = b[key] ?? -Infinity;
      return (x === y ? 0 : x > y ? 1 : -1) * dir;
    });
  }, [payers, billed, cost, profitSort, householdsThisWeek]);

  const exportRows = (only: InvoiceRow[] | null) => {
    const profit = tab === "profit" && only === null;
    const header = profit ? ["Client", "Billable hours", "Invoiced", "Caregiver cost", "Net profit", "Margin"] : ["Client", "Service period", "Status", "Pay method", "Amount"];
    const body = profit
      ? profitRows.map((r) => [r.name, String(r.hours), r.billed?.toFixed(2) ?? "", r.cost?.toFixed(2) ?? "", r.net?.toFixed(2) ?? "", r.margin === null ? "" : `${r.margin.toFixed(2)}%`])
      : (only ?? visible).map((r) => [r.clientName, periodLabel(r.period), r.status, r.method, r.amount === null ? "" : r.amount.toFixed(2)]);
    const csv = [header, ...body].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `joy-${profit ? "profitability" : "invoices"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${body.length} ${body.length === 1 ? "row" : "rows"}${only ? " selected" : " as shown"}.`);
  };

  const invoiceClients = useMemo(() => payers.map((p) => ({ clientPersonId: p.clientPersonId, name: p.name, rate: p.rate, method: p.method, payerType: p.type })), [payers]);
  const existingPeriods = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const r of rows) {
      const start = r.period.split(" – ")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) out[r.clientPersonId] = [...(out[r.clientPersonId] ?? []), start];
    }
    return out;
  }, [rows]);
  const openRow = rows.find((r) => r.key === openKey) ?? null;
  const openPayer = payers.find((p) => p.clientPersonId === openPayerId) ?? null;
  const balanceById = (id: string | null) => balances.find((b) => b.invoice.id === id);

  const th = (label: string, right?: boolean) => (
    <th key={label} scope="col" className={cn(TH, right ? "text-right" : "text-left")}>
      {label}
    </th>
  );
  const sortableTh = (key: typeof invoiceSort.key, label: string, right?: boolean) => {
    const on = invoiceSort.key === key;
    return (
      <th key={key} scope="col" aria-sort={on ? (invoiceSort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("whitespace-nowrap bg-[var(--paper-sunken)] p-0", right ? "text-right" : "text-left")}>
        <button type="button" onClick={() => setInvoiceSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))} className={cn("w-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] transition-colors hover:text-foreground", right ? "text-right" : "text-left", on ? "text-[var(--ink-body)]" : "text-muted-foreground")}>
          {label}
          {on && <span className="pl-1.5 text-primary">{invoiceSort.dir === 1 ? "↑" : "↓"}</span>}
        </button>
      </th>
    );
  };
  const profitTh = (key: typeof profitSort.key, label: string, right?: boolean) => {
    const on = profitSort.key === key;
    return (
      <th key={key} scope="col" aria-sort={on ? (profitSort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("whitespace-nowrap bg-[var(--paper-sunken)] p-0 text-[11px] font-semibold uppercase tracking-[.07em]", right ? "text-right" : "text-left")}>
        <button type="button" onClick={() => setProfitSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))} className={cn("w-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] transition-colors hover:text-foreground", right ? "text-right" : "text-left", on ? "text-[var(--ink-body)]" : "text-muted-foreground")}>
          {label}
          {on && <span className="pl-1.5 text-primary">{profitSort.dir === 1 ? "↑" : "↓"}</span>}
        </button>
      </th>
    );
  };

  const stats =
    mode === "invoices"
      ? [
          { label: "overdue", value: overdueTotal, alarm: overdueTotal > 0 },
          { label: "total outstanding", value: outstandingTotal, alarm: false },
          { label: "not sent yet", value: notSentTotal, alarm: false },
        ]
      : [
          { label: "waiting on payment or details", value: waitingTotal, alarm: false },
          { label: "ready to send", value: readyTotal, alarm: false },
          { label: "sent this period", value: sentTotal, alarm: false },
        ];
  const pendingCount = needsReview.length + manualNeedingReview.length;
  const workspaceCount = readyPackets + stuckPackets;
  const editingRow = rows.find((r) => r.key === editingKey);
  const previewRow = rows.find((r) => r.key === previewKey);
  const previewInvoice = previewRow?.balance?.invoice ?? null;
  const previewRepriced = previewEdit && previewRow?.draft ? reprice(previewRow.draft, previewEdit.hours, previewEdit.charges, previewEdit.method, previewEdit.rate ?? undefined) : null;
  const previewLines: InvoiceLine[] =
    previewRepriced?.lines ??
    previewRow?.editedLines ??
    previewRow?.draft?.lines ??
    (previewRow?.balance?.invoice.lines ?? previewRow?.manualLines ?? []).map((l: { description: string; amount: number; hours?: number; rate?: number | null }) => ({ kind: "manual" as const, description: l.description, hours: l.hours ?? 0, rate: l.rate ?? null, multiplier: 1, amount: l.amount }));
  const setupPayer = payers.find((p) => p.clientPersonId === payerSetupId);

  return (
    <>
      <PageHeader
        title="Billing"
        week={weekStart}
        actions={
          <>
            <button
              type="button"
              onClick={() => setPriv((v) => !v)}
              aria-pressed={priv}
              className={cn("flex h-[34px] items-center gap-[7px] rounded-[9px] border px-3 text-[13px] transition-colors", priv ? "border-primary bg-[#EEF0FE] text-primary" : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground")}
            >
              {priv ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              {priv ? "Amounts hidden" : "Hide amounts"}
            </button>
            <button type="button" onClick={() => exportRows(null)} className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
              <Download className="h-[13px] w-[13px]" aria-hidden="true" />
              Export
            </button>
            <div className="relative">
              <button type="button" onClick={() => setQuickOpen((v) => !v)} aria-haspopup="menu" aria-expanded={quickOpen} className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                Quick add
                <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
              </button>
              {quickOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setQuickOpen(false)} aria-hidden="true" />
                  <ul role="menu" className="absolute right-0 z-20 mt-1 w-[220px] rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-1.5 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                    {(
                      [
                        ["New invoice", () => setCreateOpen(true), false],
                        ["Review invoices", () => setBatch(needsReviewBatch()), pendingCount === 0],
                        ["Review workspace", () => setWorkspaceOpen(true), packets.length === 0],
                      ] as const
                    ).map(([label, act, off]) => (
                      <li key={label}>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={off}
                          onClick={() => {
                            setQuickOpen(false);
                            act();
                          }}
                          className="w-full rounded-[9px] px-3 py-2.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-[var(--wash)] disabled:opacity-50"
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-5 overflow-x-auto border-b border-[var(--hairline)]" role="tablist" aria-label="Billing views">
        {(
          [
            ["invoices", "Invoices"],
            ["payers", "Payers"],
            ["profit", "Profitability"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors", tab === value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------- Invoices -- */}
      {tab === "invoices" && (
        <section aria-label="Invoices" ref={invoicesRef} className="flex flex-col gap-3">
          <div className="flex justify-center">
            <div role="tablist" aria-label="Invoices or LTCI claims" className="flex rounded-[12px] bg-[var(--wash)] p-1">
              {(
                [
                  ["invoices", "Client invoices"],
                  ["ltci", "LTCI claims"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={cn("h-[36px] rounded-[9px] px-5 text-[13.5px] transition-colors", mode === value ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]" : "text-[var(--ink-body)] hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 border-b border-[var(--hairline)] py-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className={cn("text-[40px] font-semibold leading-none tracking-[-.02em] tabular-nums", priv ? "text-muted-foreground/50" : s.alarm ? "text-[#B42318]" : "text-primary")}>{bigMoney(s.value)}</span>
                <span className="text-[13px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {mode === "invoices" &&
            run.exceptions
              .filter((e) => !e.clientName && !dismissed[`exception:${e.kind}:${e.detail}`])
              .map((e, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-[#FCE8B6] bg-[#FFFAEB] px-3.5 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
                  <span className="text-[12.5px] leading-[1.5] text-[#7A6320]">
                    <span className="font-medium text-foreground">{RUN_EXCEPTION_LABELS[e.kind]}.</span> {e.detail}
                  </span>
                  <button type="button" aria-label="Dismiss this notice" onClick={() => dismiss(`exception:${e.kind}:${e.detail}`)} className="-mt-0.5 ml-auto flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] text-[13px] text-[#B54708]/70 transition-colors hover:bg-[#FEF0C7] hover:text-[#B54708]">
                    ✕
                  </button>
                </div>
              ))}

          <h2 className="m-0 mt-2 text-[17px] font-semibold tracking-[-.01em]">Recently updated</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {mode === "invoices" ? (
              <>
                <button type="button" onClick={() => setCreateOpen(true)} className="flex h-[232px] w-[212px] flex-none flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--hairline)] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                  <span className="text-[13.5px]">New invoice</span>
                </button>
                {recent.map((r) => (
                  <button key={r.key} type="button" onClick={() => setOpenKey(r.key)} className="flex h-[232px] w-[212px] flex-none flex-col overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] text-left transition-colors hover:bg-[var(--wash)]">
                    <span className="flex flex-1 flex-col gap-1 px-4 pt-4">
                      <span className="text-[12.5px] text-muted-foreground">{responsibleLine(r.clientPersonId) ?? (r.balance ? "Sent" : "Draft")}</span>
                      <span className="text-[15px] font-medium leading-[1.3]">{r.clientName}</span>
                      <span className="text-[12.5px] text-muted-foreground">{shortDay(lastTouched(r))}</span>
                      <span className={cn("mt-auto self-end pb-3 text-[17px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{r.noChargeOn ? "No charge" : money(r.amount)}</span>
                    </span>
                    <span className={cn("flex h-[44px] items-center justify-center text-[13px] font-medium", r.noChargeOn ? "bg-[var(--wash)] text-[var(--ink-body)]" : STATUS_PILL[r.status])}>{r.noChargeOn ? "No charge" : r.status}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setWorkspaceOpen(true)} className="flex h-[232px] w-[212px] flex-none flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--hairline)] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                  <span className="text-[13.5px]">New packet</span>
                </button>
                {packets.map((p) => {
                  const carrier = enrollments.find((e) => e.clientPersonId === p.clientPersonId)?.carrier;
                  return (
                    <button key={p.clientPersonId} type="button" onClick={() => setWorkspaceOpen(true)} className="flex h-[232px] w-[212px] flex-none flex-col overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] text-left transition-colors hover:bg-[var(--wash)]">
                      <span className="flex flex-1 flex-col gap-1 px-4 pt-4">
                        <span className="text-[12.5px] text-muted-foreground">{p.invoiceNumber ?? "No invoice"}</span>
                        <span className="text-[15px] font-medium leading-[1.3]">{p.clientName}</span>
                        <span className="text-[12.5px] leading-[1.4] text-muted-foreground">
                          {carrier ?? "Carrier not set"} · {periodLabel(`${p.periodStart} – ${p.periodEnd}`)}
                        </span>
                        <span className={cn("mt-auto self-end pb-3 text-[17px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(p.invoiceTotal)}</span>
                      </span>
                      <span className={cn("flex h-[44px] items-center justify-center text-[13px] font-medium", PACKET_PILL[p.state])}>{PACKET_STATE_LABELS[p.state]}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {mode === "invoices" ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="m-0 text-[17px] font-semibold tracking-[-.01em]">All invoices</h2>
                <div className="relative">
                  <button type="button" onClick={() => setPeriodOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={periodOpen} className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                    {periodOptions.find((o) => o.value === activePeriod)?.label ?? "All periods"}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </button>
                  {periodOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPeriodOpen(false)} aria-hidden="true" />
                      <ul role="listbox" className={cn(MENU, "left-0 max-h-[280px] w-[240px] overflow-y-auto")}>
                        {periodOptions.map((o) => (
                          <li key={o.value}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={activePeriod === o.value}
                              onClick={() => {
                                setPeriod(o.value);
                                setPeriodOpen(false);
                              }}
                              className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", activePeriod === o.value ? "font-medium text-primary" : "text-[var(--ink-body)]")}
                            >
                              {o.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" disabled={pendingCount === 0} onClick={() => setBatch(needsReviewBatch())} className="flex h-[36px] items-center gap-2 rounded-[10px] border border-primary/40 bg-[#EEF0FE] px-3.5 text-[13px] font-medium text-primary transition-colors hover:bg-[#E4E7FD] disabled:opacity-50">
                  Review invoices
                  <span className="rounded-full bg-[var(--paper)] px-[7px] py-px text-[11px] font-semibold text-[#B54708]">{pendingCount}</span>
                </button>
                <button type="button" disabled={packets.length === 0} onClick={() => setWorkspaceOpen(true)} className={cn(MENU_BUTTON, "gap-2 px-3.5 disabled:opacity-50")}>
                  Workspace
                  {workspaceCount > 0 && <span className="rounded-full bg-[var(--wash)] px-[7px] py-px text-[11px] font-semibold text-[#B54708]">{workspaceCount}</span>}
                </button>
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search"
                    aria-label="Search invoices by client or responsible party"
                    className="h-[36px] w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] pl-8 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <button type="button" onClick={() => setStatusOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={statusOpen} className={cn("flex h-[36px] items-center gap-[7px] rounded-[10px] border px-3 text-[13px] transition-colors", filter === "All" ? "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground" : "border-primary bg-[#EEF0FE] font-medium text-primary")}>
                    {filter === "All" ? "All statuses" : filter}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  </button>
                  {statusOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} aria-hidden="true" />
                      <ul role="listbox" aria-label="Filter invoices by status" className={cn(MENU, "right-0 w-[200px]")}>
                        {[...PRIMARY_STATUS_FILTERS, ...MORE_STATUS_FILTERS].map((s) => {
                          const n = countByStatus(s);
                          return (
                            <li key={s}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={filter === s}
                                onClick={() => {
                                  setFilter(s);
                                  setPage(0);
                                  setStatusOpen(false);
                                }}
                                className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", filter === s ? "font-medium text-primary" : "text-[var(--ink-body)]")}
                              >
                                {s === "All" ? "All statuses" : s}
                                {n > 0 && <span className="ml-auto text-[11px] text-muted-foreground">{n}</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>
              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-primary/30 bg-[#F7F8FE] px-4 py-2.5">
                  <span className="text-[13px] font-medium">
                    {selectedCount} {selectedCount === 1 ? "invoice" : "invoices"} selected
                  </span>
                  <button type="button" onClick={() => setBatch(selectedBatch())} className="h-[32px] rounded-[9px] bg-primary px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                    Review selected
                  </button>
                  <button type="button" onClick={() => exportRows(visible.filter((r) => selected[r.key]))} className="h-[32px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                    Export
                  </button>
                  <button type="button" onClick={() => setSelected({})} className="ml-auto text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                    Clear
                  </button>
                </div>
              )}
              <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <caption className="sr-only">Invoices, work first and settled last</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="w-[44px] bg-[var(--paper-sunken)] px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select every invoice shown"
                            checked={pageRows.length > 0 && pageRows.every((r) => selected[r.key])}
                            onChange={(e) => {
                              const next = { ...selected };
                              for (const r of pageRows) {
                                if (e.target.checked) next[r.key] = true;
                                else delete next[r.key];
                              }
                              setSelected(next);
                            }}
                            className="h-4 w-4 rounded border-[var(--hairline)] accent-[hsl(var(--primary))]"
                          />
                        </th>
                        {sortableTh("client", "Client / Responsible party")}
                        {sortableTh("period", "Service period")}
                        {th("Issued / Due")}
                        {sortableTh("amount", "Amount / Status", true)}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                            {q ? `Nobody matching “${query}”.` : `Nothing in “${filter === "All" ? "All statuses" : filter}” for this period.`}
                          </td>
                        </tr>
                      )}
                      {pageRows.map((r) => (
                        <tr key={r.key} onClick={() => setOpenKey(r.key)} className={cn("cursor-pointer border-t border-[var(--hairline-soft)] transition-colors hover:bg-[var(--wash)]", selected[r.key] && "bg-[#F7F8FE]")}>
                          <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${r.clientName}'s invoice`}
                              checked={!!selected[r.key]}
                              onChange={(e) => {
                                const next = { ...selected };
                                if (e.target.checked) next[r.key] = true;
                                else delete next[r.key];
                                setSelected(next);
                              }}
                              className="h-4 w-4 rounded border-[var(--hairline)] accent-[hsl(var(--primary))]"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <span className="flex flex-col gap-[3px] leading-[1.3]">
                              <span className="text-[14.5px] font-medium">{r.clientName}</span>
                              <span className="text-[12.5px] text-muted-foreground">{responsibleLine(r.clientPersonId) ?? (r.balance ? "Sent" : "Draft")}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="flex flex-col gap-[3px] leading-[1.3]">
                              <span className="text-[13.5px] text-[var(--ink-body)]">{periodLabel(r.period)}</span>
                              <span className="text-[12.5px] text-muted-foreground tabular-nums">{hoursOfRow(r) === null ? "—" : `${hoursOfRow(r)} hrs`}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="flex flex-col gap-[3px] leading-[1.3]">
                              <span className="text-[13.5px] text-[var(--ink-body)]">{issuedLabel(r)}</span>
                              <span className="text-[12.5px] text-muted-foreground">{dueLine(r)}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">
                            <span className="flex flex-col items-end gap-[5px] leading-[1.3]">
                              <span className={cn("text-[15px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                                {r.noChargeOn ? <span className="text-[12px] font-normal text-muted-foreground">On {r.noChargeOn}'s invoice</span> : money(r.amount)}
                              </span>
                              <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium", r.noChargeOn ? "bg-[var(--hairline-soft)] text-[var(--ink-body)]" : STATUS_PILL[r.status])}>
                                {r.noChargeOn ? "No charge" : r.status}
                                {r.status === "Past due" && r.balance ? ` · ${r.balance.daysOverdue}d` : ""}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(filter === "All" || filter === "Needs review") &&
                        (activePeriod === "all" || activePeriod === thisPeriod) &&
                        !q &&
                        run.skipped.map((s) => {
                          const because = run.exceptions.find((e) => e.clientPersonId === s.clientPersonId && e.blocksDraft);
                          return (
                            <tr key={s.clientPersonId} className="border-t border-[var(--hairline-soft)]">
                              <td />
                              <td className="px-4 py-4">
                                <span className="flex flex-col gap-[3px] leading-[1.3]">
                                  <span className="text-[14.5px] font-medium">{s.clientName}</span>
                                  <span className="text-[12.5px] text-muted-foreground">No draft</span>
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-[13.5px] text-muted-foreground">{periodLabel(thisPeriod)}</td>
                              <td className="px-4 py-4" colSpan={2}>
                                <span className="flex flex-wrap items-baseline gap-2">
                                  <span className="inline-flex whitespace-nowrap rounded-full bg-[#FFFAEB] px-2.5 py-[3px] text-[11.5px] font-medium text-[#B54708]">Cannot bill</span>
                                  <span className="text-[12.5px] text-[var(--ink-body)] [text-wrap:pretty]">{because?.detail ?? RUN_EXCEPTION_LABELS[s.because]}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--hairline)]">
                        <td colSpan={5} className="px-4 py-4 text-right text-[14px] text-[var(--ink-body)]">
                          Grand total: <span className={cn("text-[15px] font-semibold text-foreground tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(grandTotal)}</span> <span className="text-muted-foreground">USD</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] text-muted-foreground">{visible.length === 0 ? "0 invoices" : `${pageStart + 1}–${Math.min(pageStart + rowsPerPage, visible.length)} of ${visible.length} ${visible.length === 1 ? "invoice" : "invoices"}`}</span>
                {pageCount > 1 && (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={pageIndex === 0} aria-label="Previous page" className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="text-[12.5px] text-muted-foreground tabular-nums">
                      {pageIndex + 1} / {pageCount}
                    </span>
                    <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={pageIndex >= pageCount - 1} aria-label="Next page" className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] disabled:opacity-40">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                )}
                <button type="button" disabled={inPeriod.length === 0} onClick={() => setBatch(periodBatch())} className="text-[13px] font-medium text-primary hover:underline disabled:opacity-50">
                  Review all {inPeriod.length}
                </button>
                <span className="ml-auto flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPeriod(activePeriod === "all" ? "" : "all");
                      setFilter("All");
                      setPage(0);
                    }}
                    className={cn(MENU_BUTTON, "px-3.5")}
                  >
                    {activePeriod === "all" ? "Back to this period" : "View archived invoices"}
                  </button>
                  <span className="text-[13px] text-muted-foreground">Rows</span>
                  <div className="relative">
                    <button type="button" onClick={() => setRowsOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={rowsOpen} className={cn(MENU_BUTTON, "gap-1.5")}>
                      {rowsPerPage}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    </button>
                    {rowsOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setRowsOpen(false)} aria-hidden="true" />
                        <ul role="listbox" aria-label="Rows per page" className={cn(MENU, "right-0 w-[80px]")}>
                          {[10, 25, 50].map((n) => (
                            <li key={n}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={rowsPerPage === n}
                                onClick={() => {
                                  setRowsPerPage(n);
                                  setPage(0);
                                  setRowsOpen(false);
                                }}
                                className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", rowsPerPage === n ? "font-medium text-primary" : "text-[var(--ink-body)]")}
                              >
                                {n}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="m-0 text-[17px] font-semibold tracking-[-.01em]">All packets</h2>
                <span className="text-[13px] text-muted-foreground">{periodLabel(`${packetRange.start} – ${packetRange.end}`)}</span>
                <button type="button" disabled={packets.length === 0} onClick={() => setWorkspaceOpen(true)} className={cn(MENU_BUTTON, "ml-auto gap-2 px-3.5 disabled:opacity-50")}>
                  Open workspace
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <caption className="sr-only">LTCI reimbursement packets for the period</caption>
                    <thead>
                      <tr>
                        {th("Client / Carrier")}
                        {th("Service period")}
                        {th("Paid invoice")}
                        {th("Care notes")}
                        {th("Amount / Status", true)}
                      </tr>
                    </thead>
                    <tbody>
                      {packets.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                            No client is marked as holding a long-term care policy.
                          </td>
                        </tr>
                      )}
                      {packets.map((p) => {
                        const carrier = enrollments.find((e) => e.clientPersonId === p.clientPersonId)?.carrier;
                        const filed = p.visits.filter((v) => v.noteFiled).length;
                        return (
                          <tr key={p.clientPersonId} onClick={() => setWorkspaceOpen(true)} className="cursor-pointer border-t border-[var(--hairline-soft)] transition-colors hover:bg-[var(--wash)]">
                            <td className="px-4 py-4">
                              <span className="flex flex-col gap-[3px] leading-[1.3]">
                                <span className="text-[14.5px] font-medium">{p.clientName}</span>
                                <span className="text-[12.5px] text-muted-foreground">{carrier ?? "Carrier not set"}</span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-[13.5px] text-[var(--ink-body)]">{periodLabel(`${p.periodStart} – ${p.periodEnd}`)}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-[13.5px]">{p.paidOn ? <span className="text-[#027A48]">Paid {shortDay(p.paidOn)}</span> : <span className="text-muted-foreground">Not paid yet</span>}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-[13.5px] text-[var(--ink-body)]">{p.visits.length === 0 ? <span className="text-muted-foreground">None</span> : `${filed} ${filed === 1 ? "note" : "notes"}`}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-right">
                              <span className="flex flex-col items-end gap-[5px] leading-[1.3]">
                                <span className={cn("text-[15px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(p.invoiceTotal)}</span>
                                <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium", PACKET_PILL[p.state])}>{PACKET_STATE_LABELS[p.state]}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <StepStrip
            title={`Billing week · ${periodLabel(thisPeriod)}`}
            summary={`${sent.length} of ${run.drafts.length} sent · ${needsReview.length > 0 ? `${needsReview.length} need review before this week can go` : approved.length > 0 ? `${approved.length} ready to send` : "nothing outstanding to review"}`}
            steps={steps}
            joyLine={null}
            className="mt-1"
          />
          <div className="sticky bottom-3 z-20 -mx-1 mt-2 flex flex-wrap items-center gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-4 py-3 shadow-[0_8px_30px_rgba(25,26,46,.10)] lg:mr-[150px]">
            <span className={cn("h-[8px] w-[8px] flex-none rounded-full", pendingCount > 0 || stuckPackets > 0 ? "bg-[#F79009]" : weekComplete ? "bg-[#12B76A]" : "bg-[var(--hairline)]")} aria-hidden="true" />
            <span className="text-[14px] text-[var(--ink-body)] [text-wrap:pretty]">
              {[
                pendingCount > 0 && `${pendingCount} ${pendingCount === 1 ? "invoice needs" : "invoices need"} review`,
                pendingCount === 0 && approved.length > 0 && `${approved.length} approved and waiting to send`,
                pendingCount === 0 && approved.length === 0 && (allSent ? "This week's invoices are sent" : "Nothing waiting on you"),
                workspaceCount > 0 && `${workspaceCount} LTCI ${workspaceCount === 1 ? "packet" : "packets"} waiting in the workspace`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2.5">
              {packets.length > 0 && (
                <button type="button" onClick={() => setWorkspaceOpen(true)} className="flex h-[40px] items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-4 text-[13.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                  Review workspace
                  {workspaceCount > 0 && <span className="rounded-full bg-[var(--wash)] px-[7px] py-px text-[11px] font-semibold text-[#B54708]">{workspaceCount}</span>}
                </button>
              )}
              {pendingCount > 0 ? (
                <button type="button" onClick={() => setBatch(needsReviewBatch())} className="h-[40px] rounded-[10px] bg-primary px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  Review invoices
                </button>
              ) : approved.length > 0 ? (
                <button type="button" onClick={() => sendAll(approved)} className="h-[40px] rounded-[10px] bg-primary px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  Send the {approved.length} approved
                </button>
              ) : (
                <button type="button" disabled={inPeriod.length === 0} onClick={() => setBatch(periodBatch())} className="h-[40px] rounded-[10px] bg-primary px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1] disabled:opacity-50">
                  Review all {inPeriod.length}
                </button>
              )}
            </span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- Payers -- */}
      {tab === "payers" && (
        <section aria-label="Payers" className="flex flex-col gap-3.5">
          <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <caption className="sr-only">Every client and how they pay</caption>
                <thead>
                  <tr>
                    {th("Client")}
                    {th("Pay type")}
                    {th("Rate", true)}
                    {th("Billing method")}
                  </tr>
                </thead>
                <tbody>
                  {payers.map((p) => (
                    <tr key={p.clientPersonId} onClick={() => setOpenPayerId(p.clientPersonId)} className="cursor-pointer border-t border-[var(--hairline-soft)] transition-colors hover:bg-[var(--wash)]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">{initialsOf(p.name)}</span>
                          <span className="flex flex-col leading-[1.35]">
                            <span className="text-[13px]">{p.name}</span>
                            {responsibleLine(p.clientPersonId) && <span className="text-[11.5px] text-muted-foreground">{responsibleLine(p.clientPersonId)}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", p.type === "Not recorded" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[var(--wash-strong)] text-[var(--ink-body)]")}>{p.type}</span>
                        {p.ltci && <span className="mt-1 block text-[11px] text-muted-foreground">{p.ltci.carrier || "Carrier not recorded"}</span>}
                      </td>
                      <td className={cn("whitespace-nowrap px-4 py-3 text-right text-[12.5px] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{p.rate === null ? <span className="text-muted-foreground">No rate agreed</span> : `${money(p.rate)}/hr`}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- Profitability -- */}
      {tab === "profit" && (
        <section aria-label="Profitability" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex gap-1 rounded-[9px] bg-[var(--wash)] p-[3px]" role="radiogroup" aria-label="Period">
              {PROFIT_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  onClick={() => {
                    setScope(s);
                    setOffset(0);
                  }}
                  className={cn("h-[28px] rounded-[7px] px-3.5 text-[12.5px] transition-colors", scope === s ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]" : "text-muted-foreground hover:text-foreground")}
                >
                  {PROFIT_SCOPE_LABELS[s]}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5">
              <button type="button" aria-label={`Previous ${PROFIT_SCOPE_LABELS[scope].toLowerCase()}`} onClick={() => setOffset((o) => o - 1)} className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[13px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                ‹
              </button>
              <span className="text-[12.5px] text-[var(--ink-body)]">{range.label}</span>
              <button type="button" aria-label={`Next ${PROFIT_SCOPE_LABELS[scope].toLowerCase()}`} disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[13px] transition-colors", offset >= 0 ? "cursor-not-allowed text-muted-foreground/30" : "text-muted-foreground hover:bg-[var(--wash)] hover:text-foreground")}>
                ›
              </button>
              {offset < 0 && (
                <button type="button" onClick={() => setOffset(0)} className="rounded-[6px] px-1.5 text-[11px] font-medium text-primary hover:underline">
                  {scope === "week" ? "This week" : scope === "month" ? "This month" : "This year"}
                </button>
              )}
            </span>
            {scope !== "week" && <span className="text-[11.5px] text-muted-foreground">projected from the standing schedule</span>}
            {totals.unknown > 0 && (
              <span className="ml-auto max-w-[340px] text-[11.5px] leading-[1.5] text-[#B54708] [text-wrap:pretty]">
                {totals.unknown} {totals.unknown === 1 ? "client is" : "clients are"} missing a caregiver rate, so their cost is not in these figures.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-stretch rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-1 py-4">
            {(
              [
                ["Total invoiced", money(totals.billed), null, ""],
                ["Caregiver cost", money(totals.cost), null, ""],
                ["Net profit", money(totals.net), null, ""],
                ["Margin", totals.billed > 0 ? `${((totals.net / totals.billed) * 100).toFixed(2)}%` : "—", marginTone(totals.billed > 0 ? (totals.net / totals.billed) * 100 : null), `${MARGIN_TARGET}% target`],
              ] as const
            ).map(([label, value, tone, note], i) => (
              <span key={label} className={cn("flex min-w-[150px] flex-1 flex-col gap-[3px] px-[18px]", i > 0 && "border-l border-[var(--hairline-soft)]")}>
                <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">{label}</span>
                <span className={cn("text-[19px] font-semibold tracking-[-.015em] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50", !priv && tone)}>{value}</span>
                {note && <span className="text-[11.5px] text-muted-foreground">{note}</span>}
              </span>
            ))}
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <caption className="sr-only">What each client was invoiced over {range.label}, what the care cost, and what is left</caption>
                <thead>
                  <tr>
                    {profitTh("name", "Client")}
                    {profitTh("hours", "Billable hours", true)}
                    {profitTh("billed", "Invoiced", true)}
                    {profitTh("cost", "Caregiver cost", true)}
                    {profitTh("net", "Net profit", true)}
                    {profitTh("margin", "Margin", true)}
                  </tr>
                </thead>
                <tbody>
                  {profitRows.map((r) => (
                    <tr key={r.clientPersonId} className="border-t border-[var(--hairline-soft)] hover:bg-[var(--wash)]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">{initialsOf(r.name)}</span>
                          <span className="text-[13px]">{r.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] text-[var(--ink-body)] tabular-nums">{r.hours || "—"}</td>
                      <td className={cn("px-4 py-3 text-right text-[13px] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>
                        {r.billedOn ? <span className="text-muted-foreground">On {r.billedOn}'s invoice</span> : r.billed === null ? <span className="text-muted-foreground">No rate agreed</span> : money(r.billed)}
                      </td>
                      <td className={cn("px-4 py-3 text-right text-[12.5px] tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{r.cost === null ? <span className="text-muted-foreground">No rate on file</span> : <span className="text-muted-foreground">{money(r.cost)}</span>}</td>
                      <td className={cn("px-4 py-3 text-right text-[13px] font-medium tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(r.net)}</td>
                      <td className={cn("px-4 py-3 text-right text-[12.5px] font-medium tabular-nums", priv ? "text-muted-foreground/50" : marginTone(r.margin))}>{r.billedOn || r.margin === null ? "—" : `${r.margin.toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--hairline)] bg-[var(--paper-sunken)]">
                    <td className="px-4 py-3 text-[12.5px] font-semibold">
                      {payers.length} {payers.length === 1 ? "client" : "clients"}
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums">{totals.hours}</td>
                    <td className={cn("px-4 py-3 text-right text-[13px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(totals.billed)}</td>
                    <td className={cn("px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(totals.cost)}</td>
                    <td className={cn("px-4 py-3 text-right text-[13px] font-semibold tabular-nums", priv && "tracking-[.1em] text-muted-foreground/50")}>{money(totals.net)}</td>
                    <td className={cn("px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums", priv ? "text-muted-foreground/50" : marginTone(totals.billed > 0 ? (totals.net / totals.billed) * 100 : null))}>{totals.billed > 0 ? `${((totals.net / totals.billed) * 100).toFixed(2)}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ dialogs -- */}
      <ReviewBatchDialog
        batch={batch}
        onBatchChange={setBatch}
        itemFor={itemFor}
        readyToSend={[
          ...approved.map((d) => ({ key: draftKey(d), clientName: d.clientName, amount: d.total ?? d.subtotal })),
          ...manualDrafts.filter((d) => approvedDrafts[d.key] && !approvedDrafts[d.key]?.sentAs).map((d) => ({ key: d.key, clientName: d.clientName, amount: d.total })),
        ]}
        money={money}
        weekLabel={weekLabel}
        dueLabel={dueLabel}
        onApprove={(item) => {
          if (item.draft) {
            approve(item.draft);
            return;
          }
          approveDraft(item.key, { total: item.amount ?? 0, lineCount: item.lines.length, ratePlanVersionId: null });
          toast.success(`${item.clientName}'s invoice approved — ${money(item.amount)}.`);
        }}
        onEdit={(item) => {
          setBatch(null);
          if (item.draft) setEditingKey(item.key);
          else setOpenKey(item.key);
        }}
        onHold={(item) => {
          setHeld((h) => ({ ...h, [item.key]: true }));
          toast.success(`${item.clientName} held — excluded from this send, still in Needs review.`);
        }}
        onDetails={(item) => {
          setBatch(null);
          setOpenKey(item.key);
        }}
        onSendAll={() => sendAll(approved)}
      />

      <InvoiceSheet
        open={openRow !== null}
        onOpenChange={(o) => !o && setOpenKey(null)}
        clientName={openRow?.clientName ?? ""}
        periodLabel={openRow ? periodLabel(openRow.period) : ""}
        statusLabel={openRow?.status ?? ""}
        statusClass={openRow ? STATUS_PILL[openRow.status] : ""}
        amount={openRow?.amount ?? null}
        method={openRow?.method ?? ""}
        dueLabel={
          openRow?.balance
            ? openRow.balance.state === "paid" || openRow.balance.state === "overpaid"
              ? `Paid ${openRow.balance.lastPaymentOn ? weekdayDay(openRow.balance.lastPaymentOn) : ""}`
              : `${openRow.balance.daysOverdue > 0 ? "Was due" : "Due"} ${weekdayDay(openRow.balance.invoice.dueOn)}`
            : openRow?.draft
              ? `Due ${weekdayDay(openRow.draft.dueOn)}`
              : ""
        }
        hours={openRow ? hoursOfRow(openRow) : null}
        draft={openRow?.draft ?? null}
        manualLines={openRow?.manualLines ?? openRow?.balance?.invoice.lines?.map((l) => ({ description: l.description, amount: l.amount, hours: l.hours, rate: l.rate })) ?? null}
        balance={openRow?.balance ?? null}
        exceptions={openRow?.draft ? run.exceptions.filter((e) => e.clientPersonId === openRow.clientPersonId) : []}
        failure={openRow?.balance ? (failureFor(openRow.balance.invoice.id)?.failure ?? null) : null}
        retryRefusals={openRow?.balance ? (failureFor(openRow.balance.invoice.id)?.refusals ?? []) : []}
        onRetry={retry}
        reminders={
          openRow?.balance && openRow.balance.balance > 0 && openRow.balance.state !== "written_off"
            ? (() => {
                const d = dunningDatesFor(openRow.balance.invoice.weekStart);
                return [
                  { when: d.emailsBeginOn, label: "Reminder email — then one every day until paid" },
                  { when: d.firstTextOn, label: "Morning text joins the daily email" },
                  { when: d.callAndTextIfUnpaidOn, label: "Call and text from the office" },
                  { when: d.servicesStopIfUnpaidBy, label: "Unpaid by tonight: services stop — your call, never automatic" },
                ];
              })()
            : []
        }
        editedLines={openRow?.editedLines ?? null}
        refunds={openRow?.balance ? refunds.filter((r) => r.invoiceId === openRow.balance!.invoice.id) : []}
        responsibleParty={(openRow && responsibleName(openRow.clientPersonId)) || null}
        money={money}
        onAction={(action) => {
          const r = openRow;
          if (!r) return;
          if (action === "Add adjustment" && r.balance) return setAdjustingId(r.balance.invoice.id);
          if (action === "Void invoice" && r.balance) return setVoidingId(r.balance.invoice.id);
          if (action === "Issue refund" && r.balance) return setRefundingId(r.balance.invoice.id);
          if (action === "Resend invoice" && r.balance) {
            resendInvoice({ invoiceId: r.balance.invoice.id, clientName: r.clientName });
            toast.success(`${r.clientName}'s invoice resent`, { description: "The family is told an invoice exists; the figures wait in the portal." });
            return;
          }
          if (action === "Edit payer setup") return setPayerSetupId(r.clientPersonId);
          if (action === "Preview invoice") return setPreviewKey(r.key);
          if (action === "Edit invoice") setEditingKey(r.key);
        }}
      />

      <AdjustmentDialog
        open={adjustingId !== null}
        onOpenChange={(o) => !o && setAdjustingId(null)}
        clientName={balanceById(adjustingId)?.invoice.clientName ?? ""}
        invoiceNumber={balanceById(adjustingId)?.invoice.invoiceNumber ?? ""}
        currentTotal={balanceById(adjustingId)?.invoice.total ?? 0}
        money={money}
        onSave={(input) => {
          if (!adjustingId) return;
          adjustInvoice({ invoiceId: adjustingId, ...input });
          toast.success("Adjustment recorded", { description: `${input.kind === "credit" ? "−" : "+"}${money(input.amount)} · the original amount stays on the record.` });
          setAdjustingId(null);
        }}
      />
      <VoidDialog
        open={voidingId !== null}
        onOpenChange={(o) => !o && setVoidingId(null)}
        clientName={balanceById(voidingId)?.invoice.clientName ?? ""}
        invoiceNumber={balanceById(voidingId)?.invoice.invoiceNumber ?? ""}
        amount={balanceById(voidingId)?.invoice.total ?? 0}
        money={money}
        onVoid={(reason) => {
          if (!voidingId) return;
          voidInvoice({ invoiceId: voidingId, reason });
          toast.success("Invoice voided", { description: reason });
          setVoidingId(null);
          setOpenKey(null);
        }}
      />
      <RefundDialog
        open={refundingId !== null}
        onOpenChange={(o) => !o && setRefundingId(null)}
        clientName={balanceById(refundingId)?.invoice.clientName ?? ""}
        invoiceNumber={balanceById(refundingId)?.invoice.invoiceNumber ?? ""}
        paid={balanceById(refundingId)?.paid ?? 0}
        invoiceTotal={balanceById(refundingId)?.invoice.total ?? 0}
        method={refundingId ? methodLabel(balanceById(refundingId)?.invoice.clientPersonId ?? "") : ""}
        money={money}
        onRefund={({ amount, reason, kind }) => {
          if (!refundingId) return;
          const inv = balanceById(refundingId)?.invoice;
          refundInvoice({ invoiceId: refundingId, amount, reason, kind, method: methodLabel(inv?.clientPersonId ?? "").startsWith("Card") ? "card" : "ach" });
          toast.success(`${money(amount)} refunded`, { description: kind === "not_delivered" ? "Stripe returns it the way it came. The invoice comes down by the same amount." : "Stripe returns it the way it came. The invoice stands — the week is unpaid again." });
          setRefundingId(null);
        }}
      />

      <EditDraftDialog
        open={editingKey !== null}
        onOpenChange={(o) => !o && setEditingKey(null)}
        clientName={editingRow?.clientName ?? ""}
        periodLabel={editingRow ? periodLabel(editingRow.period) : ""}
        scheduledHours={editingRow?.scheduledHours ?? 0}
        agreedRate={editingRow ? rateFor(editingRow.clientPersonId, weekStart) : null}
        current={editingRow?.edit ?? null}
        accountMethod={editingRow && methodLabel(editingRow.clientPersonId).startsWith("Card") ? "card" : "ach"}
        payerType={payers.find((p) => p.clientPersonId === editingRow?.clientPersonId)?.type ?? "—"}
        household={(() => {
          if (!editingRow) return null;
          const h = householdOf(households, editingRow.clientPersonId);
          const partner = h?.members.find((m) => m.personId !== editingRow.clientPersonId);
          return h && partner ? { partnerName: partner.name, billing: h.billing } : null;
        })()}
        onHouseholdBilling={(billing) => {
          if (!editingRow) return;
          const h = householdOf(households, editingRow.clientPersonId);
          if (!h) return;
          setHouseholdBilling(h.id, billing);
          toast.success(`${h.label} — ${billing === "combined" ? "billed together" : "invoiced separately"}`, { description: "This week's drafts have been repriced." });
        }}
        money={money}
        onSave={({ hours, rate, reason, charges, method }) => {
          if (!editingKey) return;
          saveDraftEdit({ key: editingKey, hours, rate, reason, charges, method });
          toast.success(`${editingRow?.clientName ?? "Draft"} updated`, { description: reason || "The draft has been changed. It still needs review before it goes out." });
          setEditingKey(null);
        }}
        onPreview={(edit) => {
          if (!editingKey) return;
          setPreviewEdit(edit);
          setPreviewKey(editingKey);
        }}
      />

      <InvoicePreviewDialog
        open={previewKey !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewKey(null);
            setPreviewEdit(null);
          }
        }}
        agencyName="Joy Healthcare Services, LLC"
        clientName={previewRow?.clientName ?? ""}
        periodLabel={previewRow ? periodLabel(previewRow.period) : ""}
        invoiceNumber={previewInvoice?.invoiceNumber ?? null}
        issuedOn={previewInvoice ? shortDay(previewInvoice.issuedOn) : null}
        dueLabel={previewInvoice ? shortDay(previewInvoice.dueOn) : dueLabel}
        method={previewEdit ? (previewEdit.method === "card" ? "Card · Stripe" : "ACH · Stripe") : (previewRow?.method ?? "")}
        lines={previewLines.map((l) => ({ description: l.description, detail: l.hours > 0 && l.rate !== null ? `${l.hours} hrs × ${money(l.rate * l.multiplier)}` : null, amount: l.amount }))}
        total={previewRepriced ? previewRepriced.total : (previewRow?.amount ?? null)}
        money={money}
      />

      <FirstPaymentDialog
        open={firstOpen}
        onOpenChange={setFirstOpen}
        onOrdinaryCharge={() => {
          setFirstOpen(false);
          setCreateOpen(true);
        }}
        today={today}
        clients={payers.map((p) => ({
          clientPersonId: p.clientPersonId,
          name: p.name,
          rate: p.rate,
          weeklyHours: seedBillingAccountClients.find((c) => c.clientPersonId === p.clientPersonId)?.agreedWeeklyHours ?? null,
          payerType: p.type,
          method: p.method === "Card" ? "card" : "ach",
          alreadyIssued: !!firstPayments[p.clientPersonId],
        }))}
        money={money}
        onSave={(d) => {
          saveFirstPayment({ clientPersonId: d.clientPersonId, deposit: d.deposit, depositReason: d.depositReason, technologyFee: d.chargeTechnologyFee ? TECHNOLOGY_FEE : 0, startsOn: d.startsOn });
          const name = payers.find((p) => p.clientPersonId === d.clientPersonId)?.name ?? "Client";
          const key = `first-${d.clientPersonId}-${d.startsOn}`;
          setManualDrafts((ds) => [...ds, { key, clientPersonId: d.clientPersonId, clientName: name, lines: d.lines, total: d.total, incurred: d.dueOn, method: d.method }]);
          setPeriod(d.dueOn);
          toast.success(`First-time payment drafted for ${name}`, { description: `${money(d.total)} · due ${shortDay(d.dueOn)} · care starts ${shortDay(d.startsOn)}` });
        }}
      />

      <PayerSheet open={openPayer !== null} onOpenChange={(o) => !o && setOpenPayerId(null)} payer={openPayer} rateChanges={openPayer ? rateChanges.filter((c) => c.clientPersonId === openPayer.clientPersonId) : []} onEdit={() => openPayer && setPayerSetupId(openPayer.clientPersonId)} />

      <PayerSetupDialog
        open={payerSetupId !== null}
        onOpenChange={(o) => !o && setPayerSetupId(null)}
        clientName={setupPayer?.name ?? ""}
        effectiveFrom={weekStart}
        effectiveLabel={weekLabel}
        current={{ rate: setupPayer?.rate ?? null, method: setupPayer?.method === "ACH" ? "ach" : setupPayer?.method === "Card" ? "card" : null, type: setupPayer?.type ?? "Private Pay" }}
        householdCandidates={payers
          .filter((p) => p.clientPersonId !== payerSetupId)
          .map((p) => ({
            clientPersonId: p.clientPersonId,
            name: p.name,
            sharesVisits: run.visits.some((v) => {
              const ids = servedPeople(v).map((x) => x.personId);
              return ids.includes(p.clientPersonId) && ids.includes(payerSetupId ?? "");
            }),
          }))}
        household={(() => {
          if (!payerSetupId) return null;
          const h = householdOf(households, payerSetupId);
          const partner = h?.members.find((m) => m.personId !== payerSetupId);
          return h && partner ? { partnerPersonId: partner.personId, partnerName: partner.name, billing: h.billing } : null;
        })()}
        onSave={({ patch, rate, reason, household }) => {
          if (!payerSetupId) return;
          const me = payers.find((p) => p.clientPersonId === payerSetupId);
          savePayerSetup({ clientPersonId: payerSetupId, patch, rate, currentRate: me?.rate ?? null, reason, effectiveFrom: weekStart });
          const partner = payers.find((p) => p.clientPersonId === household.partnerPersonId);
          if (household.partnerPersonId && partner) {
            pairHousehold({ clientPersonId: payerSetupId, clientName: me?.name ?? "", partnerPersonId: household.partnerPersonId, partnerName: partner.name, billing: household.billing });
          }
          const rateMoved = rate !== me?.rate;
          toast.success(`${me?.name ?? "Payer"} setup saved`, { description: rateMoved ? `$${(me?.rate ?? 0).toFixed(2)} → $${rate.toFixed(2)} from ${weekLabel}` : "The change applies to the next invoice raised." });
          setPayerSetupId(null);
        }}
      />

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFirstTimePayment={() => {
          setCreateOpen(false);
          setFirstOpen(true);
        }}
        clients={invoiceClients}
        existingPeriods={existingPeriods}
        money={money}
        onCreateDraft={(d) => {
          setManualDrafts((ds) => [...ds, d]);
          setPeriod(d.incurred);
          toast.success(`Draft saved for ${d.clientName}`, { description: `${money(d.total)} · ${d.incurred} · in Invoices, waiting for your approval` });
        }}
        onApproveSend={(key) => {
          const d = manualDrafts.find((m) => m.key === key);
          if (!d) return;
          sendInvoice({ key, clientPersonId: d.clientPersonId, clientName: d.clientName, weekStart, weekEnd, total: d.total, lines: d.lines.map((l) => ({ description: l.description, hours: 0, rate: null, amount: l.amount })) });
          setManualDrafts((ds) => ds.filter((m) => m.key !== key));
          toast.success(`Invoice sent to ${d.clientName}`, { description: `${money(d.total)} · payment link delivered through Stripe` });
        }}
      />

      <LtciWorkspace open={workspaceOpen} onOpenChange={setWorkspaceOpen} packets={packets} enrollments={enrollments} periodLabel={periodLabel(`${packetRange.start} – ${packetRange.end}`)} money={money} onSend={sendPackets} onEditCarrier={(id) => setCarrierEditId(id)} />

      <CarrierSheet
        open={carrierEditId !== null}
        onOpenChange={(o) => !o && setCarrierEditId(null)}
        enrollment={ltciEnrollments.find((e) => e.clientPersonId === carrierEditId) ?? null}
        fromAdmission={carrierEditId ? (releaseByPerson.get(carrierEditId) ?? null) : null}
        onSave={(id, patch) => {
          saveLtciEnrollment(id, patch);
          const name = ltciEnrollments.find((e) => e.clientPersonId === id)?.clientName;
          toast.success(`${name}'s policy details saved`, { description: "The packet is rechecked against them straight away." });
        }}
      />
    </>
  );
}
