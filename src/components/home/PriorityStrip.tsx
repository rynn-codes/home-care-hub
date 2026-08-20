import { Link } from "react-router-dom";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { cn } from "@/lib/utils";

/**
 * The strip of figures across the top of Home.
 *
 * Every number is computed by the module that owns it — see
 * `domain/home/signals.ts`. It previously read six hardcoded values out of the
 * seed, which meant Home could say four open shifts while Scheduling showed
 * two, in the place somebody forms their first impression of whether any of
 * this can be trusted.
 */
export function PriorityStrip() {
  const signals = useHomeSignals();

  return (
    <nav aria-label="Today's priorities" className="mb-6">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {signals.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className={cn(
                "flex h-full flex-col gap-1 rounded-xl border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-muted",
                item.urgent ? "border-[hsl(var(--warning)/0.5)]" : "border-border hover:border-primary/40",
              )}
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums">{item.value}</span>
                {item.urgent && (
                  <span className="text-[11px] font-medium text-[hsl(var(--warning))]">
                    needs you
                  </span>
                )}
              </span>
              {item.detail && (
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {item.detail}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
