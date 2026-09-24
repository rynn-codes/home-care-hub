import type { InvoiceBalance } from "@/domain/billing/receivables";

/**
 * Long-term care insurance reimbursement packets.
 *
 * Joy is private pay. A client with a long-term care policy pays Joy first,
 * then claims it back from the carrier — Karynn, 21 August: "We allow long
 * term care insurance, but only for them to reimburse the client once they
 * have paid us." So Joy never bills a carrier. What Joy does is assemble the
 * packet the carrier wants on the client's behalf: a cover letter, the PAID
 * invoice, and the care notes for the same dates.
 *
 * Two rules shape everything here. A packet follows a PAID invoice, never an
 * unpaid one — there is nothing to reimburse until the client has paid. And
 * a packet is the client's health record leaving the agency, so it does not
 * go without their signed release.
 */

export interface LtciEnrollment {
  clientPersonId: string;
  clientName: string;
  /** The insurer's name as it appears on the policy. */
  carrier: string | null;
  /** Whatever the carrier uses to identify the claim. */
  policyReference: string | null;
  claimsFax: string | null;
  claimsEmail: string | null;
  /** The client's written permission for Joy to send their care record out. */
  releaseOnFile: boolean;
  releaseExpiresOn: string | null;
}

export type PacketState = "ready" | "incomplete" | "needs_release" | "blocked" | "sent";

export const PACKET_STATE_LABELS: Record<PacketState, string> = {
  ready: "Ready to send",
  incomplete: "Missing carrier details",
  needs_release: "Needs signed release",
  blocked: "Waiting on payment",
  sent: "Sent",
};

/**
 * Packets run two weeks behind the billing week: the invoice for a care
 * week goes out the Monday before it, is due before it starts, and a packet
 * can only follow the paid invoice for care that has been delivered.
 */
export const PACKET_WEEKS_BACK = 2;

export function packetPeriod(weekStart: string, weeksBack = 1): { start: string; end: string } {
  const start = new Date(`${weekStart}T12:00:00`);
  start.setDate(start.getDate() - weeksBack * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export interface PacketVisit {
  date: string;
  hours: number;
  noteFiled: boolean;
}

export interface PacketSent {
  on: string;
  by: string;
  to: string[];
}

export interface LtciPacket {
  clientPersonId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  state: PacketState;
  carrier: string | null;
  policyReference: string | null;
  invoiceNumber: string | null;
  invoiceTotal: number | null;
  paidOn: string | null;
  visits: PacketVisit[];
  /** Everything standing between this packet and the fax machine, in plain words. */
  blockers: string[];
  sentOn: string | null;
  sentBy: string | null;
  sentTo: string[];
}

// ------------------------------------------------------------- the release --

export const RELEASE_VALID_MONTHS = 12;

export interface ReleaseCheck {
  onFile: boolean;
  source: "recorded" | "expired" | "declined" | "none" | "admission";
  signedOn: string | null;
  expiresOn: string | null;
  note: string;
}

function longDay(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The same calendar day N months on, clamped to the month's last day. */
export function addMonths(iso: string, months: number): string | null {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/**
 * Whether Joy holds permission to send this client's record to a carrier.
 *
 * The office may record a release by hand (a carrier's own form). Otherwise
 * it comes from the signing packet at admission — the Authorization to
 * Obtain & Release Records — which is good for a year, and which the client
 * may have declined.
 */
export function releaseFromAdmission(input: {
  recorded?: { onFile: boolean; expiresOn: string | null } | null;
  signedAt: string | null;
  decisions?: Readonly<Record<string, string | undefined>>;
  today: string;
}): ReleaseCheck {
  const today = input.today.slice(0, 10);
  if (input.recorded) {
    const expired = input.recorded.expiresOn !== null && input.recorded.expiresOn < today;
    if (input.recorded.onFile && !expired) {
      return {
        onFile: true,
        source: "recorded",
        signedOn: null,
        expiresOn: input.recorded.expiresOn,
        note: input.recorded.expiresOn ? `Release recorded by the office, valid to ${longDay(input.recorded.expiresOn)}.` : "Release recorded by the office, with no expiry.",
      };
    }
    if (input.recorded.onFile && expired) {
      return {
        onFile: false,
        source: "expired",
        signedOn: null,
        expiresOn: input.recorded.expiresOn,
        note: `The recorded release expired on ${longDay(input.recorded.expiresOn!)} and needs re-signing.`,
      };
    }
    return { onFile: false, source: "recorded", signedOn: null, expiresOn: null, note: "The office has recorded that there is no release on file for this carrier." };
  }
  if (input.decisions?.obtain_release_medical_records === "decline") {
    return { onFile: false, source: "declined", signedOn: null, expiresOn: null, note: "They declined the records release at admission. A packet cannot go without asking them again." };
  }
  const signedOn = input.signedAt ? input.signedAt.slice(0, 10) : null;
  if (!signedOn) {
    return { onFile: false, source: "none", signedOn: null, expiresOn: null, note: "No signing packet on file, so there is nothing authorising a disclosure." };
  }
  const expiresOn = addMonths(signedOn, RELEASE_VALID_MONTHS);
  if (expiresOn && expiresOn < today) {
    return {
      onFile: false,
      source: "expired",
      signedOn,
      expiresOn,
      note: `The authorization signed on ${longDay(signedOn)} expired on ${longDay(expiresOn)}. It needs re-signing before a packet can go.`,
    };
  }
  return {
    onFile: true,
    source: "admission",
    signedOn,
    expiresOn,
    note: `From the signing packet — Authorization to Obtain & Release Records, signed ${longDay(signedOn)}, valid to ${longDay(expiresOn ?? signedOn)}.`,
  };
}

// --------------------------------------------------------------- building --

/** What the carrier details are missing. */
export function enrollmentGaps(e: LtciEnrollment): string[] {
  const gaps: string[] = [];
  if (!e.carrier) gaps.push("No carrier recorded on the client's billing record.");
  if (!e.policyReference) gaps.push("No policy or claim number recorded.");
  if (!e.claimsFax && !e.claimsEmail) gaps.push("No claims fax or email recorded for the carrier.");
  return gaps;
}

/** The carrier gaps, then the release. */
export function packetGaps(e: LtciEnrollment): string[] {
  const gaps = [...enrollmentGaps(e)];
  if (!e.releaseOnFile) {
    gaps.push("No signed release on file. It comes from the signing packet at admission, or can be recorded in the carrier details.");
  }
  return gaps;
}

export function releaseExpired(e: LtciEnrollment, asOf: string): boolean {
  if (!e.releaseOnFile || !e.releaseExpiresOn) return false;
  return asOf.slice(0, 10) > e.releaseExpiresOn;
}

function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysCovered(invoice: { weekStart: string; weekEnd: string }, start: string, end: string): number {
  const from = invoice.weekStart > start ? invoice.weekStart : start;
  const to = invoice.weekEnd < end ? invoice.weekEnd : end;
  if (from > to) return 0;
  const ms = new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime();
  return Math.round(ms / 864e5) + 1;
}

function settled(b: InvoiceBalance): boolean {
  return b.state === "paid" || b.state === "overpaid";
}

/**
 * One client's packet for one service period: the invoice that covers it,
 * the notes for it, and everything still in the way.
 */
export function buildPacket(input: {
  enrollment: LtciEnrollment;
  periodStart: string;
  periodEnd: string;
  balances: readonly InvoiceBalance[];
  visits: readonly PacketVisit[];
  asOf: string;
  sent: PacketSent | null;
}): LtciPacket {
  const { enrollment, periodStart, periodEnd } = input;
  const invoice = input.balances
    .filter((b) => b.invoice.clientPersonId === enrollment.clientPersonId && b.invoice.weekStart <= periodEnd && b.invoice.weekEnd >= periodStart)
    .slice()
    .sort((a, b) => {
      const byCover = daysCovered(b.invoice, periodStart, periodEnd) - daysCovered(a.invoice, periodStart, periodEnd);
      return byCover !== 0 ? byCover : Number(settled(b)) - Number(settled(a));
    })[0];

  const payment: string[] = [];
  if (!invoice) {
    payment.push(`No invoice was issued for ${longDay(periodStart)} – ${longDay(periodEnd)}, so there is nothing to seek reimbursement for.`);
  } else if (invoice.state === "written_off") {
    payment.push("This week's invoice was written off, so the client paid nothing to be reimbursed for.");
  } else if (!settled(invoice)) {
    payment.push(`The $${invoice.invoice.total.toFixed(2)} invoice for this week is ${invoice.state === "overdue" ? "overdue" : "unpaid"}. A packet can only follow a paid invoice.`);
  }

  const carrier = enrollmentGaps(enrollment);
  const release = packetGaps(enrollment).slice(carrier.length);
  if (releaseExpired(enrollment, input.asOf)) {
    release.push(`The client's release expired on ${longDay(enrollment.releaseExpiresOn!)} and needs signing again.`);
  }

  const notes: string[] = [];
  if (input.visits.length === 0) notes.push("No delivered visits are recorded for this week.");

  const blockers = [...payment, ...carrier, ...release, ...notes];
  const state: PacketState = input.sent
    ? "sent"
    : payment.length > 0
      ? "blocked"
      : carrier.length > 0
        ? "incomplete"
        : release.length > 0
          ? "needs_release"
          : notes.length > 0
            ? "blocked"
            : "ready";

  return {
    clientPersonId: enrollment.clientPersonId,
    clientName: enrollment.clientName,
    periodStart,
    periodEnd,
    state,
    carrier: enrollment.carrier,
    policyReference: enrollment.policyReference,
    invoiceNumber: invoice?.invoice.invoiceNumber ?? null,
    invoiceTotal: invoice?.invoice.total ?? null,
    paidOn: invoice && settled(invoice) ? (invoice.lastPaymentOn ?? null) : null,
    visits: [...input.visits],
    blockers,
    sentOn: input.sent?.on ?? null,
    sentBy: input.sent?.by ?? null,
    sentTo: input.sent?.to ?? [],
  };
}

export interface PacketPage {
  page: number;
  label: string;
  detail: string;
}

/** The pages, in the order the carrier receives them. */
export function packetPages(p: LtciPacket): PacketPage[] {
  const pages: PacketPage[] = [
    { page: 1, label: "Cover fax letter", detail: "Generated from payer setup" },
    {
      page: 2,
      label: `Paid invoice — ${shortDay(p.periodStart)} – ${shortDay(p.periodEnd)}`,
      detail: p.invoiceTotal !== null ? `$${p.invoiceTotal.toFixed(2)}${p.paidOn ? ` · Paid ${shortDay(p.paidOn)}` : ""}` : "Not available",
    },
  ];
  p.visits.forEach((v, i) => {
    pages.push({ page: 3 + i, label: `Care notes — ${shortDay(v.date)}`, detail: v.noteFiled ? "Finalized" : "Not filed" });
  });
  return pages;
}

export function pageCount(p: LtciPacket): number {
  return packetPages(p).length;
}

export interface PacketExclusions {
  noteDates: string[];
  invoice: boolean;
}

export const NO_EXCLUSIONS: PacketExclusions = { noteDates: [], invoice: false };

/** The packet with pages left out, and what leaving them out costs it. */
export function applyExclusions(p: LtciPacket, x: PacketExclusions): LtciPacket {
  const visits = p.visits.filter((v) => !x.noteDates.includes(v.date));
  const blockers = [...p.blockers];
  if (x.invoice) blockers.push("The paid invoice was left out. The carrier reimburses against it, so the packet cannot go without it.");
  if (visits.length === 0 && p.visits.length > 0) blockers.push("Every care note was left out. A packet with no care notes has nothing to show the carrier.");
  return {
    ...p,
    visits,
    invoiceNumber: x.invoice ? null : p.invoiceNumber,
    invoiceTotal: x.invoice ? null : p.invoiceTotal,
    paidOn: x.invoice ? null : p.paidOn,
    blockers,
    state: blockers.length > 0 && p.state === "ready" ? "blocked" : p.state,
  };
}

export interface PacketCheck {
  key: string;
  ok: boolean;
  label: string;
  detail: string;
}

/** What Joy verified before offering the packet for approval. */
export function packetChecks(p: LtciPacket, e: LtciEnrollment): PacketCheck[] {
  const filed = p.visits.filter((v) => v.noteFiled).length;
  const period = `${shortDay(p.periodStart)} – ${shortDay(p.periodEnd)}`;
  return [
    { key: "invoice", ok: p.paidOn !== null, label: "Paid invoice matched", detail: p.paidOn ? `Paid ${shortDay(p.paidOn)} · ${period}` : "No paid invoice found for this service period." },
    {
      key: "notes",
      ok: p.visits.length > 0 && filed === p.visits.length,
      label: "Care notes matched to service period",
      detail: p.visits.length === 0 ? "No delivered visits are recorded for this week." : `${filed} finalized ${filed === 1 ? "note" : "notes"}${filed < p.visits.length ? ` · ${p.visits.length - filed} still open` : ""}`,
    },
    {
      key: "dates",
      ok: p.visits.length > 0 && p.visits.every((v) => v.date >= p.periodStart && v.date <= p.periodEnd),
      label: "Invoice and care notes cover the same dates",
      detail: p.visits.length === 0 ? "Nothing to compare yet." : `All within ${period}`,
    },
    { key: "cover", ok: !!e.carrier && !!e.policyReference, label: "Cover fax letter prepared", detail: e.carrier && e.policyReference ? `${e.carrier} · ${e.policyReference}` : "Needs the carrier and the policy number." },
    { key: "fax", ok: !!e.claimsFax, label: "Fax destination verified", detail: e.claimsFax ?? "No claims fax recorded." },
    { key: "email", ok: !!e.claimsEmail, label: "Email destination verified", detail: e.claimsEmail ?? "No claims email recorded." },
    {
      key: "release",
      ok: e.releaseOnFile && !releaseExpired(e, p.periodEnd),
      label: "Client's release on file",
      detail: e.releaseOnFile ? (releaseExpired(e, p.periodEnd) ? `Expired ${longDay(e.releaseExpiresOn!)}.` : "Permission to send their care record to the carrier.") : "The client has not signed one.",
    },
  ];
}

/** "Fax (800) 555-0147", "ltcclaims@…" — where the packet goes. */
export function destinations(e: LtciEnrollment): string[] {
  const to: string[] = [];
  if (e.claimsFax) to.push(`Fax ${e.claimsFax}`);
  if (e.claimsEmail) to.push(e.claimsEmail);
  return to;
}

/** Throws rather than sending a packet that is not ready or has already gone. */
export function assertSendable(p: LtciPacket): void {
  if (p.state === "sent") throw new Error(`${p.clientName}'s packet for ${p.periodStart} has already been sent.`);
  if (p.state !== "ready") throw new Error(`Refusing to send ${p.clientName}'s packet: ${p.blockers[0] ?? "it is not ready."}`);
}
