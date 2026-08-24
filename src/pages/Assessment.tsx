import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SaveState } from "@/components/ui/save-state";
import { ConsentSigning } from "@/components/assessment/ConsentSigning";
import { useDemo } from "@/context/DemoDataProvider";
import {
  VITAL_DEFAULTS,
  activeQuestions,
  assessmentProgress,
  canCompleteAssessment,
  missingRequired,
  packetCoverage,
  type AssessmentAnswers,
  type AssessmentQuestion,
} from "@/domain/assessment/questions";
import { INTAKE_QUESTIONS, displayAnswer } from "@/domain/admissions/intake";
import { cn } from "@/lib/utils";

/**
 * The RN assessment.
 *
 * UX decisions, since these are the difference between a form that gets filled
 * at the kitchen table and one that gets filled in the car afterwards:
 *
 *  - ONE QUESTION PER SCREEN, but a question may be a whole multi-select grid.
 *    A pure one-checkbox-at-a-time flow would take 200 screens for this packet.
 *    Batching related checkboxes keeps the "one thing at a time" calm without
 *    the tedium.
 *  - TAP, DON'T TYPE. Everything the packet expresses as a checkbox is a large
 *    tap target. Typing is reserved for what genuinely cannot be enumerated —
 *    diagnoses, allergies, next of kin.
 *  - THE PACKET METER IS ALWAYS VISIBLE. It says which packet pages can be
 *    completed and what is missing, so a gap surfaces during the visit rather
 *    than after it. Counts are derived from the data, never restated in copy —
 *    hardcoding "fifteen" is how a UI drifts away from what it renders.
 *  - JOY LISTENS, THE RN LEADS. Joy shows the next question and flags what is
 *    still open; it never fills a clinical field on its own. §26 puts the
 *    assessment at draft-only authority.
 */
export default function Assessment() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { admissions, intakes, assessments, saveAssessment } = useDemo();

  const admission = admissions.find((a) => a.id === id);
  const intake = intakes[id];
  const stored = assessments[id];

  const [answers, setAnswers] = useState<AssessmentAnswers>(() => stored?.answers ?? {});
  // Tracked by question ID, not position. Answering a question can make a
  // conditional one appear EARLIER in the list — answering "equipment in the
  // home" reveals the oxygen question back in Day to day — and an index would
  // then silently point at a different question, jumping the screen under the
  // RN mid-visit.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intro" | "questions" | "review" | "signing">(
    stored?.completedAt ? "review" : stored ? "questions" : "intro",
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showContext, setShowContext] = useState(false);

  const questions = useMemo(() => activeQuestions(answers), [answers]);
  const progress = useMemo(() => assessmentProgress(answers), [answers]);
  const coverage = useMemo(() => packetCoverage(answers), [answers]);
  const missing = useMemo(() => missingRequired(answers), [answers]);
  const pagesReady = coverage.filter((p) => p.complete).length;

  if (!admission) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-lg font-semibold">That admission isn't here</h1>
        <Button className="mt-5" onClick={() => navigate("/admissions")}>
          Back to Admissions
        </Button>
      </div>
    );
  }

  const index = Math.max(0, questions.findIndex((q) => q.id === currentId));
  const question = questions[index] ?? questions[0];

  const goTo = (i: number) => {
    const next = questions[Math.min(Math.max(i, 0), questions.length - 1)];
    if (next) setCurrentId(next.id);
  };

  const setAnswer = (value: unknown) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    setSaveStatus("saving");
    saveAssessment(id, { answers: next });
    window.setTimeout(() => {
      setSaveStatus("saved");
      setLastSaved(new Date());
    }, 150);
  };

  return (
    // tablet-flow: the assessment is a tablet workflow in a client's home —
    // every control inside holds the 44px hit-area floor (Karynn, 24 Aug).
    <div className="tablet-flow mx-auto max-w-4xl pb-16">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admissions")} aria-label="Back to Admissions">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Admissions · RN Assessment</p>
          <h1 className="truncate text-lg font-semibold">{admission.name}</h1>
        </div>
        <SaveState status={saveStatus} lastSavedAt={lastSaved} />
      </div>

      {phase === "intro" && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight">Sitting down with {admission.name}</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Have the conversation. Joy asks the next question and keeps track of what the signing
            packet still needs — you won't get to the end and find something missing.
          </p>

          {intake?.completedAt && (
            <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Already known from the phone call
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Everything captured at intake carries in. You won't ask the family anything twice.
              </p>
              <button
                type="button"
                onClick={() => setShowContext((v) => !v)}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {showContext ? "Hide" : "Show"} what we already have
              </button>
              {showContext && (
                <dl className="mt-3 divide-y divide-border border-t border-border">
                  {INTAKE_QUESTIONS.filter((q) => intake.answers[q.id]).map((q) => (
                    <div key={q.id} className="flex gap-3 py-2">
                      <dt className="w-1/2 text-xs text-muted-foreground">{q.question}</dt>
                      <dd className="flex-1 text-xs">{displayAnswer(q, intake.answers[q.id])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => { setCurrentId(questions[0]?.id ?? null); setPhase("questions"); }}>Start assessment</Button>
            <Button variant="ghost" onClick={() => navigate("/admissions")}>
              Not now
            </Button>
          </div>
        </section>
      )}

      {phase === "questions" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div>
            <div className="mb-4">
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
            <section className="pt-3">
              <h2 className="m-0 text-[29px] font-semibold leading-[1.22] tracking-[-.025em] [text-wrap:pretty]">
                {question.question}
              </h2>
              {question.helper && (
                <p className="mt-2.5 text-sm leading-[1.55] text-muted-foreground [text-wrap:pretty]">{question.helper}</p>
              )}
              {question.restricted && (
                // Says out loud what the store does silently. The RN is holding
                // an iPad in someone's living room; they should know this one
                // is not being kept on the device.
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Not saved yet. It fills the packet for this visit, then it's gone — write it on
                    the paper copy. Storing it needs somewhere HIPAA-grade to put it, which is
                    coming.
                  </span>
                </p>
              )}

              <div className="mt-6">
                <AnswerInput
                  question={question}
                  value={answers[question.id]}
                  onChange={setAnswer}
                  intake={intake?.answers ?? {}}
                  admissionName={admission.name}
                />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => goTo(index - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => (index < questions.length - 1 ? goTo(index + 1) : setPhase("review"))}
                >
                  {index === questions.length - 1 ? "Review" : "Next"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                {!question.required && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => goTo(index + 1)}
                  >
                    Not applicable
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
          </div>

          <PacketMeter coverage={coverage} pagesReady={pagesReady} progress={progress} />
        </div>
      )}

      {phase === "review" && (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight">Before we sign</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pagesReady} of {coverage.length} packet pages ready · {progress.done} of {progress.total} answered
          </p>

          {missing.length > 0 ? (
            <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
              <p className="text-sm font-semibold">
                {missing.length} {missing.length === 1 ? "answer is" : "answers are"} still needed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The packet can't be completed without these. Tap one to go back to it.
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {missing.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="text-left text-sm text-muted-foreground hover:text-primary hover:underline"
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
              Every page of the packet can be filled from what you've captured.
            </p>
          )}

          <h3 className="mt-7 text-sm font-semibold">Packet pages</h3>
          <ul className="mt-2.5 divide-y divide-border">
            {coverage.map((page) => (
              <li key={page.page} className="flex items-center gap-3 py-2.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 text-sm">{page.label}</span>
                <span
                  className={cn(
                    "text-xs",
                    page.complete ? "text-[hsl(var(--success))]" : "text-[hsl(var(--warning))]",
                  )}
                >
                  {page.complete
                    ? page.filledBySigning
                      ? "Filled at signing"
                      : "Ready"
                    : `${page.missing.length} missing`}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button disabled={!canCompleteAssessment(answers)} onClick={() => setPhase("signing")}>
              Review consents with {admission.name.split(" ")[0]}
            </Button>
            <Button variant="ghost" onClick={() => setPhase("questions")}>
              Back to questions
            </Button>
          </div>
        </section>
      )}

      {phase === "signing" && (
        <ConsentSigning
          admissionId={id}
          clientName={admission.name}
          onBack={() => setPhase("review")}
          onDone={() => navigate("/admissions")}
        />
      )}
    </div>
  );
}

function PacketMeter({
  coverage,
  pagesReady,
  progress,
}: {
  coverage: ReturnType<typeof packetCoverage>;
  pagesReady: number;
  progress: { done: number; total: number };
}) {
  return (
    <aside className="rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-4 lg:self-start">
      <h2 className="text-sm font-semibold">Signing packet</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {pagesReady} of {coverage.length} pages ready
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(pagesReady / coverage.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {coverage
          .filter((p) => !p.complete)
          .slice(0, 6)
          .map((p) => (
            <li key={p.page} className="text-xs text-muted-foreground">
              <span className="text-[hsl(var(--warning))]">•</span> {p.label}
            </li>
          ))}
        {coverage.every((p) => p.complete) && (
          <li className="text-xs text-[hsl(var(--success))]">Everything the packet needs is captured.</li>
        )}
      </ul>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        {progress.done} of {progress.total} questions answered. Everything saves as you go.
      </p>
    </aside>
  );
}

function AnswerInput({
  question,
  value,
  onChange,
  intake,
  admissionName,
}: {
  question: AssessmentQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  intake: Record<string, unknown>;
  admissionName: string;
}) {
  switch (question.kind) {
    case "confirm": {
      const known = question.fromIntake ? intake[question.fromIntake] : null;
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs text-muted-foreground">From the phone call</p>
            <p className="mt-1 text-sm">
              {question.fromIntake === "client"
                ? admissionName
                : Array.isArray(known)
                  ? (known as string[]).join(", ")
                  : String(known ?? "Nothing recorded")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={value === "confirmed" ? "default" : "outline"}
              onClick={() => onChange("confirmed")}
            >
              That's right
            </Button>
            <Button type="button" variant="ghost" onClick={() => onChange("corrected")}>
              Needs correcting
            </Button>
          </div>
          {value === "corrected" && (
            <Textarea
              id={`answer-${question.id}`}
              aria-label={`Correction for: ${question.question}`}
              rows={3}
              placeholder="What's the correct information?"
              onChange={(e) => onChange(`corrected: ${e.target.value}`)}
              autoFocus
            />
          )}
        </div>
      );
    }

    case "thresholds": {
      const v = (value as Record<string, string>) ?? {};
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {VITAL_DEFAULTS.map((d) => (
            <label key={d.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="flex-1 text-xs text-muted-foreground">{d.label}</span>
              <Input
                id={`answer-${question.id}-${d.key}`}
                aria-label={d.label}
                className="h-8 w-20"
                value={v[d.key] ?? d.value}
                onChange={(e) => onChange({ ...v, [d.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      );
    }

    case "yes_no_copy":
      return (
        <div className="flex flex-wrap gap-2">
          {[
            { v: "yes_copy", label: "Yes — copy provided" },
            { v: "yes_no_copy", label: "Yes — no copy yet" },
            { v: "no", label: "No" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={value === o.v}
              onClick={() => onChange(o.v)}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm transition-colors",
                value === o.v
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {question.options?.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])
                }
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
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

    case "longtext":
      return (
        <Textarea
          id={`answer-${question.id}`}
          aria-label={question.question}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type what they tell you…"
          autoFocus
        />
      );

    case "number":
      return (
        <Input
          id={`answer-${question.id}`}
          aria-label={question.question}
          type="number"
          className="max-w-32"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          autoFocus
        />
      );

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
