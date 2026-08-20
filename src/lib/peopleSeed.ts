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
  {
    id: "contact-okpara",
    name: "Curtis Okpara",
    credentials: "MD",
    title: "Internal Medicine",
    organization: "E.X.A.M by Dr. O",
    unit: "Concierge Medicine",
    // A concierge internist's patients are exactly the demographic that needs
    // home care, and he keeps them rather than discharging them — so the
    // relationship runs both ways over years rather than one referral at a time.
    kind: "physician",
    email: "info@exambydoctoro.com",
    phone: "(281) 393-4465",
    address: "5373 W Alabama St, Houston, TX 77056",
    notes:
      "By appointment only. Active on social — @exam.by.dr.o on Instagram, exam by dr.o on " +
      "Facebook, dr.curtisokpara on TikTok.",
    addedOn: daysAgo(0),
    lastContactedOn: daysAgo(0),
    referrals: [],
  },
  {
    id: "contact-jones",
    name: "Kerwin Jones",
    credentials: null,
    title: "Outreach Specialist",
    organization: "VillageMD",
    unit: null,
    // Connecting VillageMD's patients to services is the job, so he is a
    // referral channel by definition rather than by accident.
    kind: "outreach",
    email: "kjones11@villagemd.com",
    phone: "(346) 589-6432",
    address: null,
    notes: null,
    addedOn: daysAgo(0),
    lastContactedOn: daysAgo(0),
    referrals: [],
  },
  {
    id: "contact-rhodes",
    name: "Craig Rhodes Sr.",
    credentials: null,
    title: "Broker Manager",
    organization: "VillageMD",
    unit: null,
    // Broker relationships are an insurance channel rather than a clinical one,
    // so he is a partner and not chased on the referral clock. Worth knowing
    // when an LTC insurance question comes up mid-admission.
    kind: "partner",
    email: "crhodes2@villagemd.com",
    phone: "(713) 256-8133",
    address: null,
    notes: "Office (469) 729-8738. Same organisation as Kerwin Jones.",
    addedOn: daysAgo(0),
    lastContactedOn: daysAgo(0),
    referrals: [],
  },
];
