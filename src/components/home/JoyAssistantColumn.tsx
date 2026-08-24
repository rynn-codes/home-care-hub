import { Sparkles } from "lucide-react";
import { brainHandled, brainWaiting, brainWorking } from "@/lib/brainSeed";
import { cn } from "@/lib/utils";

/**
 * The Joy Assistant column from the Home design: the standing promise ("AI
 * prepares. Humans approve."), then Handled / Working / Waiting as counted
 * groups with the items underneath.
 *
 * Same three lists The Brain's Joy Operations tab renders — one source, so the
 * count on Home and the count one level down cannot drift apart.
 */
const GROUPS = [
  { n: brainHandled.length, label: "Handled", tone: "text-[#15803D]", items: brainHandled.map((h) => h.title), note: "since yesterday" },
  { n: brainWorking.length, label: "Working", tone: "text-primary", items: brainWorking.map((w) => w.title), note: "" },
  { n: brainWaiting.length, label: "Waiting", tone: "text-muted-foreground", items: brainWaiting.map((w) => w.title), note: "" },
] as const;

export function JoyAssistantColumn() {
  return (
    <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white px-5 py-[18px]">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-.01em]">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Joy Assistant
        </span>
        <span className="text-[12px] text-muted-foreground">AI prepares. Humans approve.</span>
      </div>

      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5 border-t border-[#F3F3F6] pt-3 first-of-type:border-t-0 first-of-type:pt-0">
          <span className="flex items-baseline gap-2">
            <span className="text-[19px] font-medium leading-none tracking-[-.02em]">{g.n}</span>
            <span className={cn("text-[10.5px] font-semibold uppercase tracking-[.13em]", g.tone)}>{g.label}</span>
            {g.note && <span className="ml-auto text-[11.5px] text-muted-foreground">{g.note}</span>}
          </span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {g.items.slice(0, 4).map((t) => (
              <li key={t} className="text-[12.5px] leading-[1.45] text-[#5B6274]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="m-0 border-t border-[#F3F3F6] pt-2.5 text-[11px] text-muted-foreground [text-wrap:pretty]">
        Joy drafts and chases; every decision here waits for a person. Messages go through Spruce,
        which isn't wired in the prototype.
      </p>
    </section>
  );
}
