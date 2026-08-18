/**
 * The consent registry.
 *
 * Every item the client agrees to in the Patient Consents packet
 * (`docs/specs/Patient_Consents_Packet.pdf` — 26 pages), with the plain-language
 * framing the RN says out loud and the actual document text underneath.
 *
 * `pages` on each entry cites the packet page it comes from. Those citations are
 * load-bearing: the registry was first written from a partial reading that
 * stopped at page 9, which silently dropped nine consents including the
 * photograph authorization and every records and privacy page. The tests assert
 * the count, the ordering and that no entry cites a page beyond 26.
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

/**
 * The packet's natural chapters.
 *
 * Twenty-five consents in one unbroken list is a wall. The RN needs somewhere to
 * pause — "that's the money side done, now the permissions" — and the client
 * needs to feel the end approaching. These are the packet's own divisions, not
 * an invented taxonomy.
 */
export type ConsentGroup = "agreement" | "consent_to_care" | "permissions" | "records" | "rights";

export const CONSENT_GROUPS: Array<{ group: ConsentGroup; title: string; blurb: string }> = [
  {
    group: "agreement",
    title: "The agreement and what it costs",
    blurb: "Services, rates, invoicing and cancellation. The part families ask about later.",
  },
  {
    group: "consent_to_care",
    title: "Consent to care",
    blurb: "Permission to treat, and confirmation they have the folder in their hands.",
  },
  {
    group: "permissions",
    title: "Optional permissions",
    blurb: "Photographs and transport. Both can be refused without affecting care — say so first.",
  },
  {
    group: "records",
    title: "Records and privacy",
    blurb: "Who may send us records, who we may send them to, and who we may talk to.",
  },
  {
    group: "rights",
    title: "Rights, complaints and emergencies",
    blurb: "Their rights, how to complain about us, and what to do in a storm or an emergency.",
  },
];

export interface ConsentItem {
  key: string;
  /** Short title, as the RN would refer to it. */
  title: string;
  /** Which pages of the packet this covers, for the review list. */
  pages: string;
  /** Which chapter of the review this belongs to. */
  group: ConsentGroup;
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
    group: "agreement",
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
    pages: "2, 4",
    group: "agreement",
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
    group: "agreement",
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
    group: "agreement",
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
    group: "agreement",
    say: "Invoiced weekly in advance, payment due within one calendar day. Say the three numbers: 2.9% on credit cards, $5 on ACH, $100 late fee after the third day.",
    watchFor: "Service can be suspended within 24 hours of non-payment. This is the clause families are most surprised by later — do not rush it.",
    mark: "initials",
    mandatory: true,
    fullText:
      "I understand Joy Healthcare Services, LLC. will invoice every week in advance. Due to billing in arrears, the undersigned agrees to submit payment within 1 calendar day. Payments will be collected via credit card, debit card, auto-pay, or ACH depending on your preference. The undersigned will be legally responsible for all collection activity fees; legal fees incurred by Joy Healthcare Services, LLC. for collecting on delinquent invoices/monies owed to Joy Healthcare Services, LLC. Joy Healthcare Services, LLC applies a 2.9% convenience fee to all credit card payments and a $5 convenience fee to ACH debit payments. A fee will also apply to any outstanding invoice not paid in full within two (2) business days. Services may be suspended within 24 hours of non-payment. A late fee will incur after the third day of an outstanding invoice of $100. If a third party is utilized for payment of services, it is still the sole responsibility of the undersigned to ensure Joy Healthcare Services, LLC. receives payment on-time.",
  },
  {
    key: "changes_and_cancellation",
    title: "Changing or cancelling care",
    pages: "3",
    group: "agreement",
    say: "How to change the schedule and how to end services. Cover the notice period.",
    watchFor: "A cancellation after the caregiver has arrived is still billable. Say that plainly now rather than arguing about it later.",
    mark: "signature",
    mandatory: true,
    fullText:
      "CHANGES TO POLICY / CANCELLATION OF POLICY: Joy Healthcare Services, LLC. reserves the right to amend this policy. Cancellation terms apply where a staff member has arrived at the client's home, services are declined, and no prior notification of cancellation has been given.",
  },
  {
    key: "payment_method",
    title: "How you will pay",
    pages: "4",
    group: "agreement",
    say: "Debit card, credit card or ACH. Pick one now — this is the electronic payment preference and it needs their signature.",
    mark: "signature",
    mandatory: true,
    fullText:
      "ELECTRONIC PAYMENT PREFERENCE: Debit Card / Credit Card / ACH. Payments will be collected via the selected method according to the invoicing terms agreed above.",
  },
  {
    key: "informed_consent_care",
    title: "Consent for care, and what our caregivers cannot do",
    pages: "5–6",
    group: "agreement",
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
    group: "agreement",
    say: "Who pays for supplies and equipment, and the authorization for payment.",
    mark: "initials",
    mandatory: true,
    fullText:
      "EQUIPMENT/SUPPLIES and AUTHORIZATION FOR PAYMENT as set out in the packet. I authorize payment for services and any equipment or supplies provided, in accordance with the agreed rates.",
  },
  {
    key: "consent_for_care",
    title: "Consent for care, the client folder and release of information",
    pages: "7",
    group: "consent_to_care",
    say: "The consent to treat itself. Also confirms they have the admission folder, the privacy notice and the bill of rights in their hands.",
    watchFor:
      "Do not initial this until the folder is physically with them. It also says clinical staff are Monday–Friday 8–5 with a 24/7 on-call line for non-clinical questions — people hear \"24/7 nurse\" and are disappointed later.",
    mark: "initials",
    mandatory: true,
    fullText:
      "CONSENT FOR CARE: I hereby consent to the care provided by Joy Healthcare and authorize its agents and associates to provide care and treatment to me in my residence or facility according to program policy and as prescribed by my doctor, other healthcare provider(s), and/or Joy Healthcare's interdisciplinary team. I have been instructed by my doctor, other healthcare provider(s), and/or Joy Healthcare's interdisciplinary team about the prescribed treatment and understand the reasons it is considered necessary, along with its risks, advantages, possible complications, and alternatives. A representative of Joy Healthcare has explained the services and adequately answered all my questions. I understand that the goal of Home Health is to treat an illness or injury, while the goal of Homecare is to aid in recovery, regain independence, become more self-sufficient, maintain my current condition or level of function, and/or slow decline. I understand that clinical staff and nurses are available Monday through Friday, 8 AM to 5 PM, and that an on-call representative is available 24/7 to answer non-clinical questions. I agree to notify Joy Healthcare of any significant changes or concerns related to my health. I understand that I may refuse treatment or terminate services at any time, and that Joy Healthcare may terminate their services to me as explained in my orientation. ACKNOWLEDGEMENT OF CLIENT FOLDER: I acknowledge receipt of the Client Admission Folder, including the Notice of Privacy Practices and Bill of Rights, and confirm my understanding and agreement with its contents. RELEASE OF INFORMATION/PRIVACY LAW: I acknowledge receipt of the Notice of Privacy Practices and was given the opportunity to ask questions and voice concerns. I hereby authorize Joy Healthcare to release to or receive from hospitals, physicians, or other agencies involved in my case all medical records and information pertinent to my care. I also give permission for my medical record to be reviewed by accrediting agencies and/or other regulatory bodies. ACCESS INFORMATION: I have completed the Permission to Disclose Protected Health Information Form and understand that only those names whom I have listed may communicate with Joy Healthcare staff regarding my healthcare.",
  },
  {
    key: "customer_rights",
    title: "Rights, safety, after hours and filming for our records",
    pages: "8",
    group: "consent_to_care",
    say: "Their rights and responsibilities, what to do after hours, and who we bill. Confirm they know to call 911 first for a medical emergency.",
    watchFor:
      "This page contains its own consent to film or record for internal and insurance documentation. That is separate from the photograph consent on page 10 — if they refuse photographs, say so here too and note it.",
    mark: "initials",
    mandatory: true,
    fullText:
      "CUSTOMER RIGHTS/RESPONSIBILITIES: I have received a copy and an explanation of the Patient Bill Of Rights and Responsibilities. I acknowledge that I have been made aware of my rights and responsibilities as a customer and I understand them. I understand I have the right to choose my health care provider/agency, and I choose Joy Healthcare for my home health/care services. SAFETY/COMPLAINTS: I have received information regarding safety issues that I may encounter during my illness. Grievance and Complaint procedures have been explained to me. Joy Healthcare Services, LLC. and its employees are mandated reporters of suspected abuse and will report concerns as required by Texas state law. EDUCATIONAL MATERIAL: I acknowledge receipt of educational materials and have been given an explanation of all services, equipment, and supplies. A home safety assessment was conducted during the admission process. AFTER HOURS/EMERGENCY INFORMATION: I understand for medical emergencies to call 9-1-1. I have been informed on how and when to contact Joy Healthcare in the event of an emergency or after hours. ADVANCE DIRECTIVES: I have received an explanation and written information regarding Texas Advance Directives. CONSENT TO FILM/RECORD: I hereby consent for Joy Healthcare to record or film my care, treatment and services and allow Joy Healthcare to use the photographs/recordings for their internal use, for documenting my medical condition or for insurance providers to document my condition for payment purposes. LIABILITY/ASSIGNMENT OF PAYMENT: I further understand services provided by Joy Healthcare will be billed out to: Medicare / Medicaid / Insurance / Self-Pay / 3rd Party Payor / Grant Program.",
  },
  {
    key: "documents_reviewed",
    title: "Everything we went through today",
    pages: "9",
    group: "consent_to_care",
    say: "The checklist of what was reviewed before care starts. Read it as a list — it is the page a surveyor turns to first.",
    watchFor:
      "Only sign this once the items above it are genuinely done. It asserts the folder, the rights, the transfer and discharge policy and the complaint route were all explained.",
    mark: "signature",
    mandatory: true,
    fullText:
      "A representative from Joy Healthcare has reviewed the following documents prior to the start of home health/care services: I have been informed in a language and agree to the Authorization To Obtain & Release Medical Records. I have been informed and agree to the Patient/Client Service Agreement. I have been informed and agree to the Informed Consent For Home Health and/or Home care Services. I have received a copy and an explanation of my Patient Rights and Responsibilities. I have received a copy and an explanation of the Agency's transfer and discharge policies. I have received a copy and an explanation of Solicitation. I have been informed of my rights in a language and manner that I understand. I have received and understand the contact information including the names, addresses, and telephone numbers of the Agency Administrator, Clinical Manager(s), and Federal/State funded entities that serve the area where I reside. I have been notified of my right to voice a complaint and understand that I may first file a complaint with the Agency Administrator or designee at the above referenced phone number. I can also contact the State Home Health Hotline. I have received information on Advance Directives. I understand that it is in my right and responsibility to be involved in my care and that I will be informed as to the nature and purpose of any technical procedure. I have received and reviewed my plan of care/service agreement. I agree to the services that will be rendered and have no further questions. I have been informed what to do in an emergency/natural disaster. I have been informed verbally and in writing regarding the Agency policy on hazardous waste disposal in the home. I have been advised verbally and in writing the purpose and my rights pertaining to the collection of OASIS information and the OASIS Privacy Act. I have received the HIPAA/Notice of Privacy Practices and consent to the Agency's use and/or disclosure of protected health information for payment, treatment and the Agency's Health care operations.",
  },
  {
    key: "photograph",
    title: "Photographs and video of their care",
    pages: "10",
    group: "permissions",
    say: "Permission to photograph or film while we care for them, used for treatment purposes only.",
    watchFor:
      "The packet says outright they may refuse and it will not affect their care or payment. Say that before asking. They also get no payment for it, and can stop the filming at any time.",
    mark: "signature",
    // The packet is explicit: "I may refuse to sign this Authorization. My
    // refusal will not affect my ability to obtain treatment or payment or
    // eligibility." Modelling this as mandatory would misstate the document.
    mandatory: false,
    allowNotApplicable: true,
    fullText:
      "CONSENT TO PHOTOGRAPH. I hereby consent to be photographed while receiving care from Joy Healthcare. The term \"photograph\" includes video or still photography, in digital or any other format, and any other means of recording or reproducing images. I hereby authorize the use of the photograph(s) by, or disclosure of the photograph(s) to: Joy Healthcare Services, 2700 Post Oak Blvd. Ofc 22-151, Galleria Office Tower 1, Houston, TX 77056-5784. PURPOSE: I hereby authorize the use or disclosure of the photograph(s) for treatment purposes. EXPIRATION: The Authorization expires at the end of rendered services or by written revocation of termination. Upon expiration of this Authorization, Joy Healthcare will not permit further release of any photograph(s), and will not be able to call back any photographs or information already released. MY RIGHTS: I may request cessation of filming or recording at any time. I may rescind this Authorization up until a reasonable time before the photograph is used, but I must do so in writing and submit it to the address listed above. I may inspect or obtain a copy of any photograph whose use or disclosure I am authorizing. I may refuse to sign this Authorization. My refusal will not affect my ability to obtain treatment or payment or eligibility. I have a right to receive a copy of this Authorization. I understand that I will not receive any financial compensation.",
  },
  {
    key: "transportation",
    title: "Driving them places",
    pages: "11",
    group: "permissions",
    say: "Whether a caregiver may drive them — appointments, errands, social outings — in the caregiver's own car.",
    watchFor:
      "Say the insurance sentence out loud. Joy carries no commercial auto cover, and the caregiver's personal policy is what applies. Mileage is billed separately at $0.70 a mile, plus parking and tolls.",
    mark: "signature",
    // Refusable. Declining transport does not end care — it constrains it.
    mandatory: false,
    allowNotApplicable: true,
    fullText:
      "NON-MEDICAL TRANSPORTATION CONSENT & AGREEMENT. At Joy Health, we are committed to providing safe, supportive, and seamless care experiences, including transportation as part of our concierge-level services. I authorize Joy Healthcare Services, LLC (\"Joy Health\") to provide non-medical transportation for the above named patient. SCOPE OF TRANSPORTATION: Transportation may include medical appointments, errands, and social outings as agreed upon within the care plan. CAREGIVER USE OF VEHICLE: Transportation is provided by a caregiver using a personal vehicle. Caregivers are not licensed medical transport providers. INSURANCE & LIABILITY: All caregivers maintain personal auto insurance in accordance with Texas state requirements. Joy Health does not provide commercial auto insurance coverage for caregiver vehicles and is not responsible for incidents, delays, or accidents that may occur during transport, except in cases of gross negligence. CLIENT RESPONSIBILITIES: The client agrees to be ready at the scheduled time, wear a seatbelt at all times, and follow all safety guidance provided by the caregiver. SAFETY CONDITIONS: Services may be adjusted, delayed, or declined if conditions are deemed unsafe, including but not limited to weather, environment, or changes in client condition. MILEAGE & FEES: Mileage may be billed separately at a rate determined by Joy Health ($0.70 per mile). Additional expenses such as parking or tolls may apply. ACKNOWLEDGMENT & CONSENT: By signing below, I acknowledge and accept the terms of this agreement and consent to transportation services provided.",
  },
  {
    key: "disclose_medical_records",
    title: "Letting other providers send us their records",
    pages: "12",
    group: "records",
    say: "Permission for their doctors, hospitals, labs and pharmacy to send us what they hold, so we are not working blind.",
    watchFor:
      "This one names HIV and AIDS, drug and alcohol use, and mental health history explicitly. Read that sentence rather than skating over it — a client who did not realise is entitled to be surprised. Valid one year; revocable in writing.",
    mark: "signature",
    mandatory: true,
    fullText:
      "AUTHORIZATION TO DISCLOSE MEDICAL RECORDS. I authorize any health care provider including, but not limited to, any health care professional, hospital, clinic, laboratory, pharmacy or other medically related facility or service that has information about my health to disclose any and all of this information to Joy Healthcare Services, LLC and its duly authorized representatives. Information about my health may relate to any disorder of the immune system including, but not limited to, HIV and AIDS; use of drugs and alcohol; and mental and physical history, condition, advice or treatment, but does not include psychotherapy notes. I understand any information Joy Healthcare obtains pursuant to this authorization will be used for home health and/or homecare services. I further understand that the information is subject to redisclosure and might not be protected by certain federal regulations governing the privacy of health information. This authorization is valid for one (1) year from the date below. A photographic or electronic copy of this authorization is as valid as the original. I understand I am entitled to receive a copy of this authorization. I may revoke this authorization in writing at any time except to the extent Joy Healthcare has relied on the authorization prior to notice of revocation. I understand if I revoke, alter, or do not sign this authorization, Joy Healthcare may not be able to provide the services described above. I understand this authorization will remain in effect until I revoke it in writing.",
  },
  {
    key: "obtain_release_medical_records",
    title: "Sending their records out to someone else",
    pages: "13",
    group: "records",
    say: "The other direction: who we may send records to, which records, and covering what dates.",
    watchFor:
      "Do not leave the record types or the date range blank. This one expires twelve months from signature, not at end of service.",
    mark: "signature",
    mandatory: true,
    fullText:
      "AUTHORIZATION TO OBTAIN & RELEASE MEDICAL RECORDS. I hereby authorize the named provider to disclose the health records of the named individual. I am requesting that the Provider copy the following records and send the records to the named requester. DATES OF DISCLOSURE: from the beginning date to the end date stated. Records will be used for the purpose to render care/services. INFORMATION TO BE DISCLOSED: All Medical Records; Medication List; Discharge Summary; Office/Progress Notes; Hospitalization Records; Labs/Radiology Reports; other pertinent information. I understand I have the right to inspect and/or request a copy of the information to be disclosed and I may withdraw this authorization in writing at any time, except to the extent that action has been taken based on this authorization. I understand this authorization shall expire, without my expressed revocation, twelve (12) months from the date of signature. I am aware that once this information has been disclosed per my instructions, the information is subject to re-disclosure and may no longer be protected by the Federal Privacy Law of 1996 (HIPAA). If the patient is unable to sign, please indicate such and the authority to act of the person who is signing for the patient. The agency/facility, its employees, officers, and physicians are hereby released from any legal responsibility or liability for disclosure of the above information to the extent indicated and authorized herein.",
  },
  {
    key: "disclosure_list",
    title: "Who we are allowed to talk to about them",
    pages: "14",
    group: "records",
    say: "The names of the people we may discuss their care with. Up to four. Everyone else gets nothing, including family.",
    watchFor:
      "Get the relationship and a phone number for each, not just a first name. If they name nobody, that is a valid answer and the office needs to know it — we will not be able to update a daughter who calls.",
    mark: "signature",
    // Naming nobody is a legitimate and lawful choice. It constrains who the
    // office may speak to; it does not stop care.
    mandatory: false,
    allowNotApplicable: true,
    fullText:
      "HEALTH INFORMATION AUTHORIZED DISCLOSURE LIST. The patient or the authorized patient representative has given Joy Healthcare permission to disclose the patient's protected health information to the following individuals (up to four, each with name, relationship, phone, address and city/state/zip).",
  },
  {
    key: "hipaa_privacy",
    title: "The privacy notice",
    pages: "15",
    group: "records",
    say: "How their health information may be used and disclosed, and how they can see it. They keep a copy.",
    watchFor:
      "Give them the Privacy Officer by name and number: Karynn Verrett RN, BSN, CCM at 713 857 8353. They may ask us to restrict how their information is used — we weigh those requests and are not obliged to agree.",
    mark: "initials",
    mandatory: true,
    fullText:
      "HIPAA PRIVACY RULE RECEIPT OF INFORMATION PRIVACY PRACTICES. Consent For The Use And Disclosure Of Protected Health Information For Treatment, Payment, Or Health Care Options. I understand that as part of my continued health care, Joy Healthcare, and its affiliated companies create and maintain health records containing information about my individual health history, symptoms, examination, and test results, diagnosis and treatments provided to me, future treatment plans and payment for care provided to me. I understand that this information serves as: a record indicating my care and treatment; a communication instrument among the many health professionals who contribute to my care; a history of diagnosis and treatment information utilized in the billing process; a verification source available to Medicare and Medicaid to review against billed and provided services; an assessment tool defining quality and reviewing competence of health care professionals. I understand that I have the right to request restrictions as to how my health information may be used or disclosed to carry out treatment, payment or health care operations, that Joy Healthcare will weigh those requests and abide with all mutually agreed upon restrictions. Joy Healthcare is not required to agree to the restrictions requested. NOTICE OF PRIVACY PRACTICES: This notice describes how medical information about you may be used and disclosed and how you can obtain access to this information. If you have any questions about this Notice of Privacy Practices, please contact our Privacy Officer: Karynn Verrett RN, BSN, CCM at 713 857 8353. We are required to abide by the terms of this Notice of Privacy Practices. We may change the terms of our notice at any time; the new notice will be effective for all protected health information maintained at that time. Upon your request, the facility will provide you with any revised Notice of Privacy Practices. Your protected health information may be used and disclosed by Joy Healthcare, the office staff, and others outside the office who are involved in your care and treatment, to pay your medical care bills, and to support the operation of Joy Healthcare.",
  },
  {
    key: "bill_of_rights",
    title: "The patient's bill of rights",
    pages: "16–17",
    group: "rights",
    say: "Their rights: dignity, privacy, knowing what care costs before it starts, refusing care, and changing caregiver without any fear of reprisal.",
    watchFor:
      "The right to request a different caregiver without reprisal is the one clients most need to hear said out loud. So is the 30-day rule: we must tell them in writing within 30 days if what they owe changes.",
    mark: "initials",
    mandatory: true,
    fullText:
      "PATIENT'S BILL OF RIGHTS. The patient has the right to be informed of his or her rights. Joy Healthcare must protect and promote the exercise of these rights, and must provide the patient with written notice of the patient's rights in advance of furnishing care or during the initial evaluation visit before the initiation of care. FINANCIAL: Patients and families have the right to be advised, before care is initiated, of the extent to which payment for Home Health services may be expected from third party payers or other financial sources, and the extent to which payment may be required from the patient; to be advised orally and in writing of any changes in the liability as soon as possible, but no later than 30 calendar days from the date that the Home Health agency becomes aware of a change; to have access, upon request, to all bills for services the patient has received regardless of whether they are paid out of pocket or by another party; to be informed of the Home Health agency's governing body and its affiliation with any entities to whom the patient is referred. QUALITY OF CARE: Patients and families have the right to receive the highest quality of care; to be served by individuals who are properly trained and competent to perform their duties; to be told what to do in the case of an emergency. The Home Health agency shall assure that all medically related Home Health care is provided in accordance with physician's orders and that a plan of care is developed by the patient's physician and/or the Home Health interdisciplinary group, specifying services provided including the frequency and duration of such services; and that all medically related personal care is provided by an appropriately trained Home Health aide supervised by a qualified nurse. DECISION MAKING: Patients and families have the right to information regarding diagnosis, prognosis, and change in either; to participate in the planning of his/her care or treatment and to be informed of such right in advance; to refuse services and to be advised of the consequences of refusing care; to be informed, in advance of the care to be furnished, of the disciplines that will furnish care and the frequency of visits proposed to be furnished; to be informed of any change in the plan of care before the change is made; to information about alternatives available from the Home Health agency and payment resources; to request a change in caregiver without fear of reprisal or discrimination; to be informed that all requirements related to maintaining written policies and procedures regarding advance directives are met by the Home Health agency, and to receive written information, in advance, concerning policies on advance directives, including a description of applicable law.",
  },
  {
    key: "complaints",
    title: "How to complain about us",
    pages: "18",
    group: "rights",
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
    pages: "19",
    group: "rights",
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
    pages: "19",
    group: "rights",
    say: "A statement that no employee solicited them — choosing Joy was their decision.",
    mark: "initials",
    mandatory: true,
    fullText:
      "NON-SOLICITATION STATEMENT: It is Joy Healthcare's Policy to abide by all State and Federal Regulations regarding solicitation of patients for Home Health/Care services. This form serves as a statement that no Joy Healthcare employee or contracted employee solicited any patient or patient care giver for Home Health services. This is the sole decision of the patient and/or patient's legal representative to select Joy Healthcare as the chosen Home Health/Care provider.",
  },
  {
    key: "non_solicitation_agreement",
    title: "Please do not hire our caregivers directly",
    pages: "20",
    group: "rights",
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
    pages: "25",
    group: "rights",
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
    pages: "26",
    group: "rights",
    say: "Walk the list of signs. Tell them where to keep it — this is the page that goes on the fridge.",
    watchFor: "Confirm they know we answer 24 hours, including nights and holidays. People wait until morning when they should not.",
    mark: "signature",
    mandatory: true,
    fullText:
      "EMERGENCY CARE PLAN. This plan outlines signs/symptoms that should be called in to the nurse and what to do in case of an emergency. Please keep this information where you can find it. Our agency has staff on call 24 hours a day including nights, weekends, and holidays.",
  },
];

/** Consents in packet order, split into the chapters the review walks through. */
export function consentsByGroup(): Array<{
  group: ConsentGroup;
  title: string;
  blurb: string;
  items: ConsentItem[];
}> {
  return CONSENT_GROUPS.map((g) => ({
    ...g,
    items: CONSENTS.filter((c) => c.group === g.group),
  }));
}

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
  if (decisions.photograph === "decline" || decisions.photograph === "not_applicable") {
    out.push(
      "No photographs or video of this client, including wound photos and anything for insurance documentation. Tell the caregiver and note it on the plan of care.",
    );
  }
  if (decisions.disclosure_list === "decline" || decisions.disclosure_list === "not_applicable") {
    out.push(
      "Nobody is authorised to receive this client's health information. The office must not discuss their care with family who call, however insistent.",
    );
  }
  return out;
}
