import { homeHeadline, type HomeSignal } from "@/domain/home/signals";

/**
 * The Morning Brief — the mockups' opening move, in Joy's voice.
 *
 * The approved dashboard mock (docs/mockups/11-brief-band.png) leads with two
 * or three plain sentences: "Two assessments and one field orientation today.
 * Payroll is due Monday. One open shift needs coverage." Not a panel of
 * numbers — a colleague telling you about your day.
 *
 * Every sentence is computed from the same signals the modules own, so the
 * brief can never say something a screen would contradict. And it only says
 * what is true today: a quiet day produces a short brief, not padding.
 */
export function morningBrief(input: {
  visitsToday: number;
  unassignedToday: number;
  signals: readonly HomeSignal[];
  /** The next Saturday run's week, e.g. "2026-08-29". */
  upcomingBillingWeek: string;
  today: string;
}): string {
  const sentences: string[] = [];

  // Today's shape first — the mock's own opening.
  if (input.visitsToday === 0) {
    sentences.push("No visits on the schedule today.");
  } else {
    const visits = `${input.visitsToday} ${input.visitsToday === 1 ? "visit" : "visits"} today`;
    sentences.push(
      input.unassignedToday > 0
        ? `${visits} — ${input.unassignedToday} still ${input.unassignedToday === 1 ? "needs" : "need"} a caregiver.`
        : `${visits}, all covered.`,
    );
  }

  // What needs you, in the headline's words. "Nothing needs you this morning."
  // is a sentence worth saying; the capitalised form reads as its own line.
  const headline = homeHeadline([...input.signals]);
  sentences.push(headline.charAt(0).toUpperCase() + headline.slice(1));

  // The money rhythm, only when the run is near: drafted Saturday, approved
  // Sat–Mon. Two days out is when it belongs in a morning brief.
  const daysToRun = Math.round(
    (Date.parse(`${input.upcomingBillingWeek.slice(0, 10)}T12:00:00`) -
      7 * 86_400_000 -
      Date.parse(`${input.today.slice(0, 10)}T12:00:00`)) /
      86_400_000,
  );
  if (daysToRun === 0) {
    sentences.push("The Saturday billing run drafts today.");
  } else if (daysToRun === 1 || daysToRun === 2) {
    sentences.push(`The Saturday billing run drafts in ${daysToRun === 1 ? "one day" : "two days"}.`);
  }

  return sentences.join(" ");
}
