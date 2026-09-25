import type { ClientInput } from "@/domain/clients/roster";

/**
 * The Clients directory.
 *
 * THESE ARE KARYNN'S CLIENTS, and the rule is the opposite of the staff
 * seed's: nothing about them may be invented. No dates of birth, phones,
 * emails, addresses or conditions appear here because none were given —
 * "Not recorded" on the record is the truth, and a plausible-looking value
 * in a committed file would be a fabrication about a real person.
 *
 * What is here is what the schedule already says: who is cared for, by
 * whom, for how many hours, and who pays. The responsible-party names are
 * authorised placeholders. The three long-term-care clients — Marilyn K,
 * Jessie C and Pamela P — are not real people (Karynn, 29 September: "You
 * can add mock data"), which is why Pamela's record carries logged
 * conversations and Marilyn's carries a household address on the approved
 * locations list.
 *
 * ONE CAST, EVERYWHERE. The directory carries the same people the schedule
 * board carries, with the schedule's own person ids, so every cross-module
 * join (care plan, billing terms, visits, supervision, incidents) lands.
 *
 * EVERY CLIENT IS PRIVATE PAY. Karynn, 21 August: "We are all private pay. We
 * allow long term care insurance, but only for them to reimburse the client
 * once they have paid us." Joy invoices the client either way.
 */
const LTC_LINE = "Invoiced to the client · long-term care policy reimburses her";
const PRIVATE_LINE = "Invoiced to the client";

export const seedClients: ClientInput[] = [
  {
    personId: "c-marilyn",
    responsiblePartyName: "Denise K",
    responsiblePartyLine: "Daughter",
    firstName: "Marilyn",
    lastName: "K",
    // Mock, per the 29 September exception: Marilyn is not a real person.
    dateOfBirth: "1941-03-14",
    phone: "(713) 555-0131",
    email: "denise.k@example.com",
    address: "9912 Sample Oak Dr, Houston, TX 77007",
    admissionDate: "2026-05-04",
    status: "active",
    payer: "Private Pay + LTC Insurance",
    payerLine: LTC_LINE,
    services: ["Personal Care"],
    caregiver: "Chanel P",
    coordinator: "John Segura",
    hoursPerWeek: 8,
  },
  {
    personId: "c-jessie",
    responsiblePartyName: null,
    responsiblePartyLine: "Self",
    firstName: "Jessie",
    lastName: "C",
    // Mock, per the 29 September exception: Jessie is not a real person.
    dateOfBirth: "1938-11-02",
    phone: "(713) 555-0110",
    email: "jessie.c@example.com",
    address: "9930 Sample Elm St, Houston, TX 77019",
    admissionDate: "2026-06-15",
    status: "active",
    payer: "Private Pay + LTC Insurance",
    payerLine: LTC_LINE,
    services: ["Personal Care"],
    caregiver: "Vanessa J",
    coordinator: "John Segura",
    hoursPerWeek: 32,
  },
  {
    personId: "c-pamela",
    responsiblePartyName: "Gregory P",
    responsiblePartyLine: "Son",
    firstName: "Pamela",
    lastName: "P",
    // Mock, per the 29 September exception: Pamela is not a real person.
    dateOfBirth: "1943-09-28",
    phone: "(713) 555-0120",
    email: "gregory.p@example.com",
    address: "9945 Sample Pine Ln, Houston, TX 77024",
    admissionDate: "2026-07-03",
    status: "active",
    payer: "Private Pay + LTC Insurance",
    payerLine: LTC_LINE,
    services: ["Personal Care"],
    caregiver: "Thylia B",
    coordinator: "Kelsey Westley",
    hoursPerWeek: 16,
  },
  {
    personId: "c-charles",
    responsiblePartyName: null,
    responsiblePartyLine: "Self",
    firstName: "Charles",
    lastName: "S",
    status: "active",
    payer: "Private Pay",
    payerLine: PRIVATE_LINE,
    services: ["Personal Care"],
    caregiver: "Bedjine C",
    coordinator: "Kelsey Westley",
    hoursPerWeek: 24,
  },
  {
    personId: "c-sara",
    responsiblePartyName: "Charles S",
    responsiblePartyLine: "Husband",
    firstName: "Sara",
    lastName: "S",
    status: "active",
    payer: "Private Pay",
    payerLine: PRIVATE_LINE,
    services: ["Personal Care"],
    caregiver: "Bedjine C",
    coordinator: "Kelsey Westley",
    hoursPerWeek: 24,
  },
  {
    personId: "c-vince",
    responsiblePartyName: null,
    responsiblePartyLine: "Self",
    firstName: "Vince",
    lastName: "W",
    status: "active",
    payer: "Private Pay",
    payerLine: PRIVATE_LINE,
    services: ["Personal Care"],
    caregiver: "Vanessa J",
    coordinator: "John Segura",
    hoursPerWeek: 12,
  },
  {
    personId: "c-robert",
    responsiblePartyName: "Laura H",
    responsiblePartyLine: "Daughter",
    firstName: "Robert",
    lastName: "H",
    status: "active",
    payer: "Private Pay",
    payerLine: PRIVATE_LINE,
    services: ["Personal Care"],
    caregiver: "Bedjine C",
    coordinator: "John Segura",
    hoursPerWeek: 20,
  },
];

function clientActivityAt(daysAgo: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** System events on a client's record — what Joy did, not what somebody logged. */
export const seedClientActivity: Record<string, Array<{ label: string; at: string; tone: string }>> = {
  "c-marilyn": [
    { label: "Visit completed by Chanel P — 8:00 AM to 12:00 PM", at: clientActivityAt(1, "12:04"), tone: "done" },
    { label: "Invoice JH-2041 paid by ACH", at: clientActivityAt(6, "11:02"), tone: "done" },
  ],
  "c-pamela": [{ label: "Visit note filed by Thylia B", at: clientActivityAt(2, "22:32"), tone: "done" }],
  "c-robert": [
    { label: "Wednesday shift reopened — caregiver call-out", at: clientActivityAt(3, "07:02"), tone: "warn" },
    { label: "Visit completed by Bedjine C", at: clientActivityAt(8, "18:05"), tone: "done" },
  ],
  "c-vince": [{ label: "Invoice JH-2044 paid by ACH", at: clientActivityAt(9, "11:02"), tone: "done" }],
};
