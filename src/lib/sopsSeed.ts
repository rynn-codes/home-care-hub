import type { Sop } from "@/domain/sops/sops";
import { seedEmployees } from "@/lib/employeesSeed";

/**
 * The procedures the demo starts with — titles and categories that a home
 * care agency would recognise, each with two versions so the history has
 * something in it. The content is a skeleton, not Joy Health's real SOPs.
 */
const TITLES: Array<[string, string]> = [
  ["New Caregiver Orientation", "Onboarding"],
  ["Client Intake Process", "Onboarding"],
  ["Hand Hygiene Protocol", "Care Procedures"],
  ["Medication Reminders", "Care Procedures"],
  ["Fall Prevention", "Care Procedures"],
  ["Wound Care Basics", "Care Procedures"],
  ["HIPAA Privacy Rules", "Compliance"],
  ["Background Check Procedure", "Compliance"],
  ["Incident Reporting", "Compliance"],
  ["Fire Emergency Response", "Emergency"],
  ["Medical Emergency Protocol", "Emergency"],
  ["Severe Weather Plan", "Emergency"],
  ["Invoice Generation", "Billing"],
  ["Insurance Claim Submission", "Billing"],
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 30, 0, 0);
  return d.toISOString();
}

const body = (title: string, category: string, revised: boolean) =>
  `<h2>Purpose</h2><p>This procedure covers ${title.toLowerCase()}${revised ? ", revised for the current year" : ""}.</p>` +
  `<h2>Scope</h2><p>Applies to everyone working in ${category.toLowerCase()}.</p>` +
  `<h2>Procedure</h2><ol><li>Identify the situation that calls for this.</li><li>Follow the checklist${revised ? " as revised" : ""}.</li>` +
  `<li>Record what was done on the client's chart${revised ? " within 24 hours" : ""}.</li><li>Tell a supervisor if it needs escalating.</li></ol>` +
  `<h2>References</h2><p>Related policies are in Documents.</p>`;

export const seedSops: Sop[] = TITLES.map(([title, category], i) => {
  const owner = seedEmployees[i % seedEmployees.length].name;
  const updatedAt = daysAgo((i * 6) % 120);
  return {
    id: `sop-${i + 1}`,
    title,
    category,
    ownerName: owner,
    updatedAt,
    versions: [
      { version: 1, updatedAt: daysAgo(((i * 6) % 120) + 30), updatedBy: owner, content: body(title, category, false) },
      { version: 2, updatedAt, updatedBy: owner, content: body(title, category, true) },
    ],
  };
});
