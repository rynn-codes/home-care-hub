import { useMemo, useState } from "react";
import { CalendarCheck, Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  COMPLETION_MESSAGES,
  bookSupervisoryVisit,
  completeSupervisoryVisit,
  completionRefusals,
  supervisionHeadline,
  supervisionQueue,
  type SupervisionStatus,
  type SupervisoryVisit,
} from "@/domain/supervision/supervision";
import { activePlan, reviewDueOn, type CarePlan } from "@/domain/carePlan/plan";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedStartOfCare, seedSupervisoryVisits } from "@/lib/supervisionSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { cn } from "@/lib/utils";

const RN = "u-karynn";

/** Everybody Joy is serving, from the schedule — the same derivation Care plans uses. */
function clientsOnTheSchedule() {
  const seen = new Map<string, string>();
  for (const visit of seedVisits) {
    if (visit.clientPersonId && !seen.has(visit.clientPersonId)) {
      seen.set(visit.clientPersonId, visit.clientName);
    }
  }
  return [...seen].map(([personId, name]) => ({
    personId,
    name,
    startOfCare: seedStartOfCare[personId] ?? "",
  }));
}

function Row({
  status,
  plan,
  onBook,
  onComplete,
}: {
  status: SupervisionStatus;
  plan: CarePlan | null;
  onBook: (visit: SupervisoryVisit) => void;
  onComplete: (visit: SupervisoryVisit, plan: CarePlan | null) => void;
}) {
  const [date, setDate] = useState("");
  const [findings, setFindings] = useState("");
  const [planReviewed, setPlanReviewed] = useState(true);

  const booked = status.booked;
  const refusals = booked ? completionRefusals(booked, findings) : [];

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-5",
        status.needsYou ? "border-[hsl(var(--warning)/0.5)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {status.needsYou ? (
              <TriangleAlert
                className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]"
                aria-hidden="true"
              />
            ) : status.booked ? (
              <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
            )}
            {status.clientName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {supervisionHeadline(status)}
            {status.last?.completedAt && ` · last visit ${status.last.completedAt.slice(0, 10)}`}
          </p>
        </div>

        {plan && (
          <p className="shrink-0 text-xs text-muted-foreground">
            Care plan review due {reviewDueOn(plan)}
          </p>
        )}
      </div>

      {status.last?.findings && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {status.last.findings}
        </p>
      )}

      {/* ---------------------------------------------------------- book -- */}
      {!booked && status.needsYou && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div>
            <label
              htmlFor={`book-${status.clientPersonId}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Book a visit for
            </label>
            <Input
              id={`book-${status.clientPersonId}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button
            size="sm"
            disabled={!date}
            onClick={() => {
              onBook(
                bookSupervisoryVisit({
                  id: `sv-${status.clientPersonId}-${Date.now()}`,
                  clientPersonId: status.clientPersonId,
                  clientName: status.clientName,
                  scheduledFor: date,
                  assignedToUserId: RN,
                }),
              );
              toast.success(`Booked for ${date}`);
            }}
          >
            Book it
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------- record -- */}
      {booked && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <label
            htmlFor={`findings-${status.clientPersonId}`}
            className="text-xs font-medium"
          >
            What did you see?
          </label>
          <Textarea
            id={`findings-${status.clientPersonId}`}
            rows={2}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="What the care looked like, and whether the plan still fits."
          />

          {plan && (
            // Ticked by default because it is what the visit is for. Both
            // records move together or one of them is wrong: a plan whose
            // clock says nobody has looked at it in a year, and a supervisory
            // visit from last week saying somebody did.
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={planReviewed}
                onCheckedChange={(v) => setPlanReviewed(v === true)}
              />
              I reviewed the care plan on this visit
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={refusals.length > 0}
              onClick={() => {
                const out = completeSupervisoryVisit({
                  visit: booked,
                  findings,
                  carePlanReviewed: planReviewed,
                  plan,
                  byUserId: RN,
                  at: new Date().toISOString(),
                });
                onComplete(out.visit, out.plan);
                toast.success(
                  out.visit.carePlanReviewed
                    ? "Recorded — the care plan review clock has reset too"
                    : "Recorded",
                );
              }}
            >
              Record the visit
            </Button>
            {refusals.length > 0 && (
              <p className="text-xs text-muted-foreground">{COMPLETION_MESSAGES[refusals[0]]}</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function Supervision() {
  const [visits, setVisits] = useState<SupervisoryVisit[]>(seedSupervisoryVisits);
  const [plans, setPlans] = useState<CarePlan[]>(seedCarePlans);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const clients = useMemo(clientsOnTheSchedule, []);

  const rows = supervisionQueue({ clients, visits, today });
  const overdue = rows.filter((r) => r.daysRemaining < 0 && !r.booked).length;

  return (
    <>
      <PageHeader
        title="Supervisory visits"
        description="The annual supervision the service agreement commits Joy to, and who is waiting for one."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        {overdue === 0
          ? "Nothing overdue."
          : `${overdue} overdue`}
        {" · "}
        {rows.filter((r) => r.booked).length} booked
      </p>

      <ul className="space-y-4">
        {rows.map((row) => (
          <Row
            key={row.clientPersonId}
            status={row}
            plan={activePlan(plans, row.clientPersonId)}
            onBook={(visit) => setVisits((all) => [...all, visit])}
            onComplete={(visit, plan) => {
              setVisits((all) => all.map((v) => (v.id === visit.id ? visit : v)));
              if (plan) setPlans((all) => all.map((p) => (p.id === plan.id ? plan : p)));
            }}
          />
        ))}
      </ul>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        The client record has always shown this obligation counting down. What it could not do
        was anything about it — nothing booked a visit, nothing recorded one, and nothing reset
        the clock afterwards, so a client supervised last month still read overdue. This is where
        that gets closed.
      </p>
    </>
  );
}
