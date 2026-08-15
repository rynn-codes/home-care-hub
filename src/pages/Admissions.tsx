import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { WorkQueueSection } from "@/components/work-queue/WorkQueueSection";
import { buildWorkQueue, countNeedsYou } from "@/domain/workQueue";
import { classifyAdmission } from "@/domain/admissions/classify";
import { STAGE_LABELS, type AdmissionStage } from "@/domain/admissions/stages";
import { seedAdmissions, type SeedAdmission } from "@/lib/admissionsSeed";
import { cn } from "@/lib/utils";

/**
 * Admissions — the work queue.
 *
 * Organised by who holds the next move, not by pipeline column. Section 3 of the
 * Admissions Master Build Spec is explicit that this is more useful than
 * exposing the whole roadmap at once, and section 2 warns against a fifteen
 * column pipeline.
 *
 * Reads demo seed. The domain logic underneath — classification, stage rules,
 * duplicate detection — is real and tested; only the data source is temporary.
 */

const STAGE_FILTERS: Array<{ label: string; stage: AdmissionStage | "all" }> = [
  { label: "All", stage: "all" },
  { label: "New Referrals", stage: "new_referral" },
  { label: "Phone Intake", stage: "phone_intake" },
  { label: "Assessment", stage: "assessment" },
  { label: "Pre-Onboarding", stage: "pre_onboarding" },
  { label: "Ready for Admission", stage: "ready_for_admission" },
];

function AdmissionRow({ item }: { item: SeedAdmission }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-sm font-medium">{item.name}</span>
          <span className="text-xs text-muted-foreground">{STAGE_LABELS[item.stage]}</span>
          {item.overdue && (
            <span className="text-xs font-medium text-[hsl(var(--warning))]">Overdue</span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.headline}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.service} · {item.location} · {item.meta}
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-center">
        {item.action}
      </Button>
    </div>
  );
}

export default function Admissions() {
  const [stage, setStage] = useState<AdmissionStage | "all">("all");

  const filtered = useMemo(
    () => seedAdmissions.filter((a) => stage === "all" || a.stage === stage),
    [stage],
  );

  const sections = useMemo(() => buildWorkQueue(filtered, classifyAdmission), [filtered]);
  const needsYou = countNeedsYou(sections);

  return (
    <>
      <PageHeader
        title="Admissions"
        description="Move a referral to a ready client without losing a step."
        actions={<Button>New referral</Button>}
      />

      <p className="mb-5 text-sm text-muted-foreground">
        {needsYou === 0
          ? "Nothing is waiting on you right now."
          : `${needsYou} ${needsYou === 1 ? "record needs" : "records need"} you today.`}
      </p>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
        {STAGE_FILTERS.map((f) => (
          <button
            key={f.stage}
            type="button"
            aria-pressed={stage === f.stage}
            onClick={() => setStage(f.stage)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              stage === f.stage
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <WorkQueueSection
          key={section.group}
          section={section}
          renderItem={(item) => <AdmissionRow item={item} />}
          emptyNote={
            section.group === "needs_you"
              ? "Nothing needs you in this view."
              : section.group === "waiting"
                ? "Nobody outside the office is holding anything up."
                : "Nothing is booked further ahead in this view."
          }
        />
      ))}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Showing demo seed data. The queue logic, stage rules and duplicate check are
        implemented and tested; connecting them to the database is the next step.
      </p>
    </>
  );
}
