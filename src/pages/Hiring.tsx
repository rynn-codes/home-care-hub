import { useMemo, useState } from "react";
import { Clock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkQueueSection } from "@/components/work-queue/WorkQueueSection";
import { buildWorkQueue, countNeedsYou } from "@/domain/workQueue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HIRING_ORDER,
  HIRING_STAGE_LABELS,
  NO_FIT_LABELS,
  ONBOARDING_STAGE_LABELS,
  canAdvanceHiring,
  canBecomeActiveEmployee,
  daysInStage,
  firstShiftReadiness,
  isStale,
  toEmployee,
  type Applicant,
  type HireDetails,
} from "@/domain/hiring/pipeline";
import { seedApplicants } from "@/lib/hiringSeed";
import { ApplicantDrawer } from "@/components/hiring/ApplicantDrawer";
import { InviteCandidateDialog } from "@/components/hiring/InviteCandidateDialog";
import {
  invitationSummary,
  issueInvitation,
  newInvitationToken,
  type Invitation,
} from "@/domain/hiring/invitation";
import { composeMessage } from "@/domain/portal/messaging";
import type { E164 } from "@/domain/portal/phone";
import { useDemo } from "@/context/DemoDataProvider";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Operations → Hiring.
 *
 * Same work-queue shape as Admissions, for the same reason: a pipeline board
 * shows where everyone is, which is not the same as showing who is waiting on
 * you. A pipeline's real failure is not a wrong decision but no decision —
 * applicants take other jobs while their record sits untouched at "Applied".
 *
 * Hiring lives under Operations, never at the top level (§6).
 */

type Filter = "open" | "onboarding" | "closed";

function classifyApplicant(a: ApplicantRow) {
  if (a.track === "no_fit") return "moving_forward" as const;
  if (a.stale) return "needs_you" as const;
  // An offer out, or documents requested, is us waiting on them.
  if (a.track === "hiring" && (a.stage === "offer" || a.stage === "documents")) {
    return "waiting" as const;
  }
  if (a.track === "onboarding") {
    // Blocked onboarding needs the office to chase a document.
    return a.blockedCount > 0 ? ("needs_you" as const) : ("moving_forward" as const);
  }
  return "needs_you" as const;
}

interface ApplicantRow extends Applicant {
  stale: boolean;
  days: number;
  blockedCount: number;
  headline: string;
  action: string;
  /** Where their portal invitation stands, or that they have not had one. */
  portal: string;
}

export default function Hiring() {
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>(seedApplicants);
  const [invitations, setInvitations] = useState<Record<string, Invitation>>({});
  const [inviting, setInviting] = useState(false);
  const { hireEmployee } = useDemo();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rows = useMemo<ApplicantRow[]>(
    () =>
      applicants.map((a) => {
        const readiness = firstShiftReadiness(a);
        const days = daysInStage(a, today);
        const stale = isStale(a, today);

        const headline =
          a.track === "no_fit"
            ? NO_FIT_LABELS[a.noFitReason ?? "not_a_fit"]
            : a.track === "onboarding"
              ? readiness.ready
                ? canBecomeActiveEmployee(a).allowed
                  ? "Onboarding complete — ready to become an employee"
                  : `In ${ONBOARDING_STAGE_LABELS[a.onboardingStage ?? "online_orientation"].toLowerCase()}`
                : `${readiness.missingBlocking.length} document${readiness.missingBlocking.length === 1 ? "" : "s"} needed before a first shift`
              : a.stage === "background" && !canAdvanceHiring(a, "offer").allowed
                ? "Background check has not cleared — no offer yet"
                : stale
                  ? `No movement for ${days} days`
                  : `In ${HIRING_STAGE_LABELS[a.stage].toLowerCase()}`;

        const action =
          a.track === "no_fit"
            ? "Reopen"
            : a.track === "onboarding"
              ? canBecomeActiveEmployee(a).allowed
                ? "Complete onboarding"
                : "Open onboarding"
              : "Open applicant";

        return {
          ...a,
          stale,
          days,
          blockedCount: readiness.missingBlocking.length,
          headline,
          action,
          portal: invitationSummary(invitations[a.id] ?? null, today),
        };
      }),
    [applicants, invitations, today],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        filter === "open"
          ? r.track === "hiring"
          : filter === "onboarding"
            ? r.track === "onboarding"
            : r.track === "no_fit",
      ),
    [rows, filter],
  );

  const sections = useMemo(
    () => buildWorkQueue<ApplicantRow>(filtered, classifyApplicant),
    [filtered],
  );
  const needsYou = countNeedsYou(sections);

  const counts = {
    open: rows.filter((r) => r.track === "hiring").length,
    onboarding: rows.filter((r) => r.track === "onboarding").length,
    closed: rows.filter((r) => r.track === "no_fit").length,
  };

  // The roadmap's hiring pulse: "a single thin summary strip rather than large
  // KPI cards... Numbers are clickable filters. Minimal color." Counts come
  // from the same rows the queue shows, so the strip and the queue cannot
  // disagree. Stages with nobody in them stay off the strip — a zero is noise.
  const pulse = useMemo(() => {
    const active = rows.filter((r) => r.track === "hiring");
    return HIRING_ORDER.filter((stage) => stage !== "applied" && stage !== "phone_screen")
      .map((stage) => ({
        stage,
        label: HIRING_STAGE_LABELS[stage],
        count: active.filter((r) => r.stage === stage).length,
      }))
      .filter((entry) => entry.count > 0);
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Hiring"
        description="Applicants and onboarding, organised by who is waiting on you."
        actions={<Button onClick={() => setInviting(true)}>Invite a candidate</Button>}
      />

      <p className="mb-5 text-sm text-muted-foreground">
        {needsYou === 0
          ? "Nothing is waiting on you in this view."
          : `${needsYou} ${needsYou === 1 ? "applicant needs" : "applicants need"} you today.`}
      </p>

      {pulse.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground" aria-label="Hiring pulse">
          {pulse.map((entry, i) => (
            <span key={entry.stage}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <span className="font-medium text-foreground">{entry.label}</span> {entry.count}
            </span>
          ))}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter applicants">
        {(
          [
            ["open", `Hiring (${counts.open})`],
            ["onboarding", `Onboarding (${counts.onboarding})`],
            ["closed", `Closed (${counts.closed})`],
          ] as Array<[Filter, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <WorkQueueSection
          key={section.group}
          section={section}
          renderItem={(item) => <ApplicantRowView item={item} onOpen={() => setSelected(item)} />}
          emptyNote={
            section.group === "needs_you"
              ? "Nothing needs you in this view."
              : section.group === "waiting"
                ? "Nobody outside the office is holding anything up."
                : "Nothing is further along in this view."
          }
        />
      ))}

      <InviteCandidateDialog
        open={inviting}
        onOpenChange={setInviting}
        onInvite={(draft) => {
          // §2's boundary in one action: the decision to move forward is what
          // creates the Joy record, so the applicant and the invitation are
          // made together rather than the record existing first and sitting
          // there uninvited.
          const id = `a-${Date.now()}`;
          const applicant: Applicant = {
            id,
            name: draft.name.trim(),
            roleApplied: draft.roleApplied.trim() || "Caregiver",
            track: "hiring",
            stage: "interview",
            onboardingStage: null,
            stageSince: today,
            appliedOn: today,
            source: "GHL",
            recruiter: null,
            email: draft.email.trim(),
            phone: draft.e164,
            availability: "Not yet given",
            drives: false,
            documents: {},
          };

          const invitation = issueInvitation({
            id: `inv-${id}`,
            subjectId: id,
            phone: draft.e164 as E164,
            token: newInvitationToken(),
            // Stand-in for the signed-in user. The domain refuses a null, so
            // this cannot quietly become an unattributed decision once auth
            // is wired — it becomes a compile-time hole to fill.
            byUserId: "u-demo",
            asOf: new Date().toISOString(),
          });

          setApplicants((all) => [applicant, ...all]);
          setInvitations((all) => ({ ...all, [id]: invitation }));
          setInviting(false);

          // Composed but not sent — nothing is connected. Showing the text Joy
          // would send is more honest than a toast claiming it went out.
          const preview = composeMessage("candidate_invitation", draft.e164 as E164, {
            firstName: draft.name.trim().split(" ")[0],
            link: `joyhealth.app/p/${invitation.token.slice(0, 8)}…`,
          });
          toast.success(`${applicant.name} added and ready to invite`, {
            description: `${preview.body} — via ${preview.carrier.toUpperCase()}, once SMS is connected.`,
          });
        }}
      />

      <ApplicantDrawer
        applicant={selected}
        today={today}
        onClose={() => setSelected(null)}
        onChange={(next) => {
          setApplicants((all) => all.map((a) => (a.id === next.id ? next : a)));
          setSelected(next);
        }}
        onHire={(applicant: Applicant, details: HireDetails) => {
          // The documents chased through hiring become the credential record.
          // Nothing is re-keyed and no dates are invented at this boundary.
          const employee = toEmployee(applicant, details);
          hireEmployee(employee);
          setApplicants((all) =>
            all.map((a) => (a.id === applicant.id ? { ...a, track: "hired" as const } : a)),
          );
          setSelected(null);
          toast.success(`${applicant.name} is now on staff`, {
            description: "Their credentials carried across. Open the record to check them.",
            action: { label: "Open", onClick: () => navigate(`/employees/${employee.id}`) },
          });
        }}
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, held in this screen only. Applicants are fictional; recruiters are real staff.
        The stage rules and the first-shift document gate are implemented and tested. Invitations
        are issued for real but not delivered — no SMS provider is connected.
      </p>
    </>
  );
}

function ApplicantRowView({ item, onOpen }: { item: ApplicantRow; onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {/* The name opens the record, as it does on Clients and Employees. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {item.name}
          </button>
          <span className="text-xs text-muted-foreground">
            {item.track === "onboarding" && item.onboardingStage
              ? ONBOARDING_STAGE_LABELS[item.onboardingStage]
              : HIRING_STAGE_LABELS[item.stage]}
          </span>
          {item.track === "hiring" && (
            <span className="text-xs text-muted-foreground">· {item.portal}</span>
          )}
          {item.stale && (
            <span className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--warning))]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Stale
            </span>
          )}
          {item.blockedCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              Blocked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.headline}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.roleApplied} · {item.source} · {item.recruiter ?? "No recruiter assigned"} ·{" "}
          {item.days === 0 ? "moved today" : `${item.days}d in stage`}
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-center" onClick={onOpen}>
        {item.action}
      </Button>
    </div>
  );
}
