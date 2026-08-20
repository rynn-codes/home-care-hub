import { useMemo, useState } from "react";
import { Building2, Mail, Phone, Search, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import {
  CONTACT_KIND_LABELS,
  contactLine,
  contactStanding,
  displayName,
  isReferrer,
  needsFollowUp,
  searchContacts,
  sortContacts,
  type Contact,
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
 * The screen is organised around the second half of that sentence. An address
 * book sorted alphabetically hides the thing worth knowing, which is that the
 * discharge planner who sent two clients in the spring has not heard from
 * anybody since. So whoever needs chasing sits at the top and says why.
 *
 * Clients and Employees are their own screens, not tabs here — she moved them
 * out deliberately.
 */

function ContactRow({ contact, today }: { contact: Contact; today: string }) {
  const chase = needsFollowUp(contact, today);

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {chase && (
              <TriangleAlert
                className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]"
                aria-hidden="true"
              />
            )}
            {displayName(contact)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{contactLine(contact)}</p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 -my-2 py-2 text-muted-foreground underline-offset-4 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              // Padded to a real tap target — see OfficeNumber for why.
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 -my-2 py-2 text-muted-foreground underline-offset-4 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {contact.phone}
              </a>
            )}
          </div>

          {contact.address && (
            <p className="mt-1.5 text-xs text-muted-foreground">{contact.address}</p>
          )}
          {contact.notes && <p className="mt-1.5 text-xs text-muted-foreground">{contact.notes}</p>}
        </div>

        <div className="shrink-0 text-right">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
              isReferrer(contact)
                ? "bg-primary-soft text-primary"
                : "bg-surface-muted text-muted-foreground",
            )}
          >
            {CONTACT_KIND_LABELS[contact.kind]}
          </span>
          <p
            className={cn(
              "mt-1.5 text-xs",
              chase ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
            )}
          >
            {contactStanding(contact, today)}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function People() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [query, setQuery] = useState("");

  const contacts = useMemo(
    () => sortContacts(searchContacts(seedContacts, query), today),
    [query, today],
  );

  const chasing = seedContacts.filter((c) => needsFollowUp(c, today)).length;
  const referrers = seedContacts.filter(isReferrer).length;

  return (
    <>
      <PageHeader
        title="People"
        description="Business contacts, referral sources and partners — everybody who is not a client or an employee."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        {seedContacts.length} {seedContacts.length === 1 ? "contact" : "contacts"}
        {referrers > 0 && ` · ${referrers} who can send Joy work`}
        {chasing > 0 && (
          <span className="text-[hsl(var(--warning))]">
            {" "}
            · {chasing} worth a call
          </span>
        )}
      </p>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, organisation, unit or note"
          aria-label="Search contacts"
          className="pl-9"
        />
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {contacts.map((contact) => (
          <ContactRow key={contact.id} contact={contact} today={today} />
        ))}
        {contacts.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {query ? "Nobody matches that." : "No contacts yet."}
          </li>
        )}
      </ul>

      <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Referral sources are flagged after three months without contact, which is roughly how
          quickly an agency drops off a discharge planner's list. Adding and editing contacts is
          not wired up yet — this reads a seeded list.
        </span>
      </p>
    </>
  );
}
