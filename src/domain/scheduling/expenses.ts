/**
 * Expenses claimed on a visit — mileage, meals, supplies, a prescription.
 *
 * Nothing goes on a client's invoice or into payroll until somebody who did
 * not record it has reviewed it. Deleted items are kept thirty days. A
 * receipt is required at $75 and over; the receipt image itself never enters
 * localStorage — only its name, size, type and when it was taken.
 */

export type ExpenseCategory = "mileage" | "meals" | "gas" | "supplies" | "pharmacy" | "groceries" | "other";

export interface ExpenseCategoryInfo {
  category: ExpenseCategory;
  label: string;
  /** Who the money goes to — reimbursing the caregiver, or billing the client. */
  settlesTo: "caregiver" | "client";
  byMiles: boolean;
  plain: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryInfo[] = [
  { category: "mileage", label: "Mileage", settlesTo: "caregiver", byMiles: true, plain: "Driving for the client, paid per mile at the agency rate." },
  { category: "meals", label: "Meals", settlesTo: "caregiver", byMiles: false, plain: "The caregiver's own meal on a long shift, where the agency has agreed to cover it." },
  { category: "gas", label: "Gas", settlesTo: "caregiver", byMiles: false, plain: "Fuel bought for the client's own car. Not for trips already claimed as mileage." },
  { category: "supplies", label: "Supplies", settlesTo: "client", byMiles: false, plain: "Gloves, wipes, incontinence supplies — bought for the client, billed to the client." },
  { category: "pharmacy", label: "Pharmacy", settlesTo: "client", byMiles: false, plain: "A prescription or over-the-counter item collected for the client." },
  { category: "groceries", label: "Groceries", settlesTo: "client", byMiles: false, plain: "Food shopping done for the client, with their money or the agency's to be billed on." },
  { category: "other", label: "Other", settlesTo: "caregiver", byMiles: false, plain: "Anything else. Say what kind — the office decides who it settles to." },
];

export function categoryInfo(category: ExpenseCategory | string): ExpenseCategoryInfo {
  return EXPENSE_CATEGORIES.find((c) => c.category === category) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

export const RECEIPT_REQUIRED_FROM = 75;
export const DELETED_KEPT_DAYS = 30;
export const REVIEW_RULE = "Nothing goes on a client's invoice or into payroll until somebody who did not record it has reviewed it.";

/** What is kept about a receipt. Never the image. */
export interface ReceiptMeta {
  name: string;
  size: number;
  type: string;
  via: "camera" | "upload";
  takenAt: string;
}

export interface VisitExpense {
  id: string;
  visitId: string;
  category: ExpenseCategory;
  otherKind?: string;
  description: string;
  date: string;
  amount: number;
  miles: number;
  /** Where the miles came from — Joy's GPS reading or the odometer. */
  milesFrom?: "gps" | "typed" | null;
  tripFrom?: string;
  tripTo?: string;
  receipt: ReceiptMeta | null;
  recordedBy: string;
  recordedOn: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export function isDeleted(e: VisitExpense): boolean {
  return !!e.deletedAt;
}

export function live(list: readonly VisitExpense[]): VisitExpense[] {
  return list.filter((e) => !isDeleted(e));
}

export function purgeOn(e: VisitExpense): Date | null {
  if (!e.deletedAt) return null;
  const d = new Date(e.deletedAt);
  d.setDate(d.getDate() + DELETED_KEPT_DAYS);
  return d;
}

/** Drop deleted items whose thirty days are up. */
export function purgeExpired(list: readonly VisitExpense[], now: Date): VisitExpense[] {
  return list.filter((e) => {
    const at = purgeOn(e);
    return at === null || at.getTime() > now.getTime();
  });
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function deletedLine(e: VisitExpense): string {
  if (!e.deletedAt) return "";
  const by = e.deletedBy ? ` by ${e.deletedBy.split(" ")[0]}` : "";
  return `Deleted ${shortDate(e.deletedAt)}${by} · gone for good ${shortDate(purgeOn(e)!.toISOString())}`;
}

export function kindLabel(e: VisitExpense): string {
  return e.category === "other" && (e.otherKind ?? "").trim() !== "" ? e.otherKind!.trim() : categoryInfo(e.category).label;
}

export function descriptionLine(e: VisitExpense): string {
  if (categoryInfo(e.category).byMiles) {
    const from = (e.tripFrom ?? "").trim();
    const to = (e.tripTo ?? "").trim();
    return from && to ? `${from} → ${to}` : to || from || e.description;
  }
  return e.description;
}

export function needsReview(e: VisitExpense): boolean {
  return !isDeleted(e) && !e.reviewedAt;
}

export function mayReview(e: VisitExpense, reviewer: string): boolean {
  return reviewer.trim() !== "" && reviewer.trim() !== (e.recordedBy ?? "").trim();
}

export function whyNotReviewable(e: VisitExpense, reviewer: string): string | null {
  if (mayReview(e, reviewer)) return null;
  if (reviewer.trim() === "") return "Nobody is signed in to review it.";
  return `${reviewer.split(" ")[0]} recorded this one, so somebody else has to review it.`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function validateExpense(input: { expense: VisitExpense; others: readonly VisitExpense[] }): string | null {
  const { expense } = input;
  const others = live(input.others);
  const info = categoryInfo(expense.category);
  if (!expense.date) return "Say which day it was.";
  if (info.byMiles) {
    if (!Number.isFinite(expense.miles) || expense.miles <= 0) return "Say how many miles.";
    if (expense.miles > 300) return "Over 300 miles on one visit — check the number.";
    if ((expense.tripFrom ?? "").trim() === "") return "Say where the trip started.";
    if ((expense.tripTo ?? "").trim() === "") return "Say where it went.";
    return null;
  }
  if (!Number.isFinite(expense.amount) || expense.amount <= 0) return "Say how much it was.";
  if (expense.amount > 1000) return "Over $1,000 on one visit — check the number.";
  if (expense.category === "other" && (expense.otherKind ?? "").trim() === "") return "Say what kind of expense it was.";
  if (expense.description.trim() === "") return "Say what it was for.";
  if (expense.category === "gas" && others.some((o) => o.category === "mileage")) {
    return "Mileage is already claimed on this visit, and the mileage rate includes fuel. Claim one or the other.";
  }
  if (expense.amount >= RECEIPT_REQUIRED_FROM && expense.receipt === null) return `A receipt is needed for anything $${RECEIPT_REQUIRED_FROM} or over.`;
  return null;
}

export function receiptMissing(e: VisitExpense): boolean {
  return !categoryInfo(e.category).byMiles && e.receipt === null;
}

export function expensesTotal(list: readonly VisitExpense[], mileageRatePerMile: number): number {
  return r2(
    live(list).reduce((sum, e) => (categoryInfo(e.category).byMiles ? sum + Math.max(0, e.miles) * Math.max(0, mileageRatePerMile) : sum + Math.max(0, e.amount)), 0),
  );
}

/** "$41.20 · 3 items · receipt missing on 1 · 2 to review". */
export function expensesLine(list: readonly VisitExpense[], mileageRatePerMile: number): string {
  const items = live(list);
  if (items.length === 0) return "None claimed on this visit.";
  const total = expensesTotal(items, mileageRatePerMile);
  const missing = items.filter(receiptMissing).length;
  const review = items.filter(needsReview).length;
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  return `$${total.toFixed(2)} · ${count}${missing === 0 ? "" : ` · receipt missing on ${missing}`}${review === 0 ? "" : ` · ${review} to review`}`;
}
