import { useState } from "react";
import { ArrowLeft, Check, FileText, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FamilyPortalCard } from "@/components/clients/FamilyPortalCard";
import { RequestDocumentCard } from "@/components/clients/RequestDocumentCard";
import { seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { refusedConsents, type ClientRecord, type ComplianceItem } from "@/domain/clients/roster";
import { seedActivity } from "@/lib/clientsSeed";

/**
 * The client record, following the approved mockup: a header with status and
 * the two actions, then Profile / Activity / Schedule / Docs / Services /
 * Billing & Payments.
 *
 * Two things the mockup does not have, both of which come out of the signing
 * packet rather than out of design:
 *
 *  - RESTRICTIONS ON THE PROFILE. A client who refused transport or photographs
 *    made a decision that changes what a caregiver may do that morning. It
 *    belongs where the caregiver will actually see it, not buried in a consent
 *    log. This is the other half of recording a refusal.
 *  - EXPIRY DATES IN DOCS. The two records authorizations expire twelve months
 *    after signature and the supervisory visit is annual. A document list that
 *    shows "Signed" against a lapsed authorization is worse than no list.
 */

const TABS = ["Profile", "Activity", "Schedule", "Docs", "Services", "Billing & Payments"] as const;
type Tab = (typeof TABS)[number];

const TONE: Record<string, string> = {
  done: "bg-[hsl(var(--success))]",
  prog: "bg-primary",
  warn: "bg-[hsl(var(--warning))]",
  bad: "bg-destructive",
};

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
      ? "bg-destructive/10 text-destructive"
      : item.state === "due_soon"
        ? "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]"
        : "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]";

  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function Highlight({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function ClientRecordView({ client, onBack }: { client: ClientRecord; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("Profile");
  const activity = seedActivity[client.personId] ?? [];
  const refused = refusedConsents(client.decisions);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the client directory"
            className="mt-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary">
            {client.initials}
          </span>
          <div>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                client.status === "active"
                  ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                  : client.status === "on_hold"
                    ? "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]"
                    : "bg-surface-muted text-muted-foreground",
              )}
            >
              {client.statusLabel}
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">{client.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Care recipient
              {client.age !== null && ` · ${client.age} years old`} · {client.location}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Message family
          </Button>
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Schedule care
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Details</h2>
              <dl>
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
                  label="Authorized hours"
                  value={client.hoursPerWeek === null ? "Paused" : `${client.hoursPerWeek} hrs / week`}
                />
                <Detail label="Coordinator" value={client.coordinator ?? "Unassigned"} />
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                Emergency contact
              </h2>
              {client.responsiblePartyName ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold">
                    {client.responsiblePartyName
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{client.responsiblePartyName}</p>
                    <p className="text-xs text-muted-foreground">{client.responsiblePartyLine}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nobody recorded.</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {/* Not in the mockup, and the most important thing on the page: what
                this client refused, said where a caregiver will read it. */}
            {client.restrictions.length > 0 && (
              <section className="rounded-2xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
                  What this client declined
                </h2>
                <ul className="mt-3 space-y-2">
                  {client.restrictions.map((r) => (
                    <li key={r} className="text-sm text-muted-foreground">
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold">Highlights</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-4 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Payer</p>
                  <p className="mt-1 font-semibold">{client.payer}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{client.payerLine ?? "—"}</p>
                </div>
                <Highlight
                  label="Next visit"
                  value={client.nextVisit ?? "None scheduled"}
                  sub={client.caregiver ? `${client.caregiver}` : "No caregiver assigned"}
                />
                <Highlight
                  label="Care team"
                  value={client.caregiver ?? "Unassigned"}
                  sub={client.coordinator ? `Coordinator · ${client.coordinator}` : "No coordinator"}
                />
              </div>
            </section>

            {activity.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold">Activity</h2>
                <ul className="rounded-2xl border border-border bg-surface">
                  {activity.slice(0, 4).map((a) => (
                    <li
                      key={a.label}
                      className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0"
                    >
                      <span className="flex items-center gap-2.5 text-sm">
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[a.tone] ?? TONE.prog)}
                          aria-hidden="true"
                        />
                        {a.label}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "Activity" && (
        <ul className="rounded-2xl border border-border bg-surface">
          {activity.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing recorded for this client yet.
            </li>
          )}
          {activity.map((a) => (
            <li
              key={a.label}
              className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[a.tone] ?? TONE.prog)}
                  aria-hidden="true"
                />
                {a.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "Docs" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Signed packet
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {client.signedAt
                ? `Signed ${client.signedAt.slice(0, 10)}. One signature, placed on every page that asks.`
                : "The consents packet has not been signed."}
            </p>

            <ul>
              {client.compliance.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.detail}</span>
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

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
              Decisions on record
            </h2>
            {refused.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
                Agreed to everything in the packet.
              </p>
            ) : (
              <ul className="space-y-3">
                {refused.map((c) => (
                  <li key={c.key}>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.decisions[c.key] === "decline" ? "Declined" : "Not applicable"} · packet p.{" "}
                      {c.pages}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* §19 and §21. The family portal has existed with no way for anybody
              to reach it, and document requests had a table and a portal screen
              but nothing that created a row. Both actions belong on the client
              record, because both are decisions about this client. */}
          {/* Both §19 gates are satisfied by construction here: a client
              record only exists once somebody has been assessed and admitted.
              The interesting case — inviting a family *during* admission, when
              those gates are live — belongs on the admission review screen, and
              `canInviteFamily` is what it will call. */}
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
      )}

      {(tab === "Schedule" || tab === "Services" || tab === "Billing & Payments") && (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium">{tab} is not built yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {tab === "Schedule"
              ? "This client's visits are on the Scheduling screen, which is built. A per-client calendar comes with the scheduling assignment work."
              : tab === "Services"
                ? "The rate card and care plan versions live here in the approved design. They need the rates, which go to the client by e-mail rather than into the packet."
                : "Invoicing has no sprint in the roadmap yet — finding F26 in the build audit."}
          </p>
        </section>
      )}
    </>
  );
}
