import { anticipatedStart, daysWaiting, startOfCareAtRisk } from "@/domain/admissions/queue";
import type { AdmissionStage } from "@/domain/admissions/stages";
import type { Monitor, RawFinding } from "./types";

/**
 * Admission Watch: which admissions have stopped moving, and which start
 * dates the agency is about to miss.
 */
export const STALLED_AFTER_DAYS = 5;

const STAGE_WORDS: Partial<Record<AdmissionStage, string>> = {
  new_referral: "a new referral nobody has called back",
  phone_intake: "the phone intake",
  assessment: "the assessment",
  pre_onboarding: "pre-onboarding",
  ready_for_admission: "ready for admission",
};

const FINISHED: readonly AdmissionStage[] = ["admitted", "closed"];
const NEEDS_A_CAREGIVER: readonly AdmissionStage[] = ["pre_onboarding", "ready_for_admission"];

function relativeDay(date: string, today: string): string {
  if (date === today) return "today";
  const days = Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000);
  if (days < 0) {
    const ago = Math.abs(days);
    return ago === 1 ? "yesterday" : `${ago} days ago`;
  }
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export const admissionWatch: Monitor = {
  id: "admissions",
  name: "Admission Watch",
  question: "Which admissions have stopped moving, and which start dates will we miss?",
  cadence: "daily",
  run({ admissions, visits, today, now }) {
    const out: RawFinding[] = [];
    for (const a of admissions) {
      if (FINISHED.includes(a.stage) || (a.status && a.status !== "active")) continue;
      const to = `/admissions?id=${a.id}`;
      const subject = { kind: "admission" as const, id: a.id, name: a.name };
      const startsOn = anticipatedStart(a.answers);

      if (startsOn && startOfCareAtRisk(startsOn, a.stage, today)) {
        const passed = startsOn < today;
        out.push({
          key: `admissions:${a.id}:start-at-risk`,
          subject,
          severity: "blocking",
          headline: passed
            ? `${a.name} wanted care to start ${relativeDay(startsOn, today)} and is not ready`
            : `${a.name} wants care to start ${relativeDay(startsOn, today)} and is not ready`,
          because: passed
            ? "The date they asked for has passed and the admission has not reached pre-onboarding. Nobody has told them."
            : 'They gave a date rather than "as soon as possible", so this is a commitment rather than a hope.',
          next: { label: "Open the admission", to },
        });
      }

      const scheduled = visits.some((v) => v.clientName.trim().toLowerCase() === a.name.trim().toLowerCase() && v.caregiverName);
      if (NEEDS_A_CAREGIVER.includes(a.stage) && !scheduled) {
        const soon = !!startsOn && startOfCareAtRisk(startsOn, "pre_onboarding", today);
        out.push({
          key: `admissions:${a.id}:no-caregiver`,
          subject,
          severity: soon ? "blocking" : "due_soon",
          headline: startsOn ? `Nobody is scheduled for ${a.name}, who starts ${relativeDay(startsOn, today)}` : `Nobody is scheduled for ${a.name}`,
          because: "The readiness gates cover paperwork only — none of them asks who turns up on day one. There is no visit on the board with a caregiver on it.",
          next: { label: "Open scheduling", to: "/scheduling" },
        });
      }

      const waiting = daysWaiting(a, now);
      if (waiting !== null && waiting >= STALLED_AFTER_DAYS) {
        out.push({
          key: `admissions:${a.id}:stalled`,
          subject,
          severity: a.overdue ? "blocking" : "due_soon",
          headline: `${a.name} has been waiting on us ${waiting} days`,
          because: `Nothing has been recorded against this record while it sat at ${STAGE_WORDS[a.stage] ?? a.stage}. A family that hears nothing assumes the answer is no.`,
          next: { label: "Open the admission", to },
        });
      }
    }
    return out;
  },
};
