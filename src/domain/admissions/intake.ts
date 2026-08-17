/**
 * Manual phone intake — the question model.
 *
 * Sources: §11 (the `phone_intakes` columns), §12B (the manual section
 * sequence), and `docs/specs/Joy_Health_Phone_Intake_Claude_Design_Master_Spec.md`
 * for wording and behaviour.
 *
 * §34 requires manual mode FIRST, because it defines the authoritative
 * structured workflow that AI later populates, and guarantees intake still works
 * when OpenAI is unavailable. This module is that structure.
 *
 * PROVISIONAL FIELD LIST. §11 calls the approved two-page Client Intake Form the
 * data basis for this table, and that form is not yet in the repository. Every
 * field below traces to the kickoff brief or the Phone Intake spec, so additions
 * from the paper form should be additive rather than a reshape — but treat the
 * list as unconfirmed until it is reconciled.
 */

export type IntakeQuestionKind =
  | "text"
  | "longtext"
  | "choice"
  | "multichoice"
  | "weekdays"
  | "date"
  | "number";

export interface IntakeQuestion {
  id: string;
  section: string;
  /** Asked out loud, so it reads like a person talking, not a form label. */
  question: string;
  helper?: string;
  kind: IntakeQuestionKind;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  /** Prefilled from the referral, so nothing is asked twice. */
  prefillFrom?: "clientName" | "contactName" | "contactRelationship" | "referralSource" | "service";
}

/** §11 — the ten approved care-need values, plus the medication decision. */
export const CARE_NEEDS = [
  { value: "bathing", label: "Bathing" },
  { value: "dressing", label: "Dressing" },
  { value: "feeding", label: "Feeding" },
  { value: "toileting", label: "Toileting" },
  { value: "mobility", label: "Mobility" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "transportation", label: "Transportation" },
  { value: "shopping_errands", label: "Shopping & errands" },
  { value: "companionship", label: "Companionship" },
  // Added deliberately, ruled 15 Aug. Reminders are a companion-level task a
  // caller will mention on the phone; administration is a licensure question
  // that belongs with the RN. The name keeps that line visible.
  { value: "medication_reminders", label: "Medication reminders" },
  { value: "other", label: "Something else" },
] as const;

export const LIVING_SITUATIONS = [
  { value: "alone", label: "Lives alone" },
  { value: "with_spouse", label: "With a spouse or partner" },
  { value: "with_family", label: "With family" },
  { value: "assisted_living", label: "Assisted living" },
  { value: "skilled_nursing", label: "Skilled nursing facility" },
  { value: "hospital", label: "Currently in hospital" },
  { value: "other", label: "Other" },
] as const;

export const TIME_PREFERENCES = [
  { value: "mornings", label: "Mornings" },
  { value: "afternoons", label: "Afternoons" },
  { value: "evenings", label: "Evenings" },
  { value: "overnight", label: "Overnight" },
  { value: "live_in", label: "Live-in" },
  { value: "flexible", label: "Flexible" },
] as const;

export const PAYMENT_SOURCES = [
  { value: "self_pay", label: "Self pay" },
  { value: "self_pay_ltc_insurance", label: "Self pay + LTC insurance" },
  { value: "not_sure_yet", label: "Not sure yet" },
  { value: "other", label: "Other" },
] as const;

/**
 * The manual sequence from §12B: Caller, Client, Clinical Snapshot, Care Needs,
 * What Matters Most, Requested Schedule, Payment Source — then Review.
 *
 * The client's full address is deliberately absent. §11's source-form rule moves
 * it to assessment scheduling rather than forcing it at the start of a call.
 */
export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "caller_name",
    section: "Caller",
    question: "Who am I speaking with?",
    helper: "We already have this from the referral — confirm or correct it.",
    kind: "text",
    required: true,
    prefillFrom: "contactName",
  },
  {
    id: "caller_relationship",
    section: "Caller",
    question: "And how are they related to the client?",
    kind: "text",
    required: true,
    prefillFrom: "contactRelationship",
  },
  {
    id: "living_situation",
    section: "Client",
    question: "What's their living situation right now?",
    kind: "choice",
    options: [...LIVING_SITUATIONS],
    required: true,
  },
  {
    id: "primary_reason_care_needed",
    section: "Clinical snapshot",
    question: "What's happening that made the family look for care?",
    helper: "In their words. This carries into the RN assessment.",
    kind: "longtext",
    required: true,
  },
  {
    id: "primary_diagnosis_reported",
    section: "Clinical snapshot",
    question: "Did they mention a diagnosis?",
    helper: "As reported on the call. The RN confirms it at the assessment.",
    kind: "text",
  },
  {
    id: "mobility_equipment",
    section: "Clinical snapshot",
    question: "Anything about mobility or equipment the RN should know first?",
    helper: "Walker, wheelchair, oxygen, recent falls.",
    kind: "longtext",
  },
  {
    id: "care_needs",
    section: "Care needs",
    question: "What does the client need help with?",
    kind: "multichoice",
    options: [...CARE_NEEDS],
    required: true,
  },
  {
    id: "what_matters_most",
    section: "What matters most",
    question: "What matters most to them in choosing an agency?",
    helper: "This is what the caregiver match should honour.",
    kind: "longtext",
    required: true,
  },
  {
    id: "requested_days",
    section: "Requested schedule",
    question: "Which days are they looking for care?",
    kind: "weekdays",
    required: true,
  },
  {
    id: "time_preference",
    section: "Requested schedule",
    question: "What time of day?",
    kind: "choice",
    options: [...TIME_PREFERENCES],
  },
  {
    id: "hours_per_week",
    section: "Requested schedule",
    question: "Roughly how many hours a week?",
    helper: "An estimate is fine — the assessment firms it up.",
    kind: "number",
  },
  {
    id: "anticipated_start_date",
    section: "Requested schedule",
    question: "When would they like care to begin?",
    kind: "date",
  },
  {
    id: "payment_source",
    section: "Payment",
    question: "How do they expect to pay for care?",
    kind: "choice",
    options: [...PAYMENT_SOURCES],
    required: true,
  },
  {
    id: "additional_notes",
    section: "Notes",
    question: "Anything else the team should know before the RN visit?",
    kind: "longtext",
  },
];

export const INTAKE_SECTIONS = [...new Set(INTAKE_QUESTIONS.map((q) => q.section))];

export type IntakeAnswers = Record<string, unknown>;

function isAnswered(question: IntakeQuestion, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

/**
 * Required questions still unanswered.
 *
 * Drives the review screen's "needs review" list. §13 is explicit that AI may
 * draft but human confirmation makes a field official — so this reports gaps, it
 * does not fill them.
 */
export function missingRequired(answers: IntakeAnswers): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter((q) => q.required && !isAnswered(q, answers[q.id]));
}

export function canCompleteIntake(answers: IntakeAnswers): boolean {
  return missingRequired(answers).length === 0;
}

export function intakeProgress(answers: IntakeAnswers): { answered: number; total: number; percent: number } {
  const answered = INTAKE_QUESTIONS.filter((q) => isAnswered(q, answers[q.id])).length;
  const total = INTAKE_QUESTIONS.length;
  return { answered, total, percent: Math.round((answered / total) * 100) };
}

/** Weekly hours from selected days, when the caller gave hours per week. */
export function scheduleSummary(answers: IntakeAnswers): string {
  const days = Array.isArray(answers.requested_days) ? (answers.requested_days as string[]) : [];
  const hours = typeof answers.hours_per_week === "number" ? answers.hours_per_week : null;
  const time = typeof answers.time_preference === "string" ? answers.time_preference : null;

  if (days.length === 0) return "Not captured yet";

  const label =
    days.length === 7
      ? "Every day"
      : days.length === 5 && ["mon", "tue", "wed", "thu", "fri"].every((d) => days.includes(d))
        ? "Mon–Fri"
        : days.map((d) => d[0].toUpperCase() + d.slice(1, 3)).join(", ");

  const timeLabel = TIME_PREFERENCES.find((t) => t.value === time)?.label.toLowerCase();
  return [label, timeLabel, hours ? `about ${hours} hrs/week` : null].filter(Boolean).join(" · ");
}

/** Human-readable answer for the review screen. */
export function displayAnswer(question: IntakeQuestion, value: unknown): string {
  if (!isAnswered(question, value)) return "Not captured";

  if (question.kind === "multichoice" && Array.isArray(value)) {
    return value
      .map((v) => question.options?.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  if (question.kind === "weekdays" && Array.isArray(value)) {
    return (value as string[]).map((d) => d[0].toUpperCase() + d.slice(1, 3)).join(", ");
  }
  if (question.kind === "choice") {
    return question.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  return String(value);
}
