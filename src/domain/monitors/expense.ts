import { categoryInfo, expensesTotal, live, needsReview } from "@/domain/scheduling/expenses";
import type { Monitor, RawFinding } from "./types";

/**
 * Expense Watch: is anything about to be billed or paid that nobody has
 * reviewed?
 *
 * Nothing goes on a client's invoice or into payroll until somebody who did
 * not record it has looked. This monitor is the reminder that the look has
 * not happened yet.
 */
const visitDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export const expenseWatch: Monitor = {
  id: "expense",
  name: "Expense Watch",
  question: "Is anything about to be billed or paid that nobody has reviewed?",
  cadence: "daily",
  run({ visitExpenses, visits, mileageRatePerMile }) {
    const out: RawFinding[] = [];
    for (const [visitId, list] of Object.entries(visitExpenses)) {
      const open = live(list).filter(needsReview);
      if (open.length === 0) continue;
      const visit = visits.find((v) => v.id === visitId);
      const client = visit?.clientName ?? "a client";
      const recorder = open[0].recordedBy || visit?.caregiverName || "the caregiver";
      const on = visit ? ` on ${visitDay(visit.startsAt)}` : "";
      const toClient = open.filter((e) => categoryInfo(e.category).settlesTo === "client");
      const toCaregiver = open.filter((e) => categoryInfo(e.category).settlesTo === "caregiver");
      const money: string[] = [];
      if (toClient.length > 0) money.push(`$${expensesTotal(toClient, mileageRatePerMile).toFixed(2)} would go on ${client}'s invoice`);
      if (toCaregiver.length > 0) money.push(`$${expensesTotal(toCaregiver, mileageRatePerMile).toFixed(2)} would go into ${recorder.split(" ")[0]}'s pay`);
      out.push({
        key: `expense:${visitId}`,
        subject: { kind: "shift", id: visitId, name: `${client}${on}` },
        severity: "due_soon",
        headline: `${open.length === 1 ? "An expense" : `${open.length} expenses`} on ${client}'s visit${on} ${open.length === 1 ? "has" : "have"} not been reviewed`,
        because: `${money.join("; ")}. Recorded by ${recorder}. Nothing is billed or paid until somebody who did not record it has looked — open the visit, then Expenses, and mark each one reviewed or delete it.`,
        next: { label: "Open scheduling", to: "/scheduling" },
      });
    }
    return out;
  },
};
