import type { AdmissionStage, AdmissionStatus } from "@/domain/admissions/stages";

/**
 * The Admissions queue the demo starts with.
 *
 * Two leads, both waiting on Joy, so the queue has something to show without
 * inventing a pipeline of people who do not exist. The seven clients on the
 * schedule are here as people with no open admission — they were admitted
 * long ago — so the duplicate check knows them and a fresh enquiry about one
 * of them surfaces the history instead of creating a second record.
 *
 * Staff names are Joy Health's real team. The two leads are placeholders.
 *
 * Demo seed only. Section 32 forbids mixing this into production migrations.
 */
export interface SeedAdmission {
  id: string;
  name: string;
  stage: AdmissionStage;
  status: AdmissionStatus;
  service: string;
  location: string;
  /** The one line that says why this record is on screen. */
  headline: string;
  meta: string;
  /** The action a user would take next. */
  action: string;
  waitingOn?: string | null;
  /** When the ball landed in whoever's court it is in — the queue's "days waiting". */
  waitingSince?: string | null;
  scheduledAt?: string | null;
  overdue?: boolean;
}

function waitingSince(daysAgo: number, hhmm = "09:00"): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export const seedAdmissions: SeedAdmission[] = [
  {
    id: "adm-chris",
    name: "Chris R",
    stage: "new_referral",
    status: "active",
    service: "Personal Care",
    location: "Houston",
    headline: "New lead — nothing started yet",
    meta: "Referred 2 days ago",
    action: "Start phone intake",
    waitingOn: "Joy",
    waitingSince: waitingSince(2, "10:15"),
  },
  {
    id: "adm-gill",
    name: "Gill C",
    stage: "phone_intake",
    status: "active",
    service: "Personal Care",
    location: "Houston",
    headline: "Phone intake started and not finished",
    meta: "Started 4 days ago",
    action: "Finish the intake",
    waitingOn: "Joy",
    waitingSince: waitingSince(4, "14:40"),
  },
];

/** What Joy handled on its own this morning — the "Handled" fold on the queue. */
export const seedAdmissionsHandled: Array<{ label: string; who: string; time: string }> = [
  { label: "Assessment confirmation sent", who: "Jessie C · family notified", time: "9:42 AM" },
  { label: "Intake summary generated", who: "Marilyn K · sections 1–4", time: "9:20 AM" },
  { label: "Medication list requested", who: "Jessie C · before the 10:30 assessment", time: "8:58 AM" },
  { label: "Service agreement reminder sent", who: "Vince W · reminder 2 of 2", time: "8:31 AM" },
  { label: "Care plan drafted from assessment", who: "Robert H", time: "8:12 AM" },
  { label: "Referral acknowledged", who: "Robert H · Mercy Discharge Planning", time: "7:04 AM" },
];

/**
 * The people behind the admissions and the clients.
 *
 * Every admission points at a person, so the duplicate check sees the
 * record that is visibly sitting in the queue. Nothing about the clients is
 * recorded here beyond their names — see clientsSeed.
 */
export interface SeedPerson {
  personId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  responsiblePartyName?: string | null;
  openAdmissionStage?: string | null;
  /** Set when this person becomes a client. The person row is never duplicated. */
  clientStatus?: "active" | null;
  admissionDate?: string | null;
}

export const seedPeople: SeedPerson[] = [
  { personId: "c-marilyn", firstName: "Marilyn", lastName: "K", openAdmissionStage: null },
  { personId: "c-jessie", firstName: "Jessie", lastName: "C", openAdmissionStage: null },
  { personId: "c-pamela", firstName: "Pamela", lastName: "P", openAdmissionStage: null },
  { personId: "c-charles", firstName: "Charles", lastName: "S", openAdmissionStage: null },
  { personId: "c-sara", firstName: "Sara", lastName: "S", openAdmissionStage: null },
  { personId: "c-vince", firstName: "Vince", lastName: "W", openAdmissionStage: null },
  { personId: "c-robert", firstName: "Robert", lastName: "H", openAdmissionStage: null },
  { personId: "per-chris", firstName: "Chris", lastName: "R", openAdmissionStage: "new_referral" },
  { personId: "per-gill", firstName: "Gill", lastName: "C", openAdmissionStage: "phone_intake" },
];
