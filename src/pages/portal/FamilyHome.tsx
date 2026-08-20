import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, CircleDashed, TriangleAlert } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { OfficeNumber } from "@/components/portal/OfficeNumber";
import { usePortalSession } from "@/context/PortalSessionProvider";
import {
  admissionLines,
  careTeam,
  familyNext,
  familySchedule,
} from "@/domain/portal/familyPortal";
import { momentsTimeline } from "@/domain/portal/moments";
import { seedAdmissionProgress, seedMoments } from "@/lib/familyPortalSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import type { StatusState } from "@/domain/portal/candidateStatus";
import { cn } from "@/lib/utils";

/**
 * The family's home — §20 before start of care, §23 after.
 *
 * One screen, two states, the same way the workforce side works. §19's flow
 * runs Assessment → Move Forward → portal → documents and consents → Ready for
 * Admission → Start of Care → Ongoing, and the portal follows it rather than
 * asking the family where they are. §20: "Joy determines status."
 *
 * §27's calm is the point here more than anywhere else. This is read by
 * somebody worrying about their father.
 */

const MARK: Record<StatusState, { icon: typeof Check; tone: string }> = {
  done: { icon: Check, tone: "text-[hsl(var(--success))]" },
  in_progress: { icon: CircleDashed, tone: "text-muted-foreground" },
  waiting: { icon: CircleDashed, tone: "text-muted-foreground" },
  attention: { icon: TriangleAlert, tone: "text-[hsl(var(--warning))]" },
};

export default function FamilyHome() {
  const { grant } = usePortalSession();
  const asOf = useMemo(() => new Date(), []);

  const subjectName = grant?.subjectName ?? "your family member";
  const preAdmission = grant?.state === "pre_admission";

  const progress = seedAdmissionProgress;
  const next = familyNext(progress, subjectName);

  // Demo wiring: the busiest client on the board stands in for this family's
  // person, so the schedule and care team have something real to show.
  const clientName = useMemo(() => seedVisits[0]?.clientName ?? "", []);

  const schedule = useMemo(
    () => familySchedule({ visits: seedVisits, clientName, asOf }),
    [clientName, asOf],
  );
  const team = useMemo(() => careTeam(seedVisits, clientName), [clientName]);
  const moments = useMemo(() => momentsTimeline(seedMoments, asOf), [asOf]);

  const today = schedule.find((v) => v.when === new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).format(asOf));

  return (
    <PortalFrame>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {preAdmission ? `Hi, ${grant?.greetingName}` : `Good day, ${grant?.greetingName}`}
      </h1>

      {/* ------------------------------------------- pre-admission (§20) -- */}
      {preAdmission && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {subjectName}'s care setup
          </p>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {admissionLines(progress).map((line) => {
              const { icon: Icon, tone } = MARK[line.state];
              return (
                <div key={line.label} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="text-base">{line.label}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {line.value}
                    <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden="true" />
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ------------------------------------------------- today (§23) --- */}
      {!preAdmission && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <div className="mt-2 rounded-2xl border border-border bg-surface p-5">
            {today ? (
              <>
                <p className="text-lg font-medium">{today.caregiverName ?? "Your caregiver"}</p>
                <p className="mt-1 text-base text-muted-foreground">{today.timeRange}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{today.service}</p>
              </>
            ) : (
              <p className="text-base text-muted-foreground">No visit scheduled today.</p>
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------- next step -- */}
      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Next step
        </p>
        <p className="mt-2 text-lg font-medium leading-snug">{next.headline}</p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{next.detail}</p>
        {next.action && (
          <Link
            to={next.action.to}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
          >
            {next.action.label}
          </Link>
        )}
      </div>

      {/* ------------------------------------------------- moment (§23) -- */}
      {moments.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            A little moment from today 💛
          </p>
          <p className="mt-2 text-base leading-relaxed">{moments[0].body}</p>
          <Link
            to="/portal/care/moments"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--accent-foreground))] underline-offset-4 hover:underline"
          >
            See all moments
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* --------------------------------------------------- this week --- */}
      {schedule.length > 0 && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {schedule.slice(0, 4).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span>
                  <span className="block text-base">{v.when}</span>
                  <span className="block text-sm text-muted-foreground">{v.timeRange}</span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {/* Null caregiver reads as nothing at all, never as a gap. */}
                  {v.caregiverName ?? "Scheduled"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* --------------------------------------------------- care team --- */}
      {team.length > 0 && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Care team
          </p>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {team.map((member) => (
              <li key={member.name} className="px-4 py-3.5">
                <p className="text-base">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        Anything at all, call us on{" "}
        <OfficeNumber />
        .
      </p>
    </PortalFrame>
  );
}
