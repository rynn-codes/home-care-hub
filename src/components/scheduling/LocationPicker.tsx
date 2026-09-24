import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { LOCATION_STATUS_LABELS, searchLocations, validateProposal, type ApprovedLocation, type LocationStatus } from "@/domain/scheduling/locations";

const badge = (status: LocationStatus) =>
  cn(
    "flex-none rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[.05em]",
    status === "primary" && "bg-[#EEF0FE] text-primary",
    status === "approved" && "bg-[#ECFDF3] text-[#027A48]",
    status === "pending" && "bg-[#FFFAEB] text-[#B54708]",
  );

/** Where a clock was taken: an approved place, or a new one proposed for approval. */
export function LocationPicker({
  id,
  label,
  locations,
  value,
  sameAs,
  onPick,
  onSame,
  onPropose,
}: {
  id: string;
  label: string;
  locations: readonly ApprovedLocation[];
  value: string | null;
  sameAs?: ApprovedLocation | null;
  onPick: (id: string) => void;
  onSame?: () => void;
  onPropose: (label: string, address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const picked = locations.find((l) => l.id === value) ?? null;
  const results = useMemo(() => searchLocations(locations, query), [locations, query]);
  const typed = query.trim();
  const isNew = typed !== "" && !locations.some((l) => l.label.toLowerCase() === typed.toLowerCase());
  const problem = validateProposal({ label: name, address: typed });

  return (
    <div className="space-y-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      {open ? (
        <div className="space-y-1.5">
          <input
            id={id}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search approved, or type a new address"
            className="h-10 w-full rounded-md border-2 border-primary bg-background px-3 text-[13.5px] outline-none"
          />
          <div className="overflow-hidden rounded-md border border-[var(--hairline)] bg-[var(--paper)]">
            <span className="block bg-[var(--paper-sunken)] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-muted-foreground">Approved for this client</span>
            {onSame && (
              <button
                type="button"
                onClick={() => {
                  onSame();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-b border-[var(--hairline-soft)] px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--wash)]"
              >
                Same as clock-in
              </button>
            )}
            {results.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  onPick(l.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-b border-[var(--hairline-soft)] px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-[var(--wash)]"
              >
                <span className="flex min-w-0 flex-col leading-[1.3]">
                  <span className="truncate text-[13px]">{l.label}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{l.address ?? "No address on file yet"}</span>
                </span>
                <span className={cn(badge(l.status), "ml-auto")}>{LOCATION_STATUS_LABELS[l.status]}</span>
              </button>
            ))}
            {results.length === 0 && <span className="block px-3 py-2 text-[12.5px] text-muted-foreground">Nothing on the list matches that.</span>}
          </div>
          {isNew && (
            <div className="space-y-1.5 rounded-md border border-[var(--hairline)] bg-[var(--paper-sunken)] p-2.5">
              <span className="block text-[12px] text-muted-foreground [text-wrap:pretty]">Add “{typed}” as a new location. It goes on the client's list as pending until you approve it.</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="What the family calls it"
                placeholder="What the family calls it — Daughter's home"
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px]"
              />
              <button
                type="button"
                disabled={problem !== null}
                onClick={() => {
                  if (problem !== null) return;
                  onPropose(name, typed);
                  setName("");
                  setOpen(false);
                }}
                className={cn("h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors", problem === null ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/60")}
              >
                {problem ?? "Add it"}
              </button>
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--wash)]">
            Close
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left transition-colors hover:bg-[var(--wash)]"
        >
          <span className="flex min-w-0 flex-col leading-[1.3]">
            <span className="truncate text-[13.5px]">{sameAs ? "Same as clock-in" : picked?.label ?? "Pick a location"}</span>
            <span className="truncate text-[12px] text-muted-foreground">{(sameAs ?? picked)?.address ?? (sameAs || picked ? "No address on file yet" : "")}</span>
          </span>
          {picked && !sameAs && picked.status !== "primary" && <span className={cn(badge(picked.status), "ml-auto")}>{LOCATION_STATUS_LABELS[picked.status]}</span>}
          <span className="ml-auto flex-none text-muted-foreground" aria-hidden="true">
            ⌄
          </span>
        </button>
      )}
    </div>
  );
}
