import { agreementState, describeSchedule, weeklyHours } from "@/domain/scheduling/clientSchedule";
import type { Monitor, RawFinding } from "./types";

/**
 * Agreement Watch: is anybody on a schedule they have not signed for?
 *
 * Care carries on and the schedule is not held up — the signed agreement
 * stands. What Joy wants is the amendment reviewed and sent.
 */
export const agreementWatch: Monitor = {
  id: "agreement",
  name: "Agreement Watch",
  question: "Is anybody on a schedule they have not signed for?",
  cadence: "daily",
  run({ clientSchedules, now }) {
    const clients = [...new Set(clientSchedules.map((s) => s.clientPersonId))];
    const out: RawFinding[] = [];
    for (const clientPersonId of clients) {
      const state = agreementState({ schedules: clientSchedules, clientPersonId, now });
      if (state.state !== "needs_agreement" || !state.current) continue;
      const current = state.current;
      const agreedHours = state.lastAgreed ? weeklyHours(state.lastAgreed) : null;
      const hours = weeklyHours(current);
      out.push({
        key: `agreement:${current.id}`,
        subject: { kind: "client", id: clientPersonId, name: current.clientName },
        severity: "due_soon",
        headline: `${current.clientName} is on a schedule they have not signed for`,
        because:
          `${describeSchedule(current)} — running ${state.daysInForce} days, since ${current.startsOn}.` +
          (agreedHours === null
            ? " No signed schedule is on file to compare it with."
            : ` The agreement on file says ${agreedHours} hours a week; they are getting ${hours}.`) +
          " Care carries on and the schedule is not held up — the signed agreement stands. Joy has the amendment drafted and ready to review.",
        next: { label: "Review the draft", to: `/clients/${clientPersonId}?tab=Schedule` },
      });
    }
    return out;
  },
};
