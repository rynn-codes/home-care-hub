import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, TriangleAlert } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { useDemo } from "@/context/DemoDataProvider";
import { employeeHome, mySchedule, type MyVisit } from "@/domain/portal/employeeHome";
import { seedVisits } from "@/lib/schedulingSeed";
import { demoCaregiverName } from "@/lib/portalDemo";
import { complianceAlerts } from "@/domain/credentials/alerts";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { cn } from "@/lib/utils";

/**
 * The active caregiver's home — §8, and §29's step 7.
 *
 * One question: what do I need to do right now. §8 says to keep this
 * "significantly simpler than the admin dashboard", so there are no counts, no
 * filters, no panels — a greeting, the visit in front of them, what is next,
 * the week's hours, and anything of theirs that is expiring.
 *
 * The schedule comes from `seedVisits`, which is the admin board's own data.
 * §9: there is no second employee schedule, and no second visit type to build
 * one out of.
 */

function VisitCard({ visit, primary }: { visit: MyVisit; primary?: boolean }) {
  return (
    <Link
      to={`/portal/work/visit/${visit.visit.id}`}
      className={cn(
        "block rounded-2xl border p-5 transition-colors",
        primary ? "border-border bg-surface" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      <p className="text-lg font-medium leading-snug">{visit.visit.clientName}</p>
      <p className="mt-1 text-base text-muted-foreground">{visit.timeRange}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{visit.visit.service}</p>
      {visit.state === "in_progress" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--success)/0.12)] px-3 py-1 text-xs font-medium text-[hsl(var(--success))]">
          Visit in progress
        </p>
      )}
    </Link>
  );
}

export default function EmployeeHome() {
  const { grant } = usePortalSession();
  const { phoneAsks, answerPhoneAsk } = useDemo();
  const [phone, setPhone] = useState("");
  const asOf = useMemo(() => new Date(), []);
  // The office asks for a number by the caregiver's name on the roster, which
  // is the name the schedule carries, not the greeting.
  const rosterName = demoCaregiverName(asOf) || grant?.greetingName || "";
  const ask = phoneAsks[rosterName] ?? null;

  const view = useMemo(() => {
    const name = grant?.greetingName ?? "there";
    const caregiverName = demoCaregiverName(asOf) || name;
    const employee = seedEmployees[0];

    const schedule = mySchedule({ visits: seedVisits, caregiverName, asOf });

    return employeeHome({
      schedule,
      greetingName: name,
      employeeId: employee?.id ?? "",
      alerts: complianceAlerts(
        seedEmployees,
        seedCredentialRequirements,
        asOf.toISOString().slice(0, 10),
      ),
      asOf,
    });
  }, [grant, asOf]);

  return (
    <PortalFrame>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {view.greeting}
      </h1>

      {/* The office asked for a phone number, so Joy can remind her to clock
          out. Answered here, once, and the ask goes away. */}
      {ask && ask.answeredAt === null && (
        <div className="mt-8 rounded-2xl border border-[#DDE1FA] bg-[#F7F8FE] p-5">
          <p className="m-0 text-base leading-snug">The office needs a phone number for you, so Joy can remind you to clock out.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(713) 555-0142"
              aria-label="Your phone number"
              className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base"
            />
            <button
              type="button"
              disabled={phone.trim().length < 7}
              onClick={() => {
                answerPhoneAsk(rosterName, phone.trim(), new Date().toISOString());
                setPhone("");
              }}
              className="h-12 rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground disabled:opacity-50"
            >
              Send it
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- today -- */}
      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Today
      </p>
      <div className="mt-2">
        {view.now ? (
          <VisitCard visit={view.now} primary />
        ) : (
          <p className="rounded-2xl border border-border bg-surface p-5 text-base text-muted-foreground">
            Nothing scheduled today.
          </p>
        )}
      </div>

      {view.action && (
        <Link
          to={view.action.to}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
        >
          {view.action.label}
        </Link>
      )}

      {/* ----------------------------------------------------------- next -- */}
      {view.next && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next
          </p>
          <div className="mt-2">
            <VisitCard visit={view.next} />
          </div>
        </>
      )}

      {/* ----------------------------------------------------------- week -- */}
      <Link
        to="/portal/work/schedule"
        className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
      >
        <span className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="block text-base font-medium">This week</span>
            <span className="block text-sm text-muted-foreground">
              {view.weekHours} scheduled hours
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      {/* ------------------------------------------------------ documents -- */}
      {view.documents.length > 0 && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </p>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {view.documents.map((doc) => (
              <li key={doc.label} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="flex items-center gap-2">
                  <TriangleAlert
                    className={cn(
                      "h-4 w-4 shrink-0",
                      doc.urgent ? "text-destructive" : "text-[hsl(var(--warning))]",
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-base">{doc.label}</span>
                    <span className="block text-sm text-muted-foreground">{doc.detail}</span>
                  </span>
                </span>
                <Link
                  to="/portal/work/documents"
                  className="shrink-0 text-sm font-medium text-[hsl(var(--accent-foreground))] underline-offset-4 hover:underline"
                >
                  Renew
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PortalFrame>
  );
}
