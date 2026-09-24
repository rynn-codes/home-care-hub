import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { findingsHeadline, openFor, SEVERITY_LABELS, type Finding } from "@/domain/monitors";

/** How many findings show before the list folds. */
export const SHOW_FIRST = 5;

/**
 * What Joy noticed: the monitors' findings, worst first.
 *
 * Each row is one sentence, the reason it matters, which monitor said so and
 * how urgent it is, and one place to go. Nothing here is an action — Joy
 * notices, a person decides. The list folds after five so a bad morning does
 * not become a wall.
 */
export function WhatJoyNoticed({ findings }: { findings: Finding[] }) {
  const [expanded, setExpanded] = useState(false);
  const headline = findingsHeadline(findings);
  if (!headline) return null;
  const asOf = new Date().toISOString();
  const hidden = findings.length - SHOW_FIRST;
  const shown = expanded ? findings : findings.slice(0, SHOW_FIRST);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="m-0 text-sm font-semibold tracking-[-.01em] text-[var(--ink-strong)]">What Joy noticed</h2>
        <span className="text-[12.5px] text-muted-foreground">{headline}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0 overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-0">
        {shown.map((f) => {
          const age = openFor(f, asOf);
          return (
            <li key={f.key} className="border-b border-[var(--hairline-soft)] last:border-b-0">
              <Link to={f.next.to} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--wash)]">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[6px] h-[7px] w-[7px] flex-none rounded-full",
                    f.severity === "blocking" ? "bg-[#D92D20]" : f.severity === "due_soon" ? "bg-[#F79009]" : "bg-primary",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13.5px] leading-[1.45] text-[var(--ink-strong)]">{f.headline}</span>
                  <span className="text-[12.5px] leading-[1.5] text-[var(--ink-body)]">{f.because}</span>
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5">
                    <span className="text-[11.5px] text-[#9B9BA3]">{f.monitorName}</span>
                    <span className="text-[11.5px] text-[#9B9BA3]" aria-hidden="true">
                      ·
                    </span>
                    <span className={cn("text-[11.5px]", f.severity === "blocking" ? "text-[#B42318]" : "text-[#9B9BA3]")}>
                      {SEVERITY_LABELS[f.severity]}
                    </span>
                    {age && (
                      <>
                        <span className="text-[11.5px] text-[#9B9BA3]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[11.5px] font-medium text-[#B54708]">{age}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-1.5 pt-[3px] text-[12px] text-muted-foreground transition-colors group-hover:text-primary">
                  {f.next.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="border-t border-[var(--hairline-soft)]">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full px-5 py-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-[var(--ink-strong)]"
            >
              {expanded ? "Show fewer" : `${hidden} more ${hidden === 1 ? "thing" : "things"} Joy is watching`}
            </button>
          </li>
        )}
      </ul>
      <p className="m-0 flex items-center gap-1.5 text-[12px] text-[#9B9BA3]">
        <Eye className="h-3 w-3" aria-hidden="true" />
        Joy checks this every day and only speaks up when something is wrong.
      </p>
    </section>
  );
}
