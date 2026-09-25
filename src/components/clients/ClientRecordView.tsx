import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, FileText, Phone, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamilyPortalCard } from "@/components/clients/FamilyPortalCard";
import { RequestDocumentCard } from "@/components/clients/RequestDocumentCard";
import { SignatureRequestsCard } from "@/components/clients/SignatureRequestsCard";
import { requestsForClient } from "@/domain/documents/signatureRequests";
import { RecordDetail, RecordHeader, RecordSectionLabel } from "@/components/records/RecordHeader";
import { UndoChangeBanner } from "@/components/records/UndoChangeBanner";
import { ActivityFeed } from "@/components/records/ActivityFeed";
import { LogActivityDialog } from "@/components/records/LogActivityDialog";
import { MrNumberField } from "@/components/records/MrNumberField";
import { StatusControl, type StatusOption } from "@/components/layout/StatusControl";
import { useDemo } from "@/context/DemoDataProvider";
import { canView, canWrite } from "@/domain/access/roles";
import { buildFeed, giftSummaryLine, giftTotalFor, interactionsFor } from "@/domain/records/activity";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_MEANINGS,
  refusedConsents,
  type ClientRecord,
  type ClientStatus,
  type ComplianceItem,
} from "@/domain/clients/roster";
import { seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { seedClients, seedClientActivity } from "@/lib/clientsSeed";
import { ClientAgreementCard, ClientScheduleTab } from "@/components/clients/ClientScheduleTab";
import { HouseholdCard } from "@/components/scheduling/HouseholdCard";
import { ServiceMixEditor } from "@/components/scheduling/ServiceMixEditor";
import { useScheduleBoard } from "@/hooks/use-schedule-board";
import { companionsOf, householdOf } from "@/domain/billing/households";
import { locationsFor, LOCATION_STATUS_LABELS } from "@/domain/scheduling/locations";
import { DEFAULT_MIX, hoursLabel, splitHours, validateMix, type ServiceShare } from "@/domain/scheduling/serviceMix";
import { payerFor } from "@/lib/clientRates";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedBillingTerms, seedPaidWeeks } from "@/lib/billingSeed";
import { buildInvoice, ageing } from "@/domain/billing/invoice";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { cameFrom } from "@/lib/navigation";

/**
 * The client record: the shared record header (breadcrumb, 56px avatar,
 * status pill, actions), then Profile / Activity / Schedule / Docs /
 * Services / Billing & Payments — every tab reading the domain the modules
 * own (visits from the schedule board, the live care plan, the billing terms
 * and the Saturday run's invoice math).
 *
 * Karynn, 30 August: "Keep the same UI/UX when you click on a client or
 * Employee." So the header, the status control, the undo banner, the MR #
 * row and the activity feed are the same components the employee record
 * uses — see components/records.
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
 *
 * Billing & Payments is hidden from roles that cannot see billing — a
 * caregiver opening a client's chart should not meet an invoice.
 */

const TABS = ["Profile", "Activity", "Schedule", "Docs", "Services", "Billing & Payments"] as const;
type Tab = (typeof TABS)[number];

const STATUS_OPTIONS: ReadonlyArray<StatusOption<ClientStatus>> = (
  ["active", "on_hold", "inactive", "discharged"] as const
).map((value) => ({
  value,
  label: CLIENT_STATUS_LABELS[value],
  meaning: CLIENT_STATUS_MEANINGS[value],
  grave: value === "discharged",
  dateLabel: value === "discharged" ? "Last day of service" : undefined,
}));

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

const Detail = RecordDetail;
const SectionLabel = RecordSectionLabel;

export function ClientRecordView({ client }: { client: ClientRecord }) {
  const [params] = useSearchParams();
  const wanted = params.get("tab");
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(wanted ?? "") ? (wanted as Tab) : "Profile");
  const [logging, setLogging] = useState<"phone" | "any" | null>(null);
  const { interactions, logActivity, deleteActivity, recordView, currentUser, mrNumbers, issueMrNumber, setClientStatus, households, signatureRequests } =
    useDemo();
  const companions = companionsOf(households, client.personId);

  useEffect(() => {
    recordView("client", client.personId, client.name);
  }, [recordView, client.personId, client.name]);

  const system = seedClientActivity[client.personId] ?? [];
  const refused = refusedConsents(client.decisions);
  const year = new Date().getFullYear();
  const giftsSoFar = giftSummaryLine(giftTotalFor(interactions, "client", client.personId, year), year);
  const mayWrite = canWrite(currentUser.role);
  const tabs = TABS.filter((t) => t !== "Billing & Payments" || canView(currentUser.role, "billing"));
  const feed = buildFeed(
    interactionsFor(interactions, "client", client.personId),
    system.map((e, i) => ({ id: `sys-${client.personId}-${i}`, at: e.at, label: e.label, tone: e.tone })),
  );

  return (
    <>
      <RecordHeader
        name={client.name}
        parents={[{ label: "Clients", to: "/clients" }]}
        status={client.statusLabel}
        statusTone={client.status === "active" ? "good" : client.status === "on_hold" ? "warn" : "muted"}
        line={
          <>
            Care Recipient
            {client.age !== null && ` · ${client.age} years old`} · {client.location}
          </>
        }
        actions={
          mayWrite ? (
            <>
              <StatusControl
                current={client.status}
                label="Client status"
                subject={client.name}
                options={STATUS_OPTIONS}
                onChange={(status, details) =>
                  setClientStatus({
                    clientPersonId: client.personId,
                    status,
                    note: details.note,
                    lastServiceOn: details.on,
                    name: client.name,
                  })
                }
              />
              <button
                type="button"
                onClick={() => setLogging("phone")}
                className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Log a call
              </button>
              <Link
                to="/scheduling"
                state={{
                  ...cameFrom({ label: client.name, to: `/clients/${client.personId}` }),
                  scheduleFor: { client: client.name, caregiver: client.caregiver ?? null },
                }}
                className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              >
                <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                Schedule care
              </Link>
            </>
          ) : undefined
        }
      />

      <UndoChangeBanner kind="client" entityId={client.personId} mayWrite={mayWrite} />

      <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[var(--hairline)]" role="tablist">
        {tabs.map((t) => (
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
          <ClientAgreementCard client={client} className="lg:col-span-2" />
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
            <SectionLabel>Details</SectionLabel>
            <dl className="m-0">
              <Detail label="Name" value={client.name} />
              <Detail
                label="MR #"
                value={
                  <MrNumberField
                    firstName={client.name.split(" ")[0] ?? ""}
                    lastName={client.name.split(" ").slice(1).join(" ")}
                    value={client.mrNumber ?? mrNumbers[client.personId]}
                    existing={[
                      ...Object.values(mrNumbers),
                      ...seedClients.filter((c) => c.personId !== client.personId).map((c) => c.mrNumber),
                    ]}
                    canEdit={mayWrite}
                    onIssue={(number) => issueMrNumber(client.personId, number)}
                  />
                }
              />
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
              {companions.length > 0 && <Detail label="Served with" value={companions.map((c) => c.name).join(", ")} />}
            </dl>

            <SectionLabel>Emergency contact</SectionLabel>
            {client.responsiblePartyName ? (
              <div className="flex items-center gap-2.5 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-2.5">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--wash-strong)] text-[11px] font-semibold text-[var(--ink-body)]">
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
                <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
                  <span className="text-[12.5px] font-medium text-[var(--ink-body)]">Summary</span>
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
                  <span className="text-xs text-[var(--ink-body)]">{client.payerLine ?? "—"}</span>
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
                  <div key={h.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
                    <span className="text-[12.5px] font-medium text-[var(--ink-body)]">{h.label}</span>
                    <span className="text-[15px] font-semibold leading-[1.3]">{h.value}</span>
                    <span className="text-xs leading-[1.45] text-muted-foreground">{h.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            <ActivityFeed
              rows={feed.slice(0, 6)}
              subjectName={client.preferredName}
              onLogActivity={() => setLogging("any")}
              onLogCall={() => setLogging("phone")}
              onDelete={deleteActivity}
            />
            {feed.length > 6 && (
              <button
                type="button"
                onClick={() => setTab("Activity")}
                className="self-start text-[12.5px] text-primary hover:text-[#2A1BD1]"
              >
                View all {feed.length}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "Activity" && (
        <div className="max-w-[880px]">
          <ActivityFeed
            rows={feed}
            subjectName={client.preferredName}
            onLogActivity={() => setLogging("any")}
            onLogCall={() => setLogging("phone")}
            onDelete={deleteActivity}
          />
        </div>
      )}

      <LogActivityDialog
        open={logging !== null}
        onOpenChange={(o) => setLogging(o ? "any" : null)}
        initialChannel="phone"
        subjectName={client.name}
        suggestedParty={client.responsiblePartyName}
        giftsSoFar={giftsSoFar}
        onSave={(draft) => logActivity({ draft, subject: { kind: "client", id: client.personId, name: client.name } })}
      />

      {tab === "Schedule" && <ClientScheduleTab clientName={client.name} personId={client.personId} />}

      {tab === "Docs" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
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
                  className="flex flex-col gap-2 border-b border-[var(--hairline-soft)] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
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
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
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

            {/* Signatures asked of this client, raised from a file's menu in
                Documents and answered in the family portal. */}
            <SignatureRequestsCard requests={requestsForClient(signatureRequests, client.personId)} />
          </div>
        </div>
      )}

      {tab === "Services" && <ClientServicesTab client={client} />}

      {tab === "Billing & Payments" && <ClientBillingTab client={client} />}
    </>
  );
}

// ------------------------------------------------------------ Services --

function ClientServicesTab({ client }: { client: ClientRecord }) {
  const { serviceMixes, serviceMixConfirmed, setServiceMix, confirmServiceMix, approvedLocations, decideLocation, currentUser } = useDemo();
  const mayEdit = canWrite(currentUser.role);
  const [editingMix, setEditingMix] = useState(false);
  const [draftMix, setDraftMix] = useState<ServiceShare[]>([...DEFAULT_MIX]);
  const locations = locationsFor(approvedLocations, client.personId);
  const pendingLocations = locations.filter((l) => l.status === "pending");
  const mix = serviceMixes[client.personId] ?? DEFAULT_MIX;
  const confirmed = serviceMixConfirmed[client.personId] ?? null;
  const plans = seedCarePlans.filter((p) => p.clientPersonId === client.personId);
  const active = plans.find((p) => p.state === "active") ?? null;
  const terms = seedBillingTerms.find((t) => t.clientPersonId === client.personId);
  const service = client.services[0] ?? "Personal Care";

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-3.5">
        <section className="flex flex-col gap-3.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-[3px]">
              <SectionLabel>Service</SectionLabel>
              <span className="text-[17px] font-semibold tracking-[-.01em]">{service}</span>
            </div>
            <span
              className={cn(
                "ml-auto inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                client.status === "active" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
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

        <section className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold">Care Plan</span>
            <Link
              to="/clients/care-plans"
              className="ml-auto flex h-7 items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-xs text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
            >
              Open Care plans →
            </Link>
          </div>
          <section className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold">Where care may be given</span>
              {pendingLocations.length > 0 && <span className="rounded-full bg-[#FFFAEB] px-2 py-0.5 text-[11px] font-semibold text-[#B54708]">{pendingLocations.length} waiting on you</span>}
            </div>
            <div className="flex flex-col">
              {locations.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline-soft)] py-2.5 last:border-b-0">
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                    <span className="truncate text-[13px] font-medium">{l.label}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{l.address ?? "No address on file yet"}</span>
                    {l.status === "pending" && (
                      <span className="pt-0.5 text-[11.5px] text-[#B54708]">
                        Used by {l.addedBy || "somebody"} on a visit{l.addedOn ? ` on ${new Date(l.addedOn).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
                      </span>
                    )}
                  </span>
                  <span className={cn("flex-none rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[.05em]", l.status === "primary" && "bg-[#EEF0FE] text-primary", l.status === "approved" && "bg-[#ECFDF3] text-[#027A48]", l.status === "pending" && "bg-[#FFFAEB] text-[#B54708]")}>
                    {LOCATION_STATUS_LABELS[l.status]}
                  </span>
                  {mayEdit && l.status === "pending" && (
                    <span className="flex flex-none gap-1.5">
                      <button type="button" onClick={() => decideLocation(l.id, true, currentUser.name)} className="h-8 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                        Approve
                      </button>
                      <button type="button" onClick={() => decideLocation(l.id, false, currentUser.name)} className="h-8 rounded-lg border border-[var(--hairline)] px-3 text-[12.5px] transition-colors hover:bg-[var(--wash)]">
                        Not approved
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="m-0 text-[12px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
              A caregiver can clock in anywhere — Joy never stops care happening. Somewhere new goes on this list as pending and onto your morning list until you decide.
            </p>
          </section>
          <div className="flex flex-col gap-2 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-semibold">How a shift divides</span>
              {confirmed ? <span className="text-[11.5px] text-[#027A48]">Confirmed at admission by {confirmed.by}</span> : <span className="text-[11.5px] text-muted-foreground">Joy's default — not confirmed yet</span>}
            </div>
            {editingMix ? (
              <>
                <ServiceMixEditor mix={draftMix} onChange={setDraftMix} previewHours={8} />
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={validateMix(draftMix) !== null}
                    onClick={() => {
                      setServiceMix(client.personId, [...draftMix]);
                      setEditingMix(false);
                    }}
                    className={cn("h-8 rounded-lg px-3 text-[12.5px] font-medium transition-colors", validateMix(draftMix) === null ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
                  >
                    {validateMix(draftMix) ?? "Save the split"}
                  </button>
                  <button type="button" onClick={() => setEditingMix(false)} className="h-8 rounded-lg px-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--wash)]">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col">
                  {splitHours(mix, 8).map((l, i) => (
                    <div key={l.service} className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline-soft)] py-1 last:border-b-0">
                      <span className="min-w-0 truncate text-[12.5px]">
                        <span className="mr-1.5 font-medium tabular-nums">{mix[i].percent}%</span>
                        {l.service}
                      </span>
                      <span className="flex-none text-[11.5px] tabular-nums text-muted-foreground">{hoursLabel(l.hours)} on an 8-hour shift</span>
                    </div>
                  ))}
                </div>
                {mayEdit && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftMix([...mix]);
                        setEditingMix(true);
                      }}
                      className="h-8 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
                    >
                      Change the split
                    </button>
                    {!confirmed && (
                      <button type="button" onClick={() => confirmServiceMix(client.personId, currentUser.name)} className="h-8 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                        Confirm this split
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5">
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
                        <span key={l} className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--ink-body)]">
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
          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold">Tasks</span>
              <span className="ml-auto text-xs text-muted-foreground">From the care plan</span>
            </div>
            <div className="flex flex-col">
              {active.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
                  <span className="flex flex-col leading-[1.35]">
                    <span className="text-[13px]">{t.label}</span>
                    <span className="text-[11.5px] text-muted-foreground">{t.category}</span>
                  </span>
                  {t.required && (
                    <span className="ml-auto rounded-full bg-[var(--hairline-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--ink-body)]">
                      Required before clock-out
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
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
                <div key={label} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-[7px] last:border-0">
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
  const { households, setHouseholdBilling, setHouseholdRate, currentUser } = useDemo();
  const { visits: board } = useScheduleBoard();
  const terms = seedBillingTerms.find((t) => t.clientPersonId === client.personId);
  const household = householdOf(households, client.personId);
  const weekStart = useMemo(() => upcomingBillingWeek(new Date().toISOString()), []);
  const invoice = useMemo(
    () =>
      terms
        ? buildInvoice({
            terms,
            visits: board,
            weekStart,
            households,
            // Bill the agreement, not the board — Karynn's advance model. The
            // upcoming week's schedule may not exist yet; the agreed hours do.
            advance:
              client.hoursPerWeek !== null ? { agreedHours: client.hoursPerWeek } : null,
          })
        : null,
    [terms, weekStart, client.hoursPerWeek, households, board],
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
      <div className="max-w-xl rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-8 text-center">
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
      {household && (
        <HouseholdCard
          household={household}
          clientPersonId={client.personId}
          hourlyRate={terms.hourlyRate}
          payerFor={payerFor}
          canEdit={canWrite(currentUser.role)}
          onChange={(billing) => setHouseholdBilling(household.id, billing)}
          onRateChange={(rate, split) => setHouseholdRate(household.id, rate, split)}
        />
      )}
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
          <div key={b.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
            <SectionLabel>{b.label}</SectionLabel>
            <span className={cn("text-[17px] font-semibold tracking-[-.01em]", b.warn && "text-[#B42318]")}>
              {b.value}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{b.sub}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-3.5">
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
                    className="whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice ? (
                <tr className="border-t border-[var(--hairline-soft)]">
                  <td className="px-4 py-3 text-[13px] font-medium">
                    {invoice.weekStart} – {invoice.weekEnd}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[var(--ink-body)] tabular-nums">
                    {invoice.lines.reduce((t, l) => t + l.hours, 0)} hrs
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{money(invoice.total)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] text-[12.5px] text-[var(--ink-body)]">
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
                  <td className="px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{invoice.dueOn}</td>
                </tr>
              ) : (
                <tr className="border-t border-[var(--hairline-soft)]">
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
