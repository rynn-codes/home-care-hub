/**
 * The RN assessment, modelled backwards from the signing packet.
 *
 * The rule: by the end of this conversation, every field in
 * `docs/specs/Patient_Consents_Packet.pdf` must be answerable. Each question
 * below declares which packet page it fills, and `packetCoverage()` reports
 * what is still missing — so the RN finds out at the kitchen table, not back at
 * the office with the client already signed.
 *
 * ORDERED AS A CONVERSATION, NOT AS A FORM. The packet is arranged for filing:
 * demographics, services, plan of care, disaster plan. Nobody talks in that
 * order. This walks the way a nurse actually works through a first visit —
 * the person, then their body, then their home, then what care looks like, then
 * safety, then the paperwork. Joy reorders the answers into the packet.
 *
 * Anything already captured at phone intake is carried forward and confirmed
 * rather than asked again — "enter once, reuse everywhere".
 */

export type AssessmentInputKind =
  | "confirm"      // known already; RN confirms or corrects
  | "text"
  | "longtext"
  | "number"
  | "choice"
  | "multichoice"
  | "yes_no_copy"  // advance directive / DNR: yes + copy provided, or no
  | "thresholds";  // vital-sign parameters with packet defaults

/** Pages of the packet, used for the coverage meter. */
export type PacketPage =
  | "agreement_services"        // p1
  | "agreement_payment"         // p2, p4
  | "agreement_cancellation"    // p3
  | "payment_preference"        // p4
  | "informed_consent"          // p5-6
  | "equipment_authorization"   // p6
  | "client_consent"            // p7
  | "customer_rights"           // p8
  | "documents_reviewed"        // p9
  | "photograph"                // p10
  | "transportation"            // p11
  | "records_disclosure"        // p12
  | "records_release"           // p13
  | "disclosure_list"           // p14
  | "hipaa_privacy"             // p15
  | "bill_of_rights"            // p16-17
  | "complaints"                // p18
  | "advance_directive"         // p19
  | "non_solicitation"          // p19-20
  | "health_demographics"       // p21
  | "plan_goals_setting"        // p22
  | "plan_interventions"        // p23
  | "plan_vitals_dme"           // p24
  | "disaster_plan"             // p25
  | "emergency_care_plan";      // p26

export const PACKET_PAGE_LABELS: Record<PacketPage, string> = {
  agreement_services: "Client Agreement — services & schedule",
  agreement_payment: "Client Agreement — fees & invoicing",
  agreement_cancellation: "Client Agreement — changes & cancellation",
  payment_preference: "Electronic payment preference",
  informed_consent: "Informed consent for services",
  equipment_authorization: "Equipment, supplies & authorization",
  client_consent: "Consent for care & client folder",
  customer_rights: "Customer rights, safety & who we bill",
  documents_reviewed: "Documents reviewed before start of care",
  photograph: "Consent to photograph",
  transportation: "Non-medical transportation agreement",
  records_disclosure: "Authorization to disclose medical records",
  records_release: "Authorization to obtain & release records",
  disclosure_list: "Health information authorized disclosure list",
  hipaa_privacy: "HIPAA privacy practices receipt",
  bill_of_rights: "Patient's bill of rights",
  complaints: "Complaints policy",
  advance_directive: "Advance directive",
  non_solicitation: "Non-solicitation",
  health_demographics: "Health demographics",
  plan_goals_setting: "Plan of care — goals & home setting",
  plan_interventions: "Plan of care — interventions",
  plan_vitals_dme: "Plan of care — vitals, DME & supplies",
  disaster_plan: "At-risk evaluation & disaster plan",
  emergency_care_plan: "Emergency care plan",
};

/** Pages filled by the consent signing session rather than by a question. */
export const CONSENT_ONLY_PAGES: PacketPage[] = [
  "agreement_payment",
  "agreement_cancellation",
  "informed_consent",
  "equipment_authorization",
  "client_consent",
  "documents_reviewed",
  "photograph",
  "transportation",
  "hipaa_privacy",
  "bill_of_rights",
  "complaints",
  "non_solicitation",
];

export interface AssessmentQuestion {
  id: string;
  section: string;
  /** Asked the way a nurse would say it. */
  question: string;
  helper?: string;
  kind: AssessmentInputKind;
  options?: Array<{ value: string; label: string }>;
  /** Packet pages this answer feeds. */
  fills: PacketPage[];
  /** Required to complete the packet. */
  required?: boolean;
  /** Only asked when this predicate passes — keeps the conversation short. */
  showIf?: (answers: AssessmentAnswers) => boolean;
  /** Prefilled from phone intake; the RN confirms rather than retypes. */
  fromIntake?: string;
  /**
   * Identifiers that need narrower access than the rest of the record — §28.
   * The demo store refuses to persist these, so a social security number never
   * reaches localStorage.
   *
   * THIS IS A PROTOTYPE MEASURE, NOT THE DESTINATION. Karynn confirmed on 18 Aug
   * that the number does need to be stored, and that it waits on HIPAA-grade
   * infrastructure to hold it: a column-level access policy, encryption at rest,
   * and an audit trail on every read. Until that exists, not storing it is the
   * only honest option — a browser's localStorage has no access control at all.
   * When the real store lands, this flag stops meaning "drop" and starts meaning
   * "route to the restricted column".
   */
  restricted?: boolean;
}

export type AssessmentAnswers = Record<string, unknown>;

const opts = (...labels: string[]) =>
  labels.map((l) => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label: l }));

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ---------------------------------------------------------------- the person
  {
    id: "identity_confirm",
    section: "Getting settled",
    question: "Let's confirm who I'm here to see.",
    helper: "Name, date of birth and address as we have them. Correct anything that's wrong.",
    kind: "confirm",
    fills: [
      "agreement_services",
      "health_demographics",
      "disaster_plan",
      "records_disclosure",
      "records_release",
      "disclosure_list",
    ],
    required: true,
    fromIntake: "client",
  },
  {
    id: "sex",
    section: "Getting settled",
    question: "Sex, for the record?",
    kind: "choice",
    options: opts("Female", "Male"),
    fills: ["health_demographics", "disaster_plan"],
    required: true,
  },
  {
    id: "weight",
    section: "Getting settled",
    question: "Roughly what do they weigh?",
    helper: "The disaster plan needs it — evacuation crews plan around weight.",
    kind: "number",
    fills: ["disaster_plan"],
    required: true,
  },

  // ------------------------------------------------------------- health picture
  {
    id: "diagnoses",
    section: "Health picture",
    question: "What are we working with — diagnoses and main problems?",
    kind: "longtext",
    fills: ["health_demographics"],
    required: true,
  },
  {
    id: "allergies",
    section: "Health picture",
    question: "Any allergies?",
    helper: "If none, say so — the packet needs 'NKA' rather than a blank.",
    kind: "longtext",
    fills: ["health_demographics"],
    required: true,
  },
  {
    id: "primary_physician",
    section: "Health picture",
    question: "Who is their primary physician, and the number?",
    kind: "text",
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "pharmacy",
    section: "Health picture",
    question: "Which pharmacy do they use?",
    helper: "Name and phone. This matters in an evacuation.",
    kind: "text",
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "dme_supplier",
    section: "Health picture",
    question: "Any DME supplier involved?",
    kind: "text",
    fills: ["disaster_plan"],
  },

  // -------------------------------------------------------------- day to day
  {
    id: "orientation",
    section: "Day to day",
    question: "How are they oriented today?",
    kind: "multichoice",
    options: opts("Oriented", "Alert", "Forgets", "Confused"),
    fills: ["plan_goals_setting"],
    required: true,
  },
  {
    id: "activities_permitted",
    section: "Day to day",
    question: "What are they able to do?",
    helper: "Tap everything that applies.",
    kind: "multichoice",
    options: opts(
      "Independent at home", "Bedbound", "Up as tolerated", "Transfer bed-chair",
      "Partial weight-bearing", "Exercise prescribed", "Wheelchair", "Walker",
      "Crutches", "Cane",
    ),
    fills: ["plan_goals_setting"],
    required: true,
  },
  {
    id: "functional_limitations",
    section: "Day to day",
    question: "Where are the limitations?",
    kind: "multichoice",
    options: opts(
      "Ambulation", "Endurance", "Dyspnea", "Bowel/bladder incontinence", "Speech",
      "Dentures", "PEG tube", "Ostomy", "Hard of hearing", "Hearing aid",
      "Legally blind", "Vision issues", "Glasses/contacts", "Paralysis",
      "Contracture", "Amputation", "Artificial limb",
    ),
    fills: ["plan_goals_setting"],
    required: true,
  },
  {
    id: "limitation_detail",
    section: "Day to day",
    question: "Say more about that — which side, which limb, how severe?",
    helper: "The packet asks you to specify paralysis, contracture, amputation and artificial limbs.",
    kind: "longtext",
    fills: ["plan_goals_setting"],
    showIf: (a) => {
      const l = (a.functional_limitations as string[]) ?? [];
      return ["paralysis", "contracture", "amputation", "artificial_limb"].some((k) => l.includes(k));
    },
  },
  {
    id: "oxygen",
    section: "Day to day",
    question: "Oxygen — how much, and how is it delivered?",
    helper: "Litres, then nasal cannula, mask or other, and whether it's PRN or continuous.",
    kind: "text",
    fills: ["plan_goals_setting", "plan_vitals_dme"],
    showIf: (a) => {
      const d = (a.dme as string[]) ?? [];
      const l = (a.functional_limitations as string[]) ?? [];
      return d.includes("oxygen") || l.includes("dyspnea");
    },
  },

  // ------------------------------------------------------------------ the home
  {
    id: "home_setting",
    section: "The home",
    question: "Who else is in the home?",
    kind: "choice",
    options: opts("Lives alone", "Lives with others", "Facility"),
    fills: ["plan_goals_setting", "disaster_plan"],
    required: true,
    fromIntake: "living_situation",
  },
  {
    id: "housing_type",
    section: "The home",
    question: "What kind of home is it?",
    kind: "choice",
    options: opts("House", "Apartment", "Mobile unit"),
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "complex_name",
    section: "The home",
    question: "Name of the complex or park?",
    kind: "text",
    fills: ["disaster_plan"],
    showIf: (a) => a.housing_type === "apartment" || a.housing_type === "mobile_unit",
  },
  {
    id: "county",
    section: "The home",
    question: "Which county?",
    kind: "text",
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "next_of_kin",
    section: "The home",
    question: "Next of kin — name, phone and address?",
    kind: "longtext",
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "evacuation_risk",
    section: "The home",
    question: "If there were an evacuation order, could they get out?",
    helper: "The packet's at-risk criteria: alone and unable to self-evacuate, a caregiver who couldn't manage it, no financial means, or simply refusing to go.",
    kind: "multichoice",
    options: opts(
      "Can evacuate independently",
      "Alone and unable to self-evacuate",
      "Caregiver unable to carry out an evacuation",
      "No financial means to evacuate",
      "Would refuse to evacuate",
    ),
    fills: ["disaster_plan"],
    required: true,
  },
  {
    id: "high_risk_factors",
    section: "The home",
    question: "Any high-risk factors for the disaster plan?",
    kind: "multichoice",
    options: opts(
      "Bedbound", "Assistance", "Wheelchair", "Walker",
      "O2 dependent", "Ventilator", "CPAP",
      "IV pump", "Tube feeding", "Dialysis", "Infusion",
      "Visual", "Speech", "Hearing",
      "Daily wound care", "Unstable cardiac", "Seizures",
    ),
    fills: ["disaster_plan"],
    required: true,
  },

  // ------------------------------------------------------------ what care is
  {
    id: "services",
    section: "What care looks like",
    question: "Which services are we providing?",
    kind: "multichoice",
    options: opts(
      "Skilled nursing", "Aide", "Physical therapy", "Occupational therapy",
      "Speech therapy", "Social work",
      "Personal care", "Respite", "Companionship", "Light housekeeping",
    ),
    fills: ["agreement_services", "health_demographics"],
    required: true,
    fromIntake: "care_needs",
  },
  {
    id: "schedule_confirm",
    section: "What care looks like",
    question: "Confirm the days, times and weekly hours.",
    helper: "Carried from intake. This is what they sign, so read it back.",
    kind: "confirm",
    fills: ["agreement_services"],
    required: true,
    fromIntake: "requested_days",
  },
  {
    id: "duration",
    section: "What care looks like",
    question: "How long do we expect this to run?",
    kind: "choice",
    options: opts(
      "Until services are no longer needed",
      "Fixed end date",
      // Karynn, 21 August, on respite and post-surgical care: "They usually are
      // for care that is timed. Meaning, services will have a quicker
      // expiration date. Will be out of the home in a month or after they
      // recover." Recovery is a real third answer and it is not a date — a
      // post-surgical client leaves when they are better, which nobody can put
      // in a calendar at the kitchen table. Forcing it into "fixed end date"
      // produces a date somebody invented and everybody later treats as agreed.
      "Until they have recovered",
    ),
    fills: ["agreement_services"],
    required: true,
  },
  {
    id: "duration_end_date",
    section: "What care looks like",
    question: "What date does it run to?",
    kind: "text",
    helper: "The date the family expects care to stop. It can be extended.",
    fills: ["agreement_services"],
    showIf: (a) => a.duration === "Fixed end date",
    required: true,
  },
  {
    id: "interventions_personal",
    section: "What care looks like",
    question: "Personal care — what does the caregiver do?",
    kind: "multichoice",
    options: opts(
      "Assist to dress", "Bathing", "Comb/brush hair", "Shampoo hair", "Shave",
      "Nail care", "Foot care", "Pericare", "Skin care", "Oral hygiene/denture care",
      "Eating", "Meal prep", "Medication reminder",
    ),
    fills: ["plan_interventions"],
    required: true,
  },
  {
    id: "interventions_elimination",
    section: "What care looks like",
    question: "Anything around elimination?",
    kind: "multichoice",
    options: opts(
      "Assist w/bedside commode", "Assist with bed pan", "Catheter care",
      "Empty ostomy bag", "Incontinent care",
    ),
    fills: ["plan_interventions"],
  },
  {
    id: "interventions_activity",
    section: "What care looks like",
    question: "Activity and mobility support?",
    kind: "multichoice",
    options: opts(
      "Assist in ambulation", "Assist in transfer", "Turn of position",
      "Range of motion", "Light exercise",
    ),
    fills: ["plan_interventions"],
  },
  {
    id: "interventions_household",
    section: "What care looks like",
    question: "Household and social?",
    kind: "multichoice",
    options: opts(
      "Companion care", "Change linen", "Light housekeeping", "Make bed", "Laundry",
      "Escort outside home", "Shopping",
    ),
    fills: ["plan_interventions"],
  },
  {
    id: "goals",
    section: "What care looks like",
    question: "What are we trying to achieve?",
    kind: "multichoice",
    options: opts(
      "Effective/safe care", "Patient clean, comfortable", "Education/understanding care",
    ),
    fills: ["plan_goals_setting"],
    required: true,
  },

  // -------------------------------------------------------------------- safety
  {
    id: "vital_thresholds",
    section: "Safety",
    question: "Confirm when the caregiver should call you.",
    helper: "These are the packet's standard parameters. Change any that don't suit this client.",
    kind: "thresholds",
    fills: ["plan_vitals_dme", "emergency_care_plan"],
    required: true,
  },
  {
    id: "blood_sugar",
    section: "Safety",
    question: "Blood sugar thresholds?",
    helper: "The packet defaults to above 140 and below 70.",
    kind: "text",
    fills: ["emergency_care_plan"],
    showIf: (a) => /diabet/i.test(String(a.diagnoses ?? "")),
  },
  {
    id: "dme",
    section: "Safety",
    question: "What equipment is already in the home?",
    kind: "multichoice",
    options: opts(
      "Oxygen", "Nebulizer", "Bedside commode", "Elevated toilet seat",
      "Tub/shower bench", "Grab bars", "Walker", "Wheelchair", "Cane",
      "Crutches", "Hospital bed", "End table",
    ),
    fills: ["plan_vitals_dme", "equipment_authorization"],
    required: true,
  },
  {
    id: "supplies",
    section: "Safety",
    question: "Any supplies we need to provide?",
    kind: "multichoice",
    options: opts(
      "Briefs", "Chux/underpads", "Exam gloves", "Gauze pads", "Tape",
      "Alcohol pads", "Dressing supplies", "Diabetic supplies", "Foley catheter",
      "Leg bag", "Drainage bag", "Sharps container",
    ),
    fills: ["plan_vitals_dme", "equipment_authorization"],
  },

  // ------------------------------------------------------- directives & money
  {
    id: "advance_directive_status",
    section: "Directives",
    question: "Do they have an advance directive?",
    helper: "They do not need one to receive care — it is unlawful to require it. Just record what's true.",
    kind: "yes_no_copy",
    fills: ["advance_directive", "health_demographics"],
    required: true,
  },
  {
    id: "dnr_status",
    section: "Directives",
    question: "Is there a DNR order?",
    kind: "yes_no_copy",
    fills: ["advance_directive", "health_demographics"],
    required: true,
  },
  // ------------------------------------------------------- records & privacy
  {
    id: "ssn",
    section: "Paperwork",
    question: "Social security number.",
    helper:
      "Pages 12, 13 and 14 all ask for it. Ask once; it goes on all three. Skip it if they would rather write it on the paper copy themselves.",
    // Karynn needs this stored for real. Until there is somewhere safe to put
    // it, the prototype fills the packet and forgets it.
    kind: "text",
    fills: ["records_disclosure", "records_release", "disclosure_list"],
    // Not required. A client who declines to say it out loud still gets care,
    // and the packet can be completed on paper.
    restricted: true,
  },
  {
    id: "records_sources",
    section: "Paperwork",
    question: "Whose records should we ask for?",
    helper:
      "Hospitals, clinics, the pharmacy, any specialist. Naming them now saves a week of chasing later.",
    kind: "longtext",
    fills: ["records_release"],
    required: true,
  },
  {
    id: "records_scope",
    section: "Paperwork",
    question: "Which records do we need?",
    kind: "multichoice",
    options: [
      { value: "all_medical_records", label: "All medical records" },
      { value: "medication_list", label: "Medication list" },
      { value: "discharge_summary", label: "Discharge summary" },
      { value: "office_progress_notes", label: "Office/progress notes" },
      { value: "hospitalization_records", label: "Hospitalization records" },
      { value: "labs_radiology", label: "Labs/radiology reports" },
    ],
    fills: ["records_release"],
    required: true,
  },
  {
    id: "records_date_range",
    section: "Paperwork",
    question: "Covering what dates?",
    helper: "A start and an end date. The authorization expires twelve months after they sign either way.",
    kind: "text",
    fills: ["records_release"],
    required: true,
  },
  {
    id: "disclosure_people",
    section: "Paperwork",
    question: "Who may we talk to about their care?",
    helper:
      "Up to four people. Name, relationship, phone and address for each. Anyone not on this list gets nothing from us — say that plainly, because it includes family who call.",
    kind: "longtext",
    fills: ["disclosure_list"],
    required: true,
  },
  {
    id: "payer_source",
    section: "Paperwork",
    question: "Who is paying for this?",
    kind: "multichoice",
    options: [
      { value: "self_pay", label: "Self-pay" },
      { value: "insurance", label: "Insurance" },
      { value: "medicare", label: "Medicare" },
      { value: "medicaid", label: "Medicaid" },
      { value: "third_party", label: "3rd party payor" },
      { value: "grant", label: "Grant program" },
    ],
    fills: ["customer_rights"],
    required: true,
  },
  {
    id: "insurance_name",
    section: "Paperwork",
    question: "Which insurer, and what is the policy number?",
    kind: "text",
    fills: ["customer_rights"],
    required: true,
    showIf: (a) => {
      const payers = a.payer_source;
      return Array.isArray(payers) && payers.some((v) => v === "insurance" || v === "third_party");
    },
  },
  {
    id: "invoice_recipient",
    section: "Paperwork",
    question: "Who receives the invoices, and at what e-mail?",
    helper: "Name and e-mail. Rates go by e-mail separately, for financial privacy.",
    kind: "text",
    fills: ["agreement_payment"],
    required: true,
  },
  {
    id: "payment_method",
    section: "Paperwork",
    question: "How will they pay?",
    kind: "choice",
    options: opts("Debit card", "Credit card", "ACH"),
    fills: ["payment_preference"],
    required: true,
  },
];

/** Vital-sign parameters, defaulted from the packet. */
export const VITAL_DEFAULTS = [
  { key: "bp_low", label: "BP below", value: "70" },
  { key: "bp_high", label: "BP above", value: "150" },
  { key: "pulse_low", label: "Pulse below", value: "40" },
  { key: "pulse_high", label: "Pulse above", value: "130" },
  { key: "resp_low", label: "Resp below", value: "11" },
  { key: "resp_high", label: "Resp above", value: "26" },
  { key: "temp_low", label: "Temp below", value: "95" },
  { key: "temp_high", label: "Temp above", value: "101.3" },
  { key: "o2_low", label: "O2 sat below", value: "89" },
  { key: "weight_change", label: "Weight change (lbs/week)", value: "5" },
];

function answered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** Questions currently in play, given conditional logic. */
export function activeQuestions(answers: AssessmentAnswers): AssessmentQuestion[] {
  return ASSESSMENT_QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}

export interface PageCoverage {
  page: PacketPage;
  label: string;
  /** Questions that feed this page and are still unanswered. */
  missing: AssessmentQuestion[];
  complete: boolean;
  /** True when the signing session fills this page, not the assessment. */
  filledBySigning: boolean;
}

/**
 * Which packet pages the assessment can currently fill.
 *
 * This is the answer to "make sure the full packet is filled out" — it is
 * computed, not asserted, so it stays true as questions change.
 */
export function packetCoverage(answers: AssessmentAnswers): PageCoverage[] {
  const active = activeQuestions(answers);

  return (Object.keys(PACKET_PAGE_LABELS) as PacketPage[]).map((page) => {
    const feeding = active.filter((q) => q.fills.includes(page) && q.required);
    const missing = feeding.filter((q) => !answered(answers[q.id]));
    const filledBySigning = CONSENT_ONLY_PAGES.includes(page) && feeding.length === 0;

    return {
      page,
      label: PACKET_PAGE_LABELS[page],
      missing,
      complete: missing.length === 0,
      filledBySigning,
    };
  });
}

export function assessmentProgress(answers: AssessmentAnswers) {
  const active = activeQuestions(answers);
  const done = active.filter((q) => answered(answers[q.id])).length;
  return { done, total: active.length, percent: Math.round((done / active.length) * 100) };
}

export function missingRequired(answers: AssessmentAnswers): AssessmentQuestion[] {
  return activeQuestions(answers).filter((q) => q.required && !answered(answers[q.id]));
}

export function canCompleteAssessment(answers: AssessmentAnswers): boolean {
  return missingRequired(answers).length === 0;
}

export const ASSESSMENT_SECTIONS = [...new Set(ASSESSMENT_QUESTIONS.map((q) => q.section))];
