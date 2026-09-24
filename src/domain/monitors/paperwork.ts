import { clientCompliance, type ComplianceItem } from "@/domain/clients/roster";
import type { Monitor, RawFinding, Severity } from "./types";

/**
 * Paperwork Watch: whose signed paperwork has expired or is about to.
 *
 * Reads the same compliance items the client record shows, so a finding here
 * and a red badge there are the same fact.
 */
function severityOf(item: ComplianceItem): Severity | null {
  if (item.state === "ok") return null;
  return item.state === "overdue" || item.state === "missing" ? "blocking" : "due_soon";
}

function verbs(item: ComplianceItem): { past: string; future: string } {
  return item.key === "annual_supervision" ? { past: "was due", future: "is due in" } : { past: "expired", future: "expires in" };
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function spanLabel(days: number): string {
  if (days <= 1) return "a day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.4);
  return months < 12 ? `about ${months} months` : "over a year";
}

function headline(item: ComplianceItem, name: string): string {
  const { past, future } = verbs(item);
  if (item.state === "missing") return `${name} has no ${lower(item.label)} on file`;
  if (item.state === "overdue") return `${name}'s ${lower(item.label)} ${past} ${spanLabel(Math.abs(item.daysRemaining ?? 0))} ago`;
  return `${name}'s ${lower(item.label)} ${future} ${spanLabel(item.daysRemaining ?? 0)}`;
}

function because(item: ComplianceItem): string {
  switch (item.key) {
    case "disclose_records":
      return "Until it is signed again, their doctors, hospital and pharmacy cannot send us anything.";
    case "release_records":
      return "Until it is signed again, we cannot send their records anywhere — including to a hospital that asks.";
    case "annual_supervision":
      return "The service agreement commits us to supervising the care annually. A gap here is a survey finding.";
    default:
      return item.detail;
  }
}

export const paperworkWatch: Monitor = {
  id: "paperwork",
  name: "Paperwork Watch",
  question: "Whose signed paperwork has expired or is about to?",
  cadence: "daily",
  run({ clients, today }) {
    const out: RawFinding[] = [];
    for (const client of clients) {
      if (client.status === "discharged") continue;
      const short = client.preferredName || client.firstName;
      const full = `${client.firstName} ${client.lastName}`;
      for (const item of clientCompliance(client, today)) {
        const severity = severityOf(item);
        if (!severity) continue;
        out.push({
          key: `paperwork:${client.personId}:${item.key}`,
          subject: { kind: "client", id: client.personId, name: full },
          severity,
          headline: headline(item, short),
          because: because(item),
          next: { label: `Open ${short}'s documents`, to: `/clients/${client.personId}` },
        });
      }
    }
    return out;
  },
};
