import { Link } from "react-router-dom";
import { priorityStrip } from "@/lib/joySeed";

/**
 * The compact priority strip — all six items.
 *
 * Answers the one question Home exists to answer: what needs me today. Each
 * tile opens the filtered view behind it. Urgency is marked with a word as well
 * as a colour, since colour must never be the only status signal.
 */
export function PriorityStrip() {
  return (
    <nav aria-label="Today's priorities" className="mb-6">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {priorityStrip.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-surface-muted"
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
