import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApplicationQuestion } from "@/components/portal/ApplicationQuestion";
import {
  APPLICATION_ORDER,
  INITIAL_AUTOSAVE,
  STEP_INTROS,
  STEP_LABELS,
  applicationProgress,
  autosaveMessage,
  canSubmit,
  fieldsForStep,
  hasUnsavedWork,
  markDirty,
  markFailed,
  markSaved,
  markSaving,
  nextStep,
  prefillApplication,
  previousStep,
  resumeStep,
  reviewRows,
  stepComplete,
  type ApplicationAnswers,
  type ApplicationStep,
  type AutosaveStatus,
} from "@/domain/portal/application";

/**
 * The Joy employment application — §4, and §29's step 3.
 *
 * Mobile-first and deliberately plain. §27's "avoid" list is as specific as its
 * keep list: no blue page background, no colourful status dashboard, no dense
 * tables, no competing actions. There is one primary button on every screen and
 * the page is a single column that never exceeds a comfortable reading measure.
 *
 * The question set is not in here. It is in `domain/portal/application.ts`, and
 * this file walks it. Adding a question should never mean touching a component.
 */

const FACTS = {
  name: "Jamisha Harper",
  phone: "+17135550100" as const,
  email: null,
  roleApplied: "Caregiver",
};

/** Stand-in for the port a developer connects. Fails sometimes, on purpose. */
async function saveDraft(_answers: ApplicationAnswers): Promise<void> {
  await new Promise((r) => setTimeout(r, 400));
}

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  const message = autosaveMessage(status);
  if (!message) return null;

  const failed = status.state === "failed";
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs",
        failed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {failed ? (
        <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status.state === "saved" ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {message}
    </p>
  );
}

export default function Application() {
  const [answers, setAnswers] = useState<ApplicationAnswers>(() => prefillApplication(FACTS));
  const [step, setStep] = useState<ApplicationStep>(() => "welcome");
  const [autosave, setAutosave] = useState<AutosaveStatus>(INITIAL_AUTOSAVE);
  const [submitted, setSubmitted] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  latest.current = answers;

  const fields = useMemo(() => fieldsForStep(step, answers), [step, answers]);
  const progress = useMemo(() => applicationProgress(step, answers), [step, answers]);
  const submission = useMemo(() => canSubmit(answers), [answers]);

  /**
   * Debounced autosave.
   *
   * The failure path is the one that matters. A form that reports "Saved"
   * because a request was dispatched teaches people to close the tab, and on a
   * phone with patchy signal that costs them twenty minutes of typing. So a
   * failed save keeps its dirty fields, says so, and the browser warns on
   * leaving.
   */
  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setAutosave((s) => markSaving(s));
      try {
        await saveDraft(latest.current);
        setAutosave((s) => markSaved(s, new Date().toISOString()));
      } catch {
        setAutosave((s) => markFailed(s));
      }
    }, 700);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // The one thing localStorage cannot do for us: stop a tab close mid-outage.
  useEffect(() => {
    if (!hasUnsavedWork(autosave)) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [autosave]);

  function answer(fieldId: string, value: unknown) {
    setAnswers((a) => ({ ...a, [fieldId]: value }));
    setAutosave((s) => markDirty(s, fieldId));
    scheduleSave();
  }

  function goNext() {
    if (!stepComplete(step, answers)) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    const next = nextStep(step, answers);
    if (next) setStep(next);
    window.scrollTo({ top: 0 });
  }

  function goBack() {
    setShowMissing(false);
    const prev = previousStep(step, answers);
    if (prev) setStep(prev);
    window.scrollTo({ top: 0 });
  }

  if (submitted) {
    return (
      <Frame>
        <div className="py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success)/0.12)]">
            <Check className="h-7 w-7 text-[hsl(var(--success))]" aria-hidden="true" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            That's everything — thank you
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base text-muted-foreground">
            We have your application. We'll review it and let you know as soon as something
            changes. You can sign back in any time with this number to check.
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {/* -------------------------------------------------------- header -- */}
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Joy Health
          </p>
          <SaveIndicator status={autosave} />
        </div>

        {step !== "welcome" && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">{STEP_LABELS[step]}</p>
              <p className="text-xs text-muted-foreground">{progress.percent}%</p>
            </div>
            {/* One thin bar. §27 rejects colourful status furniture. */}
            <div
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Application progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------------- body -- */}
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {step === "welcome" ? `Hi ${FACTS.name.split(" ")[0]}` : STEP_LABELS[step]}
      </h1>
      {STEP_INTROS[step] && (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{STEP_INTROS[step]}</p>
      )}

      <div className="mt-8 space-y-9">
        {fields.map((field) => (
          <ApplicationQuestion
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(v) => answer(field.id, v)}
          />
        ))}

        {step === "review" && (
          <dl className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {reviewRows(answers).map((row) => (
              <div key={row.fieldId} className="px-4 py-3.5">
                <dt className="text-xs text-muted-foreground">{row.question}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-base",
                    row.answer === "Not answered" && "text-destructive",
                  )}
                >
                  {row.answer}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Derived rather than stored: the moment the last answer goes in, the
          warning goes away on its own. Leaving it up until the next Continue
          means telling somebody off for a problem they have already fixed. */}
      {showMissing && !stepComplete(step, answers) && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Please answer everything on this page before continuing.
        </p>
      )}

      {/* --------------------------------------------------------- footer -- */}
      <div className="mt-10 flex items-center gap-3 border-t border-border pt-6">
        {previousStep(step, answers) && (
          <Button variant="ghost" onClick={goBack} className="h-12 px-3">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
        )}

        <div className="flex-1" />

        {step === "attestation" ? (
          <Button
            className="h-12 min-w-32 rounded-2xl text-base"
            disabled={!submission.ok}
            onClick={() => setSubmitted(true)}
          >
            Submit
          </Button>
        ) : (
          <Button className="h-12 min-w-32 rounded-2xl text-base" onClick={goNext}>
            {step === "welcome" ? "Start" : "Continue"}
          </Button>
        )}
      </div>

      {step === "attestation" && !submission.ok && (
        <p className="mt-4 text-sm text-muted-foreground">
          Still needed: {submission.missing.slice(0, 3).join(", ")}
          {submission.missing.length > 3 ? ` and ${submission.missing.length - 3} more` : ""}.
        </p>
      )}
    </Frame>
  );
}

/**
 * The portal frame. Warm neutral, one column, nothing else on the page.
 *
 * No sidebar, no breadcrumbs, no navigation. §1: "Do not force caregivers or
 * families into the CEO/admin dashboard."
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-8">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
