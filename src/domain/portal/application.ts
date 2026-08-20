import type { E164 } from "@/domain/portal/phone";

/**
 * The employment application, as data.
 *
 * §4: once Joy decides to move a candidate forward, they complete the
 * application *inside Joy* rather than through DocuSign. The interaction
 * reference is the existing Fillout flow — "fast; mobile-first; one
 * section/question at a time; generous whitespace; clear progress; large
 * inputs; autosave; simple Back / Continue; minimal color; no dashboard
 * clutter" — recreated rather than cloned.
 *
 * The whole form is a list of fields with a step and an optional condition,
 * exactly as `admissions/intake.ts` is. That is not a stylistic preference: a
 * hand-written screen per step means the question set lives in JSX, and the
 * first time Karynn wants to add a question somebody has to touch a component,
 * a type and a mapper. Here it is one entry.
 *
 * §4 also says application fields "should populate structured Joy data and
 * eventually become part of the employee profile" and to "avoid re-entering
 * data from an application PDF". So every field that maps onto an employee
 * record carries `mapsTo`, and the invitation's known facts are prefilled
 * rather than asked. Nobody who has just been interviewed should be made to
 * type their own name back to the person who interviewed them.
 */

export type ApplicationAnswers = Record<string, unknown>;

export type ApplicationStep =
  | "welcome"
  | "personal"
  | "contact"
  | "experience"
  | "availability"
  | "credentials"
  | "references"
  | "review"
  | "attestation";

/** §4's flow, in order. */
export const APPLICATION_ORDER: ApplicationStep[] = [
  "welcome",
  "personal",
  "contact",
  "experience",
  "availability",
  "credentials",
  "references",
  "review",
  "attestation",
];

export const STEP_LABELS: Record<ApplicationStep, string> = {
  welcome: "Welcome",
  personal: "About you",
  contact: "How to reach you",
  experience: "Your experience",
  availability: "When you can work",
  credentials: "Your credentials",
  references: "References",
  review: "Check your answers",
  attestation: "Sign and submit",
};

/**
 * Asked as a sentence, not a form label. A caregiver filling this in on a phone
 * at nine at night is being talked to, not processed.
 */
export const STEP_INTROS: Partial<Record<ApplicationStep, string>> = {
  welcome:
    "Thanks for coming in to meet us. This takes about ten minutes, and it saves as you go — " +
    "you can stop anywhere and pick it back up.",
  personal: "First, a few details about you.",
  contact: "Where we can reach you, and who we should call in an emergency.",
  experience: "Tell us where you have worked.",
  availability: "This helps us match you with clients near you.",
  credentials: "You can upload these now or after you submit — whichever is easier.",
  references: "Two people who have supervised your work.",
  review: "Have a look before you send it.",
  attestation: "Last step.",
};

export type ApplicationFieldKind =
  | "text"
  | "longtext"
  | "choice"
  | "multichoice"
  | "weekdays"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "address"
  /** A repeating block — previous employers, references. */
  | "repeater"
  | "signature";

/**
 * Where an answer ends up on the employee record.
 *
 * Present so the hire conversion is a lookup rather than a second act of data
 * entry. §4's "avoid re-entering data" is only true if something holds the
 * mapping, and a comment does not.
 */
export type EmployeeField =
  | "legalName"
  | "preferredName"
  | "dateOfBirth"
  | "email"
  | "phone"
  | "address"
  | "emergencyContact"
  | "availability"
  | "drives"
  | "hasAutoInsurance"
  | "role";

export interface ApplicationField {
  id: string;
  step: ApplicationStep;
  /** The question, out loud. */
  question: string;
  helper?: string;
  kind: ApplicationFieldKind;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  mapsTo?: EmployeeField;
  /** Known from the invitation, so it is shown filled rather than asked. */
  prefillFrom?: "name" | "phone" | "email" | "roleApplied";
  showIf?: (answers: ApplicationAnswers) => boolean;
  /**
   * Needs storage Joy does not have yet. Karynn, 15 Aug, on the SSN: "I will
   * need that saved, so we'll have to eventually hardwire the correct software
   * (HIPAA) for that. We don't need it to rest the prototype."
   *
   * Fields marked here are described but never collected — see
   * `DEFERRED_SENSITIVE`. Collecting one into a demo store would put a real
   * person's identity document into a database with no such guarantees, which
   * is worse than not having the field.
   */
  deferredSensitive?: boolean;
  /** Wording Karynn should have reviewed before this goes live. */
  needsLegalReview?: boolean;
}

const WEEKDAY_OPTIONS = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

export const APPLICATION_FIELDS: ApplicationField[] = [
  // ------------------------------------------------------------ personal --
  {
    id: "legal_name",
    step: "personal",
    question: "What is your full legal name?",
    helper: "As it appears on your ID.",
    kind: "text",
    required: true,
    mapsTo: "legalName",
    prefillFrom: "name",
  },
  {
    id: "preferred_name",
    step: "personal",
    question: "What would you like us to call you?",
    kind: "text",
    mapsTo: "preferredName",
  },
  {
    id: "date_of_birth",
    step: "personal",
    question: "Date of birth",
    kind: "date",
    required: true,
    mapsTo: "dateOfBirth",
  },
  {
    id: "ssn",
    step: "personal",
    question: "Social Security number",
    helper: "Needed for your background check and payroll.",
    kind: "text",
    required: true,
    deferredSensitive: true,
  },
  {
    id: "work_authorized",
    step: "personal",
    question: "Are you legally authorized to work in the United States?",
    kind: "choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },

  // ------------------------------------------------------------- contact --
  {
    id: "email",
    step: "contact",
    question: "Email address",
    kind: "email",
    required: true,
    mapsTo: "email",
    prefillFrom: "email",
  },
  {
    id: "phone",
    step: "contact",
    question: "Mobile number",
    helper: "This is the number you sign in with.",
    kind: "phone",
    required: true,
    mapsTo: "phone",
    prefillFrom: "phone",
  },
  {
    id: "address",
    step: "contact",
    question: "Where do you live?",
    helper: "We use this to find clients near you.",
    kind: "address",
    required: true,
    mapsTo: "address",
  },
  {
    id: "emergency_contact",
    step: "contact",
    question: "Who should we call in an emergency?",
    helper: "Name, relationship and a phone number.",
    kind: "text",
    required: true,
    mapsTo: "emergencyContact",
  },

  // ---------------------------------------------------------- experience --
  {
    id: "role_applied",
    step: "experience",
    question: "What are you applying for?",
    kind: "text",
    required: true,
    mapsTo: "role",
    prefillFrom: "roleApplied",
  },
  {
    id: "years_experience",
    step: "experience",
    question: "How many years have you worked in care?",
    kind: "number",
    required: true,
  },
  {
    id: "employers",
    step: "experience",
    question: "Where have you worked?",
    helper: "Your last two or three positions. Include dates and why you left.",
    kind: "repeater",
    required: true,
  },
  {
    id: "care_settings",
    step: "experience",
    question: "What kinds of care have you done?",
    kind: "multichoice",
    options: [
      { value: "personal_care", label: "Personal care" },
      { value: "companion", label: "Companionship" },
      { value: "dementia", label: "Dementia care" },
      { value: "hospice", label: "Hospice support" },
      { value: "post_surgical", label: "Post-surgical" },
      { value: "pediatric", label: "Pediatric" },
    ],
  },

  // -------------------------------------------------------- availability --
  {
    id: "days_available",
    step: "availability",
    question: "Which days can you work?",
    kind: "weekdays",
    required: true,
    options: WEEKDAY_OPTIONS,
    mapsTo: "availability",
  },
  {
    id: "hours_wanted",
    step: "availability",
    question: "How many hours a week are you looking for?",
    kind: "number",
    required: true,
  },
  {
    id: "shift_preference",
    step: "availability",
    question: "What times suit you best?",
    kind: "multichoice",
    required: true,
    options: [
      { value: "mornings", label: "Mornings" },
      { value: "afternoons", label: "Afternoons" },
      { value: "evenings", label: "Evenings" },
      { value: "overnight", label: "Overnight" },
      { value: "weekends", label: "Weekends" },
    ],
  },
  {
    id: "reliable_transport",
    step: "availability",
    question: "Do you have reliable transportation to get to visits?",
    kind: "choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "drives_clients",
    step: "availability",
    question: "Are you willing to drive clients in your own car?",
    helper: "Some clients need help getting to appointments. It is fine to say no.",
    kind: "choice",
    required: true,
    mapsTo: "drives",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "auto_insurance",
    step: "availability",
    // Only asked of people who said yes — the gate Joy's credential rules use.
    question: "Do you carry current auto insurance?",
    kind: "choice",
    required: true,
    mapsTo: "hasAutoInsurance",
    showIf: (a) => a.drives_clients === "yes",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },

  // --------------------------------------------------------- credentials --
  {
    id: "certifications",
    step: "credentials",
    question: "Which of these do you hold?",
    helper: "You can upload the documents after you submit.",
    kind: "multichoice",
    options: [
      { value: "cna", label: "CNA" },
      { value: "hha", label: "Home health aide" },
      { value: "cpr", label: "CPR / First aid" },
      { value: "med_aide", label: "Medication aide" },
      { value: "none", label: "None of these yet" },
    ],
  },
  {
    id: "drivers_license",
    step: "credentials",
    question: "Do you have a valid driver's licence?",
    kind: "choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "tb_test_date",
    step: "credentials",
    question: "When was your last TB test?",
    helper: "Leave blank if you have not had one — we will arrange it.",
    kind: "date",
  },

  // ---------------------------------------------------------- references --
  {
    id: "references",
    step: "references",
    question: "Who can speak to your work?",
    helper: "Two people who have supervised you. Name, where they worked with you, and a phone number.",
    kind: "repeater",
    required: true,
  },
  {
    id: "convictions",
    step: "references",
    question:
      "Have you ever been convicted of a criminal offence, other than a minor traffic violation?",
    helper:
      "A yes does not automatically rule you out. Texas requires us to run a background check " +
      "on everyone, and we would rather hear it from you first.",
    kind: "choice",
    required: true,
    needsLegalReview: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "convictions_detail",
    step: "references",
    question: "Tell us about it in your own words.",
    kind: "longtext",
    required: true,
    needsLegalReview: true,
    showIf: (a) => a.convictions === "yes",
  },

  // --------------------------------------------------------- attestation --
  {
    id: "attestation",
    step: "attestation",
    question:
      "I confirm the information above is true and complete to the best of my knowledge.",
    kind: "choice",
    required: true,
    needsLegalReview: true,
    options: [{ value: "yes", label: "I confirm" }],
  },
  {
    id: "signature",
    step: "attestation",
    question: "Sign your name",
    kind: "signature",
    required: true,
    needsLegalReview: true,
  },
];

/**
 * Fields Joy describes but must not store yet.
 *
 * Kept as a derived list rather than a second hand-maintained one, so marking a
 * field sensitive is enough and there is no way for the two to drift apart.
 */
export const DEFERRED_SENSITIVE = APPLICATION_FIELDS.filter((f) => f.deferredSensitive).map(
  (f) => f.id,
);

/** Wording awaiting Karynn's legal review. Surfaced so it cannot be forgotten. */
export const AWAITING_LEGAL_REVIEW = APPLICATION_FIELDS.filter((f) => f.needsLegalReview).map(
  (f) => f.id,
);

// ------------------------------------------------------------- prefilling --

export interface InvitationFacts {
  name: string;
  phone: E164;
  email: string | null;
  roleApplied: string;
}

/**
 * Seed the answers Joy already knows.
 *
 * §4's "avoid re-entering data" starts here. Somebody who was interviewed on
 * Tuesday should not be asked their own name on Wednesday by the same agency.
 */
export function prefillApplication(facts: InvitationFacts): ApplicationAnswers {
  const answers: ApplicationAnswers = {};
  for (const field of APPLICATION_FIELDS) {
    switch (field.prefillFrom) {
      case "name":
        answers[field.id] = facts.name;
        break;
      case "phone":
        answers[field.id] = facts.phone;
        break;
      case "email":
        if (facts.email) answers[field.id] = facts.email;
        break;
      case "roleApplied":
        answers[field.id] = facts.roleApplied;
        break;
    }
  }
  return answers;
}

// -------------------------------------------------------------- progress --

export function activeFields(answers: ApplicationAnswers): ApplicationField[] {
  return APPLICATION_FIELDS.filter((f) => !f.showIf || f.showIf(answers)).filter(
    // Never rendered. See `deferredSensitive`.
    (f) => !f.deferredSensitive,
  );
}

export function fieldsForStep(
  step: ApplicationStep,
  answers: ApplicationAnswers,
): ApplicationField[] {
  return activeFields(answers).filter((f) => f.step === step);
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function missingRequired(
  step: ApplicationStep,
  answers: ApplicationAnswers,
): ApplicationField[] {
  return fieldsForStep(step, answers).filter((f) => f.required && !isAnswered(answers[f.id]));
}

export function stepComplete(step: ApplicationStep, answers: ApplicationAnswers): boolean {
  return missingRequired(step, answers).length === 0;
}

/**
 * Steps that have questions on them, for the progress indicator.
 *
 * Welcome and review are excluded — counting a screen with nothing to fill in
 * would make the bar move when the candidate has done no work, which is the
 * kind of small dishonesty that makes progress bars useless.
 */
export function questionSteps(answers: ApplicationAnswers): ApplicationStep[] {
  return APPLICATION_ORDER.filter((s) => fieldsForStep(s, answers).length > 0);
}

export interface ApplicationProgress {
  step: ApplicationStep;
  index: number;
  total: number;
  percent: number;
  answered: number;
  required: number;
}

export function applicationProgress(
  step: ApplicationStep,
  answers: ApplicationAnswers,
): ApplicationProgress {
  const steps = questionSteps(answers);
  const index = steps.indexOf(step);
  const required = activeFields(answers).filter((f) => f.required);
  const answered = required.filter((f) => isAnswered(answers[f.id])).length;

  return {
    step,
    index: index < 0 ? 0 : index,
    total: steps.length,
    percent: required.length === 0 ? 0 : Math.round((answered / required.length) * 100),
    answered,
    required: required.length,
  };
}

/** Where to drop someone who comes back mid-application. */
export function resumeStep(answers: ApplicationAnswers): ApplicationStep {
  const next = questionSteps(answers).find((s) => !stepComplete(s, answers));
  return next ?? "review";
}

export function nextStep(step: ApplicationStep, answers: ApplicationAnswers): ApplicationStep | null {
  const steps = APPLICATION_ORDER.filter(
    (s) => s === "welcome" || s === "review" || s === "attestation" || fieldsForStep(s, answers).length > 0,
  );
  const i = steps.indexOf(step);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export function previousStep(
  step: ApplicationStep,
  answers: ApplicationAnswers,
): ApplicationStep | null {
  const steps = APPLICATION_ORDER.filter(
    (s) => s === "welcome" || s === "review" || s === "attestation" || fieldsForStep(s, answers).length > 0,
  );
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1] : null;
}

export function canSubmit(answers: ApplicationAnswers): { ok: boolean; missing: string[] } {
  const missing = activeFields(answers)
    .filter((f) => f.required && !isAnswered(answers[f.id]))
    .map((f) => f.question);
  return { ok: missing.length === 0, missing };
}

// -------------------------------------------------------------- autosave --

export type SaveState = "clean" | "pending" | "saving" | "saved" | "failed";

/**
 * What autosave knows.
 *
 * The interesting field is `unsavedFieldIds`. §4 asks for autosave, and the
 * place autosave goes wrong is exactly where this form will be used — a phone,
 * on a bus, on patchy signal. A form that shows "Saved" because it *tried* to
 * save teaches people to close the tab, and they lose twenty minutes of typing.
 *
 * So the failed state names the fields still only in the browser, and the UI is
 * expected to say so rather than reassure. Same rule as the SMS adapter
 * reporting `delivered: false`: not knowing is reported as not knowing.
 */
export interface AutosaveStatus {
  state: SaveState;
  unsavedFieldIds: string[];
  lastSavedAt: string | null;
  attempts: number;
}

export const INITIAL_AUTOSAVE: AutosaveStatus = {
  state: "clean",
  unsavedFieldIds: [],
  lastSavedAt: null,
  attempts: 0,
};

export function markDirty(status: AutosaveStatus, fieldId: string): AutosaveStatus {
  return {
    ...status,
    state: "pending",
    unsavedFieldIds: status.unsavedFieldIds.includes(fieldId)
      ? status.unsavedFieldIds
      : [...status.unsavedFieldIds, fieldId],
  };
}

export function markSaving(status: AutosaveStatus): AutosaveStatus {
  return { ...status, state: "saving", attempts: status.attempts + 1 };
}

export function markSaved(status: AutosaveStatus, at: string): AutosaveStatus {
  return { state: "saved", unsavedFieldIds: [], lastSavedAt: at, attempts: 0 };
}

/**
 * A save failed. The dirty list is deliberately kept.
 *
 * Clearing it here would be the bug: the next successful save would write only
 * what changed after the failure, and the fields typed during the outage would
 * be silently dropped.
 */
export function markFailed(status: AutosaveStatus): AutosaveStatus {
  return { ...status, state: "failed" };
}

export function autosaveMessage(status: AutosaveStatus): string {
  switch (status.state) {
    case "clean":
      return "";
    case "pending":
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "failed":
      return status.unsavedFieldIds.length === 1
        ? "One answer has not saved yet. Stay on this page — we're still trying."
        : `${status.unsavedFieldIds.length} answers have not saved yet. Stay on this page — we're still trying.`;
  }
}

/** True when leaving now would lose work. Drives the navigation warning. */
export function hasUnsavedWork(status: AutosaveStatus): boolean {
  return status.unsavedFieldIds.length > 0;
}

// ---------------------------------------------------------------- review --

export interface ReviewRow {
  step: ApplicationStep;
  question: string;
  answer: string;
  fieldId: string;
}

export function displayAnswer(field: ApplicationField, value: unknown): string {
  if (!isAnswered(value)) return "Not answered";

  if (Array.isArray(value)) {
    const labels = value.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v));
    return labels.join(", ");
  }
  if (field.options) {
    return field.options.find((o) => o.value === value)?.label ?? String(value);
  }
  return String(value);
}

/** §4's Review step — everything, grouped, each row editable in place. */
export function reviewRows(answers: ApplicationAnswers): ReviewRow[] {
  return activeFields(answers)
    .filter((f) => f.step !== "attestation")
    .map((f) => ({
      step: f.step,
      question: f.question,
      answer: displayAnswer(f, answers[f.id]),
      fieldId: f.id,
    }));
}

/**
 * The structured record a submitted application becomes.
 *
 * This is §4's "populate structured Joy data" made literal: the hire conversion
 * reads this, not a PDF.
 */
export function toEmployeeFields(answers: ApplicationAnswers): Partial<Record<EmployeeField, unknown>> {
  const out: Partial<Record<EmployeeField, unknown>> = {};
  for (const field of APPLICATION_FIELDS) {
    if (!field.mapsTo) continue;
    const value = answers[field.id];
    if (!isAnswered(value)) continue;
    out[field.mapsTo] =
      field.mapsTo === "drives" || field.mapsTo === "hasAutoInsurance" ? value === "yes" : value;
  }
  return out;
}
