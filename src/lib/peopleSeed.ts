import type { Contact } from "@/domain/people/contacts";

/**
 * Joy's business contacts.
 *
 * Unlike every other seed in this repository, the first entry is a real person.
 * That is deliberate and Karynn's decision — she handed over the card on
 * 20 August with "this is a legit business contact."
 *
 * The distinction that makes it safe is the same one that lets Joy's own staff
 * appear by name: a hospital social worker's card exists to be given to home
 * care agencies, and her details are already in the file of every agency her
 * unit discharges to. Nothing here is health information about anybody.
 *
 * Clients remain fictional throughout, and must — being a care recipient is
 * health information about you. See the note in joySeed.ts.
 */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const seedContacts: Contact[] = [
  {
    id: "contact-bonnette",
    name: "Bria Bonnette",
    credentials: "LCSW",
    title: "Social Worker II",
    organization: "Houston Methodist",
    unit: "Skilled Nursing Unit",
    // A SNU social worker decides where a patient goes after discharge, which
    // is the single most valuable kind of contact a home care agency has.
    kind: "discharge_planner",
    email: "bbonnette@houstonmethodist.org",
    phone: "(346) 453-6979",
    address: "6565 Fannin St, West Pavilion 801, Houston, TX 77030",
    notes: "Texas Voice Center is at the same address — voice, swallowing and general ENT.",
    addedOn: daysAgo(0),
    lastContactedOn: daysAgo(0),
    referrals: [],
  },
];
