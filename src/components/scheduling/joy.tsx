import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Joy's two voices on a form: a suggestion (blue — information) and a warning
 * (rose — something is wrong or blocks). Joy suggests; a person decides.
 */

export type RowTone = "good" | "warn" | "bad" | "plain";

const ROW_TONE: Record<RowTone, string> = {
  good: "text-[#027A48]",
  warn: "text-[#B54708]",
  bad: "text-[#98322C]",
  plain: "",
};

export function JoySuggests({
  headline,
  rows = [],
  note,
  actions,
  className,
}: {
  headline: ReactNode;
  rows?: Array<{ label: string; value: ReactNode; tone?: RowTone }>;
  note?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-[11px] border border-[#DDE1FA] bg-[#F7F8FE] px-3.5 py-3", className)}>
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.085em] text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        Joy suggests
      </span>
      <span className="text-[13px] leading-[1.45] [text-wrap:pretty]">{headline}</span>
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <span key={r.label} className="flex items-baseline gap-2 text-[12.5px]">
              <span className="w-[62px] flex-none text-muted-foreground">{r.label}</span>
              <span className={cn("[text-wrap:pretty]", ROW_TONE[r.tone ?? "plain"])}>{r.value}</span>
            </span>
          ))}
        </div>
      )}
      {note && <span className="text-[12px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">{note}</span>}
      {actions && <div className="mt-0.5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function JoyWarns({ title, children, icon, className }: { title: ReactNode; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[11px] border border-[#F4D7D5] bg-[#FDF3F3] px-3.5 py-3", className)}>
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.085em] text-[#B4443C]">
        {icon}
        {title}
      </span>
      <div className="text-[12.5px] leading-[1.5] text-[#98322C] [text-wrap:pretty]">{children}</div>
    </div>
  );
}

export function SmallButton({ children, onClick, disabled, secondary }: { children: ReactNode; onClick?: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg px-3 text-[12.5px] font-medium transition-colors",
        secondary
          ? "border border-[var(--hairline)] bg-[var(--paper)] font-normal text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground"
          : disabled
            ? "cursor-default bg-[var(--wash-strong)] text-muted-foreground"
            : "bg-primary text-white hover:bg-[#2A1BD1]",
      )}
    >
      {children}
    </button>
  );
}

/** The board's pills. */
export const PILL = {
  open: "inline-flex items-center whitespace-nowrap rounded-full bg-[#EEF0FE] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-primary",
  conflict: "inline-flex items-center whitespace-nowrap rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-[#B42318]",
  confirmed: "inline-flex items-center whitespace-nowrap rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-[#027A48]",
  exception: "inline-flex items-center whitespace-nowrap rounded-full bg-[#FFFAEB] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-[#B54708]",
};

/** Local time and date formatting the whole module shares. */
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtLong = (d: Date) => d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
export const fmtDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
export const fmtShort = (iso: string) => {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${suffix}`;
};
export const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
