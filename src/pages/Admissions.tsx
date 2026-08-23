import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkQueueSection } from "@/components/work-queue/WorkQueueSection";
import { buildWorkQueue, countNeedsYou } from "@/domain/workQueue";
import { classifyAdmission } from "@/domain/admissions/classify";
import { followUp } from "@/domain/admissions/intake";
import { STAGE_LABELS, type AdmissionStage } from "@/domain/admissions/stages";
import { NewReferralDrawer } from "@/components/admissions/NewReferralDrawer";
import { type SeedAdmission } from "@/lib/admissionsSeed";
import { useDemo } from "@/context/DemoDataProvider";
import { useNavigate } from "react-router-dom";
import { newId } from "@/lib/demoStore";
import type { ReferralDraft } from "@/domain/admissions/referral";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Admissions — the work queue, to the approved mock's frame: the stage
 * filter tabs with counts, the stalled-record banner, the grouped queue
 * (Needs you / Waiting / Moving forward, each under its colored dot) and
 * the Today + Ask Joy rail.
 *
 * Organised by who holds the next move, not by pipeline column. Section 3
 * of the Admissions Master Build Spec is explicit that this is more useful
 * than exposing the whole roadmap at once, and section 2 warns against a
 * many-column pipeline — which is also why the mock's kanban Board view is
 * deliberately not built: the queue IS the spec's preferred surface, and a
 * second view of the same records would need its own reason to exist.
 *
 * Reads demo seed. The domain logic underneath — classification, stage
 * rules, duplicate detection, follow-up escalation — is real and tested.
 */

const STAGE_FILTERS: Array<{ label: string; stage: AdmissionStage | "all" }> = [
  { label: "All", stage: "all" },
  { label: "New Referrals", stage: "new_referral" },
  { label: "Phone Intake", stage: "phone_intake" },
  { label: "Assessment", stage: "assessment" },
  { label: "Pre-Onboarding", stage: "pre_onboarding" },
  { label: "Ready for Admission", stage: "ready_for_admission" },
];

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function AdmissionRow({
  item,
  onAction,
  waiting,
}: {
  item: SeedAdmission;
  onAction: (item: SeedAdmission) => void;
  waiting: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-[18px] py-4 transition-colors hover:bg-[#FAFAFB]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
        {initialsOf(item.name)}
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{item.name}</span>
          <span className="inline-flex whitespace-nowrap rounded-full bg-[#F3F3F6] px-2 py-[2px] text-[10.5px] font-medium text-[#5B6274]">
            {STAGE_LABELS[item.stage]}
          </span>
          {item.overdue && (
            <span className="inline-flex whitespace-nowrap rounded-full bg-[#FFFAEB] px-2 py-[2px] text-[10.5px] font-medium text-[#B54708]">
              Overdue
            </span>
          )}
        </span>
        <span className="text-[12.5px] text-[#5B6274]">{item.headline}</span>
        <span className="text-[11.5px] text-muted-foreground">
          {item.service} · {item.location} · {item.meta}
        </span>
      </div>
      <span className="ml-auto flex flex-none items-center">
        {waiting && !item.overdue ? (
          <button
            type="button"
            onClick={() => onAction(item)}
            className="h-[30px] rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
          >
            {item.action}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction(item)}
            className="h-[30px] rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] font-medium text-primary transition-colors hover:bg-[#EEF0FE]"
          >
            {item.action}
          </button>
        )}
      </span>
    </div>
  );
}

export default function Admissions() {
  const [stage, setStage] = useState<AdmissionStage | "all">("all");
  const [q, setQ] = useState("");
  const [referralOpen, setReferralOpen] = useState(false);
  const navigate = useNavigate();
  const { admissions, people, intakes, addReferral, scheduleEvents } = useDemo();

  // Stands in for the create service until the migrations are applied. It
  // persists to localStorage so the demo survives a refresh, and the
  // confirmation says plainly that this is not a database write.
  const handleCreate = (draft: ReferralDraft) => {
    const name = [draft.preferredName || draft.firstName, draft.lastName]
      .filter(Boolean)
      .join(" ");
    const id = newId("adm");

    addReferral(
      {
        id,
        name,
        stage: "new_referral",
        status: "active",
        service: draft.serviceRequested
          ? draft.serviceRequested.replace(/_/g, " ")
          : "Not specified",
        location: draft.serviceArea || "Not specified",
        headline: "New referral — no one has called back yet",
        meta: draft.referralNote || "Just added",
        action: "Start intake",
      },
      {
        personId: newId("per"),
        firstName: draft.firstName,
        lastName: draft.lastName,
        preferredName: draft.preferredName || null,
        phone: draft.phone || draft.contactPhone || null,
        email: draft.email || null,
        dateOfBirth: draft.dateOfBirth || null,
        responsiblePartyName: draft.contactIsSomeoneElse ? draft.contactName : null,
        openAdmissionStage: "new_referral",
      },
    );

    toast.success("Referral added", {
      description: "Saved on this device. Not yet written to a database.",
    });
  };

  // Every row's button goes somewhere. A count or an action that leads
  // nowhere is a dead end, which the definition of done rules out.
  const handleAction = (item: SeedAdmission) => {
    if (item.stage === "new_referral" || item.stage === "phone_intake") {
      navigate(`/admissions/${item.id}/intake`);
      return;
    }
    if (item.stage === "assessment") {
      navigate(
        intakes[item.id]?.completedAt
          ? `/admissions/${item.id}/assessment`
          : `/admissions/${item.id}/intake`,
      );
      return;
    }
    if (["pre_onboarding", "ready_for_admission", "admitted"].includes(item.stage)) {
      navigate(`/admissions/${item.id}/review`);
      return;
    }
    toast.info(`${item.action} is not built yet.`, {
      description: "The flow from referral through admission is.",
    });
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const escalated = useMemo(
    () =>
      admissions.map((a) => {
        // The intake form's follow-up date is the whole reason it is asked.
        // A caller who did not book an in-home visit is the one who quietly
        // disappears, so an overdue follow-up escalates into "needs you".
        const answers = intakes[a.id]?.answers;
        if (!answers) return a;
        const state = followUp(answers, today);
        if (state.state !== "overdue" && state.state !== "due") return a;
        return { ...a, overdue: true, headline: state.note };
      }),
    [admissions, intakes, today],
  );

  const filtered = useMemo(
    () =>
      escalated
        .filter((a) => stage === "all" || a.stage === stage)
        .filter((a) => !q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase())),
    [escalated, stage, q],
  );

  const countFor = (s: AdmissionStage | "all") =>
    s === "all" ? escalated.length : escalated.filter((a) => a.stage === s).length;

  const stalled = escalated.find((a) => a.overdue);

  const sections = useMemo(
    () => buildWorkQueue<SeedAdmission>(filtered, classifyAdmission),
    [filtered],
  );
  const needsYou = countNeedsYou(sections);

  const todaysEvents = useMemo(
    () =>
      scheduleEvents
        .filter((e) => e.startsAt.slice(0, 10) === today)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [scheduleEvents, today],
  );

  return (
    <>
      <PageHeader
        title="Admissions"
        description="Move a referral to a ready client without losing a step."
        actions={
          <>
            <div className="flex h-[34px] w-full items-center gap-2 rounded-[9px] border border-[#ECECF1] bg-white px-2.5 sm:w-[212px]">
              <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search admissions"
                aria-label="Search admissions"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => setReferralOpen(true)}
              className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              New referral
            </button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-5 overflow-x-auto border-b border-[#ECECF1]" role="tablist" aria-label="Filter by stage">
        {STAGE_FILTERS.map((f) => (
          <button
            key={f.stage}
            role="tab"
            aria-selected={stage === f.stage}
            onClick={() => setStage(f.stage)}
            className={cn(
              "-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
              stage === f.stage
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-[7px] py-px text-[11px]",
                stage === f.stage ? "bg-[#EEF0FE] text-primary" : "bg-[#F3F3F6] text-muted-foreground",
              )}
            >
              {countFor(f.stage)}
            </span>
          </button>
        ))}
      </div>

      {stalled && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#ECECF1] bg-white px-4 py-3">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
          <span className="text-[13px] [text-wrap:pretty]">
            <span className="font-medium">{stalled.name}</span> — {stalled.headline}
          </span>
          <span className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              disabled
              title="Reminders go through Spruce — not wired in the prototype"
              className="h-[30px] cursor-not-allowed rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] text-muted-foreground/50"
            >
              Send reminder
            </button>
            <button
              type="button"
              onClick={() => handleAction(stalled)}
              className="h-[30px] rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] text-[#5B6274] transition-colors hover:bg-[#F1F2F6] hover:text-foreground"
            >
              Open record
            </button>
          </span>
        </div>
      )}

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mb-4 mt-0 text-sm text-muted-foreground">
            {needsYou === 0
              ? "Nothing is waiting on you right now."
              : `${needsYou} ${needsYou === 1 ? "record needs" : "records need"} you today.`}
          </p>

          {sections.map((section) => (
            <WorkQueueSection
              key={section.group}
              section={section}
              renderItem={(item) => (
                <AdmissionRow item={item} onAction={handleAction} waiting={section.group === "waiting"} />
              )}
              emptyNote={
                section.group === "needs_you"
                  ? "Nothing needs you in this view."
                  : section.group === "waiting"
                    ? "Nobody outside the office is holding anything up."
                    : "Nothing is booked further ahead in this view."
              }
            />
          ))}
        </div>

        <div className="flex flex-col gap-3.5">
          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
              Today
            </h2>
            {todaysEvents.length === 0 ? (
              <p className="m-0 py-1 text-[12.5px] text-muted-foreground">
                No assessments booked today.
              </p>
            ) : (
              <div className="flex flex-col">
                {todaysEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-2 last:border-0">
                    <span className="w-[62px] flex-none text-xs text-muted-foreground">
                      {new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="flex flex-col leading-[1.3]">
                      <span className="text-[12.5px]">{e.clientName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        RN assessment · {e.assessorName}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <span className="flex items-center gap-2">
              <span
                className="h-[7px] w-[7px] flex-none rounded-full bg-[#8FA0FF]"
                style={{ animation: "joyGlow 2.6s ease-in-out infinite" }}
                aria-hidden="true"
              />
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Ask Joy
              </h2>
            </span>
            <div className="flex flex-col gap-px">
              {[
                "Who is stalled in the pipeline?",
                "What is missing before the next admission?",
                "Summarize this week's referrals",
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: p } }))
                  }
                  className="rounded-lg p-2 text-left text-[12.5px] leading-[1.4] text-muted-foreground transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <NewReferralDrawer
        open={referralOpen}
        onOpenChange={setReferralOpen}
        existingPeople={people}
        onCreate={handleCreate}
        onOpenExisting={() => toast.info("Opening the existing record is not built yet.")}
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. The queue logic, stage rules and duplicate check
        are implemented and tested; connecting them to a database is the next step.
      </p>
    </>
  );
}
