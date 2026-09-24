import type { PacketState } from "@/domain/billing/ltci";

/**
 * The words the Invoices list uses for where an invoice is, and the order the
 * list falls into under "All": the work first, the settled last.
 */
export type RowStatus =
  | "Needs review"
  | "Ready"
  | "Sent"
  | "Past due"
  | "Adjusted"
  | "Paid"
  | "Refunded"
  | "Void";

/** The status menu, in two groups: the everyday ones, then the rest. */
export const PRIMARY_STATUS_FILTERS: ReadonlyArray<RowStatus | "All"> = ["All", "Needs review", "Ready", "Sent", "Paid"];
export const MORE_STATUS_FILTERS: ReadonlyArray<RowStatus> = ["Past due", "Adjusted", "Refunded", "Void"];

export const STATUS_ORDER: ReadonlyArray<RowStatus> = ["Needs review", "Ready", "Sent", "Past due", "Adjusted", "Paid", "Refunded", "Void"];

/** Amber = a person owes a decision; blue = information; rose = wrong; green = done. */
export const STATUS_PILL: Record<RowStatus, string> = {
  "Needs review": "bg-[#FFFAEB] text-[#B54708]",
  Ready: "bg-[#EEF0FE] text-primary",
  Sent: "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
  "Past due": "bg-[#FEF3F2] text-[#B42318]",
  Paid: "bg-[#ECFDF3] text-[#027A48]",
  Adjusted: "bg-[#ECFDF7] text-[#0B7268]",
  Refunded: "bg-[#F5F9FF] text-[#2B4A7E]",
  Void: "bg-[var(--hairline-soft)] text-muted-foreground",
};

export const PACKET_PILL: Record<PacketState, string> = {
  ready: "bg-[#EEF0FE] text-primary",
  sent: "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
  incomplete: "bg-[#FFFAEB] text-[#B54708]",
  needs_release: "bg-[#FFFAEB] text-[#B54708]",
  blocked: "bg-[#FFFAEB] text-[#B54708]",
};

/** "Sep 26" from an ISO date. */
export function shortDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "Sep 26 – Oct 2" from "2026-09-26 – 2026-10-02"; a lone date or a label passes through. */
export function periodLabel(period: string): string {
  const parts = period.split(" – ");
  if (parts.length === 1) return shortDay(period);
  if (parts.length !== 2) return period;
  return `${shortDay(parts[0])} – ${shortDay(parts[1])}`;
}

/** "Sun, Sep 27". */
export function weekdayDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export const initialsOf = (name: string) =>
  name
    .split(/[ ,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
