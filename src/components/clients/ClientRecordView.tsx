import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, FileText, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamilyPortalCard } from "@/components/clients/FamilyPortalCard";
import { RequestDocumentCard } from "@/components/clients/RequestDocumentCard";
import { seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { refusedConsents, type ClientRecord, type ComplianceItem } from "@/domain/clients/roster";
import { seedActivity } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedBillingTerms, seedPaidWeeks } from "@/lib/billingSeed";
import { buildInvoice, ageing } from "@/domain/billing/invoice";
import { upcomingBillingWeek } from "@/domain/billing/run";

/**
 * The client record, to the approved Clients mock: the 56px avatar header
 * with its status pill and actions, then Profile / Activity / Schedule /
 * Docs / Services / Billing & Payments — every tab now real, reading the
 * same domain the modules own (visits from the schedule board, the live
 * care plan, the billing terms and the Saturday run's invoice math).
 *
 * Two things the mock does not have, both of which come out of the signing
 * packet rather than out of design:
 *
 *  - RESTRICTIONS ON THE PROFILE. A client who refused transport or photos
 *    made a decision that changes what a caregiver may do that morning. It
 *    belongs where the caregiver will actually see it.
 *  - EXPIRY DATES IN DOCS. The two records authorizations expire twelve
 *    months after signature and the supervisory visit is annual. A document
 *    list that shows "Signed" against a lapsed authorization is worse than
 *    no list.
 */

const TABS = ["Profile", "Activity", "Schedule", "Docs", "Services", "Billing & Payments"] as const;
type Tab = (typeof TABS)[number];

const TONE: Record<string, string> = {
  done: "bg-[#12B76A]",
  prog: "bg-primary",
  warn: "bg-[#F79009]",
  bad: "bg-[#D92D20]",
};

const money = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

function ComplianceBadge({ item }: { item: ComplianceItem }) {
  const label =
    item.state === "missing"
      ? "Not on file"
      : item.state === "overdue"
        ? `Lapsed ${item.dueOn}`
        : item.state === "due_soon"
          ? `Renews ${item.dueOn}`
          : `Valid to ${item.dueOn}`;

  const tone =
    item.state === "overdue" || item.state === "missing"
      ? "bg-[#FEF3F2] text-[#B42318]"
      : item.state === "due_soon"
        ? "bg-[#FFFAEB] text-[#B54708]"
        : "bg-[#ECFDF3] text-[#027A48]";

  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium", tone)}>
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[#F3F3F6] py-2 last:border-0">
      <dt className="w-28 flex-none text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13px] [text-wrap:pretty]">{value}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function ClientRecordView({ client, onBack }: { client: ClientRecord; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("Profile");
  const activity = seedActivity[client.personId] ?? [];
  const refused = refusedConsents(client.decisions);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the client directory"
            className="mt-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EEF0FE] text-[17px] font-semibold text-primary">
            {client.initials}
          </span>
          <div className="flex flex-col gap-1 pt-0.5">
            <span
              className={cn(
                "inline-flex self-start rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                client.status === "active"
                  ? "bg-[#ECFDF3] text-[#027A48]"
                  : client.status === "on_hold"
                    ? "bg-[#FFFAEB] text-[#B54708]"
                    : "bg-[#F3F3F6] text-[#5B6274]",
              )}
            >
              {client.statusLabel}
            </span>
            <h1 className="m-0 text-[23px] font-semibold leading-[1.15] tracking-[-.02em]">{client.name}</h1>
            <p className="m-0 text-[12.5px] text-muted-foreground">
              Care Recipient
              {client.age !== null && ` · ${client.age} years old`} · {client.location}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto sm:pt-1.5">
          <button
            type="button"
            disabled
            title="Family messaging goes through Spruce — not wired in the prototype"
            className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-muted-foreground/50"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Message family
          </button>
          <Link
            to="/scheduling"
            className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
          >
            <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
            Schedule care
          </Link>
        </div>
      </div>

      <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[#ECECF1]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
              tab === t
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
            <SectionLabel>Details</SectionLabel>
            <dl className="m-0">
              <Detail label="Name" value={client.name} />
              {client.preferredName !== client.name.split(" ")[0] && (
                <Detail label="Goes by" value={client.preferredName} />
              )}
              <Detail label="Age" value={client.age === null ? "Not recorded" : `${client.age} years old`} />
              <Detail label="Condition" value={client.condition ?? "Not recorded"} />
              <Detail label="Address" value={client.address ?? "Not recorded"} />
              <Detail label="Phone" value={client.phone ?? "Not recorded"} />
              <Detail label="Email" value={client.email ?? "Not recorded"} />
              <Detail label="Client since" value={client.admissionDate ?? "Not recorded"} />
              <Detail label="Services" value={client.services.join(", ") || "None"} />
              <Detail
                label="Hours"
                value={client.hoursPerWeek === null ? "Paused" : `${client.hoursPerWeek} hrs / week`}
              />
              <Detail label="Coordinator" value={client.coordinator ?? "Unassigned"} />
            </dl>

            <SectionLabel>Emergency contact</SectionLabel>
            {client.responsiblePartyName ? (
              <div className="flex items-center gap-2.5 rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD] p-2.5">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#F1F2F6] text-[11px] font-semibold text-[#5B6274]">
                  {client.responsiblePartyName.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <span className="flex flex-col leading-[1.35]">
                  <span className="text-[13px] font-medium">{client.responsiblePartyName}</span>
                  <span className="text-[11.5px] text-muted-foreground">{client.responsiblePartyLine}</span>
                </span>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">Nobody recorded.</p>
            )}
          </div>

          <div className="flex flex-col gap-[18px]">
            {/* Not in the mock, and the most important thing on the page: what
                this client refused, said where a caregiver will read it. */}
            {client.restrictions.length > 0 && (
              <section className="rounded-[14px] border border-[#FCE8B6] bg-[#FFFAEB] p-[18px]">
                <h2 className="m-0 flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="h-4 w-4 text-[#B54708]" aria-hidden="true" />
                  What this client declined
                </h2>
                <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
                  {client.restrictions.map((r) => (
                    <li key={r} className="text-[13px] text-[#7A6320]">
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="m-0 text-sm font-semibold tracking-[-.01em]">Highlights</h2>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <div className="flex flex-col gap-2 rounded-[14px] border border-[#ECECF1] bg-white p-4">
                  <span className="text-[12.5px] font-medium text-[#5B6274]">Summary</span>
                  <p className="m-0 text-sm leading-[1.55] [text-wrap:pretty]">
                    {client.services.length > 0
                      ? `${client.preferredName || client.name.split(" ")[0]} is ${
                          client.status === "active" ? "an active" : client.status === "on_hold" ? "an on-hold" : "a discharged"
                        } ${client.services[0]} client${client.admissionDate ? ` since ${client.admissionDate}` : ""}${
                          client.caregiver ? `, with ${client.caregiver} as primary caregiver` : ", with no primary caregiver assigned"
                        }${client.hoursPerWeek ? ` at ${client.hoursPerWeek} hours a week` : ""}.`
                      : "No services on the agreement yet."}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 rounded-[14px] border border-[#E0E3FB] bg-[#EEF0FE] p-4">
                  <span className="text-[12.5px] font-medium text-primary">Payer</span>
                  <span className="text-[15px] font-semibold">{client.payer}</span>
                  <span className="text-xs text-[#5B6274]">{client.payerLine ?? "—"}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Next visit",
                    value: client.nextVisit ?? "None scheduled",
                    sub: client.caregiver ?? "No caregiver assigned",
                  },
                  {
                    label: "Care team",
                    value: client.caregiver ?? "Unassigned",
                    sub: client.coordinator ? `Coordinator · ${client.coordinator}` : "No coordinator",
                  },
                ].map((h) => (
                  <div key={h.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
                    <span className="text-[12.5px] font-medium text-[#5B6274]">{h.label}</span>
                    <span className="text-[15px] font-semibold leading-[1.3]">{h.value}</span>
                    <span className="text-xs leading-[1.45] text-muted-foreground">{h.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            {activity.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="m-0 flex items-center gap-2 text-sm font-semibold tracking-[-.01em]">
                  Activity
                  <button
                    type="button"
                    onClick={() => setTab("Activity")}
                    className="text-[12.5px] font-normal text-primary hover:text-[#2A1BD1]"
                  >
                    View all
                  </button>
                </h2>
                <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
                  {activity.slice(0, 3).map((a) => (
                    <div
                      key={a.label}
                      className="flex items-center gap-3 border-b border-[#F3F3F6] px-4 py-3.5 last:border-0"
                    >
                      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", TONE[a.tone] ?? TONE.prog)} aria-hidden="true" />
                      <span className="text-[13px]">{a.label}</span>
                      <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{a.when}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "Activity" && (
        <div className="max-w-[820px] rounded-[14px] border border-[#ECECF1] bg-white p-5">
          {activity.length === 0 && (
            <p className="m-0 py-6 text-center text-sm text-muted-foreground">
              Nothing recorded for this client yet.
            </p>
          )}
          {activity.map((a, i) => (
            <div key={a.label} className="flex gap-3.5 pb-[18px] last:pb-0">
              <span className="flex flex-none flex-col items-center pt-[5px]">
                <span className={cn("h-[7px] w-[7px] rounded-full", TONE[a.tone] ?? TONE.prog)} aria-hidden="true" />
                {i < activity.length - 1 && <span className="mt-[5px] w-px flex-1 bg-[#ECECF1]" aria-hidden="true" />}
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13.5px] leading-[1.45]">{a.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{a.when}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "Schedule" && <ClientScheduleTab clientName={client.name} />}

      {tab === "Docs" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <section className="rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
            <SectionLabel>Signed packet</SectionLabel>
            <p className="mb-4 mt-1.5 text-[13px] text-muted-foreground">
              {client.signedAt
                ? `Signed ${client.signedAt.slice(0, 10)}. One signature, placed on every page that asks.`
                : "The consents packet has not been signed."}
            </p>

            <ul className="m-0 list-none p-0">
              {client.compliance.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-col gap-2 border-b border-[#F3F3F6] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    <span>
                      <span className="block text-[13px]">{item.label}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{item.detail}</span>
                    </span>
                  </span>
                  <ComplianceBadge item={item} />
                </li>
              ))}
              {client.compliance.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  No renewals tracked — this client is discharged.
                </li>
              )}
            </ul>
          </section>

          <div className="flex flex-col gap-[18px]">
            <section className="rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
              <SectionLabel>Decisions on record</SectionLabel>
              {refused.length === 0 ? (
                <p className="m-0 mt-2.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Check className="h-4 w-4 text-[#027A48]" aria-hidden="true" />
                  Agreed to everything in the packet.
                </p>
              ) : (
                <ul className="m-0 mt-2.5 flex list-none flex-col gap-2.5 p-0">
                  {refused.map((c) => (
                    <li key={c.key}>
                      <p className="m-0 text-[13px] font-medium">{c.title}</p>
                      <p className="m-0 text-[11.5px] text-muted-foreground">
                        {client.decisions[c.key] === "decline" ? "Declined" : "Not applicable"} · packet p. {c.pages}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* §19 and §21: inviting a family and requesting documents are
                decisions about this client, so they live on the record. */}
            <FamilyPortalCard
              clientName={client.preferredName || client.name}
              clientPersonId={client.personId}
              responsibleParty={client.responsiblePartyName}
              responsiblePartyPhone={null}
              assessmentComplete
              movingForward
              existing={null}
            />

            <RequestDocumentCard
              clientName={client.preferredName || client.name}
              requests={seedRequestedDocuments}
            />
          </div>
        </div>
      )}

      {tab === "Services" && <ClientServicesTab client={client} />}

      {tab === "Billing & Payments" && <ClientBillingTab client={client} />}
    </>
  );
}

// ------------------------------------------------------------ Schedule --

function ClientScheduleTab({ clientName }: { clientName: string }) {
  const [cursor, setCursor] = useState(() => new Date());

  const visits = useMemo(
    () => seedVisits.filter((v) => v.clientName === clientName),
    [clientName],
  );

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Sat-first columns — the agency week is Saturday → Friday everywhere.
    const lead = (first.getDay() + 1) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dayVisits = visits.filter(
        (v) => new Date(v.startsAt).toDateString() === date.toDateString(),
      );
      return { date, inMonth: date.getMonth() === cursor.getMonth(), visits: dayVisits };
    });
  }, [cursor, visits]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
      <div className="flex flex-wrap items-center gap-3 pb-3.5">
        <span className="text-[15px] font-semibold tracking-[-.01em]">
          {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
        </span>
        <span className="ml-auto flex items-center gap-3.5 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#12B76A]" aria-hidden="true" />
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" />
            Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#F79009]" aria-hidden="true" />
            Unassigned
          </span>
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="h-7 w-7 rounded-lg border border-[#ECECF1] bg-white text-muted-foreground hover:bg-[#FAFAFB]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="h-7 rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] hover:bg-[#FAFAFB]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="h-7 w-7 rounded-lg border border-[#ECECF1] bg-white text-muted-foreground hover:bg-[#FAFAFB]"
          >
            ›
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-[11px] border border-[#ECECF1]">
        {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((w) => (
          <div
            key={w}
            className="border-b border-[#ECECF1] bg-[#FCFCFD] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map(({ date, inMonth, visits: dayVisits }) => {
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "flex min-h-[84px] flex-col gap-1 border-b border-r border-[#F3F3F6] px-2 py-1.5",
                isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-white" : "bg-[#FCFCFD]",
              )}
            >
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isToday ? "font-semibold text-primary" : inMonth ? "text-[#5B6274]" : "text-muted-foreground/40",
                )}
              >
                {date.getDate()}
              </span>
              {dayVisits.map((v) => {
                const past = new Date(v.endsAt) < new Date();
                const open = v.caregiverName === null;
                return (
                  <span
                    key={v.id}
                    className={cn(
                      "block rounded-md px-1.5 py-1 leading-[1.3]",
                      open
                        ? "bg-[#FFFAEB] text-[#B54708]"
                        : past
                          ? "bg-[#ECFDF3] text-[#027A48]"
                          : "bg-[#EEF0FE] text-primary",
                    )}
                  >
                    <span className="block text-[10px] opacity-90">{fmtTime(v.startsAt)}</span>
                    <span className="block text-[11px] font-medium">
                      {open ? "Unassigned" : v.caregiverName}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mb-0 mt-3 text-xs text-muted-foreground">
        The same visits the Scheduling board shows, filtered to this client — one Joy schedule, per
        §20. <Link to="/scheduling" className="text-primary hover:text-[#2A1BD1]">Open Scheduling →</Link>
      </p>
    </div>
  );
}

// ------------------------------------------------------------ Services --

function ClientServicesTab({ client }: { client: ClientRecord }) {
  const plans = seedCarePlans.filter((p) => p.clientPersonId === client.personId);
  const active = plans.find((p) => p.state === "active") ?? null;
  const terms = seedBillingTerms.find((t) => t.clientPersonId === client.personId);
  const service = client.services[0] ?? "Personal Care";

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-3.5">
        <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-[3px]">
              <SectionLabel>Service</SectionLabel>
              <span className="text-[17px] font-semibold tracking-[-.01em]">{service}</span>
            </div>
            <span
              className={cn(
                "ml-auto inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                client.status === "active" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F3F3F6] text-[#5B6274]",
              )}
            >
              {client.statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
            {[
              ["Weekly hours", client.hoursPerWeek === null ? "Paused" : `${client.hoursPerWeek} hrs / week`],
              ["Client since", client.admissionDate ?? "Not recorded"],
              ["Primary caregiver", client.caregiver ?? "Unassigned"],
              ["All services", client.services.join(", ") || "None"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-[3px]">
                <span className="text-[11.5px] text-muted-foreground">{label}</span>
                <span className="text-[13px]">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold">Care Plan</span>
            <Link
              to="/clients/care-plans"
              className="ml-auto flex h-7 items-center rounded-lg border border-[#ECECF1] bg-white px-2.5 text-xs text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
            >
              Open Care plans →
            </Link>
          </div>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD] px-3 py-2.5">
                <span className="text-[12.5px]">Version {active.version}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {active.effectiveFrom ? `Effective ${active.effectiveFrom.slice(0, 10)}` : "Not yet effective"}
                </span>
                <span className="ml-auto rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-[#027A48]">
                  Active
                </span>
              </div>
              <div className="flex flex-col gap-2.5 pt-1">
                {[
                  ["Goals", active.goals],
                  ["Call the RN when", active.vitals.map((v) => (v.value ? `${v.label} ${v.value}` : v.label))],
                  ["Emergency plan", active.emergencyPlan ? [active.emergencyPlan] : []],
                ]
                  .filter(([, lines]) => (lines as string[]).length > 0)
                  .map(([title, lines]) => (
                    <div key={title as string} className="flex flex-col gap-1">
                      <span className="text-[12.5px] font-semibold">{title}</span>
                      {(lines as string[]).map((l) => (
                        <span key={l} className="flex gap-2 text-[12.5px] leading-[1.5] text-[#5B6274]">
                          <span className="text-muted-foreground/40" aria-hidden="true">•</span>
                          {l}
                        </span>
                      ))}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="m-0 text-[13px] text-muted-foreground">
              No active care plan. {plans.length > 0 ? "A draft exists — " : "Nothing has been written — "}
              somebody is receiving care with nothing written down, which the Care plans screen
              flags first.
            </p>
          )}
        </section>

        {active && active.tasks.length > 0 && (
          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold">Tasks</span>
              <span className="ml-auto text-xs text-muted-foreground">From the care plan</span>
            </div>
            <div className="flex flex-col">
              {active.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-2.5 last:border-0">
                  <span className="flex flex-col leading-[1.35]">
                    <span className="text-[13px]">{t.label}</span>
                    <span className="text-[11.5px] text-muted-foreground">{t.category}</span>
                  </span>
                  {t.required && (
                    <span className="ml-auto rounded-full bg-[#F3F3F6] px-2 py-0.5 text-[10.5px] font-medium text-[#5B6274]">
                      Required before clock-out
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
        {[
          {
            title: "Agreement",
            rows: [
              ["Payer", client.payer],
              ["Weekly hours", client.hoursPerWeek === null ? "Paused" : `${client.hoursPerWeek} hrs`],
              ["Payment method", terms ? terms.paymentMethod.toUpperCase() : "Not recorded"],
            ],
          },
          {
            title: "Rate",
            rows: [["Hourly rate", "Emailed privately — not stored in the prototype"]],
          },
          {
            title: "Care team",
            rows: [
              ["Primary caregiver", client.caregiver ?? "Unassigned"],
              ["Coordinator", client.coordinator ?? "Unassigned"],
            ],
          },
        ].map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <SectionLabel>{g.title}</SectionLabel>
            <div className="flex flex-col">
              {g.rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2.5 border-b border-[#F3F3F6] py-[7px] last:border-0">
                  <span className="flex-none text-[12.5px] text-muted-foreground">{label}</span>
                  <span className="ml-auto min-w-0 text-right text-[12.5px] [text-wrap:pretty]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Billing --

function ClientBillingTab({ client }: { client: ClientRecord }) {
  const terms = seedBillingTerms.find((t) => t.clientPersonId === client.personId);
  const weekStart = useMemo(() => upcomingBillingWeek(new Date().toISOString()), []);
  const invoice = useMemo(
    () =>
      terms
        ? buildInvoice({
            terms,
            visits: seedVisits,
            weekStart,
            // Bill the agreement, not the board — Karynn's advance model. The
            // upcoming week's schedule may not exist yet; the agreed hours do.
            advance:
              client.hoursPerWeek !== null ? { agreedHours: client.hoursPerWeek } : null,
          })
        : null,
    [terms, weekStart, client.hoursPerWeek],
  );
  const paid = seedPaidWeeks.has(client.personId);
  const age =
    invoice && invoice.total !== null
      ? ageing({
          dueOn: invoice.dueOn,
          paid,
          total: invoice.total,
          asOf: new Date().toISOString().slice(0, 10),
        })
      : null;

  if (!terms) {
    return (
      <div className="max-w-xl rounded-[14px] border border-[#ECECF1] bg-white p-8 text-center">
        <p className="m-0 text-sm font-medium">No billing terms on file.</p>
        <p className="m-0 mt-1 text-[13px] text-muted-foreground">
          This client has no visits on the schedule board yet, so the Saturday run has nothing to
          price. Billing terms appear once care is scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Outstanding",
            value: invoice?.total === null ? "Can't price" : paid ? "$0.00" : money(invoice?.total ?? 0),
            sub:
              invoice?.total === null
                ? invoice.blockedReason ?? "No rate on file"
                : paid
                  ? "This week is paid"
                  : age && age.daysOverdue > 0
                    ? `${age.daysOverdue} days overdue`
                    : `Due ${invoice?.dueOn ?? "—"}`,
            warn: !paid && Boolean(age && age.daysOverdue > 0),
          },
          {
            label: "Next invoice",
            value: invoice ? money(invoice.total) : "—",
            sub: `Week of ${weekStart} · drafts Saturday`,
          },
          {
            label: "Deposit held",
            value: money(terms.depositRemaining),
            sub: "One week, per the agreement",
          },
          {
            label: "Payment method",
            value: terms.paymentMethod.toUpperCase(),
            sub: "Autopay authorization signs at billing setup",
          },
        ].map((b) => (
          <div key={b.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <SectionLabel>{b.label}</SectionLabel>
            <span className={cn("text-[17px] font-semibold tracking-[-.01em]", b.warn && "text-[#B42318]")}>
              {b.value}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{b.sub}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
        <div className="flex items-center gap-2 border-b border-[#ECECF1] px-4 py-3.5">
          <span className="text-[13.5px] font-semibold">Invoices</span>
          <Link to="/billing" className="ml-auto text-[12.5px] text-primary hover:text-[#2A1BD1]">
            Open Billing →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {["Period", "Hours", "Amount", "Status", "Due"].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice ? (
                <tr className="border-t border-[#F3F3F6]">
                  <td className="px-4 py-3 text-[13px] font-medium">
                    {invoice.weekStart} – {invoice.weekEnd}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#5B6274] tabular-nums">
                    {invoice.lines.reduce((t, l) => t + l.hours, 0)} hrs
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{money(invoice.total)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] text-[12.5px] text-[#5B6274]">
                      {/* Not "Paid" even for a paid-up client: this invoice
                          has not drafted yet, and a paid pill on it would be
                          the screen asserting a payment nobody made. */}
                      <span
                        className={cn(
                          "h-[7px] w-[7px] rounded-full",
                          invoice.state === "cannot_bill" ? "bg-[#D92D20]" : "bg-primary",
                        )}
                        aria-hidden="true"
                      />
                      {invoice.state === "cannot_bill"
                        ? invoice.blockedReason ?? "Cannot bill"
                        : "Drafts Saturday"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#5B6274]">{invoice.dueOn}</td>
                </tr>
              ) : (
                <tr className="border-t border-[#F3F3F6]">
                  <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                    Nothing invoiced yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="m-0 text-xs text-muted-foreground">
        Placeholder pricing — Joy's real rates are emailed to each client privately and are not in
        this prototype. The Saturday run in Billing owns drafting, approval and sending; this tab
        reads the same math.
      </p>
    </div>
  );
}
