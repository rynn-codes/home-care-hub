import type { ClientInput } from "@/domain/clients/roster";

/**
 * Deterministic demo seed for the Clients directory.
 *
 * EVERY CLIENT HERE IS FICTIONAL AND MUST STAY FICTIONAL. The same rule as
 * joySeed.ts and admissionsSeed.ts, and the reason is worth restating: the fact
 * that a named person receives home care is health information about them. This
 * file is committed to git and its contents are written to localStorage, so a
 * real client's name in it is a disclosure, not a convenience. Staff names are
 * Joy Health's real team; care recipients are invented.
 *
 * The states are chosen to exercise the record rather than to look tidy — one
 * client whose records authorization has already lapsed, one whose renewal
 * falls inside the warning window, one who declined transport and photographs,
 * one on hold, one discharged. A directory where everything is fine proves
 * nothing about the screen.
 *
 * Clients admitted through the demo appear alongside these; nothing here is
 * duplicated when that happens, because admission adds a client profile to the
 * existing person rather than creating a second record (§10).
 *
 * EVERY CLIENT IS PRIVATE PAY. Karynn, 21 August: "We are all private pay. We
 * allow long term care insurance, but only for them to reimburse the client
 * once they have paid us. We don't need anything regarding authorizations."
 *
 * This file used to carry Medicaid STAR+PLUS, VA Community Care, Medicare and
 * LTC Insurance as payers, with one record reading "authorization through Dec
 * 2026". None of that was true of Joy, and it was invented here rather than
 * given — which is exactly how a seed stops being a demo and starts being a
 * wrong answer somebody builds on. It cost an authorisation module and a burn
 * rate report before anybody said so.
 *
 * A long-term care policy reimburses the CLIENT, after the client has paid Joy.
 * Joy invoices the client either way and is not a party to the claim. What that
 * client needs from Joy is documentation good enough to submit — which is a
 * different feature from billing an insurer, and not one that has been asked
 * for yet.
 */
export const seedClients: ClientInput[] = [
  {
    personId: "cli-hollis",
    firstName: "Wendell",
    lastName: "Hollis",
    preferredName: "Wen",
    dateOfBirth: "1943-11-04",
    phone: "(713) 555-0182",
    email: "hollis.family@example.com",
    address: "4212 Chatsworth Dr, Houston, TX 77027",
    location: "Houston · Memorial",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · card on file",
    services: ["Personal Care", "Companionship Care"],
    caregiver: "Chanel P",
    coordinator: "John Segura",
    condition: "Parkinson's disease",
    hoursPerWeek: 40,
    nextVisit: "Tue, Aug 19 · 7:00 AM",
    lastActivity: "Care plan signed · Aug 4",
    responsiblePartyName: "Marguerite Hollis",
    responsiblePartyLine: "Daughter · (713) 555-0188 · primary contact",
    admissionDate: "2026-02-16",
    // Signed nearly a year ago: the records authorizations are inside the
    // warning window, which is exactly when someone should be told.
    signedAt: "2025-10-02T14:20:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "cli-arceneaux",
    firstName: "Odessa",
    lastName: "Arceneaux",
    dateOfBirth: "1938-06-21",
    phone: "(281) 555-0119",
    email: "o.arceneaux@example.com",
    address: "908 Kingsland Blvd, Katy, TX 77450",
    location: "Katy",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · ACH",
    services: ["Personal Care"],
    caregiver: "Bedjine Cupidon",
    coordinator: "John Segura",
    condition: "Congestive heart failure",
    hoursPerWeek: 25,
    nextVisit: "Today · 9:00 AM",
    lastActivity: "Visit note filed · Aug 16",
    responsiblePartyName: "Renata Arceneaux",
    responsiblePartyLine: "Daughter · (281) 555-0143",
    admissionDate: "2025-02-03",
    // Lapsed. This is the record the directory should surface first.
    signedAt: "2025-02-01T16:05:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "cli-brightwell",
    firstName: "Cordelia",
    lastName: "Brightwell",
    preferredName: "Cora",
    dateOfBirth: "1935-01-30",
    phone: "(713) 555-0131",
    email: "brightwell.family@example.com",
    address: "1140 Yale St, Houston, TX 77008",
    location: "Houston · Heights",
    status: "active",
    payer: "Private Pay",
    // The long-term care policy reimburses HER, after she has paid Joy. Joy is
    // not a party to it and never bills the insurer — see the note at the top
    // of this file.
    payerLine: "Weekly invoicing · claims LTC reimbursement herself",
    services: ["Personal Care", "Respite"],
    caregiver: "Heather Gonzales",
    coordinator: "Kelsey Westley",
    condition: "Dementia, moderate",
    hoursPerWeek: 30,
    nextVisit: "Wed, Aug 20 · 8:00 AM",
    lastActivity: "Assessment updated · Aug 2",
    responsiblePartyName: "Junie Rowe",
    responsiblePartyLine: "Niece · (713) 555-0156",
    admissionDate: "2026-05-12",
    signedAt: "2026-05-10T11:00:00.000Z",
    // Refused both. The record must show what a caregiver may not do, and the
    // office must not ring the niece without checking the disclosure list.
    decisions: {
      transportation: "decline",
      photograph: "decline",
      disclose_medical_records: "agree",
    },
  },
  {
    personId: "cli-nakamura",
    firstName: "Theo",
    lastName: "Nakamura",
    dateOfBirth: "1957-09-15",
    phone: "(832) 555-0164",
    email: "t.nakamura@example.com",
    address: "2203 Austin Pkwy, Sugar Land, TX 77479",
    location: "Sugar Land",
    status: "on_hold",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · card on file",
    services: ["Personal Care"],
    caregiver: null,
    coordinator: "John Segura",
    condition: "Post-surgical recovery",
    hoursPerWeek: null,
    nextVisit: null,
    lastActivity: "Placed on hold · Aug 1",
    responsiblePartyName: "Ilse Nakamura",
    responsiblePartyLine: "Wife · (832) 555-0165",
    admissionDate: "2026-01-20",
    signedAt: "2026-01-18T09:40:00.000Z",
    decisions: { transportation: "agree", photograph: "not_applicable" },
  },
  {
    personId: "cli-okonkwo",
    firstName: "Beatrice",
    lastName: "Okonkwo",
    preferredName: "Bea",
    dateOfBirth: "1950-04-08",
    phone: "(346) 555-0177",
    email: "b.okonkwo@example.com",
    address: "3305 Broadway St, Pearland, TX 77581",
    location: "Pearland",
    status: "active",
    payer: "Private Pay",
    payerLine: "Card on file · weekly invoicing",
    services: ["Companionship Care"],
    caregiver: "Vanessa",
    coordinator: "Kelsey Westley",
    condition: "Type 2 diabetes",
    hoursPerWeek: 12,
    nextVisit: "Thu, Aug 20 · 10:00 AM",
    lastActivity: "Invoice paid · Aug 7",
    responsiblePartyName: "Chidi Okonkwo",
    responsiblePartyLine: "Son · (346) 555-0178",
    admissionDate: "2026-06-05",
    signedAt: "2026-06-03T13:15:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "cli-vandermeer",
    firstName: "Augustin",
    lastName: "Vandermeer",
    dateOfBirth: "1937-12-19",
    phone: "(713) 555-0193",
    email: "vandermeer.family@example.com",
    address: "5401 Bissonnet St, Bellaire, TX 77401",
    location: "Houston · Bellaire",
    status: "discharged",
    payer: "Private Pay",
    payerLine: "Closed on transition to hospice care",
    services: ["Personal Care"],
    caregiver: null,
    coordinator: "John Segura",
    condition: "Hospice transition",
    hoursPerWeek: null,
    nextVisit: null,
    lastActivity: "Discharged · Jul 12",
    responsiblePartyName: "Wilhelmina Vandermeer",
    responsiblePartyLine: "Daughter · (713) 555-0194",
    admissionDate: "2024-03-08",
    signedAt: "2024-03-06T10:00:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
];

/** Activity feed. Demo only — the real one is built from the audit log (§27). */
export const seedActivity: Record<string, Array<{ label: string; when: string; tone: string }>> = {
  "cli-hollis": [
    { label: "Care plan signed by Kelsey Westley", when: "Aug 4 · 1:32 PM", tone: "done" },
    { label: "Visit completed by Chanel P — 7:00 AM to 3:00 PM", when: "Aug 7 · 3:04 PM", tone: "done" },
    { label: "Medical release form uploaded", when: "Aug 3 · 9:18 AM", tone: "prog" },
    { label: "Caregiver substitution — Thylia covered Aug 2", when: "Aug 2 · 6:40 AM", tone: "warn" },
    { label: "Invoice INV-2041 paid by ACH", when: "Aug 1 · 11:02 AM", tone: "done" },
  ],
  "cli-arceneaux": [
    { label: "Visit note filed by Bedjine Cupidon", when: "Aug 16 · 2:20 PM", tone: "done" },
    { label: "Weight and fluid check logged", when: "Aug 16 · 2:18 PM", tone: "prog" },
    { label: "Records authorization lapsed", when: "Feb 1 · 12:00 AM", tone: "bad" },
  ],
  "cli-brightwell": [
    { label: "Assessment updated — mobility section revised", when: "Aug 2 · 2:14 PM", tone: "prog" },
    { label: "Transport consent declined at signing", when: "May 10 · 11:26 AM", tone: "warn" },
    { label: "Service agreement signed at intake", when: "May 10 · 11:00 AM", tone: "done" },
  ],
};
