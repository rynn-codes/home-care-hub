import { useMemo, useState } from "react";
import { Plus, Search, ChevronDown, UserPlus, Phone, ClipboardCheck, CalendarPlus, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkQueueSection } from "@/components/work-queue/WorkQueueSection";
import { buildWorkQueue, countNeedsYou } from "@/domain/workQueue";
import { classifyAdmission } from "@/domain/admissions/classify";
import { followUp } from "@/domain/admissions/intake";
import { STAGE_LABELS, type AdmissionStage } from "@/domain/admissions/stages";
import { NewReferralDrawer } from "@/components/admissions/NewReferralDrawer";
import { PersonPickerDialog } from "@/components/admissions/PersonPickerDialog";
import {
  ScheduleAdmissionDialog,
  type ScheduleSubmission,
} from "@/components/admissions/ScheduleAdmissionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SeedAdmission } from "@/lib/admissionsSeed";
import { useDemo } from "@/context/DemoDataProvider";
import { useNavigate } from "react-router-dom";
import { newId } from "@/lib/demoStore";
import type { ReferralDraft } from "@/domain/admissions/referral";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** The RNs who carry out assessments. */
const ASSESSORS = ["Kelsey Westley, RN", "Karynn Verrett, RN"];

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
 *
 * Quick Add is the updated mock's "flexible entry": the office can enter the
 * process at any point. The + menu offers New lead (a quick capture, no DOB),
 * Start phone intake and Start assessment (each behind a person picker with
 * "start with a new person" always available), Schedule (a three-step modal),
 * and Upload document. Nothing blocks on a missing earlier step — a referral
 * can arrive as a booked assessment with no intake, and the gap stays visible.
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
  const [pickerMode, setPickerMode] = useState<"intake" | "assessment" | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const navigate = useNavigate();
  const { admissions, people, intakes, addReferral, scheduleEvents, scheduleAssessment } =
    useDemo();

  const intakeComplete = (admissionId: string) => Boolean(intakes[admissionId]?.completedAt);

  // Stands in for the create service until the migrations are applied. It
  // persists to localStorage so the demo survives a refresh. Returns the new
  // admission id so a caller can go straight on to intake or an assessment.
  const createLead = (
    fields: {
      name: string;
      firstName: string;
      lastName: string;
      preferredName?: string | null;
      phone?: string | null;
      email?: string | null;
      responsiblePartyName?: string | null;
      service?: string;
      location?: string;
      meta?: string;
    },
    announce = true,
  ): string => {
    const id = newId("adm");
    addReferral(
      {
        id,
        name: fields.name,
        stage: "new_referral",
        status: "active",
        service: fields.service || "Not specified",
        location: fields.location || "Not specified",
        headline: "New referral — no one has called back yet",
        meta: fields.meta || "Just added",
        action: "Start intake",
      },
      {
        personId: newId("per"),
        firstName: fields.firstName,
        lastName: fields.lastName,
        preferredName: fields.preferredName || null,
        phone: fields.phone || null,
        email: fields.email || null,
        dateOfBirth: null,
        responsiblePartyName: fields.responsiblePartyName || null,
        openAdmissionStage: "new_referral",
      },
    );
    if (announce) {
      toast.success("Lead added", {
        description: "Saved on this device. Not yet written to a database.",
      });
    }
    return id;
  };

  const handleCreate = (draft: ReferralDraft): string => {
    const name = [draft.preferredName || draft.firstName, draft.lastName]
      .filter(Boolean)
      .join(" ");
    return createLead({
      name,
      firstName: draft.firstName,
      lastName: draft.lastName,
      preferredName: draft.preferredName,
      phone: draft.phone || draft.contactPhone,
      email: draft.email,
      responsiblePartyName: draft.contactIsSomeoneElse ? draft.contactName : null,
      service: draft.serviceRequested ? draft.serviceRequested.replace(/_/g, " ") : "Not specified",
      location: draft.serviceArea || "Not specified",
      meta: draft.referralNote || "Just added",
    });
  };

  // A brand-new person captured inside the Schedule modal. Splits the single
  // contact name into first/last so the same person shape is written as a lead.
  const createLeadFromCapture = (contactName: string, personNeedingCare: string, phone: string, zip: string): string => {
    const careName = personNeedingCare.trim() || contactName.trim();
    const parts = careName.split(" ").filter(Boolean);
    return createLead(
      {
        name: careName,
        firstName: parts[0] ?? careName,
        lastName: parts.slice(1).join(" "),
        phone,
        responsiblePartyName: personNeedingCare.trim() ? contactName.trim() : null,
        location: zip.trim() || "Not specified",
        meta: "Added while scheduling",
      },
      false,
    );
  };

  const startIntake = (admissionId: string) => navigate(`/admissions/${admissionId}/intake`);
  const startAssessment = (admissionId: string) => {
    // If the intake was never completed, the assessment still opens — the flow
    // itself surfaces the gap. Route straight to the assessment.
    navigate(`/admissions/${admissionId}/assessment`);
  };

  const handleSchedule = (s: ScheduleSubmission) => {
    const admissionId = s.admissionId ?? (s.newPerson
      ? createLeadFromCapture(s.newPerson.contactName, s.newPerson.personNeedingCare, s.newPerson.phone, s.newPerson.zip)
      : null);
    if (!admissionId) return;

    const startsAt = new Date(`${s.date}T${s.time || "09:00"}`).toISOString();

    if (s.what === "assessment") {
      const intakeOutstanding = !intakeComplete(admissionId);
      scheduleAssessment({
        admissionId,
        clientName: s.clientName,
        assessorName: s.assignedTo,
        startsAt,
        durationMinutes: 90,
        address: s.address,
        notifyName: s.clientName,
      });
      toast.success("Assessment booked", {
        description: intakeOutstanding
          ? "Phone intake is still outstanding — it stays flagged on the record."
          : "The family will be notified through Spruce once it is connected.",
      });
    } else {
      toast.success("Phone intake scheduled", {
        description: s.newPerson
          ? "New lead created and dropped into New Leads."
          : "Noted on the record. Start the call from the queue when it is time.",
      });
    }
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                >
                  <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                  Quick add
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem className="gap-2.5 py-2" onSelect={() => setReferralOpen(true)}>
                  <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  New lead
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 py-2" onSelect={() => setPickerMode("intake")}>
                  <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Start phone intake
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 py-2" onSelect={() => setPickerMode("assessment")}>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Start assessment
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 py-2" onSelect={() => setScheduleOpen(true)}>
                  <CalendarPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Schedule
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2.5 py-2" onSelect={() => navigate("/documents")}>
                  <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Upload document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        onStartIntake={startIntake}
        onOpenExisting={() => toast.info("Opening the existing record is not built yet.")}
      />

      <PersonPickerDialog
        open={pickerMode !== null}
        onOpenChange={(next) => !next && setPickerMode(null)}
        mode={pickerMode ?? "intake"}
        admissions={escalated}
        intakeComplete={intakeComplete}
        onPick={(id) => (pickerMode === "assessment" ? startAssessment(id) : startIntake(id))}
        onStartNew={() => {
          setPickerMode(null);
          setReferralOpen(true);
        }}
      />

      <ScheduleAdmissionDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        admissions={escalated}
        assessors={ASSESSORS}
        intakeComplete={intakeComplete}
        onSubmit={handleSchedule}
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. The queue logic, stage rules and duplicate check
        are implemented and tested; connecting them to a database is the next step.
      </p>
    </>
  );
}
