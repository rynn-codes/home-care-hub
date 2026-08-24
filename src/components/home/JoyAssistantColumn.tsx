import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_JOY } from "@/lib/homeSeed";

/**
 * The Joy Assistant column, transcribed from the mockup: the standing promise,
 * then Handled · Working · Waiting as counted groups with their items.
 * CLAUDE.md fixes those four words and that order everywhere they appear.
 */
export function JoyAssistantColumn() {
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-[#ECECF1] bg-white px-5 py-[18px]">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-.01em]">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Joy Assistant
        </span>
        <span className="text-[12px] text-muted-foreground">AI prepares. Humans approve.</span>
      </div>

      {HOME_JOY.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <span className="flex items-baseline gap-2">
            <span className="text-[19px] font-medium leading-none tracking-[-.02em]">{g.n}</span>
            <span className={cn("text-[10.5px] font-semibold uppercase tracking-[.13em]", g.tone)}>{g.label}</span>
            {g.note && <span className="ml-auto text-[11.5px] text-muted-foreground">{g.note}</span>}
          </span>
          <ul className="m-0 flex list-none flex-col gap-[5px] p-0">
            {g.items.map((t) => (
              <li key={t} className="text-[12.5px] leading-[1.45] text-[#5B6274]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
