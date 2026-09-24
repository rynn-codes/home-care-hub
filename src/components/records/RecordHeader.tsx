import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/layout/Breadcrumb";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

/**
 * The top of any record — a client, an employee, a business contact.
 *
 * Karynn, 30 August: "Keep the same UI/UX when you click on a client or
 * Employee."
 *
 * She was looking at three screens that had arrived by three different routes.
 * Clients and Employees were built to the approved record mock and opened with
 * a back arrow, a 56px avatar and a status pill. People was rebuilt to the
 * Attio mock the same week and opened with a breadcrumb, putting the avatar and
 * the actions down in the left rail. Both were defensible on their own and the
 * pair was incoherent: the same gesture — click a person, look at their record
 * — produced two different pages.
 *
 * This is the reconciliation, and it takes from each the part that was right.
 *
 * THE BREADCRUMB WINS OVER THE BACK ARROW. A bare arrow says "somewhere back"
 * and nothing else; the trail says which directory you came from and lets you
 * jump to Home in one move. Every other screen in the product already has it,
 * so the record pages were the exception rather than the rule.
 *
 * THE IDENTITY BLOCK WINS OVER THE RAIL. Avatar, status and name belong at the
 * top where the eye lands, not a third of the way down the left column. Status
 * especially: "Discharged" or "Cannot be scheduled" changes how you read
 * everything under it, so it cannot sit below the fold.
 *
 * ACTIONS STAY TOP-RIGHT, which is where they were on Clients and Employees and
 * where PageHeader puts them on all nineteen other screens.
 */

export type RecordStatusTone = "good" | "warn" | "bad" | "info" | "muted";

const TONES: Record<RecordStatusTone, string> = {
  good: "bg-[#ECFDF3] text-[#027A48]",
  warn: "bg-[#FFFAEB] text-[#B54708]",
  bad: "bg-[#FEF3F2] text-[#B42318]",
  info: "bg-[#EEF0FE] text-primary",
  muted: "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
};

export function RecordHeader({
  name,
  line,
  status,
  statusTone = "muted",
  parents,
  actions,
}: {
  name: string;
  /** The one line under the name: role, age and location, unit and employer. */
  line?: ReactNode;
  status?: string;
  statusTone?: RecordStatusTone;
  parents?: readonly Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <Breadcrumb parents={parents} current={name} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EEF0FE] text-[17px] font-semibold text-primary"
          >
            {initialsOf(name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            {status && (
              <span
                className={cn(
                  "inline-flex self-start rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                  TONES[statusTone],
                )}
              >
                {status}
              </span>
            )}
            <h1 className="m-0 text-[23px] font-semibold leading-[1.15] tracking-[-.02em]">
              {name}
            </h1>
            {line && <p className="m-0 text-[12.5px] text-muted-foreground">{line}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:pt-1.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One row of the Details rail.
 *
 * Clients and Employees ruled their rows with a hairline and People did not,
 * which is the sort of two-pixel difference nobody can name but everybody feels
 * when the two screens sit side by side. The rule stays: at ten or more rows —
 * which every one of these rails has — the eye needs the line to keep a value
 * with its label.
 */
export function RecordDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0">
      <dt className="w-28 flex-none text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13px] [text-wrap:pretty]">
        {value === null || value === undefined || value === "" ? (
          <span className="text-muted-foreground">Not recorded</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function RecordSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
      {children}
    </h2>
  );
}
