import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { joyInsights } from "@/lib/joySeed";
import { cn } from "@/lib/utils";

/**
 * Joy Assistant, collapsed by default.
 *
 * Revision 3 puts this at the bottom of the page, collapsed, so AI supports the
 * user without dominating the screen. It states plainly that Joy has prepared
 * work rather than done it — under section 26, Home-level AI is draft and
 * propose authority only, so every item ends in a human action.
 */
export function JoyAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="joy-assistant-items"
          className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-surface-muted"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Joy Assistant</span>
            <span className="block text-xs text-muted-foreground">
              Prepared for your review · Joy prepares, a human approves
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{joyInsights.length} items</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </h2>

      {open && (
        <ul id="joy-assistant-items" className="divide-y divide-border border-t border-border">
          {joyInsights.map((insight) => (
            <li key={insight.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground">{insight.message}</p>
              <button
                type="button"
                className="shrink-0 self-start rounded-md border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-soft sm:self-auto"
              >
                {insight.action}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
