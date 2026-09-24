import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StripStep {
  key: string;
  label: string;
  note: string;
  state: "done" | "open" | "todo";
  onClick?: () => void;
}

/**
 * Where a week is, as a row of steps. Green is done, amber is waiting on a
 * person, an empty ring is not yet. A step with a handler is a shortcut to
 * the work it names.
 */
export function StepStrip({ title, summary, steps, joyLine, className }: { title: string; summary: string; steps: StripStep[]; joyLine: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-[18px] py-4", className ?? "mb-5")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-[13.5px] font-semibold tracking-[-.01em]">{title}</h2>
        <span className="text-[12.5px] text-muted-foreground [text-wrap:pretty]">{summary}</span>
      </div>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0">
        {steps.map((step, i) => {
          const body = (
            <>
              <span
                className={cn(
                  "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10.5px] font-semibold",
                  step.state === "done" ? "bg-[#12B76A] text-white" : step.state === "open" ? "bg-[#F79009] text-white" : "border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground/50",
                )}
                aria-hidden="true"
              >
                {step.state === "done" ? "✓" : step.state === "open" ? "!" : ""}
              </span>
              <span className="flex flex-col leading-[1.3]">
                <span className={cn("whitespace-nowrap text-[12.5px]", step.state === "todo" ? "text-muted-foreground" : "font-medium")}>{step.label}</span>
                <span className={cn("whitespace-nowrap text-[11px]", step.state === "open" ? "text-[#B54708]" : "text-muted-foreground")}>{step.note}</span>
              </span>
            </>
          );
          return (
            <li key={step.key} className="flex items-center gap-1">
              {step.onClick ? (
                <button type="button" onClick={step.onClick} className="flex items-center gap-2 rounded-[9px] px-2 py-1 transition-colors hover:bg-[var(--wash)]">
                  {body}
                </button>
              ) : (
                <span className="flex items-center gap-2 px-2 py-1">{body}</span>
              )}
              {i < steps.length - 1 && <span className="h-px w-4 flex-none bg-[var(--hairline)]" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      {joyLine && (
        <p className="m-0 flex items-start gap-2 border-t border-[var(--hairline-soft)] pt-2.5 text-[12px] leading-[1.5] text-[var(--ink-body)] [text-wrap:pretty]">
          <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
          {joyLine}
        </p>
      )}
    </section>
  );
}
