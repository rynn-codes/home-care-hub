import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Pencil, Phone, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecordHeader } from "@/components/records/RecordHeader";
import { LogActivityDialog } from "@/components/records/LogActivityDialog";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { ContactDialog } from "@/components/people/ContactDialog";
import { ContactRecord } from "@/components/people/ContactRecord";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { buildFeed, giftSummaryLine, giftTotalFor, interactionsFor } from "@/domain/records/activity";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABELS,
  CONTACT_SORT_LABELS,
  applyDraft,
  contactFromDraft,
  contactLine,
  contactRow,
  deletionWarning,
  filterContactRows,
  isReferrer,
  searchContacts,
  sortContactRows,
  type Contact,
  type ContactDraft,
  type ContactFilter,
  type ContactSort,
} from "@/domain/people/contacts";
import { seedContacts } from "@/lib/peopleSeed";
import { cn } from "@/lib/utils";

/**
 * People — everybody who is neither a client nor an employee.
 *
 * Karynn's own definition, 18 August: "our general contact list for ancillary
 * people, IE any contacts of the company that we need to remember, follow-up
 * with, business contacts, partners."
 *
 * A table, sorted by silence. An address book sorted alphabetically hides
 * the thing worth knowing, which is that the discharge planner who sent two
 * clients in the spring has not heard from anybody since. So the quietest
 * referrer sits at the top, in orange, and the temperature dot says the
 * same thing at a glance. Sort and filter are there for the other questions
 * — who is at Methodist, who has sent us the most work.
 *
 * A row opens the record, which carries the same header as a client or an
 * employee and the same activity feed. "Spoke to them today" is gone: a
 * logged call moves the last-contact date on its own, so the record of the
 * conversation and the clock reset are one action.
 *
 * Clients and Employees are their own screens, not tabs here — she moved
 * them out deliberately.
 */
function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-[#8A8A92]", className)}>
      {children}
    </th>
  );
}

export default function People() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ContactSort>("last_contact");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logging, setLogging] = useState<"phone" | "any" | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const {
    contacts: added,
    contactEdits,
    deletedContactIds,
    admissions,
    addContact,
    editContact,
    deleteContact,
    restoreDeleted,
    interactions,
    logActivity,
    deleteActivity,
    currentUser,
  } = useDemo();
  const mayWrite = canWrite(currentUser.role);

  // Added contacts merge with the seeded cards rather than replacing them, the
  // same way new hires merge with the seeded workforce. Edits apply to both,
  // so a caller does not have to know which list somebody came from.
  const all = useMemo(
    () =>
      [...added, ...seedContacts]
        .filter((c) => !deletedContactIds.includes(c.id))
        .map((c) => ({ ...c, ...contactEdits[c.id] })),
    [added, contactEdits, deletedContactIds],
  );

  const referralNames = useMemo(
    () => (ids: readonly string[]) =>
      ids.map((rid) => admissions.find((a) => a.id === rid)?.name).filter((n): n is string => Boolean(n)),
    [admissions],
  );

  const rows = useMemo(() => {
    const searched = searchContacts(all, query).map((c) => contactRow(c, today));
    return sortContactRows(filterContactRows(searched, filter), sort, today);
  }, [all, query, filter, sort, today]);

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setDialogOpen(true);
  };

  const save = (draft: ContactDraft) => {
    if (editing) {
      // The whole contact, so clearing a field actually clears it.
      editContact(editing.id, applyDraft(editing, draft));
      toast.success(`${draft.name.trim()} updated`);
      return;
    }
    const contact = contactFromDraft({ draft, id: `contact-${Date.now()}`, today });
    addContact(contact);
    toast.success(`${contact.name} added`);
  };

  const selected = id ? all.find((c) => c.id === id) : undefined;

  if (id && !selected) {
    return (
      <>
        <PageHeader title="Not found" parents={[{ label: "People", to: "/people" }]} />
        <p className="text-sm text-muted-foreground">That contact is not here. It may have been removed.</p>
      </>
    );
  }

  if (selected) {
    const year = new Date().getFullYear();
    const gifts = giftTotalFor(interactions, "contact", selected.id, year);
    return (
      <>
        <RecordHeader
          name={selected.name}
          parents={[{ label: "People", to: "/people" }]}
          status={CONTACT_KIND_LABELS[selected.kind]}
          statusTone={isReferrer(selected) ? "info" : "muted"}
          line={contactLine(selected) || undefined}
          actions={
            mayWrite ? (
              <>
                <button
                  type="button"
                  onClick={() => setLogging("phone")}
                  className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Log a call
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </button>
                <Button variant="outline" onClick={() => setRemoving(selected)}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remove
                </Button>
              </>
            ) : undefined
          }
        />

        <ContactRecord
          contact={selected}
          asOf={today}
          referralNames={referralNames}
          feed={buildFeed(interactionsFor(interactions, "contact", selected.id))}
          gifts={gifts}
          giftYear={year}
          onLogActivity={() => setLogging("any")}
          onLogCall={() => setLogging("phone")}
          onDeleteActivity={deleteActivity}
        />

        <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSave={save} />

        <LogActivityDialog
          open={logging !== null}
          onOpenChange={(o) => setLogging(o ? "any" : null)}
          initialChannel="phone"
          subjectName={selected.name}
          giftsSoFar={giftSummaryLine(gifts, year)}
          onSave={(draft) => {
            logActivity({ draft, subject: { kind: "contact", id: selected.id, name: selected.name } });
            toast(`Activity logged for ${selected.name}`);
          }}
        />

        <ConfirmDeleteDialog
          open={!!removing}
          onOpenChange={(o) => !o && setRemoving(null)}
          title="Remove this contact?"
          subject={removing ? [removing.name, removing.organization].filter(Boolean).join(" · ") : ""}
          consequences={[
            "Their card and everything on it",
            deletionWarning(removing ?? selected) ?? "They have not sent us anybody, so nothing else is affected.",
          ]}
          confirmLabel="Remove contact"
          onConfirm={() => {
            if (!removing) return;
            const gone = removing;
            deleteContact(gone.id);
            setRemoving(null);
            navigate("/people");
            toast(`${gone.name} removed`, {
              description: "In Deleted items for 30 days.",
              action: { label: "Undo", onClick: () => restoreDeleted(gone.id) },
            });
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="People"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add contact
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
            >
              Sort: {CONTACT_SORT_LABELS[sort]}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as ContactSort)}>
              {(Object.keys(CONTACT_SORT_LABELS) as ContactSort[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {CONTACT_SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] transition-colors",
                filter === "all"
                  ? "border-[var(--hairline)] bg-[var(--paper)] hover:bg-[var(--wash)]"
                  : "border-[rgba(20,7,162,.24)] bg-[#EFEDFB] font-medium text-primary",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              {filter === "all"
                ? "Filter"
                : filter === "referrers"
                  ? "Sends us work"
                  : filter === "needs_call"
                    ? "Worth a call"
                    : CONTACT_KIND_LABELS[filter]}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel>Show</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as ContactFilter)}>
              <DropdownMenuRadioItem value="all">Everyone</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="referrers">Sends us work</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="needs_call">Worth a call</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {CONTACT_KINDS.map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {CONTACT_KIND_LABELS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative ml-auto w-full max-w-[300px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, organisation, unit or note"
            aria-label="Search contacts"
            className="h-9 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[#C7C9F5] placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--hairline)] bg-[var(--paper-sunken)]">
                <Th className="w-[26%]">Name</Th>
                <Th className="w-[20%]">Organization</Th>
                <Th className="w-[14%]">Type</Th>
                <Th className="w-[20%]">Email</Th>
                <Th className="w-[10%]">Referrals</Th>
                <Th className="w-[14%]">Last contact</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.contact.id}
                  onClick={() => navigate(`/people/${r.contact.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/people/${r.contact.id}`);
                  }}
                  className="cursor-pointer border-b border-[var(--hairline-soft)] transition-colors last:border-b-0 hover:bg-[var(--wash)] focus:bg-[var(--wash)] focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13.5px] font-medium text-[var(--ink-strong)]">{r.name}</span>
                      {r.contact.title && (
                        <span className="text-[12px] text-[var(--ink-body)]">
                          {r.contact.title}
                          {r.contact.unit ? ` · ${r.contact.unit}` : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[var(--ink-body)]">{r.organization}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--hairline-soft)] px-2 py-[3px] text-[11px] font-medium text-[var(--ink-body)]">
                      {r.kindLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    {r.contact.email ? (
                      <a
                        href={`mailto:${r.contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {r.contact.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-[var(--ink-body)]">
                    {r.referrals || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 whitespace-nowrap text-[13px]">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-[7px] w-[7px] flex-none rounded-full",
                          r.temperature === "fresh"
                            ? "bg-[#15803D]"
                            : r.temperature === "cold"
                              ? "bg-[#C2410C]"
                              : r.temperature === "none"
                                ? "bg-[#C8C8D0]"
                                : "bg-[#B98900]",
                        )}
                      />
                      <span className={r.temperature === "cold" ? "font-medium text-[#C2410C]" : "text-[var(--ink-body)]"}>
                        {r.lastContact}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {query || filter !== "all" ? "Nobody matches that." : "No contacts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-2.5 text-[12.5px] text-muted-foreground">
          <span className="font-medium text-[var(--ink-body)]">{rows.length}</span>
          <span>{rows.length === 1 ? "person" : "people"}</span>
          {rows.length !== all.length && <span>· {all.length} in total</span>}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Referral sources are flagged after three months without contact, which is roughly how quickly an
        agency drops off a discharge planner's list.
      </p>

      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSave={save} />
    </>
  );
}
