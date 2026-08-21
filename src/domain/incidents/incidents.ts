/**
 * Incidents — what happens after a caregiver says something went wrong.
 *
 * §11 makes the caregiver answer an incident question before she can clock out,
 * and until now the answer went into a chart line and nowhere else. A
 * documented incident that reaches nobody is worse than no field at all: it
 * looks like diligence, it satisfies the check, and the first anybody at the
 * office hears of a fall is when a daughter rings.
 *
 * So this is the part that was missing — classify it, work out who has to be
 * told and by when, and hold it open until somebody has actually done that.
 *
 * WHAT THIS FILE DOES NOT CLAIM
 *
 * Texas licenses home and community support services agencies and imposes real
 * reporting duties, with real deadlines, and some of them are short. Nothing
 * here asserts what those are. `NOTIFICATION_POLICY` is Joy's own policy as
 * data, written to be corrected — Karynn is the RN and the administrator, she
 * knows the rules for her licence category, and a number invented here that
 * looked authoritative would be worse than an obviously blank one.
 *
 * FLAGGED FOR KARYNN. Every window below needs her confirmation against the
 * current TAC requirements before this is relied on. The mechanism is right;
 * the numbers are a starting point.
 */

export type IncidentKind =
  | "fall"
  | "injury"
  | "medication_error"
  | "behavioural"
  | "property_damage"
  | "missing_client"
  | "allegation"
  | "death"
  | "other";

export const INCIDENT_LABELS: Record<IncidentKind, string> = {
  fall: "Fall",
  injury: "Injury",
  medication_error: "Medication error",
  behavioural: "Behaviour or safety concern",
  property_damage: "Property damage",
  missing_client: "Client could not be found",
  allegation: "Allegation of abuse, neglect or exploitation",
  death: "Death",
  other: "Something else",
};

/**
 * How bad, decided by the office rather than the caregiver.
 *
 * A caregiver in somebody's hallway is not well placed to judge severity, and
 * asking her to would make the field a guess that later reads as a finding. She
 * reports what happened; the RN classifies it.
 */
export type IncidentSeverity = "minor" | "significant" | "serious";

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  minor: "Minor — no harm",
  significant: "Significant — harm or potential harm",
  serious: "Serious — hospitalisation, death or an allegation",
};

export type NotifyParty = "rn" | "family" | "physician" | "state" | "administrator";

export const NOTIFY_LABELS: Record<NotifyParty, string> = {
  rn: "The RN",
  family: "The responsible party",
  physician: "The client's physician",
  state: "The state",
  administrator: "The administrator",
};

export interface NotificationRule {
  party: NotifyParty;
  /** Hours from when Joy learned of it. */
  withinHours: number;
  /** Why, in one line, for the person doing it at eleven at night. */
  because: string;
}

/**
 * Joy's notification policy, as data.
 *
 * Requirements-as-data rather than branches, the same as credentials: the rules
 * change, they differ by licence category, and Karynn should be able to correct
 * a window without anybody touching a component.
 *
 * ALL WINDOWS NEED KARYNN'S CONFIRMATION. They are deliberately conservative —
 * being early is recoverable and being late is not — but conservative is not
 * the same as correct.
 */
export const NOTIFICATION_POLICY: Record<IncidentKind, NotificationRule[]> = {
  fall: [
    { party: "rn", withinHours: 1, because: "A fall needs clinical eyes before anything else." },
    { party: "family", withinHours: 2, because: "They will hear about it anyway. Better from Joy." },
  ],
  injury: [
    { party: "rn", withinHours: 1, because: "Someone clinical has to decide if this needs more." },
    { party: "family", withinHours: 2, because: "They will hear about it anyway. Better from Joy." },
  ],
  medication_error: [
    { party: "rn", withinHours: 1, because: "The RN decides whether the physician is called." },
    { party: "physician", withinHours: 4, because: "Only the prescriber can say what happens next." },
    { party: "family", withinHours: 4, because: "They are entitled to know what was given." },
  ],
  behavioural: [
    { party: "rn", withinHours: 4, because: "A pattern is a care plan change, not an incident." },
  ],
  property_damage: [
    { party: "administrator", withinHours: 24, because: "Liability, and the conversation with the family." },
  ],
  missing_client: [
    { party: "rn", withinHours: 1, because: "Immediately." },
    { party: "administrator", withinHours: 1, because: "This escalates fast and needs the owner." },
    { party: "family", withinHours: 1, because: "They may know where they are." },
  ],
  allegation: [
    // The one nobody may sit on. An allegation against a caregiver is also an
    // allegation Joy is now on notice of.
    { party: "administrator", withinHours: 1, because: "The owner decides, nobody else." },
    { party: "state", withinHours: 24, because: "Reporting is mandatory and the clock is short." },
  ],
  death: [
    { party: "rn", withinHours: 1, because: "Immediately." },
    { party: "administrator", withinHours: 1, because: "Immediately." },
    { party: "state", withinHours: 24, because: "Reportable. Confirm the window for your licence." },
  ],
  other: [
    { party: "rn", withinHours: 24, because: "Somebody clinical should look at it." },
  ],
};

/** Kinds Joy treats as serious regardless of what anybody selects. */
export const ALWAYS_SERIOUS: readonly IncidentKind[] = ["allegation", "death", "missing_client"];

export type IncidentState = "reported" | "under_review" | "closed";

export interface Notification {
  party: NotifyParty;
  dueBy: string;
  doneAt: string | null;
  doneByUserId: string | null;
  /** How it was done — a call, a message, a form. */
  note: string | null;
}

export interface Incident {
  id: string;
  visitId: string | null;
  clientPersonId: string;
  clientName: string;
  /** Who reported it. Almost always the caregiver who was there. */
  reportedByPersonId: string;
  reportedByName: string;
  /** Their words, unchanged. The office classifies; it does not rewrite. */
  narrative: string;
  /** When Joy learned of it, which starts every clock. */
  reportedAt: string;

  kind: IncidentKind | null;
  severity: IncidentSeverity | null;
  state: IncidentState;
  notifications: Notification[];

  /** What the office found, once somebody has looked. */
  findings: string | null;
  /** What changed as a result. A closed incident that changed nothing is a flag. */
  actionTaken: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
}

// ------------------------------------------------------------ creating --

/**
 * Raise an incident from a caregiver's clock-out answer.
 *
 * Unclassified on purpose. She said what happened; deciding it is a "fall"
 * rather than an "injury", and how serious, is the RN's job and should carry
 * the RN's name.
 */
export function incidentFromVisit(input: {
  id: string;
  visitId: string;
  clientPersonId: string;
  clientName: string;
  reportedByPersonId: string;
  reportedByName: string;
  narrative: string;
  at: string;
}): Incident {
  if (!input.narrative.trim()) {
    throw new Error("An incident needs the caregiver's account of what happened.");
  }

  return {
    id: input.id,
    visitId: input.visitId,
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    reportedByPersonId: input.reportedByPersonId,
    reportedByName: input.reportedByName,
    narrative: input.narrative.trim(),
    reportedAt: input.at,
    kind: null,
    severity: null,
    state: "reported",
    notifications: [],
    findings: null,
    actionTaken: null,
    closedAt: null,
    closedByUserId: null,
  };
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/**
 * Classify it, which is what generates the obligations.
 *
 * Deadlines run from when it was reported, not from when somebody got round to
 * classifying it. Otherwise an incident that sat unopened all weekend would
 * have a fresh clock on Monday, which is precisely backwards.
 */
export function classifyIncident(input: {
  incident: Incident;
  kind: IncidentKind;
  severity: IncidentSeverity;
  byUserId: string | null;
}): Incident {
  if (!input.byUserId) {
    throw new Error("Classifying an incident is a clinical judgement and needs a name against it.");
  }

  const severity = ALWAYS_SERIOUS.includes(input.kind) ? "serious" : input.severity;

  return {
    ...input.incident,
    kind: input.kind,
    severity,
    state: "under_review",
    notifications: NOTIFICATION_POLICY[input.kind].map((rule) => ({
      party: rule.party,
      dueBy: addHours(input.incident.reportedAt, rule.withinHours),
      doneAt: null,
      doneByUserId: null,
      note: null,
    })),
  };
}

export function recordNotification(input: {
  incident: Incident;
  party: NotifyParty;
  note: string;
  byUserId: string | null;
  at: string;
}): Incident {
  if (!input.byUserId) throw new Error("Recording a notification needs the person who made it.");

  return {
    ...input.incident,
    notifications: input.incident.notifications.map((n) =>
      n.party === input.party
        ? { ...n, doneAt: input.at, doneByUserId: input.byUserId, note: input.note.trim() || null }
        : n,
    ),
  };
}

// ------------------------------------------------------------- closing --

export type CloseRefusal = "not_classified" | "notifications_outstanding" | "no_findings";

export const CLOSE_MESSAGES: Record<CloseRefusal, string> = {
  not_classified: "Classify it first — the notifications depend on what kind it is.",
  notifications_outstanding: "Somebody still has to be told. Record that before closing.",
  no_findings: "Write down what you found. A closed incident with no findings is a gap in the file.",
};

export function closeRefusals(incident: Incident): CloseRefusal[] {
  const refusals: CloseRefusal[] = [];

  if (!incident.kind) refusals.push("not_classified");
  if (incident.notifications.some((n) => !n.doneAt)) refusals.push("notifications_outstanding");
  if (!incident.findings?.trim()) refusals.push("no_findings");

  return refusals;
}

/**
 * Close it.
 *
 * `actionTaken` is deliberately not required. Plenty of incidents are genuinely
 * nobody's fault and change nothing, and forcing a sentence would produce a file
 * full of "no action required" that means nothing. Findings are required,
 * because an incident nobody wrote a conclusion about was not investigated.
 */
export function closeIncident(input: {
  incident: Incident;
  byUserId: string | null;
  at: string;
}): Incident {
  if (!input.byUserId) throw new Error("Closing an incident needs the person closing it.");

  const refusals = closeRefusals(input.incident);
  if (refusals.length > 0) {
    throw new Error(refusals.map((r) => CLOSE_MESSAGES[r]).join(" "));
  }

  return {
    ...input.incident,
    state: "closed",
    closedAt: input.at,
    closedByUserId: input.byUserId,
  };
}

// ------------------------------------------------------------- overdue --

export interface IncidentUrgency {
  /** Notifications past their deadline, worst first. */
  overdue: Notification[];
  /** Due within the hour. */
  dueSoon: Notification[];
  /** Nobody has classified this yet, and it was reported a while ago. */
  unclassifiedFor: number | null;
  headline: string;
}

/** Reported and untouched for this long is itself the failure. */
export const CLASSIFY_WITHIN_HOURS = 2;

export function incidentUrgency(incident: Incident, asOf: string): IncidentUrgency {
  const now = Date.parse(asOf);

  const pending = incident.notifications.filter((n) => !n.doneAt);
  const overdue = pending
    .filter((n) => Date.parse(n.dueBy) < now)
    .sort((a, b) => a.dueBy.localeCompare(b.dueBy));
  const dueSoon = pending.filter(
    (n) => Date.parse(n.dueBy) >= now && Date.parse(n.dueBy) - now <= 3_600_000,
  );

  const unclassifiedHours = incident.kind
    ? null
    : Math.floor((now - Date.parse(incident.reportedAt)) / 3_600_000);

  const headline = (() => {
    if (incident.state === "closed") return "Closed";
    if (unclassifiedHours !== null && unclassifiedHours >= CLASSIFY_WITHIN_HOURS) {
      return `Reported ${unclassifiedHours} hours ago and nobody has looked at it`;
    }
    if (!incident.kind) return "Waiting to be classified";
    if (overdue.length > 0) {
      const [worst] = overdue;
      return `${NOTIFY_LABELS[worst.party]} should have been told by now`;
    }
    if (dueSoon.length > 0) return `${NOTIFY_LABELS[dueSoon[0].party]} needs telling within the hour`;
    if (pending.length > 0) return `${pending.length} still to notify`;
    return "Everyone has been told — ready to close";
  })();

  return { overdue, dueSoon, unclassifiedFor: unclassifiedHours, headline };
}

/** Sort for the office queue: the most overdue thing first. */
export function sortIncidents(incidents: readonly Incident[], asOf: string): Incident[] {
  const weight = (incident: Incident) => {
    if (incident.state === "closed") return 3;
    const urgency = incidentUrgency(incident, asOf);
    if (urgency.overdue.length > 0) return 0;
    if (!incident.kind) return 1;
    return 2;
  };

  return incidents
    .slice()
    .sort((a, b) => weight(a) - weight(b) || a.reportedAt.localeCompare(b.reportedAt));
}
