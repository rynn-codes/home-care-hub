import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { ACH_CONVENIENCE_FEE, CARD_CONVENIENCE_RATE, type InvoiceLine } from "@/domain/billing/invoice";

/**
 * Invoices raised by hand, drafts edited before they go, and the first-time
 * payment that precedes care. None of these come from the Saturday run, so
 * none of them has a schedule Joy can check them against — which is why
 * every one says so on review.
 */

// ---------------------------------------------------------- charge types --

export interface ChargeType {
  key: string;
  label: string;
  hint: string;
  quantityLabel: string | null;
  /** Quantity × rate, rather than a flat amount. */
  rated: boolean;
}

export const CHARGE_TYPES: readonly ChargeType[] = [
  { key: "hours", label: "Service hours", hint: "Missed or additional care hours", quantityLabel: "Hours", rated: true },
  { key: "mileage", label: "Transportation / mileage", hint: "Trips, mileage or transport time", quantityLabel: "Miles", rated: true },
  { key: "expense", label: "Expense / reimbursement", hint: "Money a caregiver fronted", quantityLabel: null, rated: false },
  { key: "service", label: "Additional service", hint: "One-time service outside the care plan", quantityLabel: "Quantity", rated: true },
  { key: "fee", label: "Fee / adjustment", hint: "Contractual fee or one-off adjustment", quantityLabel: null, rated: false },
  { key: "custom", label: "Custom item", hint: "Anything the types above do not cover", quantityLabel: "Quantity", rated: false },
];

/** The IRS standard rate, as a starting point for a mileage charge. */
export const MILEAGE_RATE = 0.7;

export function chargeType(key: string): ChargeType {
  return CHARGE_TYPES.find((t) => t.key === key) ?? CHARGE_TYPES[0];
}

export interface ManualCharge {
  id: number;
  type: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export function chargeAmount(c: ManualCharge): number {
  const n = chargeType(c.type).rated ? c.quantity * c.rate : c.amount;
  return Math.round(n * 100) / 100;
}

export interface ManualDraft {
  key: string;
  clientPersonId: string;
  clientName: string;
  lines: Array<{ description: string; amount: number }>;
  total: number;
  /** The date or period the charge belongs to, as a label. */
  incurred: string;
  method: "ach" | "card";
}

/** The processing fee line, or none when there is nothing to process. */
export function feeLine(method: "ach" | "card", subtotal: number): { label: string; amount: number } | null {
  if (subtotal <= 0) return null;
  return method === "card"
    ? { label: `Card fee · ${(CARD_CONVENIENCE_RATE * 100).toFixed(1)}%`, amount: Math.round(subtotal * CARD_CONVENIENCE_RATE * 100) / 100 }
    : { label: "ACH fee", amount: ACH_CONVENIENCE_FEE };
}

/** The last N agency weeks, newest first, for a service-period picker. */
export function recentWeeks(count = 8): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const anchor = new Date(`${agencyWeekStart(new Date().toISOString().slice(0, 10))}T12:00:00`);
  for (let i = 0; i < count; i += 1) {
    const start = new Date(anchor);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const value = start.toISOString().slice(0, 10);
    const m1 = start.toLocaleDateString("en-US", { month: "long" });
    const m2 = end.toLocaleDateString("en-US", { month: "long" });
    out.push({
      value,
      label: m1 === m2 ? `${m1} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}` : `${m1} ${start.getDate()} – ${m2} ${end.getDate()}, ${end.getFullYear()}`,
    });
  }
  return out;
}

// ------------------------------------------------------------ draft edits --

export interface DraftCharge {
  id: string;
  type: string;
  description: string;
  amount: number;
}

export interface DraftEdit {
  hours: number;
  /** Absent when the agreed rate stands. */
  rate?: number;
  reason: string;
  charges: DraftCharge[];
  method: "ach" | "card";
  editedByUserId: string;
  editedAt: string;
}

let chargeSeq = 0;
export const newChargeId = () => `dc-${Date.now()}-${chargeSeq++}`;

export type DraftEditRefusal = "negative_hours" | "no_rate" | "no_reason" | "unchanged" | "charge_incomplete";

export const DRAFT_EDIT_MESSAGES: Record<DraftEditRefusal, string> = {
  negative_hours: "Hours cannot be negative.",
  no_rate: "Enter the rate for this invoice.",
  no_reason: "Say why this invoice differs from the agreement.",
  unchanged: "Nothing has changed yet",
  charge_incomplete: "Give each charge a description and an amount.",
};

export function draftEditRefusals(input: {
  hours: number;
  scheduledHours: number;
  rate: number | null;
  agreedRate: number | null;
  reason: string;
  charges: readonly DraftCharge[];
  changed: boolean;
}): DraftEditRefusal[] {
  const refusals: DraftEditRefusal[] = [];
  if (input.hours < 0) refusals.push("negative_hours");
  if (input.agreedRate !== null && !(input.rate !== null && input.rate > 0)) refusals.push("no_rate");
  const hoursMoved = input.hours !== input.scheduledHours;
  const rateMoved = input.agreedRate !== null && input.rate !== null && input.rate !== input.agreedRate;
  if ((hoursMoved || rateMoved) && !input.reason.trim()) refusals.push("no_reason");
  if (input.charges.some((c) => !c.description.trim() || !(c.amount > 0))) refusals.push("charge_incomplete");
  if (!input.changed) refusals.push("unchanged");
  return refusals;
}

export function reasonQuestion(input: { hoursMoved: boolean; rateMoved: boolean }): string {
  if (input.hoursMoved && input.rateMoved) return "Why does this invoice differ from the agreement?";
  if (input.rateMoved) return "Why is the rate different on this invoice?";
  return "Why do the hours differ from the schedule?";
}

export function regularCareLabel(input: { hours: number; scheduledHours: number }): string {
  return input.hours === input.scheduledHours ? "Regular care" : `Regular care — adjusted from ${input.scheduledHours} hrs`;
}

export function processingFee(input: { subtotal: number; method: "ach" | "card" }): number {
  if (input.subtotal <= 0) return 0;
  return input.method === "card" ? Math.round(input.subtotal * CARD_CONVENIENCE_RATE * 100) / 100 : ACH_CONVENIENCE_FEE;
}

export function draftSubtotal(input: { hours: number; rate: number | null; charges: readonly { amount: number }[] }): number | null {
  if (input.rate === null) return null;
  const care = input.hours * input.rate;
  const extras = input.charges.reduce((t, c) => t + c.amount, 0);
  return Math.round((care + extras) * 100) / 100;
}

/** A draft re-priced from an edit: the care line, the charges, the fee. */
export function repriceDraft(input: { scheduledHours: number; hours: number; rate: number | null; charges: readonly DraftCharge[]; method: "ach" | "card" }): { lines: InvoiceLine[]; total: number | null } {
  const subtotal = draftSubtotal(input);
  const fee = subtotal === null ? 0 : processingFee({ subtotal, method: input.method });
  const lines: InvoiceLine[] = [
    {
      kind: "standard",
      description: regularCareLabel({ hours: input.hours, scheduledHours: input.scheduledHours }),
      hours: input.hours,
      rate: input.rate,
      multiplier: 1,
      amount: input.rate === null ? null : Math.round(input.hours * input.rate * 100) / 100,
    },
    ...input.charges.map((c) => ({ kind: "manual" as const, description: c.description, hours: 0, rate: null, multiplier: 1, amount: c.amount })),
    ...(fee > 0 ? [{ kind: "manual" as const, description: input.method === "card" ? "Card processing fee · 2.9%" : "ACH processing fee", hours: 0, rate: null, multiplier: 1, amount: fee }] : []),
  ];
  return { lines, total: subtotal === null ? null : Math.round((subtotal + fee) * 100) / 100 };
}

// ------------------------------------------------------ first-time payment --

/** One time, at the start of service. */
export const TECHNOLOGY_FEE = 100;

export function oneWeekOfCare(input: { weeklyHours: number | null; rate: number | null }): number | null {
  if (input.weeklyHours === null || input.rate === null) return null;
  return Math.round(input.weeklyHours * input.rate * 100) / 100;
}

export interface FirstPaymentLine {
  key: string;
  description: string;
  detail: string;
  amount: number;
}

export function firstPaymentLines(input: {
  weeklyHours: number | null;
  rate: number | null;
  deposit: number;
  chargeTechnologyFee: boolean;
  method: "ach" | "card";
  weekLabel: string;
}): { lines: FirstPaymentLine[]; subtotal: number; fee: number; total: number } {
  const care = input.weeklyHours === null || input.rate === null ? null : Math.round(input.weeklyHours * input.rate * 100) / 100;
  const lines: FirstPaymentLine[] = [];
  if (input.deposit > 0) lines.push({ key: "deposit", description: "Deposit", detail: "Held on the account and applied to the final week of care", amount: input.deposit });
  if (input.chargeTechnologyFee) lines.push({ key: "technology", description: "Technology fee", detail: "One time, at the start of service", amount: TECHNOLOGY_FEE });
  if (care !== null) lines.push({ key: "care", description: "First week of care", detail: `${input.weeklyHours} hrs × $${input.rate!.toFixed(2)} · ${input.weekLabel}`, amount: care });
  const subtotal = Math.round(lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;
  const fee = subtotal <= 0 ? 0 : input.method === "card" ? Math.round(subtotal * CARD_CONVENIENCE_RATE * 100) / 100 : ACH_CONVENIENCE_FEE;
  return { lines, subtotal, fee, total: Math.round((subtotal + fee) * 100) / 100 };
}

export type FirstPaymentRefusal = "no_client" | "no_rate" | "no_hours" | "negative_deposit" | "no_deposit_reason" | "no_start" | "due_after_start" | "already_issued";

export const FIRST_PAYMENT_MESSAGES: Record<FirstPaymentRefusal, string> = {
  no_client: "Choose a client",
  no_rate: "This client has no agreed rate. Set it in Payers first.",
  no_hours: "This client has no agreed weekly hours yet.",
  negative_deposit: "A deposit cannot be negative.",
  no_deposit_reason: "Say why the deposit is not one week of care.",
  no_start: "Say when care starts.",
  due_after_start: "Payment must be due before care starts.",
  already_issued: "This client has already had a first invoice.",
};

export function firstPaymentRefusals(input: {
  hasClient: boolean;
  rate: number | null;
  weeklyHours: number | null;
  deposit: number;
  suggested: number | null;
  depositReason: string;
  startsOn: string;
  dueOn: string;
  alreadyIssued: boolean;
}): FirstPaymentRefusal[] {
  if (!input.hasClient) return ["no_client"];
  const refusals: FirstPaymentRefusal[] = [];
  if (input.alreadyIssued) refusals.push("already_issued");
  if (input.rate === null) refusals.push("no_rate");
  if (input.weeklyHours === null) refusals.push("no_hours");
  if (input.deposit < 0) refusals.push("negative_deposit");
  if (input.suggested !== null && Math.abs(input.deposit - input.suggested) > 5e-3 && !input.depositReason.trim()) refusals.push("no_deposit_reason");
  if (!input.startsOn) refusals.push("no_start");
  if (input.startsOn && input.dueOn && input.dueOn >= input.startsOn) refusals.push("due_after_start");
  return refusals;
}

/** The week a first day of care falls in, for the line's label. */
export function weekOf(iso: string): { start: string; label: string } {
  const d = new Date(`${iso}T12:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const short = (x: Date) => `${x.toLocaleDateString("en-US", { month: "short" })} ${x.getDate()}`;
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return { start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: `${short(d)} – ${short(end)}` };
}
