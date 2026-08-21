import { useMemo, useState } from "react";
import { AlertTriangle, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  PLAN_GAP_MESSAGES,
  QUEUE_REASON_LABELS,
  TASK_CATEGORY_LABELS,
  activatePlan,
  carePlanQueue,
  planGaps,
  replacePlan,
  reviewDueOn,
  reviewPlan,
  type CarePlan,
  type CarePlanQueueRow,
  type TaskCategory,
} from "@/domain/carePlan/plan";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { cn } from "@/lib/utils";

const RN = "u-karynn";

/** Everybody Joy is actually serving, taken from the schedule. */
function clientsOnTheSchedule() {
  const seen = new Map<string, string>();
  for (const visit of seedVisits) {
    if (visit.clientPersonId && !seen.has(visit.clientPersonId)) {
      seen.set(visit.clientPersonId, visit.clientName);
    }
  }
  return [...seen].map(([personId, name]) => ({ personId, name }));
}

const CATEGORY_ORDER: TaskCategory[] = ["personal", "elimination", "activity", "household"];

const PLAN_STATE_LABELS: Record<CarePlan["state"], string> = {
  draft: "draft",
  in_review: "waiting for review",
  active: "live",
  superseded: "retired",
};

function PlanBody({ plan }: { plan: CarePlan }) {
  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {/* Which version this is. Without it the header's "version 1" and a
          revision's contents are on screen together with nothing saying they
          are different documents. */}
      <p className="text-xs text-muted-foreground">
        Version {plan.version} · {PLAN_STATE_LABELS[plan.state]}
        {plan.supersedes && " · replaces the version being followed today"}
      </p>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What the care is for
        </p>
        <ul className="mt-1 text-sm">
          {plan.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
          {plan.goals.length === 0 && <li className="text-muted-foreground">Not answered.</li>}
        </ul>
      </div>

      {CATEGORY_ORDER.filter((c) => plan.tasks.some((t) => t.category === c)).map((category) => (
        <div key={category}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {TASK_CATEGORY_LABELS[category]}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {plan.tasks
              .filter((t) => t.category === category)
              .map((task) => (
                <li key={task.id}>
                  {task.label}
                  {task.required && (
                    <span className="ml-1.5 text-xs text-muted-foreground">required</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Call the RN when
        </p>
        {plan.vitals.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No parameters. The caregiver would not know when to call.
          </p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {plan.vitals.map((v) => (
              <li key={v.key}>
                {v.label} <span className="font-medium">{v.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(plan.equipment.length > 0 || plan.supplies.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {plan.equipment.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Already in the home
              </p>
              <p className="mt-1 text-sm">{plan.equipment.join(", ")}</p>
            </div>
          )}
          {plan.supplies.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Joy provides
              </p>
              <p className="mt-1 text-sm">{plan.supplies.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {plan.emergencyPlan && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            In an emergency
          </p>
          <p className="mt-1 text-sm">{plan.emergencyPlan}</p>
        </div>
      )}
    </div>
  );
}

function QueueCard({
  row,
  onChange,
}: {
  row: CarePlanQueueRow;
  onChange: (plans: CarePlan[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = row.pending ?? row.active;
  const gaps = shown ? planGaps(shown) : [];

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-5",
        row.needsYou ? "border-[hsl(var(--warning)/0.5)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {row.needsYou ? (
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]"
                aria-hidden="true"
              />
            ) : (
              <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
            )}
            {row.clientName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {QUEUE_REASON_LABELS[row.reason]}
            {row.active && ` · version ${row.active.version}`}
            {row.active?.expectedEnd.kind === "fixed" &&
              ` · care to ${row.active.expectedEnd.endsOn}`}
            {row.active?.expectedEnd.kind === "until_recovered" && " · until recovered"}
            {row.active && reviewDueOn(row.active) && ` · review due ${reviewDueOn(row.active)}`}
          </p>
        </div>

        {shown && (
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide plan" : row.pending ? "Read the change" : "Read the plan"}
          </Button>
        )}
      </div>

      {row.reason === "past_end_date" && row.active?.expectedEnd.kind === "fixed" && (
        // Timed care that quietly continues is money and consent both: the
        // visits are still being scheduled and nobody has asked the family
        // whether they still want them.
        <p className="mt-3 text-sm text-muted-foreground">
          {row.clientName}&rsquo;s care was agreed to {row.active.expectedEnd.endsOn} and is still
          running. Either the family has extended it and nobody wrote that down, or it should have
          finished.
        </p>
      )}

      {row.reason === "no_plan" && (
        // Said plainly, because this is a client receiving care that nobody has
        // written down. The caregiver's screen tells her the same thing.
        <p className="mt-3 text-sm text-muted-foreground">
          {row.clientName} has visits on the schedule and no care plan. The caregiver arrives
          with no task list, and nothing records what Joy agreed to do.
        </p>
      )}

      {open && shown && <PlanBody plan={shown} />}

      {row.pending && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {!row.pending.reviewedAt ? (
            <Button
              size="sm"
              onClick={() => {
                const reviewed = reviewPlan({
                  plan: row.pending!,
                  byUserId: RN,
                  at: new Date().toISOString(),
                });
                onChange([reviewed]);
                toast.success("Reviewed — it can go live now");
              }}
            >
              Mark reviewed
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={gaps.length > 0}
              onClick={() => {
                const at = new Date().toISOString();
                if (row.active) {
                  const { previous, revision } = replacePlan({
                    previous: row.active,
                    revision: row.pending!,
                    at,
                  });
                  onChange([previous, revision]);
                } else {
                  onChange([activatePlan({ plan: row.pending!, at })]);
                }
                toast.success(`Version ${row.pending!.version} is live`);
              }}
            >
              Put version {row.pending.version} live
            </Button>
          )}
          {gaps.length > 0 && (
            <p className="text-xs text-muted-foreground">{PLAN_GAP_MESSAGES[gaps[0]]}</p>
          )}
        </div>
      )}
    </li>
  );
}

export default function CarePlans() {
  const [plans, setPlans] = useState<CarePlan[]>(seedCarePlans);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const clients = useMemo(clientsOnTheSchedule, []);

  const rows = carePlanQueue({ clients, plans, today });
  const needing = rows.filter((r) => r.needsYou).length;

  return (
    <>
      <PageHeader
        title="Care plans"
        description="What Joy agreed to do for each client, and who is still waiting for a plan."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        {needing === 0 ? (
          "Every client on the schedule has a current plan."
        ) : (
          <>
            <FileText className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            {needing} of {rows.length} need you
          </>
        )}
      </p>

      <ul className="space-y-4">
        {rows.map((row) => (
          <QueueCard
            key={row.clientPersonId}
            row={row}
            onChange={(changed) =>
              setPlans((all) =>
                all.map((p) => changed.find((c) => c.id === p.id) ?? p),
              )
            }
          />
        ))}
      </ul>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        A plan is never edited in place. A change makes a new version and the old one is retired
        the moment the new one goes live, so a visit charted last month still reads against the
        plan that was in effect that day.
      </p>
    </>
  );
}
