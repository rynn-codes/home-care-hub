import type { ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { ActivityFeed } from "@/components/records/ActivityFeed";
import {
  CONTACT_KIND_LABELS,
  TEMPERATURE_LABELS,
  contactTemperature,
  displayName,
  relativeContactLabel,
  type Contact,
} from "@/domain/people/contacts";
import { fmtWhen, formatMoney, type FeedRow, type GiftTotal } from "@/domain/records/activity";
import { cn } from "@/lib/utils";

/**
 * A business contact's record: the card on the left, what matters on the
 * right. Same grid as a client or an employee — Karynn, 30 August: "Keep
 * the same UI/UX when you click on a client or Employee."
 *
 * Highlights lead with silence, because that is the reason to open this
 * page: the discharge planner who sent two clients in the spring and has
 * not heard from anybody since. Gifts show only when there are any, and
 * only to roles the feed lets see them.
 */
function Detail({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  const empty = value == null || value === "";
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0">
      <dt className="w-28 flex-none text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-[13px] [text-wrap:pretty]">
        {empty ? (
          <span className="text-muted-foreground">—</span>
        ) : href ? (
          <a href={href} className="text-primary hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-[#9B9BA3]">{children}</span>;
}

function Highlight({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-4 py-3.5">
      <span className="pb-1.5 text-[11.5px] text-[#8A8A92]">{label}</span>
      {children}
    </div>
  );
}

export function ContactRecord({
  contact,
  asOf,
  referralNames,
  feed,
  gifts,
  giftYear,
  onLogActivity,
  onLogCall,
  onDeleteActivity,
}: {
  contact: Contact;
  asOf: string;
  /** Turns the admission ids on the card into the names the office knows. */
  referralNames: (ids: readonly string[]) => string[];
  feed: FeedRow[];
  gifts: GiftTotal;
  giftYear: number;
  onLogActivity: () => void;
  onLogCall: () => void;
  onDeleteActivity: (id: string) => void;
}) {
  const temperature = contactTemperature(contact, asOf);
  const referred = referralNames(contact.referrals);

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
        <SectionLabel>Details</SectionLabel>
        <dl className="m-0">
          <Detail label="Name" value={displayName(contact)} />
          <Detail label="Title" value={contact.title} />
          <Detail label="Organization" value={contact.organization} />
          <Detail label="Unit" value={contact.unit} />
          <Detail label="Type" value={CONTACT_KIND_LABELS[contact.kind]} />
          <Detail label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
          <Detail label="Phone" value={contact.phone} />
          <Detail label="Address" value={contact.address} />
          <Detail label="Last contact" value={relativeContactLabel(contact.lastContactedOn, asOf)} />
          <Detail label="Added" value={relativeContactLabel(contact.addedOn, asOf)} />
        </dl>
        {(contact.email || contact.phone) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] transition-colors hover:bg-[var(--wash)]"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] transition-colors hover:bg-[var(--wash)]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Call
              </a>
            )}
          </div>
        )}
      </aside>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3.5">
          <h2 className="m-0 text-sm font-semibold tracking-[-.01em] text-[var(--ink-strong)]">Highlights</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Highlight label="Last contact">
              <span className="text-[15px] font-medium text-[var(--ink-strong)]">
                {relativeContactLabel(contact.lastContactedOn, asOf)}
              </span>
              <span
                className={cn(
                  "mt-1 inline-flex w-fit rounded-full px-2 py-[2px] text-[11px] font-medium",
                  temperature === "cold"
                    ? "bg-[#FDF0E7] text-[#C2410C]"
                    : temperature === "fresh"
                      ? "bg-[#E8F5EC] text-[#15803D]"
                      : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                )}
              >
                {TEMPERATURE_LABELS[temperature]}
              </span>
            </Highlight>
            <Highlight label="Referrals sent">
              <span className="text-[15px] font-medium text-[var(--ink-strong)]">
                {referred.length === 0 ? "None yet" : referred.length}
              </span>
              {referred.length > 0 && (
                <span className="mt-1 text-[12.5px] leading-[1.45] text-[var(--ink-body)]">{referred.join(", ")}</span>
              )}
            </Highlight>
            {gifts.count > 0 && (
              <Highlight label={`Gifts in ${giftYear}`}>
                <span className="text-[15px] font-medium text-[var(--ink-strong)]">
                  {gifts.totalUsd > 0 ? formatMoney(gifts.totalUsd) : `${gifts.count}`}
                </span>
                <span className="mt-1 text-[12.5px] text-[var(--ink-body)]">
                  {gifts.count} {gifts.count === 1 ? "gift" : "gifts"}
                  {gifts.unpriced > 0 && ` · ${gifts.unpriced} without a value`}
                </span>
              </Highlight>
            )}
            <Highlight label="Activity logged">
              <span className="text-[15px] font-medium text-[var(--ink-strong)]">
                {feed.length === 0 ? "None yet" : feed.length}
              </span>
              {feed[0] && <span className="mt-1 text-[12.5px] text-[var(--ink-body)]">Last on {fmtWhen(feed[0].at)}</span>}
            </Highlight>
          </div>
        </section>

        {contact.notes && (
          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-5 py-4">
            <SectionLabel>Before you ring them</SectionLabel>
            <p className="m-0 mt-2 text-[13.5px] leading-[1.6] text-[var(--ink-strong)] [text-wrap:pretty]">{contact.notes}</p>
          </section>
        )}

        <ActivityFeed
          rows={feed}
          subjectName={contact.name.split(" ")[0]}
          onLogActivity={onLogActivity}
          onLogCall={onLogCall}
          onDelete={onDeleteActivity}
        />
        <p className="m-0 text-[12px] text-[#9B9BA3]">Built from what is on the record. Log an activity and it appears here.</p>
      </div>
    </div>
  );
}
