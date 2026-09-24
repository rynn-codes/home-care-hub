import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { STAGE_LABELS } from "@/domain/admissions/stages";
import { groupHits, search, type SearchHit, type SearchItem } from "@/domain/search";
import type { SeedAdmission } from "@/lib/admissionsSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedContacts } from "@/lib/peopleSeed";

function buildIndex(admissions: SeedAdmission[]): SearchItem[] {
  const items: SearchItem[] = [];
  for (const c of seedClients) {
    items.push({
      id: c.personId,
      kind: "client",
      name: `${c.firstName} ${c.lastName}`,
      detail: [c.status === "active" || !c.status ? "Client" : `Client · ${c.status}`, (c.services ?? []).join(", ")].filter(Boolean).join(" · "),
      terms: [c.phone ?? "", c.email ?? "", c.address ?? "", c.location ?? "", c.caregiver ?? "", c.coordinator ?? "", c.condition ?? "", c.responsiblePartyName ?? "", c.payer ?? ""].filter(Boolean),
      to: `/clients/${c.personId}`,
    });
  }
  for (const a of admissions) {
    items.push({
      id: a.id,
      kind: "admission",
      name: a.name,
      detail: [STAGE_LABELS[a.stage], a.service].filter(Boolean).join(" · "),
      terms: [a.location, a.headline, a.meta].filter(Boolean),
      to:
        a.stage === "new_referral" || a.stage === "phone_intake"
          ? `/admissions/${a.id}/intake`
          : a.stage === "assessment"
            ? `/admissions/${a.id}/assessment`
            : `/admissions/${a.id}/review`,
    });
  }
  for (const e of seedEmployees) {
    items.push({
      id: e.id,
      kind: "employee",
      name: e.name,
      detail: [e.role, e.status].filter(Boolean).join(" · "),
      terms: [e.phone ?? "", e.email ?? "", ...(e.clients ?? []), e.kin ?? ""].filter(Boolean),
      to: `/employees/${e.id}`,
    });
  }
  for (const c of seedContacts) {
    items.push({
      id: c.id,
      kind: "contact",
      name: c.name,
      detail: [c.title, c.organization].filter(Boolean).join(" · ") || "Contact",
      terms: [c.phone ?? "", c.email ?? "", c.organization ?? "", c.unit ?? ""].filter(Boolean),
      to: `/people/${c.id}`,
    });
  }
  return items;
}

/** ⌘K. Type a name, a phone number, a ZIP — or a caregiver's name to find their clients. */
export function CommandPalette({
  open,
  onOpenChange,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}) {
  const navigate = useNavigate();
  const { admissions } = useDemo();
  const [query, setQuery] = useState(initialQuery);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => buildIndex(admissions), [admissions]);
  const hits = useMemo(() => search(index, query), [index, query]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setCursor(0);
    }
  }, [open, initialQuery]);
  useEffect(() => setCursor(0), [query]);

  const go = (hit: SearchHit) => {
    onOpenChange(false);
    navigate(hit.to);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter" && flat[cursor]) {
      e.preventDefault();
      go(flat[cursor]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12%] max-h-[70vh] w-full max-w-[560px] translate-y-0 gap-0 overflow-hidden rounded-[16px] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          input.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-3.5 pl-4 pr-12">
          <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
          <input
            ref={input}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search clients, caregivers, admissions, people…"
            aria-label="Search"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none placeholder:text-[#C9C9D0]"
          />
          <kbd className="flex-none rounded border border-[var(--hairline)] px-1.5 py-0.5 text-[10.5px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {query.trim().length < 2 ? (
            <p className="m-0 px-4 py-6 text-center text-[13px] text-muted-foreground">
              Type a name, a phone number, a ZIP — or a caregiver's name to find their clients.
            </p>
          ) : flat.length === 0 ? (
            <p className="m-0 px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing matches “{query.trim()}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g.kind} className="pb-1.5">
                <p className="m-0 px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#9B9BA3]">{g.label}</p>
                {g.items.map((hit) => {
                  const i = flat.indexOf(hit);
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(hit)}
                      className={cn("flex w-full items-baseline gap-2.5 px-4 py-2 text-left transition-colors", i === cursor ? "bg-[#EFEDFB]" : "hover:bg-[var(--wash)]")}
                    >
                      <span className="truncate text-[13.5px] font-medium text-[var(--ink-strong)]">{hit.name}</span>
                      <span className="truncate text-[12px] text-[var(--ink-body)]">{hit.detail}</span>
                      {hit.matchedOn !== "name" && <span className="ml-auto flex-none text-[11px] text-[#9B9BA3]">matched on details</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** ⌘K / Ctrl+K anywhere in the app. */
export function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}
