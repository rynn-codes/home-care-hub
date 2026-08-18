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
 * RECONCILED against the paper Client Intake Form on 18 Aug 2026. §11 names that
 * two-page form as the data basis for this table; until then this list was
 * provisional. The reshape it needed turned out to be additive, as hoped, but
 * the additions were not cosmetic — the whole "consultation not scheduled"
 * branch was absent, which is the branch that stops a lead going cold.
 *
 * The form is NOT vendored into this repository. The copy supplied is a
 * completed one carrying a real client's name, address, telephone number, email
 * and two cancer diagnoses. Committing it would put identifiable health
 * information into git history permanently. The structure below is the record
 * of what it asks; a blank copy can be vendored safely if one is wanted.
 *
 * One thing the form settles: the client's street address is NOT asked at the
 * top of the call. The form marks it "collect when scheduling home visit", which
 * is exactly what §11 says, so it is captured as the consultation location
 * rather than demanded from a caller who rang to ask about prices.
 */

export type IntakeAnswers = Record<string, unknown>;

export type IntakeQuestionKind =
  | "text"
  | "longtext"
  | "choice"
  | "multichoice"
  | "weekdays"
  | "date"
  | "number"
  | "time"
  /** One short line per care need already selected, as the paper form has. */
  | "need_details";

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
  /**
   * Only asked when this passes. The form branches once — whether an in-home
   * consultation got booked — and the two sides ask completely different
   * questions. Showing both would put eight dead fields on the screen during a
   * live call.
   */
  showIf?: (answers: IntakeAnswers) => boolean;
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

// The paper form offers Private Pay, LTC Insurance and Other. "Self pay + LTC
// insurance" is kept because it is the common real answer — the policy covers
// part and the family pays the rest — but LTC insurance alone is now available
// as the form has it.
export const PAYMENT_SOURCES = [
  { value: "self_pay", label: "Private pay" },
  { value: "ltc_insurance", label: "LTC insurance" },
  { value: "self_pay_ltc_insurance", label: "Private pay + LTC insurance" },
  { value: "not_sure_yet", label: "Not sure yet" },
  { value: "other", label: "Other" },
] as const;

/** How the caller would rather be reached, when no visit was booked. */
export const CONTACT_METHODS = [
  { value: "phone_call", label: "Phone call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
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
    id: "caller_phone",
    section: "Caller",
    question: "Best number to reach you on?",
    helper: "The caller's own number. It is often not the client's line.",
    kind: "text",
    required: true,
  },
  {
    id: "caller_email",
    section: "Caller",
    question: "And an email address?",
    helper: "Rates and the confirmation go here, so read it back to them.",
    kind: "text",
  },
  {
    id: "referral_source_heard",
    section: "Caller",
    question: "How did they hear about us?",
    helper: "Word of mouth, a hospital, a placement service. Worth knowing what is working.",
    kind: "text",
    prefillFrom: "referralSource",
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
    id: "care_need_details",
    section: "Care needs",
    question: "Anything specific on any of those?",
    helper: "The paper form has a line beside each one. Shower bench, meal prep, bedside commode — the detail that tells the RN what to look for.",
    kind: "need_details",
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
    id: "requested_hours_window",
    section: "Requested schedule",
    question: "Any particular hours?",
    helper: "If they gave times, put them here as they said them — \"11 to 7\".",
    kind: "text",
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
    id: "consultation_scheduled",
    section: "In-home consultation",
    question: "Did you get the in-home visit booked?",
    helper: "The RN assessment. Booking it on the call is the whole point of the call.",
    kind: "choice",
    options: [
      { value: "yes", label: "Yes, it is booked" },
      { value: "no", label: "Not yet" },
    ],
    required: true,
  },
  {
    id: "consultation_date",
    section: "In-home consultation",
    question: "What date?",
    kind: "date",
    required: true,
    showIf: (a) => a.consultation_scheduled === "yes",
  },
  {
    id: "consultation_time",
    section: "In-home consultation",
    question: "And what time?",
    kind: "time",
    required: true,
    showIf: (a) => a.consultation_scheduled === "yes",
  },
  {
    id: "consultation_location",
    section: "In-home consultation",
    question: "Where are we going?",
    helper: "Street, city and zip. This is the point in the call where the address is asked for — the form says so explicitly, and it is easier to ask once there is a visit to attach it to.",
    kind: "longtext",
    required: true,
    showIf: (a) => a.consultation_scheduled === "yes",
  },
  {
    id: "consultation_attendees",
    section: "In-home consultation",
    question: "Who will be there?",
    helper:
      "Then tell them who is coming from our side, by name and role. The form is emphatic about this, and whoever makes the visit should ring to confirm and introduce themselves beforehand.",
    kind: "text",
    required: true,
    showIf: (a) => a.consultation_scheduled === "yes",
  },
  {
    id: "no_consultation_reason",
    section: "Following up",
    question: "What stopped it being booked?",
    helper: "Thinking about it, comparing agencies, waiting on a family member. Say it plainly.",
    kind: "longtext",
    required: true,
    showIf: (a) => a.consultation_scheduled === "no",
  },
  {
    id: "followup_date",
    section: "Following up",
    question: "When will you follow up?",
    helper: "A date, agreed with them on the call. Without one this becomes a lead nobody rings back.",
    kind: "date",
    required: true,
    showIf: (a) => a.consultation_scheduled === "no",
  },
  {
    id: "followup_time",
    section: "Following up",
    question: "At what time?",
    kind: "time",
    showIf: (a) => a.consultation_scheduled === "no",
  },
  {
    id: "preferred_contact_method",
    section: "Following up",
    question: "How would they rather be reached?",
    kind: "choice",
    options: [...CONTACT_METHODS],
    required: true,
    showIf: (a) => a.consultation_scheduled === "no",
  },
  {
    id: "additional_notes",
    section: "Notes",
    question: "Anything else the team should know before the RN visit?",
    kind: "longtext",
  },
];

export const INTAKE_SECTIONS = [...new Set(INTAKE_QUESTIONS.map((q) => q.section))];

function isAnswered(question: IntakeQuestion, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  // need_details holds one line per care need; an object of empty strings is
  // not an answer, and it is optional anyway.
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
  }
  return true;
}

/**
 * Questions in play, given the consultation branch.
 *
 * Everything downstream counts against this rather than the full list, or an
 * intake where the visit was booked would sit for ever at "4 questions still
 * needed" — the four on the branch that is not being asked.
 */
export function activeQuestions(answers: IntakeAnswers): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}

/**
 * Required questions still unanswered.
 *
 * Drives the review screen's "needs review" list. §13 is explicit that AI may
 * draft but human confirmation makes a field official — so this reports gaps, it
 * does not fill them.
 */
export function missingRequired(answers: IntakeAnswers): IntakeQuestion[] {
  return activeQuestions(answers).filter((q) => q.required && !isAnswered(q, answers[q.id]));
}

export function canCompleteIntake(answers: IntakeAnswers): boolean {
  return missingRequired(answers).length === 0;
}

export function intakeProgress(answers: IntakeAnswers): { answered: number; total: number; percent: number } {
  const active = activeQuestions(answers);
  const answered = active.filter((q) => isAnswered(q, answers[q.id])).length;
  const total = active.length;
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

export type FollowUpState = "none" | "booked" | "scheduled" | "due" | "overdue";

export interface FollowUp {
  state: FollowUpState;
  /** ISO date, when there is one. */
  date: string | null;
  note: string;
}

/**
 * Where this lead stands after the call.
 *
 * The paper form's most valuable field is the follow-up date on the "not
 * scheduled" branch, because a caller who did not book a visit is the one who
 * quietly disappears. This turns that date into something the work queue can
 * escalate: an overdue follow-up is exactly the "a person must act today" case
 * §8 puts at the top.
 *
 * `today` is a parameter so this stays testable and can be evaluated as of any
 * date.
 */
export function followUp(answers: IntakeAnswers, today: string): FollowUp {
  if (answers.consultation_scheduled === "yes") {
    const date = typeof answers.consultation_date === "string" ? answers.consultation_date : null;
    return { state: "booked", date, note: date ? `In-home visit booked for ${date}` : "In-home visit booked" };
  }

  if (answers.consultation_scheduled !== "no") {
    return { state: "none", date: null, note: "No decision recorded on the in-home visit" };
  }

  const date = typeof answers.followup_date === "string" && answers.followup_date ? answers.followup_date : null;
  if (!date) {
    // A "not yet" with no date is the failure mode this branch exists to
    // prevent. It is worse than no answer, because it looks handled.
    return { state: "overdue", date: null, note: "No visit booked and no follow-up date agreed" };
  }

  if (date < today) return { state: "overdue", date, note: `Follow-up was due ${date}` };
  if (date === today) return { state: "due", date, note: "Follow-up is due today" };
  return { state: "scheduled", date, note: `Following up ${date}` };
}

/** Human-readable answer for the review screen. */
export function displayAnswer(question: IntakeQuestion, value: unknown): string {
  if (!isAnswered(question, value)) return "Not captured";

  if (question.kind === "need_details" && typeof value === "object") {
    return Object.entries(value as Record<string, string>)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `${CARE_NEEDS.find((n) => n.value === k)?.label ?? k}: ${v.trim()}`)
      .join(" · ");
  }

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
