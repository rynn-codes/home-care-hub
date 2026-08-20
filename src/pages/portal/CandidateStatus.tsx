import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, CircleDashed, TriangleAlert } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { candidateStatus, type StatusLine, type StatusState } from "@/domain/portal/candidateStatus";
import { seedApplicants } from "@/lib/hiringSeed";
import { cn } from "@/lib/utils";

/**
 * "Where am I?" — §5, and §29's step 4.
 *
 * The screen a candidate returns to after submitting. It never asks them
 * anything: §5 is explicit that Joy already knows their hiring stage, and a
 * portal that asked would be admitting it had not joined its own records up.
 *
 * Every word here comes from `candidateStatus`, which is an allowlist. Nothing
 * on this page reads the applicant record directly, because the moment a
 * component starts formatting internal state is the moment a reason code
 * reaches a candidate's phone.
 */

const MARK: Record<StatusState, { icon: typeof Check; tone: string }> = {
  done: { icon: Check, tone: "text-[hsl(var(--success))]" },
  in_progress: { icon: CircleDashed, tone: "text-muted-foreground" },
  waiting: { icon: CircleDashed, tone: "text-muted-foreground" },
  attention: { icon: TriangleAlert, tone: "text-[hsl(var(--warning))]" },
};

function Line({ line }: { line: StatusLine }) {
  const { icon: Icon, tone } = MARK[line.state];
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-base">{line.label}</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {line.value}
        <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden="true" />
      </span>
    </div>
  );
}

export default function CandidateStatus() {
  const { grant } = usePortalSession();

  // Demo wiring. The real version reads the applicant this grant hangs off.
  const view = useMemo(
    () =>
      candidateStatus({
        applicant: seedApplicants.find((a) => a.track === "hiring") ?? seedApplicants[0],
        applicationSubmitted: true,
        greetingName: grant?.greetingName ?? "there",
      }),
    [grant],
  );

  return (
    <PortalFrame>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        {view.greeting}
      </h1>

      {view.lines.length > 0 && (
        <>
          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your status
          </p>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {view.lines.map((line) => (
              <Line key={line.label} line={line} />
            ))}
          </div>
        </>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Current status
        </p>
        <p className="mt-1 text-base font-medium">{view.currentStatus}</p>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Next step
        </p>
        <p className="mt-2 text-lg font-medium leading-snug">{view.nextStepHeadline}</p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {view.nextStepDetail}
        </p>

        {view.action && (
          <Link
            to={view.action.to}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
          >
            {view.action.label}
          </Link>
        )}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Questions? Call the office on{" "}
        <a href="tel:+17132319662" className="underline underline-offset-4">
          (713) 231-9662
        </a>
        .
      </p>
    </PortalFrame>
  );
}
