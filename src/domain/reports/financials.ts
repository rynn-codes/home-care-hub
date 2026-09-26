import { financialHistory, REFUND_KIND_LABELS, type Refund } from "@/domain/billing/invoiceActions";
import { invoiceBalance, type IssuedInvoice, type Payment } from "@/domain/billing/receivables";
import { entryHours, OVERTIME_AFTER_HOURS, workweekStart, type TimeEntry } from "@/domain/payroll/hours";
import { grossFor } from "@/domain/payroll/review";
import { categoryInfo, live, type VisitExpense } from "@/domain/scheduling/expenses";
import type { Visit } from "@/domain/scheduling/conflicts";
import { INVESTOR_BASIS_LABELS, type InvestorBasis } from "@/domain/agency/settings";
import { inRange, monthsIn, type DateRange } from "./period";
import { REPORT_LABELS, type ReportResult } from "./reports";

/**
 * The money reports — for Karynn, her bookkeeper and her investor.
 *
 * Every figure comes from the same records Billing and Payroll read: issued
 * invoices, their adjustments and write-offs, payments and refunds, time
 * entries and expense lines. Nothing here is a second copy of anything.
 *
 * THE WORDS. "Billed" is what the invoices said when they went out. "Net
 * billed" is billed after credits, debits and write-offs — what the agency
 * actually expects. "Collected" is money that arrived; "net collected" is
 * that less refunds. The investor is paid on collected money, so the
 * investor report never touches the billed side and never names a client.
 */

const money = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface MonthMoney {
  month: string;
  billed: number;
  credits: number;
  debits: number;
  writtenOff: number;
  netBilled: number;
  collected: number;
  refunded: number;
  netCollected: number;
}

/** What each month billed and collected, oldest first, one row per month in the range. */
export function monthlyMoney(input: { invoices: readonly IssuedInvoice[]; payments: readonly Payment[]; range: DateRange }): MonthMoney[] {
  const rows = new Map<string, MonthMoney>();
  const blank = (month: string): MonthMoney => ({ month, billed: 0, credits: 0, debits: 0, writtenOff: 0, netBilled: 0, collected: 0, refunded: 0, netCollected: 0 });
  for (const m of monthsIn(input.range)) rows.set(m, blank(m));
  const get = (day: string) => {
    const m = day.slice(0, 7);
    if (!rows.has(m)) rows.set(m, blank(m));
    return rows.get(m)!;
  };

  for (const inv of input.invoices) {
    if (inRange(inv.issuedOn, input.range)) get(inv.issuedOn).billed += financialHistory(inv).original;
    for (const a of inv.adjustments ?? []) {
      if (!inRange(a.createdAt, input.range)) continue;
      if (a.kind === "credit") get(a.createdAt).credits += a.amount;
      else if (a.kind === "debit") get(a.createdAt).debits += a.amount;
      else get(a.createdAt).writtenOff += a.amount;
    }
    if (inv.writtenOffOn && inRange(inv.writtenOffOn, input.range)) {
      // What was still owed when it was written off, not the whole invoice.
      const paid = input.payments.filter((p) => p.invoiceId === inv.id).reduce((n, p) => n + p.amount, 0);
      get(inv.writtenOffOn).writtenOff += Math.max(0, inv.total - paid);
    }
  }
  for (const p of input.payments) {
    if (!inRange(p.receivedOn, input.range)) continue;
    if (p.amount >= 0) get(p.receivedOn).collected += p.amount;
    else get(p.receivedOn).refunded += -p.amount;
  }

  return [...rows.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({
      ...r,
      billed: money(r.billed),
      credits: money(r.credits),
      debits: money(r.debits),
      writtenOff: money(r.writtenOff),
      netBilled: money(r.billed + r.debits - r.credits - r.writtenOff),
      collected: money(r.collected),
      refunded: money(r.refunded),
      netCollected: money(r.collected - r.refunded),
    }));
}

const sum = <T,>(rows: readonly T[], f: (r: T) => number) => money(rows.reduce((n, r) => n + f(r), 0));

// -------------------------------------------------------- revenue summary --

export function revenueSummary(input: { invoices: readonly IssuedInvoice[]; payments: readonly Payment[]; range: DateRange }): ReportResult {
  const rows = monthlyMoney(input);
  const any = rows.some((r) => r.billed || r.collected || r.refunded || r.credits || r.writtenOff);
  const totals = { billed: sum(rows, (r) => r.billed), net: sum(rows, (r) => r.netBilled), collected: sum(rows, (r) => r.netCollected) };
  return {
    key: "revenue_summary",
    title: REPORT_LABELS.revenue_summary,
    subtitle: any ? `$${totals.billed.toLocaleString()} billed · $${totals.net.toLocaleString()} net · $${totals.collected.toLocaleString()} collected after refunds · ${input.range.label}` : input.range.label,
    state: any ? "computed" : "empty",
    columns: [
      { key: "month", label: "Month" },
      { key: "billed", label: "Billed", numeric: true, money: true },
      { key: "credits", label: "Credits", numeric: true, money: true },
      { key: "writtenOff", label: "Written off", numeric: true, money: true },
      { key: "netBilled", label: "Net billed", numeric: true, money: true },
      { key: "collected", label: "Collected", numeric: true, money: true },
      { key: "refunded", label: "Refunded", numeric: true, money: true },
      { key: "netCollected", label: "Net collected", numeric: true, money: true },
    ],
    rows: rows.map((r) => ({ ...r })),
    chart: { labelKey: "month", valueKey: "netCollected", unit: "$" },
    note:
      "Billed is what the invoices said when they went out, by issue date. Net billed takes off credits and write-offs and adds debits. Collected is money that arrived, by the date it arrived; net collected is that less refunds. Only issued invoices count — a computed week nobody was billed for is not revenue.",
  };
}

// ------------------------------------------------------ revenue by client --

export function revenueByClient(input: { invoices: readonly IssuedInvoice[]; payments: readonly Payment[]; range: DateRange }): ReportResult {
  const byClient = new Map<string, { client: string; invoices: number; billed: number; credits: number; collected: number; outstanding: number }>();
  const row = (id: string, name: string) => {
    const r = byClient.get(id) ?? { client: name, invoices: 0, billed: 0, credits: 0, collected: 0, outstanding: 0 };
    byClient.set(id, r);
    return r;
  };
  for (const inv of input.invoices) {
    if (!inRange(inv.issuedOn, input.range)) continue;
    const r = row(inv.clientPersonId, inv.clientName);
    const h = financialHistory(inv);
    r.invoices += 1;
    r.billed += h.original;
    r.credits += Math.max(0, -h.adjustment);
    const b = invoiceBalance({ invoice: inv, payments: input.payments, asOf: input.range.end });
    r.outstanding += b.state === "written_off" ? 0 : Math.max(0, b.balance);
  }
  const invoiceClient = new Map(input.invoices.map((i) => [i.id, i]));
  for (const p of input.payments) {
    if (!inRange(p.receivedOn, input.range)) continue;
    const inv = invoiceClient.get(p.invoiceId);
    if (!inv) continue;
    row(inv.clientPersonId, inv.clientName).collected += p.amount;
  }
  const rows = [...byClient.values()]
    .map((r) => ({ ...r, billed: money(r.billed), credits: money(r.credits), collected: money(r.collected), outstanding: money(r.outstanding) }))
    .sort((a, b) => b.billed - a.billed);
  return {
    key: "revenue_by_client",
    title: REPORT_LABELS.revenue_by_client,
    subtitle: `${rows.length} client${rows.length === 1 ? "" : "s"} invoiced · ${input.range.label}`,
    state: rows.length ? "computed" : "empty",
    columns: [
      { key: "client", label: "Client" },
      { key: "invoices", label: "Invoices", numeric: true },
      { key: "billed", label: "Billed", numeric: true, money: true },
      { key: "credits", label: "Credits", numeric: true, money: true },
      { key: "collected", label: "Collected", numeric: true, money: true },
      { key: "outstanding", label: "Still owed", numeric: true, money: true },
    ],
    rows,
    chart: { labelKey: "client", valueKey: "billed", unit: "$" },
    note: "Invoices by issue date; payments by the date they arrived, so a payment this month against last month's invoice counts here. Still owed is as at the end of the period.",
  };
}

// ------------------------------------------------------ payments received --

const METHOD_LABELS: Record<string, string> = { card: "Card", ach: "ACH", check: "Check" };

export function paymentsReceived(input: { invoices: readonly IssuedInvoice[]; payments: readonly Payment[]; range: DateRange }): ReportResult {
  const byId = new Map(input.invoices.map((i) => [i.id, i]));
  const rows = input.payments
    .filter((p) => inRange(p.receivedOn, input.range))
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))
    .map((p) => {
      const inv = byId.get(p.invoiceId);
      return {
        date: p.receivedOn,
        client: inv?.clientName ?? "—",
        invoice: inv?.invoiceNumber ?? p.invoiceId,
        method: p.amount < 0 ? "Refund" : METHOD_LABELS[p.method] ?? p.method,
        reference: p.reference ?? "",
        amount: money(p.amount),
      };
    });
  const received = sum(rows.filter((r) => r.amount > 0), (r) => r.amount);
  const refunded = sum(rows.filter((r) => r.amount < 0), (r) => -r.amount);
  return {
    key: "payments_received",
    title: REPORT_LABELS.payments_received,
    subtitle: rows.length ? `$${received.toLocaleString()} received${refunded ? `, $${refunded.toLocaleString()} refunded` : ""} · ${input.range.label}` : input.range.label,
    state: rows.length ? "computed" : "empty",
    columns: [
      { key: "date", label: "Date" },
      { key: "client", label: "Client" },
      { key: "invoice", label: "Invoice" },
      { key: "method", label: "How" },
      { key: "reference", label: "Reference" },
      { key: "amount", label: "Amount", numeric: true, money: true },
    ],
    rows,
    note: "Every payment recorded against an issued invoice, newest first. Refunds show as negative amounts. This is the list to reconcile against the bank.",
  };
}

// -------------------------------------------------------- adjustments log --

export function adjustmentsLog(input: { invoices: readonly IssuedInvoice[]; refunds: readonly Refund[]; range: DateRange }): ReportResult {
  const rows: Array<{ date: string; client: string; invoice: string; kind: string; amount: number; reason: string; by: string }> = [];
  const byId = new Map(input.invoices.map((i) => [i.id, i]));
  for (const inv of input.invoices) {
    for (const a of inv.adjustments ?? []) {
      if (!inRange(a.createdAt, input.range) || a.origin === "refund") continue;
      rows.push({ date: a.createdAt.slice(0, 10), client: inv.clientName, invoice: inv.invoiceNumber ?? inv.id, kind: a.kind === "credit" ? "Credit" : a.kind === "debit" ? "Debit" : "Write-off", amount: money(a.kind === "debit" ? a.amount : -a.amount), reason: a.reason, by: a.createdByUserId });
    }
    if (inv.writtenOffOn && inRange(inv.writtenOffOn, input.range)) {
      rows.push({ date: inv.writtenOffOn, client: inv.clientName, invoice: inv.invoiceNumber ?? inv.id, kind: "Written off", amount: money(-inv.total), reason: inv.writtenOffReason ?? "", by: "" });
    }
  }
  for (const r of input.refunds) {
    if (!inRange(r.on, input.range)) continue;
    const inv = byId.get(r.invoiceId);
    rows.push({ date: r.on, client: inv?.clientName ?? "—", invoice: inv?.invoiceNumber ?? r.invoiceId, kind: `Refund · ${REFUND_KIND_LABELS[r.kind]}`, amount: money(-r.amount), reason: r.reason, by: r.issuedByUserId });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const total = sum(rows, (r) => r.amount);
  return {
    key: "adjustments_log",
    title: REPORT_LABELS.adjustments_log,
    subtitle: rows.length ? `${rows.length} ${rows.length === 1 ? "entry" : "entries"} · net $${total.toLocaleString()} · ${input.range.label}` : input.range.label,
    state: rows.length ? "computed" : "empty",
    columns: [
      { key: "date", label: "Date" },
      { key: "client", label: "Client" },
      { key: "invoice", label: "Invoice" },
      { key: "kind", label: "What" },
      { key: "amount", label: "Amount", numeric: true, money: true },
      { key: "reason", label: "Reason" },
      { key: "by", label: "By" },
    ],
    rows,
    note: "Everything that changed an invoice after it went out, or sent money back, with the reason given at the time. A bookkeeper reconciling billed against collected starts here.",
  };
}

// --------------------------------------------------------- investor share --

export interface InvestorShareRow {
  month: string;
  collected: number;
  refunded: number;
  netCollected: number;
  basisAmount: number;
  percent: number;
  due: number;
}

export function investorShareRows(input: { payments: readonly Payment[]; range: DateRange; percent: number; basis: InvestorBasis }): InvestorShareRow[] {
  return monthlyMoney({ invoices: [], payments: input.payments, range: input.range }).map((m) => {
    const basisAmount = input.basis === "collected" ? m.collected : m.netCollected;
    return { month: m.month, collected: m.collected, refunded: m.refunded, netCollected: m.netCollected, basisAmount, percent: input.percent, due: money((basisAmount * input.percent) / 100) };
  });
}

export function investorShare(input: { payments: readonly Payment[]; range: DateRange; percent: number; basis: InvestorBasis; investorName: string }): ReportResult {
  if (!(input.percent > 0)) {
    return {
      key: "investor_share",
      title: REPORT_LABELS.investor_share,
      subtitle: input.range.label,
      state: "needs_input",
      columns: [],
      rows: [],
      missing: ["No investor share is set. Settings → Agency → Investor share holds the percentage and what it is a percentage of."],
    };
  }
  const rows = investorShareRows(input);
  const due = sum(rows, (r) => r.due);
  const basis = sum(rows, (r) => r.basisAmount);
  return {
    key: "investor_share",
    title: REPORT_LABELS.investor_share,
    subtitle: `${input.percent}% of ${INVESTOR_BASIS_LABELS[input.basis].toLowerCase()} · $${due.toLocaleString()} on $${basis.toLocaleString()} · ${input.range.label}`,
    state: rows.some((r) => r.collected || r.refunded) ? "computed" : "empty",
    columns: [
      { key: "month", label: "Month" },
      { key: "collected", label: "Collected", numeric: true, money: true },
      { key: "refunded", label: "Refunded", numeric: true, money: true },
      { key: "basisAmount", label: INVESTOR_BASIS_LABELS[input.basis], numeric: true, money: true },
      { key: "percent", label: "Share %", numeric: true },
      { key: "due", label: `Due to ${input.investorName || "the investor"}`, numeric: true, money: true },
    ],
    rows: rows.map((r) => ({ ...r })),
    chart: { labelKey: "month", valueKey: "due", unit: "$" },
    note: "Collected money only, by the month it arrived. Nothing billed and not yet paid is in it. The report sent to the investor carries these figures and no client's name.",
  };
}

/** The brief report for the investor: figures only, no names, no health information. */
export function investorReportText(input: { row: InvestorShareRow; agencyName: string; investorName: string; basis: InvestorBasis }): { subject: string; body: string } {
  const monthName = new Date(`${input.row.month}-15T12:00:00`).toLocaleString([], { month: "long", year: "numeric" });
  const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = [
    `${input.agencyName} — investor report for ${monthName}`,
    "",
    `Collected: ${usd(input.row.collected)}`,
    `Refunded: ${usd(input.row.refunded)}`,
    `${INVESTOR_BASIS_LABELS[input.basis]}: ${usd(input.row.basisAmount)}`,
    `Share: ${input.row.percent}%`,
    `Amount due: ${usd(input.row.due)}`,
    "",
    "Figures are collected revenue for the calendar month, from the agency's billing records. No client information is included.",
  ];
  return { subject: `${input.agencyName} — ${monthName} investor report: ${usd(input.row.due)} due`, body: lines.join("\n") };
}

// ---------------------------------------------------------- payroll cost --

export function payrollCost(input: { entries: readonly TimeEntry[]; nameFor: (personId: string) => string; rateFor: (name: string) => number | null; range: DateRange }): ReportResult {
  const weeks = new Map<string, Map<string, number>>();
  for (const e of input.entries) {
    if (!inRange(e.clockedInAt, input.range)) continue;
    const name = input.nameFor(e.caregiverPersonId);
    const week = workweekStart(e.clockedInAt);
    const perWeek = weeks.get(name) ?? new Map<string, number>();
    perWeek.set(week, (perWeek.get(week) ?? 0) + entryHours(e));
    weeks.set(name, perWeek);
  }
  const unrated: string[] = [];
  const rows = [...weeks]
    .map(([name, perWeek]) => {
      let regular = 0;
      let overtime = 0;
      for (const h of perWeek.values()) {
        regular += Math.min(h, OVERTIME_AFTER_HOURS);
        overtime += Math.max(h - OVERTIME_AFTER_HOURS, 0);
      }
      const rate = input.rateFor(name);
      const gross = grossFor({ regularHours: regular, overtimeHours: overtime, rate });
      if (gross === null) unrated.push(name);
      return { caregiver: name, regular: round1(regular), overtime: round1(overtime), rate: rate ?? 0, gross: gross ?? 0 };
    })
    .sort((a, b) => b.gross - a.gross);
  const total = sum(rows, (r) => r.gross);
  const hours = round1(rows.reduce((n, r) => n + r.regular + r.overtime, 0));
  return {
    key: "payroll_cost",
    title: REPORT_LABELS.payroll_cost,
    subtitle: rows.length ? `$${total.toLocaleString()} gross on ${hours} hours · ${input.range.label}` : input.range.label,
    state: rows.length ? "computed" : "empty",
    columns: [
      { key: "caregiver", label: "Caregiver" },
      { key: "regular", label: "Regular hours", numeric: true },
      { key: "overtime", label: "Overtime", numeric: true },
      { key: "rate", label: "Rate", numeric: true, money: true },
      { key: "gross", label: "Gross", numeric: true, money: true },
    ],
    rows,
    chart: { labelKey: "caregiver", valueKey: "gross", unit: "$" },
    note: [
      "Hours from the clock, overtime per workweek over 40, priced at the base rate on each employee's record. Those rates are placeholders until the real ones are entered. Gross wages only: no employer taxes, insurance or reimbursements.",
      "Gusto is the record of what was actually paid; this is what the hours cost at those rates.",
      unrated.length ? `No rate on file, so shown at $0: ${unrated.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

// -------------------------------------------------------- reimbursements --

export function reimbursements(input: { visitExpenses: Record<string, VisitExpense[]>; visits: readonly Visit[]; mileageRatePerMile: number; range: DateRange }): ReportResult {
  const caregiverOf = new Map(input.visits.map((v) => [v.id, v.caregiverName ?? "Unassigned"]));
  const rows = new Map<string, { caregiver: string; miles: number; mileage: number; other: number; total: number; items: number; awaitingReview: number }>();
  for (const [visitId, list] of Object.entries(input.visitExpenses)) {
    for (const e of live(list ?? [])) {
      const info = categoryInfo(e.category);
      if (info.settlesTo !== "caregiver" || !inRange(e.date, input.range)) continue;
      const name = caregiverOf.get(visitId) ?? "Unassigned";
      const r = rows.get(name) ?? { caregiver: name, miles: 0, mileage: 0, other: 0, total: 0, items: 0, awaitingReview: 0 };
      const amount = info.byMiles ? e.miles * input.mileageRatePerMile : e.amount;
      if (info.byMiles) {
        r.miles += e.miles;
        r.mileage += amount;
      } else r.other += amount;
      r.total += amount;
      r.items += 1;
      if (!e.reviewedAt) r.awaitingReview += 1;
      rows.set(name, r);
    }
  }
  const out = [...rows.values()].map((r) => ({ ...r, miles: round1(r.miles), mileage: money(r.mileage), other: money(r.other), total: money(r.total) })).sort((a, b) => b.total - a.total);
  const total = sum(out, (r) => r.total);
  const pending = out.reduce((n, r) => n + r.awaitingReview, 0);
  return {
    key: "reimbursements",
    title: REPORT_LABELS.reimbursements,
    subtitle: out.length ? `$${total.toLocaleString()} owed to caregivers${pending ? ` · ${pending} item${pending === 1 ? "" : "s"} awaiting review` : ""} · ${input.range.label}` : input.range.label,
    state: out.length ? "computed" : "empty",
    columns: [
      { key: "caregiver", label: "Caregiver" },
      { key: "miles", label: "Miles", numeric: true },
      { key: "mileage", label: "Mileage", numeric: true, money: true },
      { key: "other", label: "Other", numeric: true, money: true },
      { key: "total", label: "Total", numeric: true, money: true },
      { key: "awaitingReview", label: "Awaiting review", numeric: true },
    ],
    rows: out,
    chart: { labelKey: "caregiver", valueKey: "total", unit: "$" },
    note: `Mileage at $${input.mileageRatePerMile.toFixed(2)} a mile, the rate in Settings, plus meals, gas and other items that settle to the caregiver. Supplies, pharmacy and groceries settle to the client and are not here. Reimbursements are not wages: not taxed, not overtime. Nothing awaiting review should be paid yet.`,
  };
}
