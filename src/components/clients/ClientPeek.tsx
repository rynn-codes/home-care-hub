import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS_LABELS, type ClientRecord } from "@/domain/clients/roster";

/**
 * The quick look from the directory: who they are, who is on the case, what
 * paperwork is outstanding, and the way to the full record. A right-hand
 * sheet so the directory stays where it was — the same gesture as Employees.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px]">
      <span className="flex-none text-[12px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[12.5px] text-[var(--ink-body)]">{children}</span>
    </div>
  );
}

export function ClientPeek({
  client,
  mayWrite,
  onClose,
  onDelete,
}: {
  client: ClientRecord | null;
  mayWrite: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const lapsed = client?.compliance.filter((c) => c.state === "overdue" || c.state === "missing") ?? [];
  const dueSoon = client?.compliance.filter((c) => c.state === "due_soon") ?? [];

  return (
    <Sheet open={client !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        {client && (
          <>
            <SheetHeader className="border-b border-[var(--hairline)] px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[14px] font-semibold text-primary">
                  {client.initials}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-[17px]">{client.name}</SheetTitle>
                  <SheetDescription className="text-[12.5px]">
                    {CLIENT_STATUS_LABELS[client.status]}
                    {client.location ? ` · ${client.location}` : ""}
                    {client.age !== null ? ` · ${client.age}` : ""}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                {client.phone ? (
                  <a
                    href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {client.phone}
                  </a>
                ) : (
                  <span className="rounded-[9px] border border-dashed border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
                    No phone on file
                  </span>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
                  >
                    <Mail className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 px-5 py-4">
              <section className="rounded-[12px] border border-[var(--hairline)] p-3.5">
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Care</p>
                <Row label="Payer">{client.payer ?? "Not recorded"}</Row>
                <Row label="Services">{client.services.length ? client.services.join(", ") : "—"}</Row>
                <Row label="Primary caregiver">{client.caregiver ?? "Unassigned"}</Row>
                <Row label="Coordinator">{client.coordinator ?? "—"}</Row>
                <Row label="Hours">{client.hoursPerWeek === null ? "—" : `${client.hoursPerWeek} / week`}</Row>
                <Row label="Next visit">{client.nextVisit ?? "—"}</Row>
              </section>

              <section className="rounded-[12px] border border-[var(--hairline)] p-3.5">
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Paperwork</p>
                {lapsed.length === 0 && dueSoon.length === 0 ? (
                  <p className="m-0 text-[12.5px] text-muted-foreground">Nothing outstanding.</p>
                ) : (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {[...lapsed, ...dueSoon].map((item) => (
                      <li key={item.key} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span
                          className={cn(
                            "flex-none",
                            item.state === "overdue" || item.state === "missing" ? "text-[#B42318]" : "text-[#B54708]",
                          )}
                        >
                          {item.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-[var(--hairline)] bg-[var(--paper)] px-5 py-3.5">
              {mayWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="text-[#B42318] hover:bg-[#FEF3F2] hover:text-[#B42318]"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </Button>
              )}
              <span className="flex-1" />
              <Button asChild size="sm">
                <Link to={`/clients/${client.personId}`} onClick={onClose}>
                  Full profile
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
