import { INTAKE_QUESTIONS, type IntakeAnswers } from "@/domain/admissions/intake";
import {
  ASSESSMENT_QUESTIONS,
  VITAL_DEFAULTS,
  type AssessmentAnswers,
} from "@/domain/assessment/questions";
import { seedAdmissions } from "@/lib/admissionsSeed";
import { CONSENTS } from "@/domain/consents/registry";

/**
 * The intake and assessment records each seeded admission's stage implies.
 *
 * WHY THIS EXISTS. The admissions board said "Pre-Onboarding · assessment
 * completed Aug 12" and the review screen for the same record said "0 of 25
 * decided" and "the in-person assessment has not been completed yet". Both were
 * reading real code; they were reading different stores. The stage lived in
 * `admissionsSeed` and the work lived in the demo store, which starts empty, so
 * every seeded admission looked untouched the moment you opened it.
 *
 * That is the same class of defect as Home's hardcoded priority numbers and the
 * family portal's hardcoded care-plan string: one fact in two places, and the
 * screen a person actually opens is the one that is wrong.
 *
 * Rather than hand-write answers, this walks the real question lists and fills
 * what they say is required. Two consequences worth having: the demo cannot
 * drift out of step when a question is added, and nothing here asserts a
 * clinical fact that the question model did not ask for.
 *
 * EVERY CLIENT IS FICTIONAL, as everywhere in this repository, and the answers
 * are deliberately bland. A demo seed is not the place for somebody's real
 * diagnosis.
 */

/** Stages that mean the phone intake happened. */
const INTAKE_DONE = new Set(["assessment", "pre_onboarding", "ready_for_admission", "admitted"]);

/** Stages that mean the RN has been out and the assessment is finished. */
const ASSESSMENT_DONE = new Set(["pre_onboarding", "ready_for_admission", "admitted"]);

/**
 * A plausible answer of the right shape.
 *
 * `choice` and `multichoice` take the question's own first option rather than
 * anything invented — if the option list changes, so does this, and nothing
 * here can name a service or a diagnosis the question model does not offer.
 */
function fill(
  question: { id: string; kind: string; options?: Array<{ value: string }> },
  name: string,
  phone: string,
): unknown {
  switch (question.kind) {
    case "choice":
      return question.options?.[0]?.value ?? "";
    case "multichoice":
      return question.options?.slice(0, 2).map((o) => o.value) ?? [];
    case "number":
      return 20;
    case "yes_no_copy":
      return { answer: "no" };
    case "thresholds":
      return Object.fromEntries(VITAL_DEFAULTS.map((v) => [v.key, v.value]));
    case "confirm":
      return "Confirmed";
    case "longtext":
      return "Recorded during the call.";
    default:
      if (question.id.includes("phone")) return phone;
      if (question.id.includes("name")) return name;
      // Relationship labels are capitalized (business rule #6), and this one
      // feeds the e-signature ceremony's signer chip — a real word, not filler.
      if (question.id.includes("relationship")) return "Daughter";
      return "Recorded";
  }
}

function intakeFor(name: string, phone: string): IntakeAnswers {
  const answers: IntakeAnswers = {};
  for (const q of INTAKE_QUESTIONS) {
    if (q.showIf && !q.showIf(answers)) continue;
    if (!q.required) continue;
    answers[q.id] = fill(q, name, phone);
  }
  // The two §19 needs by name, so the portal invitation has somebody to go to.
  answers.caller_name = name;
  answers.caller_phone = phone;
  return answers;
}

function assessmentFor(name: string, phone: string): AssessmentAnswers {
  const answers: AssessmentAnswers = {};
  // Two passes, because `showIf` reads answers already given — a question
  // revealed by an earlier answer would be missed by a single pass, and
  // `canCompleteAssessment` would then refuse a record this file claims is done.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const q of ASSESSMENT_QUESTIONS) {
      if (q.showIf && !q.showIf(answers)) continue;
      if (!q.required || answers[q.id] !== undefined) continue;
      answers[q.id] = fill(q, name, phone);
    }
  }
  return answers;
}

/**
 * The responsible party for each seeded admission.
 *
 * Fictional, and deliberately a different person from the client: §19's link
 * goes to whoever Joy has been speaking to, which is usually a daughter or a
 * son rather than the person receiving care.
 */
const RESPONSIBLE_PARTY: Record<string, { name: string; phone: string }> = {
  "adm-susan-m": { name: "Diane Miller", phone: "(713) 555-0143" },
  "adm-robert": { name: "Anthony Green", phone: "(281) 555-0177" },
  "adm-evelyn": { name: "Priya Carter", phone: "(832) 555-0164" },
  "adm-marcus": { name: "Yvonne Bell", phone: "(713) 555-0129" },
  "adm-harold": { name: "Linh Nguyen", phone: "(713) 555-0198" },
};

/**
 * A signed packet for the admissions that have reached "ready for admission".
 *
 * Same reasoning as the assessment: Robert Green's board card says "ready for
 * admission — start of care targeted for Monday" and his review screen said
 * "packet not signed, 0 of 25 decided". A record cannot be both.
 *
 * The two pre-onboarding admissions are deliberately left unsigned. Susan's
 * headline is "agreement ready for your review" and Evelyn's is "waiting on
 * family signature" — an unsigned packet is exactly what those say, and seeding
 * a signature over them would erase the one state the signing flow exists for.
 *
 * The witness is Karynn, an RN and the owner, because `witnessRule` allows
 * nobody else to take a signature.
 */
const SIGNED_STAGES = new Set(["ready_for_admission", "admitted"]);

export interface SeededConsentSession {
  admissionId: string;
  decisions: Record<string, "agree" | "decline" | "not_applicable" | undefined>;
  signerName: string | null;
  witnessName?: string | null;
  witnessRole?: "ceo_admin" | "rn_clinical" | null;
  signerRelationship: string | null;
  /** The e-signature ceremony's own record — consent, adoption, method. */
  esignConsentAt?: string | null;
  signatureAdoptedAt?: string | null;
  signatureMethod?: "esign_adopted" | null;
  signedAt: string | null;
}

export interface SeededIntake {
  admissionId: string;
  answers: IntakeAnswers;
  visited: string[];
  completedAt: string | null;
  startedAt: string;
}

export interface SeededAssessment {
  admissionId: string;
  answers: AssessmentAnswers;
  visited: string[];
  completedAt: string | null;
  startedAt: string;
}

const AT = "2026-08-12T14:00:00.000Z";

export const seedConsentSessions: Record<string, SeededConsentSession> = Object.fromEntries(
  seedAdmissions
    .filter((a) => SIGNED_STAGES.has(a.stage))
    .map((a) => {
      const rp = RESPONSIBLE_PARTY[a.id] ?? { name: a.name, phone: "(713) 555-0100" };
      return [
        a.id,
        {
          admissionId: a.id,
          // Agreed to everything except transport, so the client record has a
          // real restriction to carry to the caregiver rather than a clean
          // sheet that demonstrates nothing.
          decisions: Object.fromEntries(
            CONSENTS.map((c) => [
              c.key,
              c.key === "transportation" ? ("decline" as const) : ("agree" as const),
            ]),
          ),
          signerName: rp.name,
          signerRelationship: "Responsible party",
          witnessName: "Karynn Verrett",
          witnessRole: "ceo_admin" as const,
          // Signed through the e-signature ceremony: agreed to sign
          // electronically, adopted the generated marks, then one application.
          esignConsentAt: AT,
          signatureAdoptedAt: AT,
          signatureMethod: "esign_adopted" as const,
          signedAt: AT,
        },
      ];
    }),
);

export const seedIntakes: Record<string, SeededIntake> = Object.fromEntries(
  seedAdmissions
    .filter((a) => INTAKE_DONE.has(a.stage))
    .map((a) => {
      const rp = RESPONSIBLE_PARTY[a.id] ?? { name: a.name, phone: "(713) 555-0100" };
      return [
        a.id,
        {
          admissionId: a.id,
          answers: intakeFor(rp.name, rp.phone),
          visited: INTAKE_QUESTIONS.map((q) => q.id),
          completedAt: AT,
          startedAt: AT,
        },
      ];
    }),
);

export const seedAssessments: Record<string, SeededAssessment> = Object.fromEntries(
  seedAdmissions
    .filter((a) => ASSESSMENT_DONE.has(a.stage))
    .map((a) => {
      const rp = RESPONSIBLE_PARTY[a.id] ?? { name: a.name, phone: "(713) 555-0100" };
      return [
        a.id,
        {
          admissionId: a.id,
          answers: assessmentFor(rp.name, rp.phone),
          visited: ASSESSMENT_QUESTIONS.map((q) => q.id),
          completedAt: AT,
          startedAt: AT,
        },
      ];
    }),
);
