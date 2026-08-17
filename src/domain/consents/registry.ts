/**
 * The consent registry.
 *
 * Every item the client agrees to in the Patient Consents packet
 * (`docs/specs/Patient_Consents_Packet.pdf`), with the plain-language framing
 * the RN says out loud and the actual document text underneath.
 *
 * Two rules shape this file:
 *
 * 1. **The client signs once.** §19 and §36: one handwritten signature and one
 *    set of initials for the session, applied everywhere the packet asks. The
 *    family never signs the same sentence twice.
 *
 * 2. **Every consent still records its own decision.** Also §19. Some of these
 *    are genuinely refusable — a client may decline photographs or transport
 *    and still receive care. A packet that cannot record a refusal is not
 *    evidence of informed consent, it is evidence of a form being completed.
 *    That distinction is finding F4 in the build audit.
 *
 * `mandatory: true` means care cannot proceed without agreement, because the
 * item defines the service or the payment for it. Those still get an explicit
 * Agree; declining ends the admission rather than silently continuing.
 */

export type ConsentDecision = "agree" | "decline" | "not_applicable";

export type ConsentMark = "signature" | "initials";

export interface ConsentItem {
  key: string;
  /** Short title, as the RN would refer to it. */
  title: string;
  /** Which pages of the packet this covers, for the review list. */
  pages: string;
  /** What the RN says out loud. Plain language, not legalese. */
  say: string;
  /** The thing people misunderstand — surfaced so the RN can pre-empt it. */
  watchFor?: string;
  /** Whether the packet takes a full signature or initials here. */
  mark: ConsentMark;
  /** False when the client may decline and still receive care. */
  mandatory: boolean;
  /** True when "not applicable" is a legitimate answer. */
  allowNotApplicable?: boolean;
  /** Verbatim from the packet, shown when the client asks to read it. */
  fullText: string;
}

export const CONSENTS: ConsentItem[] = [
  {
    key: "services_and_schedule",
    title: "What we will do, and how often",
    pages: "1",
    say: "Read back the services, the days and the weekly hours. If anything is wrong, fix it now — they should not sign a schedule they did not agree to.",
    watchFor: "People hear the hours as a maximum. They are a commitment. Say the weekly total out loud.",
    mark: "signature",
    mandatory: true,
    fullText:
      "I, the undersigned, hereby make the following acknowledgement and agreements regarding services to be provided by Joy Healthcare Services, LLC. I agree to enter into an agreement for the following services. Joy Healthcare Services, LLC. agrees to provide the following services: [services, frequency, days, start and end time, total weekly hours], for the duration specified, or until services are no longer needed.",
  },
  {
    key: "fee_for_service",
    title: "The rates, and that they were sent to you",
    pages: "2",
    say: "Confirm they received the rates by e-mail. The rates are not in this packet on purpose — they go by e-mail for financial privacy.",
    mark: "initials",
    mandatory: true,
    fullText:
      "I confirm that a representative from Joy Healthcare Services, LLC. has confirmed and reviewed the service rates. These agreed-upon rate(s) have been documented, confirmed, and e-mailed to me to ensure financial privacy.",
  },
  {
    key: "deposit",
    title: "The deposit",
    pages: "2",
    say: "One week of the agreed hours, held as a deposit, and it goes toward the first weeks of service — it is not an extra charge.",
    mark: "initials",
    mandatory: true,
    fullText:
      "DEPOSIT: 1x the agreed upon hours/days per week. The deposit will be used toward the first weeks of service.",
  },
  {
    key: "holiday_overtime",
    title: "Holiday and overtime rates",
    pages: "2",
    say: "Time and a half over 40 hours a week, and on seven named holidays.",
    watchFor: "Name the holidays if they are scheduling around one. New Year's Day, Memorial Day, Easter Sunday, Independence Day, Labor Day, Thanksgiving, Christmas.",
    mark: "initials",
    mandatory: true,
    fullText:
      "I understand that Joy Healthcare Services, LLC. will bill at a rate of 1 1/2 times the hourly rate for overtime (Overtime is considered anything over 40 hours) and service(s) provided on the following holidays: New Year's Day, Memorial Day, Easter Sunday, Independence Day, Labor Day, Thanksgiving Day, Christmas Day.",
  },
  {
    key: "invoicing",
    title: "Invoicing and when payment is due",
    pages: "2",
    say: "Invoiced weekly in advance, payment due within one calendar day. Say the three numbers: 2.9% on credit cards, $5 on ACH, $100 late fee after the third day.",
    watchFor: "Service can be suspended within 24 hours of non-payment. This is the clause families are most surprised by later — do not rush it.",
    mark: "initials",
    mandatory: true,
    fullText:
      "I understand Joy Healthcare Services, LLC. will invoice every week in advance. Due to billing in arrears, the undersigned agrees to submit payment within 1 calendar day. Payments will be collected via credit card, debit card, auto-pay, or ACH depending on your preference. The undersigned will be legally responsible for all collection activity fees; legal fees incurred by Joy Healthcare Services, LLC. for collecting on delinquent invoices/monies owed to Joy Healthcare Services, LLC. Joy Healthcare Services, LLC applies a 2.9% convenience fee to all credit card payments and a $5 convenience fee to ACH debit payments. A fee will also apply to any outstanding invoice not paid in full within two (2) business days. Services may be suspended within 24 hours of non-payment. A late fee will incur after the third day of an outstanding invoice of $100. If a third party is utilized for payment of services, it is still the sole responsibility of the undersigned to ensure Joy Healthcare Services, LLC. receives payment on-time.",
  },
  {
    key: "payment_method",
    title: "How you will pay",
    pages: "4",
    say: "Debit card, credit card or ACH. Pick one now — this is the electronic payment preference and it needs their signature.",
    mark: "signature",
    mandatory: true,
    fullText:
      "ELECTRONIC PAYMENT PREFERENCE: Debit Card / Credit Card / ACH. Payments will be collected via the selected method according to the invoicing terms agreed above.",
  },
  {
    key: "changes_and_cancellation",
    title: "Changing or cancelling care",
    pages: "3",
    say: "How to change the schedule and how to end services. Cover the notice period.",
    watchFor: "A cancellation after the caregiver has arrived is still billable. Say that plainly now rather than arguing about it later.",
    mark: "signature",
    mandatory: true,
    fullText:
      "CHANGES TO POLICY / CANCELLATION OF POLICY: Joy Healthcare Services, LLC. reserves the right to amend this policy. Cancellation terms apply where a staff member has arrived at the client's home, services are declined, and no prior notification of cancellation has been given.",
  },
  {
    key: "informed_consent_care",
    title: "Consent for care, and what our caregivers cannot do",
    pages: "5–6",
    say: "What home care is and is not. Be specific about the limits — caregivers are not nurses unless skilled nursing is on the plan.",
    watchFor: "Families often assume medication administration is included. Reminders are not administration.",
    mark: "signature",
    mandatory: true,
    fullText:
      "INFORMED CONSENT FOR HOME HEALTH/HOME CARE SERVICES. Home Health/Home Care philosophy, criteria for services, the scope of home health and home care services, respite care and continuous care as described in the packet. I consent to the provision of these services as described and understand the limits of non-skilled care.",
  },
  {
    key: "equipment_supplies_payment",
    title: "Equipment, supplies and authorization for payment",
    pages: "6",
    say: "Who pays for supplies and equipment, and the authorization for payment.",
    mark: "initials",
    mandatory: true,
    fullText:
      "EQUIPMENT/SUPPLIES and AUTHORIZATION FOR PAYMENT as set out in the packet. I authorize payment for services and any equipment or supplies provided, in accordance with the agreed rates.",
  },
  {
    key: "complaints",
    title: "How to complain about us",
    pages: "7",
    say: "Give them the number: 713 231 9662, staffed 24 hours. Then give them the state number too — they are entitled to go over our heads.",
    watchFor: "Do not skip the HHSC contact. Offering it builds more trust than withholding it.",
    mark: "initials",
    mandatory: true,
    fullText:
      "COMPLAINTS POLICY: Our commitment to quality of care and a positive experience for your family remains our team's primary goal. Please call Joy Healthcare with any complaints or concerns: 713 231 9662. A staff member is available 24 hours a day, 7 days a week. For complaints or questions regarding home health/care services: HHSC Complaint and Incident Intake, Mail Code E249, P.O. Box 149030, Austin, Texas 78714-9030. Toll Free: 1-800-458-9858 (7AM–7PM Mon–Fri). crscomplaints@hhscdads.state.tx.us. The Home Health agency or the Patient's Physician may be forced to refer the patient to another source of care if the patient's refusal to comply with the plan of care threatens to compromise the provider's commitment to quality of care.",
  },
  {
    key: "advance_directive",
    title: "Advance directives",
    pages: "8",
    say: "Explain what an advance directive is, and say clearly that they do not need one to receive care.",
    watchFor: "It is unlawful to require one. If they do not have one, that is a complete answer — record it and move on.",
    mark: "initials",
    // Genuinely optional. Federal law forbids requiring one as a condition of
    // service, so this cannot be mandatory.
    mandatory: false,
    allowNotApplicable: true,
    fullText:
      "PATIENT SELF DETERMINATION ACT. The United States government and most individual state governments have enacted laws that protect the rights of adult individuals to make decisions concerning their own health care. These rights include the right to accept or refuse medical or surgical treatment and the right to formulate advance directives as permitted under state law. AN ADVANCE DIRECTIVE is a living will, a durable power of attorney for health care and/or another written document executed by the individual, signed, dated, and expressing the individual's health care treatment decisions; it provides a way for the individual to state his/her wishes regarding his/her own health care decisions should the individual become incapacitated. Under these laws, it is unlawful for any person or organization to require an individual to execute advance directives as a condition for receiving services or care. An individual is not required to have an advance directive in order to receive Home Health services.",
  },
  {
    key: "non_solicitation_statement",
    title: "Nobody pressured you to choose us",
    pages: "8",
    say: "A statement that no employee solicited them — choosing Joy was their decision.",
    mark: "initials",
    mandatory: true,
    fullText:
      "NON-SOLICITATION STATEMENT: It is Joy Healthcare's Policy to abide by all State and Federal Regulations regarding solicitation of patients for Home Health/Care services. This form serves as a statement that no Joy Healthcare employee or contracted employee solicited any patient or patient care giver for Home Health services. This is the sole decision of the patient and/or patient's legal representative to select Joy Healthcare as the chosen Home Health/Care provider.",
  },
  {
    key: "non_solicitation_agreement",
    title: "Please do not hire our caregivers directly",
    pages: "9",
    say: "They agree not to recruit our caregivers, during care and for six months after.",
    watchFor: "Say the six months out loud. Families sometimes think this ends when care ends.",
    mark: "signature",
    mandatory: true,
    fullText:
      "NON-SOLICITATION AGREEMENT: It is Joy Healthcare's Policy to abide by all State and Federal Regulations regarding solicitation of patients for Home Health/Care services. This form serves as an agreement that family members are prohibited from directly or indirectly soliciting, recruiting, or encouraging Joy Healthcare's employees to leave their employment with the company. This includes but is not limited to: contacting employees for the purpose of discussing potential job opportunities outside of Joy Healthcare; providing information about job openings at other organizations to Joy Healthcare's employees; attempting to influence Joy Healthcare's employees to resign or accept employment elsewhere, including but not limited to the patient's home/residence or any location that the patient is residing. During the term of care under Joy Healthcare and for six (6) months after employment is terminated, you will not indirectly or directly solicit to hire, hire, or engage with any individual who is engaged as a consultant, contractor, or is employed by Joy Healthcare. All employees and their family members are required to acknowledge receipt and understanding of this Non-Solicitation Policy. Failure to comply with the policy may result in termination of services and a fine.",
  },
  {
    key: "disaster_plan",
    title: "The disaster and evacuation plan",
    pages: "14",
    say: "Their emergency information and permission to share it with responders if there is a storm or evacuation.",
    watchFor: "This is the form that matters in a hurricane. Confirm next of kin and the pharmacy are right.",
    mark: "signature",
    mandatory: true,
    fullText:
      "AT RISK EVALUATION AND DISASTER PLAN. I grant permission to medical providers, transportation providers, and other care providers as necessary, to provide care and disclose any information necessary to respond to my needs.",
  },
  {
    key: "emergency_care_plan",
    title: "When to call us, and when to call 911",
    pages: "16",
    say: "Walk the list of signs. Tell them where to keep it — this is the page that goes on the fridge.",
    watchFor: "Confirm they know we answer 24 hours, including nights and holidays. People wait until morning when they should not.",
    mark: "signature",
    mandatory: true,
    fullText:
      "EMERGENCY CARE PLAN. This plan outlines signs/symptoms that should be called in to the nurse and what to do in case of an emergency. Please keep this information where you can find it. Our agency has staff on call 24 hours a day including nights, weekends, and holidays.",
  },
  {
    key: "transportation",
    title: "Driving them places",
    pages: "12",
    say: "Whether caregivers may transport them, and in whose vehicle.",
    watchFor: "Declining this is fine and common. It changes what the caregiver can do, so scheduling needs to know.",
    mark: "initials",
    // Refusable. Declining transport does not end care — it constrains it.
    mandatory: false,
    allowNotApplicable: true,
    fullText:
      "TRANSPORTATION: consent for Joy Healthcare caregivers to provide transportation or escort outside the home as part of the plan of care, subject to the agency's transportation policy and insurance requirements.",
  },
];

/** Consents the client may decline and still receive care. */
export const OPTIONAL_CONSENT_KEYS = CONSENTS.filter((c) => !c.mandatory).map((c) => c.key);

export type ConsentDecisions = Record<string, ConsentDecision | undefined>;

export interface ConsentReadiness {
  decided: number;
  total: number;
  /** Consents with no decision yet. Signing is gated on this being empty. */
  undecided: ConsentItem[];
  /** Mandatory consents that were declined — these end the admission. */
  blockingDeclines: ConsentItem[];
  /** Optional consents declined. Care proceeds; downstream must be told. */
  optionalDeclines: ConsentItem[];
  canSign: boolean;
}

/**
 * Whether the packet is ready for signature.
 *
 * Gated on every consent having *a decision* — not on every consent being
 * agreed. That is the distinction the approved design missed: it required all
 * twelve to be "marked", which made declining impossible.
 */
export function consentReadiness(decisions: ConsentDecisions): ConsentReadiness {
  const undecided = CONSENTS.filter((c) => !decisions[c.key]);
  const blockingDeclines = CONSENTS.filter((c) => c.mandatory && decisions[c.key] === "decline");
  const optionalDeclines = CONSENTS.filter((c) => !c.mandatory && decisions[c.key] === "decline");

  return {
    decided: CONSENTS.length - undecided.length,
    total: CONSENTS.length,
    undecided,
    blockingDeclines,
    optionalDeclines,
    canSign: undecided.length === 0 && blockingDeclines.length === 0,
  };
}

/**
 * What downstream needs to know about declines.
 *
 * A declined transport consent has to reach scheduling; a declined advance
 * directive has to reach the care plan. Recording the decision is only half the
 * job — carrying it forward is the other half.
 */
export function declineConsequences(decisions: ConsentDecisions): string[] {
  const out: string[] = [];
  if (decisions.transportation === "decline") {
    out.push("Caregivers must not drive this client. Scheduling and the care plan need to reflect that.");
  }
  if (decisions.advance_directive === "decline" || decisions.advance_directive === "not_applicable") {
    out.push("No advance directive on file. Record it on the plan of care; it does not affect eligibility for care.");
  }
  return out;
}
