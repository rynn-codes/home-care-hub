import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SaveState } from "@/components/ui/save-state";
import { ScheduleAssessmentDrawer } from "@/components/admissions/ScheduleAssessmentDrawer";
import { useDemo } from "@/context/DemoDataProvider";
import {
  INTAKE_QUESTIONS,
  CARE_NEEDS,
  activeQuestions,
  canCompleteIntake,
  displayAnswer,
  intakeProgress,
  missingRequired,
  scheduleSummary,
  type IntakeAnswers,
  type IntakeQuestion,
} from "@/domain/admissions/intake";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

/**
 * Manual phone intake.
 *
 * One question at a time, per the approved Typeform-style design. §34 requires
 * manual mode to exist before AI: it defines the authoritative structure Joy
 * later fills, and guarantees intake still works when OpenAI is unavailable.
 *
 * Autosaves to the demo store on every answer, so a refresh mid-call does not
 * lose the conversation — the Sprint 1 exit criterion "refresh does not lose
 * work", demonstrated with localStorage until the real store lands.
 */
export default function PhoneIntake() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { admissions, people, intakes, saveIntake, completeIntake } = useDemo();

  const admission = admissions.find((a) => a.id === id);
  const person = people.find((p) => `${p.firstName} ${p.lastName}` === admission?.name);
  const stored = intakes[id];

  const [answers, setAnswers] = useState<IntakeAnswers>(() => stored?.answers ?? {});
  const [currentId, setCurrentId] = useState(INTAKE_QUESTIONS[0].id);
  const [phase, setPhase] = useState<"intro" | "questions" | "review" | "done">(
    stored?.completedAt ? "done" : stored ? "questions" : "intro",
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Prefill from the referral. §12A's rule: what the lead already told us is
  // shown as known, never asked again.
  useEffect(() => {
    if (stored || !admission) return;
    setAnswers((a) => ({
      ...a,
      caller_name: person?.responsiblePartyName ?? "",
      caller_relationship: person?.responsiblePartyName ? "Family" : "",
    }));
  }, [admission, person, stored]);

  const progress = useMemo(() => intakeProgress(answers), [answers]);
  const missing = useMemo(() => missingRequired(answers), [answers]);
  const questions = useMemo(() => activeQuestions(answers), [answers]);
  const index = Math.max(
    0,
    questions.findIndex((q) => q.id === currentId),
  );
  const question = questions[index] ?? questions[0];

  if (!admission) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-lg font-semibold">That referral isn't here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed, or the link is stale.
        </p>
        <Button className="mt-5" onClick={() => navigate("/admissions")}>
          Back to Admissions
        </Button>
      </div>
    );
  }

  const persist = (next: IntakeAnswers, visitedId?: string) => {
    setSaveStatus("saving");
    saveIntake(id, {
      answers: next,
      visited: visitedId
        ? [...new Set([...(stored?.visited ?? []), visitedId])]
        : (stored?.visited ?? []),
    });
    // The real hook debounces a server write; localStorage is synchronous, so
    // this only exists to make the save state legible rather than to fake work.
    window.setTimeout(() => {
      setSaveStatus("saved");
      setLastSaved(new Date());
    }, 150);
  };

  const answer = (value: unknown) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    persist(next, question.id);
  };

  const goTo = (i: number) => {
    const target = questions[i];
    if (target) setCurrentId(target.id);
  };

  const goNext = () => {
    if (index < questions.length - 1) goTo(index + 1);
    else setPhase("review");
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3 border-b border-border pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admissions")} aria-label="Back to Admissions">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Admissions · Phone Intake</p>
          <h1 className="truncate text-lg font-semibold">{admission.name}</h1>
        </div>
        <SaveState status={saveStatus} lastSavedAt={lastSaved} />
      </div>

      {phase === "intro" && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight">Phone intake</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Have the conversation. Answer as they talk — everything saves as you go, so you can
            stop and pick it up later without losing the call.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Already known from the referral
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["Client", admission.name],
                ["Service", admission.service],
                ["Area", admission.location],
                ["Primary contact", person?.responsiblePartyName ?? "Not recorded"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">You won't be asked for these again.</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setPhase("questions")}>Start intake</Button>
            <Button variant="ghost" onClick={() => navigate("/admissions")}>
              Not now
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Joy's AI conversation mode is the approved default, behind the
            <code className="mx-1 rounded bg-surface-muted px-1">AI_PHONE_INTAKE_ENABLED</code>
            flag. It is off, so this is the manual path — which is the one that must always work.
          </p>
        </section>
      )}

      {phase === "questions" && (
        <>
          <div className="mb-6">
            <div className="mb-2 flex items-baseline gap-3 text-[12.5px]">
              <span className="font-semibold tracking-[.02em] text-primary tabular-nums">
                {String(index + 1).padStart(2, "0")} / {questions.length}
              </span>
              <span className="text-muted-foreground">{question.section}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[#F1F2F6]">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* The mock's question floats on the page — no card around it. */}
          <section className="pt-4">
            <h2 className="m-0 text-[29px] font-semibold leading-[1.22] tracking-[-.025em] [text-wrap:pretty]">
              {question.question}
            </h2>
            {question.helper && (
              <p className="mt-2.5 text-sm leading-[1.55] text-muted-foreground [text-wrap:pretty]">{question.helper}</p>
            )}

            <div className="mt-6">
              <QuestionInput
                question={question}
                value={answers[question.id]}
                onChange={answer}
                answers={answers}
              />
            </div>

            <div className="mt-8 flex items-center gap-2 border-t border-border pt-5">
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button size="sm" onClick={goNext}>
                {index === questions.length - 1 ? "Review" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              {!question.required && (
                <Button variant="ghost" size="sm" onClick={goNext} className="text-muted-foreground">
                  Skip for now
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => setPhase("review")}
              >
                Review
              </Button>
            </div>
          </section>
        </>
      )}

      {phase === "review" && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight">Intake summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.answered} of {progress.total} captured · {admission.name}
          </p>

          {missing.length > 0 ? (
            <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
              <p className="text-sm font-semibold">
                {missing.length} {missing.length === 1 ? "item needs" : "items need"} an answer
              </p>
              <ul className="mt-2 space-y-1.5">
                {missing.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="text-left text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                      onClick={() => {
                        setCurrentId(q.id);
                        setPhase("questions");
                      }}
                    >
                      {q.question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
              <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
              Nothing required is missing.
            </p>
          )}

          <dl className="mt-6 divide-y divide-border">
            {questions.map((q) => (
              <div key={q.id} className="flex items-baseline gap-4 py-2.5">
                <dt className="w-1/3 shrink-0 text-xs text-muted-foreground">{q.question}</dt>
                <dd className="flex-1 text-sm">{displayAnswer(q, answers[q.id])}</dd>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setCurrentId(q.id);
                    setPhase("questions");
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-lg bg-surface-muted px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Requested schedule: </span>
            {scheduleSummary(answers)}
          </div>

          <div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button
              disabled={!canCompleteIntake(answers)}
              onClick={() => {
                completeIntake(id);
                setPhase("done");
              }}
            >
              Complete intake &amp; continue
            </Button>
            <Button variant="ghost" onClick={() => setPhase("questions")}>
              Back to questions
            </Button>
          </div>
          {!canCompleteIntake(answers) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Answer the items above to complete. Nothing you've captured is lost in the meantime.
            </p>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--success))]">
            <Check className="h-4 w-4" aria-hidden="true" />
            Phone intake complete
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-balance">
            Would you like to move forward with an in-home RN assessment?
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {admission.name}'s intake is saved. Scheduling the assessment carries everything
            captured today into the RN's visit — she won't ask the family anything twice.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setScheduleOpen(true)}>Schedule RN assessment</Button>
            <Button variant="outline" onClick={() => navigate("/admissions")}>
              Not right now
            </Button>
          </div>
        </section>
      )}

      <ScheduleAssessmentDrawer
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        admissionId={id}
        clientName={admission.name}
        contactName={person?.responsiblePartyName ?? admission.name}
        defaultAddress={admission.location}
      />
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  answers,
}: {
  question: IntakeQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  answers: IntakeAnswers;
}) {
  switch (question.kind) {
    case "longtext":
      return (
        <Textarea
          id={`answer-${question.id}`}
          aria-label={question.question}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type what they said…"
          autoFocus
        />
      );

    case "number":
      return (
        <Input
          id={`answer-${question.id}`}
          aria-label={question.question}
          type="number"
          min={0}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="max-w-40"
          autoFocus
        />
      );

    case "date":
      return (
        <Input
          id={`answer-${question.id}`}
          aria-label={question.question}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-52"
          autoFocus
        />
      );

    case "time":
      return (
        <Input
          id={`answer-${question.id}`}
          aria-label={question.question}
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-40"
          autoFocus
        />
      );

    // One short line per care need already selected, mirroring the line beside
    // each need on the paper form. Nothing is shown until needs are picked, so
    // this never appears as ten empty boxes.
    case "need_details": {
      const details = (value as Record<string, string>) ?? {};
      const selected = (answers.care_needs as string[]) ?? [];
      const chosen = CARE_NEEDS.filter((n) => selected.includes(n.value));

      if (chosen.length === 0) {
        return (
          <p className="text-sm text-muted-foreground">
            Pick the care needs first and they will be listed here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {chosen.map((need) => (
            <div key={need.value} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <label
                htmlFor={`answer-${question.id}-${need.value}`}
                className="w-full text-sm text-muted-foreground sm:w-40 sm:shrink-0"
              >
                {need.label}
              </label>
              <Input
                id={`answer-${question.id}-${need.value}`}
                value={details[need.value] ?? ""}
                onChange={(e) => onChange({ ...details, [need.value]: e.target.value })}
                placeholder="Optional detail"
              />
            </div>
          ))}
        </div>
      );
    }

    case "choice":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options?.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                value === o.value
                  ? "border-primary bg-primary-soft font-medium text-primary"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      );

    case "multichoice": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options?.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])
                }
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  on ? "border-primary bg-primary-soft font-medium text-primary" : "border-border hover:bg-surface-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }

    case "weekdays": {
      const days = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? days.filter((v) => v !== d.value) : [...days, d.value])}
                className={cn(
                  "h-11 w-14 rounded-xl border text-sm transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground font-medium" : "border-border hover:bg-surface-muted",
                )}
              >
                {d.label}
              </button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-center text-muted-foreground"
            onClick={() => onChange(["mon", "tue", "wed", "thu", "fri"])}
          >
            Mon–Fri
          </Button>
        </div>
      );
    }

    default:
      return (
        <Input
          id={`answer-${question.id}`}
          aria-label={question.question}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      );
  }
}
