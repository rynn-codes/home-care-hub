import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_MIX, SERVICES, rebalance, splitHours, validateMix, type ServiceShare } from "@/domain/scheduling/serviceMix";

/** Sliders for a client's plan-of-care mix, kept adding to 100. */
export function ServiceMixEditor({ mix, onChange, previewHours = 8, className }: { mix: ServiceShare[]; onChange: (mix: ServiceShare[]) => void; previewHours?: number; className?: string }) {
  const problem = validateMix(mix);
  const preview = splitHours(mix, previewHours);
  const hoursFor = (service: string) => preview.find((p) => p.service === service)?.hours ?? 0;
  const setService = (i: number, service: string) => onChange(mix.map((m, j) => (j === i ? { ...m, service } : m)));
  const remove = (i: number) => {
    const rest = mix.filter((_, j) => j !== i);
    if (rest.length === 0) return;
    onChange([...rebalance(rest, 0, rest[0].percent + (100 - rest.reduce((sum, m) => sum + m.percent, 0)))]);
  };
  const add = () => {
    const next = SERVICES.find((s) => !mix.some((m) => m.service === s));
    if (!next) return;
    const grown = [...mix, { service: next, percent: 0 }];
    onChange([...rebalance(grown, grown.length - 1, 10)]);
  };

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {mix.map((m, i) => (
        <div key={`${m.service}-${i}`} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <select value={m.service} aria-label={`Service ${i + 1}`} onChange={(e) => setService(i, e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[13px]">
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="w-[52px] flex-none text-right text-[13px] font-medium tabular-nums">{m.percent}%</span>
            <button
              type="button"
              aria-label={`Remove ${m.service}`}
              disabled={mix.length === 1}
              onClick={() => remove(i)}
              className="flex h-9 w-8 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--wash)] disabled:opacity-30"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={m.percent}
              aria-label={`${m.service} share`}
              onChange={(e) => onChange([...rebalance(mix, i, Number(e.target.value))])}
              className="h-1.5 min-w-0 flex-1 accent-[hsl(var(--primary))]"
            />
            <span className="w-[86px] flex-none text-right text-[11.5px] tabular-nums text-muted-foreground">
              {hoursFor(m.service)} of {previewHours} hrs
            </span>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={add} disabled={mix.length >= SERVICES.length} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--wash)] disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add a service
        </button>
        <button type="button" onClick={() => onChange([...DEFAULT_MIX])} className="h-8 rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--wash)]">
          Back to 70 / 20 / 10
        </button>
      </div>
      {problem && <p className="m-0 text-[12.5px] leading-[1.45] text-[#98322C]">{problem}</p>}
    </div>
  );
}
