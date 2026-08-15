import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface HomePanelProps {
  title: string;
  /** Optional link out to the module this panel summarises. */
  action?: { label: string; to: string };
  children: ReactNode;
}

/**
 * The shared surface for every Home panel.
 *
 * Each panel is a self-contained widget so the Home screen can become
 * drag-and-drop later without rewriting its contents, and so no panel invents
 * its own card styling. Follows the visual constitution: white surface,
 * hairline border, no shadow stack, no decorative gradient.
 */
export function HomePanel({ title, action, children }: HomePanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action && (
          <Link
            to={action.to}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * A labelled count that navigates to the filtered view behind it.
 *
 * "No dead buttons" in the definition of Done applies to counts too — a number
 * on Home that cannot be opened is a dead end.
 */
export function CountLink({
  label,
  value,
  note,
  to,
}: {
  label: string;
  value: string;
  note?: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
    >
      <span className="flex-1 text-sm">{label}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
      <span className="min-w-6 text-right text-sm font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
