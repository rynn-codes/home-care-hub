import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STAGE_LABELS, type AdmissionStage } from "@/domain/admissions/stages";
import type { SeedAdmission } from "@/lib/admissionsSeed";
import { cn } from "@/lib/utils";

/**
 * The person picker that stands in front of Start phone intake and Start
 * assessment.
 *
 * The design principle (Admissions §5, "flexible entry"): the office can enter
 * the process at any point. You do not have to have created a lead first — you
 * search whoever is already on the board, or start with a brand-new person, and
 * the missing steps stay visible instead of blocking.
 *
 * For an assessment, choosing someone whose phone intake was never completed is
 * NOT blocked. It shows a plain-language notice — the information intake would
 * have gathered may have to be gathered at the visit — and a Continue button.
 * That is the whole point: the software accepts the real world and keeps the
 * gap in view.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "intake" | "assessment";
  admissions: SeedAdmission[];
  /** admissionId -> whether phone intake has been completed. */
  intakeComplete: (admissionId: string) => boolean;
  onPick: (admissionId: string) => void;
  onStartNew: () => void;
}

const searchable = (a: SeedAdmission) =>
  `${a.name} ${a.location} ${a.service}`.toLowerCase();

export function PersonPickerDialog({
  open,
  onOpenChange,
  mode,
  admissions,
  intakeComplete,
  onPick,
  onStartNew,
}: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Non-admitted records only — an active client does not belong in the
  // admissions pipeline picker.
  const candidates = useMemo(
    () => admissions.filter((a) => a.stage !== ("admitted" as AdmissionStage)),
    [admissions],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((a) => searchable(a).includes(needle));
  }, [candidates, q]);

  const chosen = selected ? admissions.find((a) => a.id === selected) ?? null : null;
  const noticeForAssessment =
    mode === "assessment" && chosen ? !intakeComplete(chosen.id) : false;

  const reset = () => {
    setQ("");
    setSelected(null);
  };

  const title = mode === "intake" ? "Start phone intake" : "Start assessment";
  const description =
    mode === "intake"
      ? "Pick who the call is about, or start with a new person."
      : "Pick who the visit is for, or start with a new person.";

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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-[#ECECF1] bg-white px-3">
          <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(null);
            }}
            placeholder="Search by name, phone, or email"
            aria-label="Search people"
            className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="-mx-1 max-h-[280px] overflow-y-auto px-1">
          {results.length === 0 ? (
            <p className="px-1 py-3 text-[13px] text-muted-foreground">
              No one matches “{q.trim()}”. Start with a new person below.
            </p>
          ) : (
            <div className="flex flex-col">
              {results.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  aria-pressed={selected === a.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] p-2.5 text-left transition-colors",
                    selected === a.id ? "bg-[#EEF0FE]" : "hover:bg-[#FAFAFB]",
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-[2px]">
                    <span className="truncate text-[13.5px] font-medium">{a.name}</span>
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {a.service} · {a.location}
                    </span>
                  </span>
                  <span className="ml-auto flex-none whitespace-nowrap rounded-full bg-[#F3F3F6] px-2 py-[2px] text-[10.5px] font-medium text-[#5B6274]">
                    {STAGE_LABELS[a.stage]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {noticeForAssessment && (
          <div className="flex flex-col gap-2 rounded-[11px] border border-[#FCE8B6] bg-[#FFFAEB] px-3 py-2.5">
            <p className="m-0 text-[12.5px] leading-[1.5] text-[#8A6220] [text-wrap:pretty]">
              Phone intake was not completed for {chosen?.name}. Information normally
              collected during intake may need to be completed during this assessment.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[#F3F3F6] pt-4">
          {chosen ? (
            <button
              type="button"
              onClick={() => {
                onPick(chosen.id);
                reset();
                onOpenChange(false);
              }}
              className="h-[40px] rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
            >
              {noticeForAssessment ? "Continue to assessment" : `Continue with ${chosen.name.split(" ")[0]}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onStartNew();
                reset();
                onOpenChange(false);
              }}
              className="flex h-[40px] items-center gap-2 rounded-[10px] border border-dashed border-[#D8D8DE] bg-white px-4 text-[13.5px] text-primary transition-colors hover:bg-[#FAFAFB]"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Start with a new person
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="ml-auto rounded-lg px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
