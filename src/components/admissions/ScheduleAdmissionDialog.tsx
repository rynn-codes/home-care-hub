import { useMemo, useState } from "react";
import { Phone, ClipboardCheck, Search, UserPlus, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeedAdmission } from "@/lib/admissionsSeed";
import { cn } from "@/lib/utils";

/**
 * Schedule — the three-step modal from Admissions §5's flexible entry.
 *
 * pick WHAT (Phone intake or Assessment) → pick WHO (an existing record, or a
 * brand-new person captured in three fields) → the DETAILS (date, time, who is
 * assigned, a note; an assessment also takes the meeting address and who will
 * be present).
 *
 * A brand-new person creates the admissions record and drops it into New Leads.
 * Booking an assessment for someone whose phone intake was never completed is
 * allowed — the caller is told the intake is still outstanding rather than being
 * stopped.
 */

export type ScheduleWhat = "phone_intake" | "assessment";

export interface NewPersonCapture {
  contactName: string;
  phone: string;
  personNeedingCare: string;
  zip: string;
}

export interface ScheduleSubmission {
  what: ScheduleWhat;
  /** Set when an existing record was chosen. */
  admissionId: string | null;
  /** Set when a new person was captured. */
  newPerson: NewPersonCapture | null;
  clientName: string;
  date: string;
  time: string;
  assignedTo: string;
  note: string;
  /** Assessment only. */
  address: string;
  whoPresent: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissions: SeedAdmission[];
  assessors: string[];
  intakeComplete: (admissionId: string) => boolean;
  onSubmit: (submission: ScheduleSubmission) => void;
}

const searchable = (a: SeedAdmission) => `${a.name} ${a.location} ${a.service}`.toLowerCase();

export function ScheduleAdmissionDialog({
  open,
  onOpenChange,
  admissions,
  assessors,
  intakeComplete,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [what, setWhat] = useState<ScheduleWhat>("assessment");
  const [q, setQ] = useState("");
  const [admissionId, setAdmissionId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newPerson, setNewPerson] = useState<NewPersonCapture>({
    contactName: "",
    phone: "",
    personNeedingCare: "",
    zip: "",
  });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [assignedTo, setAssignedTo] = useState(assessors[0] ?? "");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [whoPresent, setWhoPresent] = useState("");

  const candidates = useMemo(
    () => admissions.filter((a) => a.stage !== "admitted"),
    [admissions],
  );
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((a) => searchable(a).includes(needle));
  }, [candidates, q]);

  const chosen = admissionId ? admissions.find((a) => a.id === admissionId) ?? null : null;
  const clientName = addingNew
    ? newPerson.personNeedingCare.trim() || newPerson.contactName.trim()
    : chosen?.name ?? "";

  const isAssessment = what === "assessment";
  const outstandingIntake =
    isAssessment && chosen ? !intakeComplete(chosen.id) : false;

  const whoReady = addingNew
    ? newPerson.contactName.trim().length > 0 && newPerson.phone.trim().length > 0
    : admissionId !== null;
  const detailsReady = date.trim().length > 0 && time.trim().length > 0 && (!isAssessment || address.trim().length > 0);

  const reset = () => {
    setStep(1);
    setWhat("assessment");
    setQ("");
    setAdmissionId(null);
    setAddingNew(false);
    setNewPerson({ contactName: "", phone: "", personNeedingCare: "", zip: "" });
    setDate("");
    setTime("");
    setAssignedTo(assessors[0] ?? "");
    setNote("");
    setAddress("");
    setWhoPresent("");
  };

  const submit = () => {
    onSubmit({
      what,
      admissionId: addingNew ? null : admissionId,
      newPerson: addingNew ? newPerson : null,
      clientName,
      date,
      time,
      assignedTo,
      note,
      address,
      whoPresent,
    });
    reset();
    onOpenChange(false);
  };

  const stepLabel = `Step ${step} of 3`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                aria-label="Back"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#F1F2F6] hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            Schedule
          </DialogTitle>
          <DialogDescription>
            {stepLabel} ·{" "}
            {step === 1 ? "What are you booking?" : step === 2 ? "Who is it for?" : "The details"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — what */}
        {step === 1 && (
          <div className="flex flex-col gap-2.5">
            {(
              [
                ["assessment", ClipboardCheck, "RN assessment", "The in-home visit. Books a time and notifies the family."],
                ["phone_intake", Phone, "Phone intake", "The intake call. Creates or updates the lead."],
              ] as const
            ).map(([value, Icon, label, blurb]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setWhat(value);
                  setStep(2);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-[12px] border p-3.5 text-left transition-colors",
                  what === value ? "border-[#DDE0F8] bg-[#F7F8FE]" : "border-[#ECECF1] hover:bg-[#FAFAFB]",
                )}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[#EEF0FE] text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[14px] font-medium">{label}</span>
                  <span className="text-[12px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{blurb}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — who */}
        {step === 2 && !addingNew && (
          <div className="flex flex-col gap-3">
            <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-[#ECECF1] bg-white px-3">
              <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setAdmissionId(null);
                }}
                placeholder="Search existing people"
                aria-label="Search existing people"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="-mx-1 max-h-[220px] overflow-y-auto px-1">
              {results.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-muted-foreground">
                  No one matches. Add a new person below.
                </p>
              ) : (
                <div className="flex flex-col">
                  {results.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAdmissionId(a.id)}
                      aria-pressed={admissionId === a.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[10px] p-2.5 text-left transition-colors",
                        admissionId === a.id ? "bg-[#EEF0FE]" : "hover:bg-[#FAFAFB]",
                      )}
                    >
                      <span className="flex min-w-0 flex-col gap-[2px]">
                        <span className="truncate text-[13.5px] font-medium">{a.name}</span>
                        <span className="truncate text-[11.5px] text-muted-foreground">
                          {a.service} · {a.location}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              className="flex h-[40px] items-center gap-2 rounded-[10px] border border-dashed border-[#D8D8DE] bg-white px-4 text-[13.5px] text-primary transition-colors hover:bg-[#FAFAFB]"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add new person
            </button>
            <div className="flex justify-end border-t border-[#F3F3F6] pt-3">
              <button
                type="button"
                disabled={!whoReady}
                onClick={() => setStep(3)}
                className={cn(
                  "h-[40px] rounded-[10px] px-4 text-[13.5px] font-medium transition-colors",
                  whoReady
                    ? "bg-primary text-white hover:bg-[#2A1BD1]"
                    : "cursor-not-allowed bg-[#F1F2F6] text-[#B9B9C1]",
                )}
              >
                {whoReady ? "Continue" : "Pick someone to continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && addingNew && (
          <div className="flex flex-col gap-3">
            <LabeledInput label="Contact name" value={newPerson.contactName} onChange={(v) => setNewPerson((p) => ({ ...p, contactName: v }))} placeholder="Johnathan Huang" autoFocus />
            <LabeledInput label="Phone" value={newPerson.phone} onChange={(v) => setNewPerson((p) => ({ ...p, phone: v }))} placeholder="(713) 555-0188" inputMode="tel" />
            <LabeledInput label="Person needing care" hint="Optional" value={newPerson.personNeedingCare} onChange={(v) => setNewPerson((p) => ({ ...p, personNeedingCare: v }))} placeholder="Lian Huang" />
            <LabeledInput label="ZIP" hint="Optional" value={newPerson.zip} onChange={(v) => setNewPerson((p) => ({ ...p, zip: v }))} placeholder="77027" />
            <div className="flex items-center justify-between gap-2 border-t border-[#F3F3F6] pt-3">
              <button
                type="button"
                onClick={() => setAddingNew(false)}
                className="rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to search
              </button>
              <button
                type="button"
                disabled={!whoReady}
                onClick={() => setStep(3)}
                className={cn(
                  "h-[40px] rounded-[10px] px-4 text-[13.5px] font-medium transition-colors",
                  whoReady
                    ? "bg-primary text-white hover:bg-[#2A1BD1]"
                    : "cursor-not-allowed bg-[#F1F2F6] text-[#B9B9C1]",
                )}
              >
                {whoReady ? "Continue" : "Name and phone to continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — details */}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            {outstandingIntake && (
              <div className="rounded-[11px] border border-[#FCE8B6] bg-[#FFFAEB] px-3 py-2.5">
                <p className="m-0 text-[12.5px] leading-[1.5] text-[#8A6220] [text-wrap:pretty]">
                  {clientName}’s phone intake is still outstanding. You can book the visit
                  anyway — the intake will stay flagged.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Date" type="date" value={date} onChange={setDate} />
              <LabeledInput label="Time" type="time" value={time} onChange={setTime} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">{isAssessment ? "Assigned RN" : "Assigned to"}</span>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-[40px] rounded-[10px] border border-[#ECECF1] bg-white px-3 text-[13.5px] outline-none"
              >
                {assessors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {isAssessment && (
              <>
                <LabeledInput label="Meeting address" value={address} onChange={setAddress} placeholder="Street, city, ZIP" />
                <LabeledInput label="Who will be present" hint="Optional" value={whoPresent} onChange={setWhoPresent} placeholder="Client and daughter" />
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Note <span className="font-normal text-muted-foreground">Optional</span></span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-[10px] border border-[#ECECF1] bg-white px-3 py-2 text-[13.5px] outline-none"
              />
            </div>
            <div className="flex justify-end border-t border-[#F3F3F6] pt-3">
              <button
                type="button"
                disabled={!detailsReady}
                onClick={submit}
                className={cn(
                  "h-[40px] rounded-[10px] px-4 text-[13.5px] font-medium transition-colors",
                  detailsReady
                    ? "bg-primary text-white hover:bg-[#2A1BD1]"
                    : "cursor-not-allowed bg-[#F1F2F6] text-[#B9B9C1]",
                )}
              >
                {detailsReady
                  ? isAssessment
                    ? "Book assessment"
                    : "Schedule intake"
                  : "Add a date, time and place"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabeledInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoFocus,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "tel" | "text";
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">
        {label}
        {hint ? <span className="ml-1 font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-[40px] rounded-[10px] border border-[#ECECF1] bg-white px-3 text-[13.5px] outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
