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
 * ONE CAST, EVERYWHERE. This directory used to carry six invented clients
 * (Hollis, Arceneaux, Brightwell…) while Scheduling, Billing, Care plans,
 * Supervision and the dashboard all spoke of Lian Huang, Edward Pham and Ruth
 * Alvarez. Two casts for one agency is Joy contradicting itself on the first
 * click — the person the dashboard says to call did not exist in the
 * directory. The directory now carries the same people the schedule board
 * carries, with the schedule's own person ids, so every cross-module join
 * (care plan, billing terms, visits, supervision) lands. Theo and Augustin
 * are the two who are NOT on this week's board — deliberately, because
 * on-hold and discharged clients have no visits, and that absence agreeing
 * across screens is the point.
 *
 * The states are chosen to exercise the record rather than to look tidy — one
 * client whose records authorization has already lapsed, one whose renewal
 * falls inside the warning window, one who declined transport and photographs,
 * one on hold, one discharged. A directory where everything is fine proves
 * nothing about the screen.
 *
 * EVERY CLIENT IS PRIVATE PAY. Karynn, 21 August: "We are all private pay. We
 * allow long term care insurance, but only for them to reimburse the client
 * once they have paid us. We don't need anything regarding authorizations."
 * A long-term care policy reimburses the CLIENT, after the client has paid
 * Joy. Joy invoices the client either way and is not a party to the claim.
 */
export const seedClients: ClientInput[] = [
  {
    personId: "c-lian",
    firstName: "Lian",
    lastName: "Huang",
    dateOfBirth: "1948-11-04",
    phone: "(713) 555-0182",
    email: "huang.family@example.com",
    address: "4212 Chatsworth Dr, Houston, TX 77027",
    location: "Houston · Memorial",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · ACH",
    services: ["Personal Care"],
    caregiver: "Chanel P",
    coordinator: "John Segura",
    condition: "Parkinson's disease",
    hoursPerWeek: 8,
    nextVisit: "Wed · 8:00 AM",
    lastActivity: "Care plan signed · Aug 4",
    responsiblePartyName: "Johnathan Huang",
    responsiblePartyLine: "Son · (713) 555-0188 · primary contact",
    admissionDate: "2026-02-16",
    // Signed nearly a year ago: the records authorizations are inside the
    // warning window, which is exactly when someone should be told.
    signedAt: "2025-10-02T14:20:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "c-edward",
    firstName: "Edward",
    lastName: "Pham",
    dateOfBirth: "1941-06-21",
    phone: "(281) 555-0119",
    email: "pham.family@example.com",
    address: "908 Kingsland Blvd, Katy, TX 77450",
    location: "Katy",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · card on file",
    // 56 hrs is a live-in schedule, but the service line is Personal Care —
    // the agency's catalog is exactly three (Personal Care, Post-Surgical,
    // Respite); "Live-In" is a schedule, not a service.
    services: ["Personal Care"],
    caregiver: "Vanessa",
    coordinator: "Kelsey Westley",
    condition: "Congestive heart failure",
    hoursPerWeek: 56,
    nextVisit: "Mon · 4:00 PM",
    lastActivity: "Supervisory visit booked · Aug 20",
    responsiblePartyName: "Tuyet Pham",
    responsiblePartyLine: "Daughter · (281) 555-0143",
    admissionDate: "2025-09-14",
    signedAt: "2026-06-30T16:05:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "c-dolores",
    firstName: "Dolores",
    lastName: "Vance",
    preferredName: "Dee",
    dateOfBirth: "1939-01-30",
    phone: "(713) 555-0131",
    email: "vance.family@example.com",
    address: "1140 Yale St, Houston, TX 77008",
    location: "Houston · Heights",
    status: "active",
    // The second of the two allowed payer values. It still means private pay —
    // the long-term care policy reimburses HER, after she has paid Joy. Joy is
    // not a party to it and never bills the insurer. The label records that a
    // policy is in play so the office can hand her the paperwork she needs.
    payer: "Private Pay + LTC Insurance",
    payerLine: "Weekly invoicing · claims LTC reimbursement herself",
    services: ["Personal Care"],
    caregiver: "Thylia",
    coordinator: "Kelsey Westley",
    condition: "Fall risk, evening confusion",
    hoursPerWeek: 20,
    nextVisit: "Tue · 6:30 PM",
    lastActivity: "Incident classified · Aug 18",
    responsiblePartyName: "Marta Vance",
    responsiblePartyLine: "Niece · (713) 555-0156",
    admissionDate: "2025-02-03",
    // Lapsed. This is the record the directory should surface first.
    signedAt: "2025-02-01T16:05:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "c-susan",
    firstName: "Susan",
    lastName: "Miller",
    dateOfBirth: "1946-04-08",
    phone: "(346) 555-0177",
    email: "miller.family@example.com",
    address: "3305 Broadway St, Pearland, TX 77581",
    location: "Pearland",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · check",
    services: ["Personal Care"],
    caregiver: "Vanessa",
    coordinator: "John Segura",
    condition: "Type 2 diabetes",
    hoursPerWeek: 12,
    nextVisit: "Thu · 6:00 PM",
    lastActivity: "Asked about increased hours · Aug 21",
    responsiblePartyName: "Daniel Miller",
    responsiblePartyLine: "Son · (346) 555-0178",
    admissionDate: "2026-06-05",
    signedAt: "2026-06-03T13:15:00.000Z",
    decisions: { transportation: "agree", photograph: "agree" },
  },
  {
    personId: "c-ruth",
    firstName: "Ruth",
    lastName: "Alvarez",
    dateOfBirth: "1944-09-15",
    phone: "(832) 555-0164",
    email: "alvarez.family@example.com",
    address: "2203 Austin Pkwy, Sugar Land, TX 77479",
    location: "Sugar Land",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · card on file",
    services: ["Respite"],
    // Her Wednesday shift is the open one on the board — the dashboard's
    // "3 available caregivers" insight and this null are the same fact.
    caregiver: null,
    coordinator: "John Segura",
    condition: "Early dementia",
    hoursPerWeek: 6,
    nextVisit: "Wed · 12:00 PM",
    lastActivity: "Shift reopened · Aug 17",
    responsiblePartyName: "Gloria Alvarez",
    responsiblePartyLine: "Daughter · (832) 555-0165",
    admissionDate: "2026-01-20",
    signedAt: "2026-07-18T09:40:00.000Z",
    decisions: { transportation: "agree", photograph: "not_applicable" },
  },
  {
    personId: "c-evelyn",
    firstName: "Evelyn",
    lastName: "Carter",
    preferredName: "Evie",
    dateOfBirth: "1936-12-19",
    phone: "(713) 555-0193",
    email: "carter.family@example.com",
    address: "5401 Bissonnet St, Bellaire, TX 77401",
    location: "Houston · Bellaire",
    status: "active",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · ACH",
    services: ["Personal Care"],
    caregiver: "Heather Gonzales",
    coordinator: "Kelsey Westley",
    condition: "Dementia, moderate",
    hoursPerWeek: 16,
    nextVisit: "Fri · 9:00 AM",
    lastActivity: "Assessment updated · Aug 2",
    responsiblePartyName: "Junie Rowe",
    responsiblePartyLine: "Niece · (713) 555-0157",
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
    personId: "c-theo",
    firstName: "Theo",
    lastName: "Nakamura",
    dateOfBirth: "1957-09-15",
    phone: "(832) 555-0174",
    email: "t.nakamura@example.com",
    address: "2610 Settlers Way Blvd, Sugar Land, TX 77479",
    location: "Sugar Land",
    status: "on_hold",
    payer: "Private Pay",
    payerLine: "Weekly invoicing · card on file",
    // The one Post-Surgical client on the roster — a short recovery line with
    // a defined end, which reads differently from ongoing Personal Care.
    services: ["Post-Surgical"],
    // On hold means no visits — which is why he is absent from the schedule
    // board, and the two screens agreeing on that absence is deliberate.
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
    personId: "c-augustin",
    firstName: "Augustin",
    lastName: "Vandermeer",
    dateOfBirth: "1937-12-19",
    phone: "(713) 555-0196",
    email: "vandermeer.family@example.com",
    address: "5402 Palmetto St, Bellaire, TX 77401",
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
  "c-lian": [
    { label: "Care plan signed by Kelsey Westley", when: "Aug 4 · 1:32 PM", tone: "done" },
    { label: "Visit completed by Chanel P — 8:00 AM to 12:00 PM", when: "Aug 17 · 12:04 PM", tone: "done" },
    { label: "Medical release form uploaded", when: "Aug 3 · 9:18 AM", tone: "prog" },
    { label: "Caregiver substitution — Thylia covered Aug 2", when: "Aug 2 · 6:40 AM", tone: "warn" },
    { label: "Invoice JH-2041 paid by ACH", when: "Aug 1 · 11:02 AM", tone: "done" },
  ],
  "c-dolores": [
    { label: "Incident classified — fall, family notified", when: "Aug 18 · 5:12 PM", tone: "warn" },
    { label: "Visit note filed by Thylia", when: "Aug 18 · 10:32 PM", tone: "done" },
    { label: "Records authorization lapsed", when: "Feb 1 · 12:00 AM", tone: "bad" },
  ],
  "c-evelyn": [
    { label: "Assessment updated — mobility section revised", when: "Aug 2 · 2:14 PM", tone: "prog" },
    { label: "Transport consent declined at signing", when: "May 10 · 11:26 AM", tone: "warn" },
    { label: "Service agreement signed at intake", when: "May 10 · 11:00 AM", tone: "done" },
  ],
  "c-ruth": [
    { label: "Wednesday shift reopened — caregiver call-out", when: "Aug 17 · 7:02 AM", tone: "warn" },
    { label: "Visit completed by Bedjine Cupidon", when: "Aug 12 · 6:05 PM", tone: "done" },
  ],
  "c-susan": [
    { label: "Family asked about increasing weekly hours", when: "Aug 21 · 3:40 PM", tone: "prog" },
    { label: "Invoice paid by check", when: "Aug 7 · 11:02 AM", tone: "done" },
  ],
};
