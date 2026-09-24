import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { HOME_JOY } from "@/lib/homeSeed";

/**
 * The Joy Assistant column: the standing promise, then Handled · Working ·
 * Waiting · Needs you as counted groups, and a way through to the whole of
 * Joy's work at the bottom.
 *
 * Karynn, 25 August: "All of these should be links to somewhere. Also you're
 * missing View Joy Operations."
 *
 * Every row is a link now. They stay in body colour rather than the link blue —
 * a column of eleven blue lines reads as an alarm board, and the semantic rule
 * keeps blue for the one primary action. The affordance is the hover: the row
 * darkens to ink and its arrow slides in. The Needs-you group is the one whose
 * count takes the warm colour, because it is the one that wants opening.
 */
export function JoyAssistantColumn() {
  return (
    <section
      aria-labelledby="joy-assistant-heading"
      className="flex flex-col gap-4 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-5 py-[18px] sm:flex-1"
    >
      <div className="flex flex-col gap-0.5">
        <span id="joy-assistant-heading" className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-.01em]">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Joy Assistant
        </span>
        <span className="text-[12px] text-muted-foreground">AI prepares. Humans approve.</span>
      </div>

      {HOME_JOY.map((g) => {
        const needsYou = g.label === "Needs you";
        return (
          <div key={g.label} className="flex flex-col gap-2">
            <span className="flex items-baseline gap-2">
              <span className={cn("text-[19px] font-medium leading-none tracking-[-.02em]", needsYou && g.tone)}>{g.n}</span>
              <span className={cn("text-[10.5px] font-semibold uppercase tracking-[.13em]", g.tone)}>{g.label}</span>
              {g.note && <span className="ml-auto text-[11.5px] text-muted-foreground">{g.note}</span>}
            </span>
            <ul className="m-0 flex list-none flex-col gap-[5px] p-0">
              {g.items.map((item) => (
                <li key={item.text}>
                  <Link
                    to={item.to}
                    className={cn(
                      "group -mx-1.5 flex items-start gap-1.5 rounded-md px-1.5 py-[3px] text-[12.5px] leading-[1.45] transition-colors hover:bg-[var(--wash)]",
                      needsYou ? "font-medium text-[var(--ink)]" : "text-[var(--ink-body)] hover:text-[var(--ink)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">{item.text}</span>
                    <ArrowRight
                      className="mt-[3px] h-3 w-3 flex-none opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* The way into the whole of it. The four groups above are a summary;
          Joy Operations is the screen that holds every item, with the queue
          and the approvals. */}
      <Link
        to="/brain/operations"
        className="mt-auto flex items-center gap-1.5 border-t border-[var(--hairline)] pt-3.5 text-[12.5px] font-medium text-primary transition-colors hover:text-[#2A1BD1]"
      >
        View Joy Operations
        <ArrowRight className="h-3 w-3 flex-none" aria-hidden="true" />
      </Link>
    </section>
  );
}
