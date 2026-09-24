import type { Interaction } from "@/domain/records/activity";

/**
 * Logged activity the demo starts with.
 *
 * Pamela P is one of the three LTCI clients Karynn confirmed are not real
 * people (29 September), so her record can carry mock conversations. Tanya R
 * is real staff, and the two entries about her are the TB lapse the rest of
 * the demo already shows — nothing here says anything about her the
 * credential record does not.
 */
function so(daysAgo: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export const seedInteractions: Interaction[] = [
  {
    id: "act-seed-dolores-fall",
    subject: { kind: "client", id: "c-pamela", name: "Pamela P" },
    channel: "phone",
    at: so(12, "17:20"),
    direction: "incoming",
    spokeWith: "Marta Pamela P",
    minutes: 9,
    place: null,
    gift: null,
    notes: `Marta rang about twenty minutes after Thylia B left. Dee had gone to the bathroom on her own and slipped getting up — she did not hit her head and she was able to get herself back to the chair, but Marta said her hip was sore on the right side.

She has not called the GP yet and asked whether she should. I said we would file it as an incident either way and that someone would look at the evening routine, because this is the second time it has happened after the last visit of the day rather than during one.

Marta asked whether the 6:30 visit could move later. I said I could not promise it on the phone but that scheduling would come back to her this week.`,
    summary: "Fall after the evening visit — second one at that time of day. Marta wants 6:30 moved later.",
    source: "typed",
    loggedBy: "Karynn Verrett",
    loggedAt: so(12, "17:44"),
  },
  {
    id: "act-seed-dolores-auth",
    subject: { kind: "client", id: "c-pamela", name: "Pamela P" },
    channel: "email",
    at: so(4, "10:05"),
    direction: "outgoing",
    spokeWith: "Marta Pamela P",
    minutes: null,
    place: null,
    gift: null,
    notes: `Sent the records authorization for re-signature and explained that it runs twelve months from signature, which is why the February one has lapsed. Without it we cannot request anything from Methodist.

Marta replied within the hour to say she would sign it this week and asked us to keep using email rather than post.`,
    summary: "Records authorization sent for re-signature. She prefers email over post.",
    source: "typed",
    loggedBy: "Karynn Verrett",
    loggedAt: so(4, "10:12"),
  },
  {
    id: "act-seed-dolores-visit",
    subject: { kind: "client", id: "c-pamela", name: "Pamela P" },
    channel: "in_person",
    at: so(9, "14:00"),
    direction: null,
    spokeWith: "Marta Pamela P",
    minutes: 45,
    place: "The house, 1140 Yale St",
    gift: null,
    notes: `Went out to look at the evening routine after the fall. The bathroom light switch is behind the door, so Dee crosses the room in the dark to reach it. Marta is going to put a plug-in night light in the hallway this week.

Dee was in good spirits and walked me to the door with the frame. No bruising visible on the hip. She asked whether Thylia B could stay a little later on Tuesdays.`,
    summary: "Walked the evening routine. Light switch is the problem — night light going in.",
    source: "typed",
    loggedBy: "Karynn Verrett",
    loggedAt: so(9, "16:20"),
  },
  {
    id: "act-seed-tanya-tb",
    subject: { kind: "employee", id: "emp-tanya", name: "Tanya R" },
    channel: "phone",
    at: so(2, "07:40"),
    direction: "incoming",
    spokeWith: null,
    minutes: 3,
    place: null,
    gift: null,
    notes: `Tanya rang first thing. She has seen she is off the schedule and wanted to know why. I told her the TB test lapsed and that we cannot put her on a shift until it is renewed.

She has an appointment at the clinic on Thursday and will bring the paperwork in the same afternoon. She asked about the Thursday 10am with Vince W — I said that shift still needs covering and it would not be held for her.`,
    summary: "TB renewal booked for Thursday. Thursday 10am with Vince still needs covering.",
    source: "dictated",
    loggedBy: "Karynn Verrett",
    loggedAt: so(2, "07:46"),
  },
  {
    id: "act-seed-tanya-text",
    subject: { kind: "employee", id: "emp-tanya", name: "Tanya R" },
    channel: "text",
    at: so(1, "18:12"),
    direction: "incoming",
    spokeWith: null,
    minutes: null,
    place: null,
    gift: null,
    notes: `Text: "Clinic moved me to Friday 8am, is that still ok? I can bring the form straight after."

Replied that Friday is fine and to send a photo of the form as soon as she has it so we can get her back on the board without waiting for the paper copy.`,
    summary: "Clinic moved to Friday 8am. Photo of the form is enough to reinstate her.",
    source: "pasted",
    loggedBy: "Karynn Verrett",
    loggedAt: so(1, "18:15"),
  },
];
