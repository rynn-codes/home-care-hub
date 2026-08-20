import type { AdmissionProgress, RequestedDocument } from "@/domain/portal/familyPortal";
import type { Moment } from "@/domain/portal/moments";
import type { Preference } from "@/domain/portal/preferences";

/**
 * Demo data for the family portal.
 *
 * Clients are fictional and must stay that way — being a care recipient is
 * health information about you, and a seed file committed to a repository is
 * not the place for it. See the note in joySeed.ts.
 */

export const seedRequestedDocuments: RequestedDocument[] = [
  {
    id: "rd1",
    label: "Medication list",
    state: "needed",
    reason: "Our nurse needs it before the care plan is finished.",
  },
  { id: "rd2", label: "Advance directive", state: "accepted", reason: null },
  { id: "rd3", label: "Physician information", state: "accepted", reason: null },
  { id: "rd4", label: "Long-term care insurance", state: "under_review", reason: null },
];

export const seedAdmissionProgress: AdmissionProgress = {
  assessmentComplete: true,
  serviceAgreementSigned: true,
  paymentSetUp: true,
  carePlanState: "in_review",
  startOfCare: "Monday",
  requestedDocuments: seedRequestedDocuments,
  awaitingSignature: [],
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * Moments already shared with this family.
 *
 * Written the way §13's examples read — warm, specific, and carrying no
 * clinical content whatsoever. Each would pass `checkMoment`, which is the
 * point of seeding them rather than inventing prose.
 */
export const seedMoments: Moment[] = [
  {
    id: "mo1",
    visitId: "v1",
    clientPersonId: "p-marcus",
    narrative: "He beat me at chess and wanted everyone to know.",
    body: "Marcus and Jamisha played two games of chess this afternoon — he won one, and made sure she knew it.",
    state: "shared",
    createdByPersonId: "p-jamisha",
    createdAt: daysAgo(0),
    approvedByPersonId: "p-jamisha",
    approvedAt: daysAgo(0),
    sharedAt: daysAgo(0),
    withheldReason: null,
    edited: true,
  },
  {
    id: "mo2",
    visitId: "v2",
    clientPersonId: "p-marcus",
    narrative: "He sat out on the porch after lunch for a good while.",
    body: "He sat out on the porch after lunch for a good while.",
    state: "shared",
    createdByPersonId: "p-jamisha",
    createdAt: daysAgo(3),
    approvedByPersonId: "p-jamisha",
    approvedAt: daysAgo(3),
    sharedAt: daysAgo(3),
    withheldReason: null,
    edited: false,
  },
  {
    id: "mo3",
    visitId: "v3",
    clientPersonId: "p-marcus",
    narrative: "We looked through the family photos on the hall table.",
    body: "We looked through the family photos on the hall table — he told me about the one from the lake.",
    state: "shared",
    createdByPersonId: "p-maria",
    createdAt: daysAgo(5),
    approvedByPersonId: "p-maria",
    approvedAt: daysAgo(5),
    sharedAt: daysAgo(5),
    withheldReason: null,
    edited: true,
  },
];

/**
 * §17 — deliberately maintained, not inferred.
 *
 * Real records rather than a string list, because §17's distinction only means
 * something if each one carries who added it and who approved it. The last one
 * is a family suggestion still waiting on the office, so the approval queue and
 * the pre-visit card have something to actually differ about.
 */
export const seedPreferences: Preference[] = [
  {
    id: "pref1",
    clientPersonId: "p-marcus",
    text: "Enjoys chess",
    state: "approved",
    addedByPersonId: "p-jamisha",
    addedAt: daysAgo(20),
    approvedByPersonId: "p-karynn",
    approvedAt: daysAgo(19),
    retiredReason: null,
    source: "caregiver",
  },
  {
    id: "pref2",
    clientPersonId: "p-marcus",
    text: "Likes sitting on the porch after lunch",
    state: "approved",
    addedByPersonId: "p-karynn",
    addedAt: daysAgo(18),
    approvedByPersonId: "p-karynn",
    approvedAt: daysAgo(18),
    retiredReason: null,
    source: "office",
  },
  {
    id: "pref3",
    clientPersonId: "p-marcus",
    text: "Coffee with one cream",
    state: "approved",
    addedByPersonId: "p-susan",
    addedAt: daysAgo(15),
    approvedByPersonId: "p-karynn",
    approvedAt: daysAgo(14),
    retiredReason: null,
    source: "family",
  },
  {
    id: "pref4",
    clientPersonId: "p-marcus",
    text: "Gospel music in the morning",
    state: "approved",
    addedByPersonId: "p-susan",
    addedAt: daysAgo(15),
    approvedByPersonId: "p-karynn",
    approvedAt: daysAgo(14),
    retiredReason: null,
    source: "family",
  },
  {
    id: "pref5",
    clientPersonId: "p-marcus",
    text: "Happy to talk about the lake house",
    state: "proposed",
    addedByPersonId: "p-susan",
    addedAt: daysAgo(1),
    approvedByPersonId: null,
    approvedAt: null,
    retiredReason: null,
    source: "family",
  },
];
