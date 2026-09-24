import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A record's status, as a button that opens the list of what it could be.
 *
 * Every option says what it means before it is picked, and a change is
 * confirmed on a second step that names the person — Karynn, 29 September:
 * "need a secondary confirm to ensure the change is warranted on the right
 * person." A grave change (discharge) also asks for its effective date.
 */
export interface StatusOption<V extends string> {
  value: V;
  label: string;
  meaning: string;
  /** Asks for a date and shows the meaning as a warning before confirming. */
  grave?: boolean;
  dateLabel?: string;
}

export interface StatusChangeDetails {
  note: string | null;
  on: string | null;
}

export function StatusControl<V extends string>({
  current,
  options,
  label,
  subject,
  onChange,
  disabled,
}: {
  current: V;
  options: ReadonlyArray<StatusOption<V>>;
  /** The menu's name — "Employment status", "Client status". */
  label: string;
  /** Whose status, so the confirm step names them. */
  subject?: string;
  onChange: (value: V, details: StatusChangeDetails) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<StatusOption<V> | null>(null);
  const [note, setNote] = useState("");
  const [on, setOn] = useState("");
  const now = options.find((o) => o.value === current);

  const close = () => {
    setOpen(false);
    setPending(null);
    setNote("");
    setOn("");
  };
  const confirm = (o: StatusOption<V>) => {
    onChange(o.value, { note: note.trim() || null, on: on || null });
    close();
  };
  const needsDate = pending?.grave === true && on === "";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors",
          disabled ? "cursor-not-allowed text-muted-foreground/50" : "text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground",
        )}
      >
        {now?.label ?? current}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 z-20 mt-1.5 flex w-[310px] flex-col rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-1.5 shadow-[0_16px_40px_rgba(25,26,46,.16)]"
          >
            {pending === null ? (
              <>
                <span className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                  {label}
                </span>
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="menuitem"
                    onClick={() => (o.value === current ? close() : setPending(o))}
                    className={cn(
                      "flex flex-col gap-[2px] rounded-[9px] px-2.5 py-2 text-left transition-colors",
                      o.value === current ? "bg-[var(--wash-strong)]" : "hover:bg-[var(--wash)]",
                    )}
                  >
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      {o.label}
                      {o.value === current && (
                        <span className="text-[10.5px] font-normal text-muted-foreground">Current</span>
                      )}
                    </span>
                    <span className="text-[11.5px] leading-[1.4] text-muted-foreground [text-wrap:pretty]">{o.meaning}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="flex flex-col gap-2.5 p-2">
                <span className="flex flex-col gap-[2px]">
                  {subject && <span className="text-[13px] font-semibold">{subject}</span>}
                  <span className={cn("text-[13px]", subject ? "text-muted-foreground" : "font-semibold")}>
                    {now?.label ?? current} → {pending.label}
                  </span>
                </span>
                {pending.grave && (
                  <p className="m-0 rounded-[9px] border border-[#FCE8B6] bg-[#FFFAEB] px-2.5 py-2 text-[11.5px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">
                    {pending.meaning}
                  </p>
                )}
                {pending.grave && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                      {pending.dateLabel ?? "Effective date"}
                    </span>
                    <input
                      id={`status-date-${pending.value}`}
                      type="date"
                      value={on}
                      onChange={(e) => setOn(e.target.value)}
                      className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[13px] outline-none transition-colors focus:border-primary"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                    Reason <span className="font-normal normal-case tracking-normal">(optional)</span>
                  </span>
                  <input
                    id={`status-note-${pending.value}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="In hospital until the 30th"
                    className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[13px] outline-none transition-colors focus:border-primary"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={needsDate}
                    onClick={() => confirm(pending)}
                    className={cn(
                      "h-[34px] flex-1 rounded-[9px] px-3 text-[13px] font-medium transition-colors",
                      needsDate
                        ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50"
                        : "bg-primary text-white hover:bg-[#2A1BD1]",
                    )}
                  >
                    {needsDate
                      ? `Set the ${(pending.dateLabel ?? "date").toLowerCase()} first`
                      : `Change ${subject ?? ""} to ${pending.label.toLowerCase()}`.replace("  ", " ")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
