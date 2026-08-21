import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, CircleDashed, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  UNCOVERED,
  surveyReadiness,
  type ReadinessLine,
} from "@/domain/audit/surveyReadiness";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedIncidents } from "@/lib/incidentsSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedStartOfCare, seedSupervisoryVisits } from "@/lib/supervisionSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedClients } from "@/lib/clientsSeed";
import { cn } from "@/lib/utils";

/**
 * The audit home — Karynn, 21 August: "Is there a home for the audit portion?"
 *
 * There was not. Joy could build an audit packet for one employee, from inside
 * that employee's record, and that was all — so the thing an agency needs on the
 * morning somebody arrives with a clipboard did not exist. You would have had to
 * know to open eleven records one at a time.
 *
 * Written as questions rather than as metrics on purpose. "94% compliant" is a
 * number nobody can act on; "show me the personnel file for each caregiver" is
 * the sentence that will actually be said in the room, and the answer under it
 * is what Joy would say back.
 */

const MARK: Record<ReadinessLine["state"], { icon: typeof Check; tone: string }> = {
  ready: { icon: Check, tone: "text-[hsl(var(--success))]" },
  gaps: { icon: TriangleAlert, tone: "text-[hsl(var(--warning))]" },
  not_held: { icon: CircleDashed, tone: "text-muted-foreground" },
};

export default function Audit() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const servedClients = useMemo(
    () => [
      ...new Map(
        seedVisits
          .filter((v) => v.clientPersonId)
          .map((v) => [
            v.clientPersonId!,
            {
              personId: v.clientPersonId!,
              name: v.clientName,
              startOfCare: seedStartOfCare[v.clientPersonId!] ?? "",
            },
          ]),
      ).values(),
    ],
    [],
  );

  const readiness = useMemo(
    () =>
      surveyReadiness({
        today,
        workforce: seedEmployees,
        requirements: seedCredentialRequirements,
        incidents: seedIncidents,
        carePlans: seedCarePlans,
        servedClients,
        supervisoryVisits: seedSupervisoryVisits,
        clients: seedClients,
      }),
    [today, servedClients],
  );

  return (
    <>
      <PageHeader
        title="Audit"
        description="What a surveyor asks for, and what Joy can show them this morning."
      />

      <p className="mb-6 text-sm">{readiness.headline}</p>

      <ul className="space-y-3">
        {readiness.lines.map((line) => {
          const { icon: Icon, tone } = MARK[line.state];
          return (
            <li
              key={line.key}
              className={cn(
                "rounded-2xl border bg-surface p-5",
                line.state === "gaps" ? "border-[hsl(var(--warning)/0.5)]" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-start gap-2 text-sm font-medium">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden="true" />
                    <span>&ldquo;{line.question}&rdquo;</span>
                  </p>
                  <p className="mt-1 pl-6 text-sm text-muted-foreground">{line.answer}</p>
                </div>

                <Button size="sm" variant="outline" asChild>
                  <Link to={line.to}>Open</Link>
                </Button>
              </div>

              {line.gaps.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pl-6 pt-3 text-sm text-muted-foreground">
                  {line.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-8 rounded-2xl border border-border bg-surface-muted p-5">
        <h2 className="text-sm font-semibold">What is not on this page</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Texas licenses home and community support services agencies against a longer list than
          this. These are things a surveyor may ask for that Joy holds no data on, so nothing above
          can speak to them. They are named rather than left off — a screen of green lines is how
          somebody concludes they are ready when they are not.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {UNCOVERED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Every count here composes an engine the modules already use — the same{" "}
        <code>complianceAlerts</code>, <code>carePlanQueue</code>, <code>supervisionQueue</code>{" "}
        and <code>annualIncidentLog</code> the screens read. A figure here that disagreed with the
        screen it links to would be a bug in one of those, not a difference of emphasis.
      </p>
    </>
  );
}
