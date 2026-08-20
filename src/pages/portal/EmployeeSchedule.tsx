import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { OfficeNumber } from "@/components/portal/OfficeNumber";
import { mySchedule, type MyVisit } from "@/domain/portal/employeeHome";
import { seedVisits } from "@/lib/schedulingSeed";
import { demoCaregiverName } from "@/lib/portalDemo";

/**
 * The caregiver's own schedule — §9.
 *
 * The same visits the admin board shows, filtered to one person. Not a second
 * schedule and not a copy: `seedVisits` here is the same export Scheduling
 * renders, and `mySchedule` only narrows it.
 *
 * Grouped by day rather than shown as a grid, because a week grid is a desktop
 * idea. On a phone the question is "what am I doing Thursday", and a list
 * answers it without pinching.
 */

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

function groupByDay(visits: MyVisit[]): Array<[string, MyVisit[]]> {
  const groups = new Map<string, MyVisit[]>();
  for (const v of visits) {
    const key = DAY.format(new Date(v.visit.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  return [...groups.entries()];
}

export default function EmployeeSchedule() {
  const asOf = useMemo(() => new Date(), []);

  const schedule = useMemo(() => {
    const caregiverName = demoCaregiverName(asOf);
    return mySchedule({ visits: seedVisits, caregiverName, asOf });
  }, [asOf]);

  const days = groupByDay(schedule.week);

  return (
    <PortalFrame>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        Your schedule
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        {schedule.weekHours} scheduled hours this week.
      </p>

      <div className="mt-8 space-y-7">
        {days.map(([day, visits]) => (
          <div key={day}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {day}
            </p>
            <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
              {visits.map((v) => (
                <li key={v.visit.id}>
                  <Link
                    to={`/portal/work/visit/${v.visit.id}`}
                    className="block px-4 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <p className="text-base font-medium">{v.visit.clientName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {v.timeRange} · {v.visit.service}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {days.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-5 text-base text-muted-foreground">
            You have no visits scheduled this week.
          </p>
        )}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Your schedule is set by the office. To change something, call{" "}
        <OfficeNumber />
        .
      </p>
    </PortalFrame>
  );
}
