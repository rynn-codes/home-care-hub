import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, CircleDashed, TriangleAlert } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { OfficeNumber } from "@/components/portal/OfficeNumber";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { candidateStatus, type StatusLine, type StatusState } from "@/domain/portal/candidateStatus";
import { onboardingStatus } from "@/domain/portal/onboarding";
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

  /**
   * One screen, two states — §6 and §7. A candidate and an onboarding hire see
   * the same page with different lines on it, because "the existing Joy portal
   * changes state" and "no new account, no new employee app login".
   *
   * Demo wiring picks the applicant from the seed. The real version reads the
   * applicant this grant hangs off.
   */
  const view = useMemo(() => {
    const onboarding = grant?.state === "onboarding";
    const applicant =
      seedApplicants.find((a) => (onboarding ? a.track === "onboarding" : a.track === "hiring")) ??
      seedApplicants[0];
    const greetingName = grant?.greetingName ?? "there";

    if (!onboarding) {
      return {
        ...candidateStatus({ applicant, applicationSubmitted: true, greetingName }),
        greeting: `Hi, ${greetingName}`,
      };
    }

    const state = onboardingStatus({
      applicant,
      applicationSubmitted: true,
      // Nothing is connected to Gusto. `NullHrOnboardingService` returns null
      // and the view renders that honestly rather than inventing a step.
      gusto: null,
      orientation: { onlineOrientation: null, fieldOrientation: null },
    });

    return {
      greeting: `Welcome to Joy, ${greetingName}`,
      lines: state.lines,
      currentStatus: "You're getting ready to start",
      nextStepHeadline: state.headline,
      nextStepDetail: state.detail,
      action: state.action,
    };
  }, [grant]);

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

        {/* Gusto's link leaves Joy, so it must not go through the router —
            react-router would treat an absolute URL as an in-app path and
            render a 404 instead of opening Gusto. */}
        {view.action &&
          (view.action.to.startsWith("http") ? (
            <a
              href={view.action.to}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
            >
              {view.action.label}
            </a>
          ) : (
            <Link
              to={view.action.to}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
            >
              {view.action.label}
            </Link>
          ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Questions? Call the office on{" "}
        <OfficeNumber />
        .
      </p>
    </PortalFrame>
  );
}
