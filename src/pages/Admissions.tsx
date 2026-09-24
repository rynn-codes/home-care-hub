import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  ClipboardCheck,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkQueueSection } from "@/components/work-queue/WorkQueueSection";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { NewReferralDrawer } from "@/components/admissions/NewReferralDrawer";
import { PersonPickerDialog } from "@/components/admissions/PersonPickerDialog";
import { ScheduleAdmissionDialog, type ScheduleSubmission } from "@/components/admissions/ScheduleAdmissionDialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildWorkQueue, countNeedsYou, type WorkQueueGroup } from "@/domain/workQueue";
import { classifyAdmission } from "@/domain/admissions/classify";
import { followUp } from "@/domain/admissions/intake";
import { STAGE_LABELS, checkTransition, type AdmissionStage } from "@/domain/admissions/stages";
import {
  QUEUE_ORDER,
  anticipatedStart,
  daysWaiting,
  isLongWait,
  nextStep,
  routeForStage,
  startOfCareAtRisk,
  waitingLabel,
  type AdmissionRoute,
} from "@/domain/admissions/queue";
import { careRecipientName, leadMeta, splitName, type LeadCapture } from "@/domain/admissions/leadCapture";
import { admissionConsequences, whyNotDeletable } from "@/domain/records/deletion";
import { canWrite } from "@/domain/access/roles";
import { seedAdmissionsHandled, type SeedAdmission } from "@/lib/admissionsSeed";
import { newId } from "@/lib/demoStore";
import { useDemo } from "@/context/DemoDataProvider";
import { useOpenRequest } from "@/hooks/use-open-request";
import { cn } from "@/lib/utils";

/** The RNs who carry out assessments. */
const ASSESSORS = ["Kelsey Westley, RN", "Karynn Verrett, RN"];

/**
 * Admissions — the work queue, to the approved mock's frame: the stage
 * filter tabs with counts, the stalled-record banner, the grouped queue
 * (Needs you / Waiting / Moving forward, each under its colored dot) and
 * the Today rail. A board view of the same records sits behind a toggle for
 * the people who think in columns; a card dragged between columns goes
 * through the same stage rules as everything else.
 *
 * Organised by who holds the next move, not by pipeline column. Section 3
 * of the Admissions Master Build Spec is explicit that this is more useful
 * than exposing the whole roadmap at once.
 *
 * Quick add is the updated mock's "flexible entry": the office can enter the
 * process at any point. New lead (a quick capture, no DOB), Start phone
 * intake and Start assessment (each behind a person picker with "start with
 * a new person" always available), Schedule (a three-step modal), and Upload
 * document. Nothing blocks on a missing earlier step — a referral can arrive
 * as a booked assessment with no intake, and the gap stays visible.
 *
 * Deleting is for the record that should never have been made — a
 * duplicate, the wrong person, somebody who never wanted care. It asks why,
 * lists what goes with it, and bins rather than shreds. A record that became
 * a client cannot be deleted from here at all.
 */

const STAGE_FILTERS: Array<{ label: string; stage: AdmissionStage | "all" }> = [
  { label: "All", stage: "all" },
  { label: "New leads", stage: "new_referral" },
  { label: "Phone intake", stage: "phone_intake" },
  { label: "Assessment", stage: "assessment" },
  { label: "Pre-onboarding", stage: "pre_onboarding" },
  { label: "Ready", stage: "ready_for_admission" },
  { label: "Admitted", stage: "admitted" },
];

const SERVICES = ["Personal Care", "Post-Surgical", "Respite"];

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

interface QueueItem extends SeedAdmission {
  route: AdmissionRoute | null;
  daysWaiting: number | null;
  atRisk: boolean;
}

function AdmissionRow({
  item,
  onAction,
  onDelete,
  group,
}: {
  item: QueueItem;
  onAction: (item: QueueItem) => void;
  onDelete?: (item: QueueItem) => void;
  group: WorkQueueGroup;
}) {
  const waiting = group === "waiting";
  const waitLabel = group === "moving_forward" ? null : waitingLabel(item.daysWaiting);
  const long = isLongWait(item.daysWaiting);

  return (
    <div className="flex items-center gap-4 px-[18px] py-4 transition-colors hover:bg-[var(--wash)]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
        {initialsOf(item.name)}
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{item.name}</span>
          <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--hairline-soft)] px-2 py-[2px] text-[10.5px] font-medium text-[var(--ink-body)]">
            {STAGE_LABELS[item.stage]}
          </span>
          {item.overdue && (
            <span className="inline-flex whitespace-nowrap rounded-full bg-[#FFFAEB] px-2 py-[2px] text-[10.5px] font-medium text-[#B54708]">
              Overdue
            </span>
          )}
          {item.atRisk && !item.overdue && (
            <span className="inline-flex whitespace-nowrap rounded-full bg-[#FDF0E7] px-2 py-[2px] text-[10.5px] font-medium text-[#C2410C]">
              Start of care at risk
            </span>
          )}
          {waitLabel && (
            <span
              className={cn(
                "inline-flex whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-medium",
                long ? "bg-[#FDF0E7] text-[#C2410C]" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
              )}
            >
              {waitLabel}
            </span>
          )}
        </span>
        <span className="text-[12.5px] text-[var(--ink-body)]">{item.headline}</span>
        <span className="text-[11.5px] text-muted-foreground">
          {item.service} · {item.location} · {item.meta}
        </span>
      </div>
      <span className="ml-auto flex flex-none items-center gap-1">
        {waiting && !item.overdue ? (
          <button
            type="button"
            onClick={() => onAction(item)}
            className="h-[30px] rounded-[20px] border border-[var(--hairline)] bg-[var(--paper)] px-[13px] text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
          >
            {item.action}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction(item)}
            className="h-[30px] rounded-[20px] border border-[#1407A2]/[.28] bg-[var(--paper)] px-[13px] text-[12.5px] font-medium text-primary transition-colors hover:bg-[#EEF0FE]"
          >
            {item.action}
          </button>
        )}
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More for ${item.name}`}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--hairline-soft)] hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-[#B42318] focus:text-[#B42318]" onSelect={() => onDelete(item)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Delete this record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
  const [deleting, setDeleting] = useState<QueueItem | null>(null);
  const navigate = useNavigate();

  // The header's New menu lands here asking for a dialog.
  const requested = useOpenRequest<"referral" | "assessment">();
  useEffect(() => {
    if (requested === "referral") setReferralOpen(true);
    if (requested === "assessment") setPickerMode("assessment");
  }, [requested]);

  const {
    admissions,
    people,
    intakes,
    assessments,
    consentSessions,
    preOnboarding,
    currentUser,
    addReferral,
    deleteAdmission,
    restoreDeleted,
    scheduleEvents,
    scheduleAssessment,
  } = useDemo();

  const mayDelete = (a: SeedAdmission) =>
    canWrite(currentUser.role) &&
    !whyNotDeletable({ stage: a.stage, activated: !!preOnboarding[a.id]?.activatedAt });

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
        waitingOn: "Joy",
        waitingSince: new Date().toISOString(),
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

  const handleCreate = (lead: LeadCapture): string => {
    const name = careRecipientName(lead);
    const { firstName, lastName } = splitName(name);
    const someoneElse = lead.personNeedingCare.trim().length > 0;
    return createLead({
      name,
      firstName,
      lastName,
      phone: lead.phone,
      email: lead.email,
      responsiblePartyName: someoneElse ? lead.contactName.trim() : null,
      service: "Not specified",
      location: lead.zip.trim() || "Not specified",
      meta: leadMeta(lead),
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
    const admissionId =
      s.admissionId ??
      (s.newPerson
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
  const handleAction = (item: QueueItem) => {
    const route = item.route ?? routeForStage(item.stage);
    if (route) {
      navigate(`/admissions/${item.id}/${route}`);
      return;
    }
    toast.info(`${item.action} is not built yet.`, {
      description: "The flow from referral through admission is.",
    });
  };

  // Board view: a card dropped on a column asks the stage rules first. The
  // move is held on this screen only — it is a demo of the gesture, not a
  // second way to change a record behind the flow's back.
  const [stageOverrides, setStageOverrides] = useState<Record<string, AdmissionStage>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<AdmissionStage | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const now = useMemo(() => new Date(), []);

  const escalated = useMemo(
    () =>
      admissions.map((a) => {
        const record = stageOverrides[a.id] ? { ...a, stage: stageOverrides[a.id] } : a;
        // The intake form's follow-up date is the whole reason it is asked.
        // A caller who did not book an in-home visit is the one who quietly
        // disappears, so an overdue follow-up escalates into "needs you".
        const answers = intakes[record.id]?.answers;
        if (!answers) return record;
        const state = followUp(answers, today);
        if (state.state !== "overdue" && state.state !== "due") return record;
        return { ...record, overdue: true, headline: state.note };
      }),
    [admissions, intakes, today, stageOverrides],
  );

  const dropOn = (to: AdmissionStage) => {
    const id = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!id) return;
    const record = escalated.find((a) => a.id === id);
    if (!record || record.stage === to) return;
    const check = checkTransition(record.stage, to);
    if (!check.allowed) {
      toast.error(`${record.name} stays at ${STAGE_LABELS[record.stage]}`, { description: check.reason });
      return;
    }
    setStageOverrides((s) => ({ ...s, [id]: to }));
    toast.success(`${record.name} moved to ${STAGE_LABELS[to]}`, { description: "Saved on this device." });
  };

  const [service, setService] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const activeFilters = (service !== "all" ? 1 : 0) + (overdueOnly ? 1 : 0);
  const passesFilters = (a: SeedAdmission) => (service === "all" || a.service === service) && (!overdueOnly || !!a.overdue);

  const filtered = useMemo(
    () =>
      escalated
        .filter((a) => (stage === "all" ? a.stage !== "admitted" : a.stage === stage))
        .filter(passesFilters)
        .filter((a) => !q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escalated, stage, q, service, overdueOnly],
  );

  const countFor = (s: AdmissionStage | "all") => {
    const pool = escalated.filter(passesFilters);
    return s === "all" ? pool.filter((a) => a.stage !== "admitted").length : pool.filter((a) => a.stage === s).length;
  };

  const stalled = escalated.find((a) => a.overdue);

  const rows = useMemo<QueueItem[]>(
    () =>
      filtered.map((a) => {
        const step = nextStep({
          stage: a.stage,
          intakeStarted: !!intakes[a.id],
          intakeComplete: !!intakes[a.id]?.completedAt,
          assessmentStarted: !!assessments[a.id],
          assessmentComplete: !!assessments[a.id]?.completedAt,
          packetSigned: !!consentSessions[a.id]?.signedAt,
        });
        return {
          ...a,
          action: step?.label ?? a.action,
          route: step?.route ?? routeForStage(a.stage),
          daysWaiting: daysWaiting(a, now),
          atRisk: startOfCareAtRisk(anticipatedStart(intakes[a.id]?.answers), a.stage, today),
        };
      }),
    [filtered, intakes, assessments, consentSessions, today, now],
  );

  const sections = useMemo(() => buildWorkQueue<QueueItem>(rows, classifyAdmission, QUEUE_ORDER), [rows]);
  const needsYou = countNeedsYou(sections);
  const [handledOpen, setHandledOpen] = useState(false);

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
        actions={
          <>
            <div className="flex h-[34px] w-full items-center gap-2 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 sm:w-[212px]">
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
            <div className="flex h-[34px] flex-none items-center gap-0.5 rounded-[9px] bg-[var(--wash-strong)] p-[3px]" role="group" aria-label="View">
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "h-[28px] rounded-[7px] px-3 text-[13px] capitalize transition-colors",
                    view === v
                      ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-[34px] flex-none items-center gap-[7px] rounded-[9px] border px-3 text-[13px] transition-colors",
                    activeFilters > 0
                      ? "border-[#1407A2]/[.28] bg-[#EEF0FE] font-medium text-primary"
                      : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground",
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                  Filter
                  {activeFilters > 0 && (
                    <span className="rounded-full bg-primary px-[6px] text-[11px] font-semibold text-white">{activeFilters}</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Service</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={service} onValueChange={setService}>
                  <DropdownMenuRadioItem value="all">All services</DropdownMenuRadioItem>
                  {SERVICES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {s}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(v === true)}>
                  Overdue only
                </DropdownMenuCheckboxItem>
                {activeFilters > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setService("all");
                        setOverdueOnly(false);
                      }}
                    >
                      Clear filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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

      <div className="mb-4 flex items-center gap-5 overflow-x-auto border-b border-[var(--hairline)]" role="tablist" aria-label="Filter by stage">
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
                stage === f.stage ? "bg-[#EEF0FE] text-primary" : "bg-[var(--hairline-soft)] text-muted-foreground",
              )}
            >
              {countFor(f.stage)}
            </span>
          </button>
        ))}
      </div>

      {stalled && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-4 py-3">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
          <span className="text-[13px] [text-wrap:pretty]">
            <span className="font-medium">{stalled.name}</span> — {stalled.headline}
          </span>
          <span className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              disabled
              title="Reminders go through Spruce — not wired in the prototype"
              className="h-[30px] cursor-not-allowed rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] text-muted-foreground/50"
            >
              Send reminder
            </button>
            <button
              type="button"
              onClick={() => handleAction(rows.find((r) => r.id === stalled.id) ?? { ...stalled, route: null, daysWaiting: null, atRisk: false })}
              className="h-[30px] rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash-strong)] hover:text-foreground"
            >
              Open record
            </button>
          </span>
        </div>
      )}

      {view === "board" ? (
        <div className="flex items-start gap-3.5 overflow-x-auto pb-2.5">
          {STAGE_FILTERS.filter((f) => f.stage !== "all").map((column) => {
            const cards = rows.filter((r) => r.stage === column.stage);
            const over = dropTarget === column.stage;
            return (
              <div
                key={column.stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(column.stage as AdmissionStage);
                }}
                onDragLeave={() => setDropTarget((t) => (t === column.stage ? null : t))}
                onDrop={() => dropOn(column.stage as AdmissionStage)}
                className={cn(
                  "flex w-[236px] flex-none flex-col gap-2 rounded-[14px] border p-2.5 transition-colors",
                  over ? "border-[#1407A2]/[.35] bg-[#EEF0FE]" : "border-[var(--hairline)] bg-[var(--paper-sunken)]",
                )}
              >
                <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-1 pb-[9px] pt-0.5">
                  <span className="text-xs font-semibold text-[var(--ink-strong)]">{column.label}</span>
                  <span className="ml-auto text-[11.5px] text-[#9B9BA3]">{cards.length}</span>
                </div>
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    draggable
                    onDragStart={() => setDragging(card.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    onClick={() => handleAction(card)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper)] p-2.5 text-left transition-opacity",
                      "cursor-grab active:cursor-grabbing hover:border-[#1407A2]/[.24]",
                      dragging === card.id && "opacity-40",
                    )}
                  >
                    <span className="text-[13px] font-medium leading-[1.3] text-[var(--ink-strong)]">{card.name}</span>
                    <span className="text-[11.5px] text-[#9B9BA3]">{card.service}</span>
                    <span className="text-[11.5px] leading-[1.4] text-[var(--ink-body)]">{card.headline}</span>
                    {card.overdue && (
                      <span className="rounded-full bg-[#FEF0C7] px-2 py-px text-[10.5px] font-medium text-[#B54708]">Overdue</span>
                    )}
                  </button>
                ))}
                {cards.length === 0 && <div className="px-2 py-3.5 text-center text-xs text-[#C9C9D0]">Empty</div>}
              </div>
            );
          })}
        </div>
      ) : (
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
                  <AdmissionRow
                    item={item}
                    onAction={handleAction}
                    onDelete={mayDelete(item) ? setDeleting : undefined}
                    group={section.group}
                  />
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

            {/* What Joy did on its own this morning — folded, because it is
                reassurance rather than work. */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setHandledOpen((o) => !o)}
                aria-expanded={handledOpen}
                className="flex items-center gap-[9px] self-start text-left"
              >
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#B9B9C1]" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-[#9B9BA3]">Handled</span>
                <span className="text-[11px] text-[#B9B9C1]">{seedAdmissionsHandled.length}</span>
                <span className="ml-1 text-[12px] text-[#B9B9C1]">Completed by Joy today</span>
                <span className="ml-1.5 text-[12px] text-[#9B9BA3] underline-offset-2 hover:underline">
                  {handledOpen ? "Hide" : "Show"}
                </span>
              </button>
              {handledOpen && (
                <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
                  {seedAdmissionsHandled.map((h) => (
                    <div key={h.label} className="flex items-center gap-3.5 border-b border-[var(--hairline-soft)] px-[18px] py-[13px] last:border-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#12B76A"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="flex-none"
                        aria-hidden="true"
                      >
                        <path d="M3.4 8.4l2.8 2.8 6.4-6.6" />
                      </svg>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13.5px] text-[var(--ink-strong)]">{h.label}</span>
                        <span className="text-[11.5px] text-[#9B9BA3]">{h.who}</span>
                      </span>
                      <span className="ml-auto flex-none text-[11.5px] text-[#9B9BA3]">{h.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <section className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Today</h2>
              {todaysEvents.length === 0 ? (
                <p className="m-0 py-1 text-[12.5px] text-muted-foreground">No assessments booked today.</p>
              ) : (
                <div className="flex flex-col">
                  {todaysEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                      <span className="w-[62px] flex-none text-xs text-muted-foreground">
                        {new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="flex flex-col leading-[1.3]">
                        <span className="text-[12.5px]">{e.clientName}</span>
                        <span className="text-[11px] text-muted-foreground">RN assessment · {e.assessorName}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

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

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this record?"
        subject={deleting ? `${deleting.name} · ${STAGE_LABELS[deleting.stage]}` : ""}
        consequences={
          deleting
            ? admissionConsequences({
                hasIntake: !!intakes[deleting.id],
                hasAssessment: !!assessments[deleting.id],
                hasConsents: !!consentSessions[deleting.id],
              })
            : []
        }
        askForReason
        confirmLabel="Delete record"
        onConfirm={(reason) => {
          if (!deleting) return;
          const { id, name } = deleting;
          deleteAdmission(id, reason);
          setDeleting(null);
          toast(`${name} deleted`, {
            description: "In Deleted items for 30 days.",
            action: { label: "Undo", onClick: () => restoreDeleted(id) },
          });
        }}
      />
    </>
  );
}
