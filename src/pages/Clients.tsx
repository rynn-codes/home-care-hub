import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientDirectory, type ClientStatusFilter } from "@/components/clients/ClientDirectory";
import { ClientPeek } from "@/components/clients/ClientPeek";
import { ClientRecordView } from "@/components/clients/ClientRecordView";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { recoveryDaysFor } from "@/domain/records/deletion";
import { buildClientRecord, searchRoster, sortRoster, type ClientRecord } from "@/domain/clients/roster";
import { buildClientRoster } from "@/lib/clientRoster";

/**
 * Clients — the permanent record.
 *
 * Admissions is the process; this is where a person ends up. §10: admission does
 * not create a second record, so a client admitted through the demo appears here
 * by gaining a client profile on the people row that already existed — nothing
 * is copied and nothing is duplicated.
 *
 * Structure follows the approved Clients mockup. Note that the mockup's own
 * navigation puts Clients and Employees at the top level with People beside
 * them, which is the opposite of §6 and §10 ("the permanent client record
 * ultimately lives under People → Clients"). Karynn ruled for the mockup on 18
 * Aug: People is the general contact list — business contacts, partners, anyone
 * the agency needs to follow up with — and clients are not filed inside it. The
 * data model is unaffected; this is where a record is *displayed*, not how it
 * is stored.
 *
 * A row opens the peek first, the same gesture as Employees. Deleting is a
 * bin, not a shredder: the record sits in Settings → Deleted items for its
 * recovery window. An admitted client cannot be deleted at all — Texas
 * retention — which the provider enforces.
 */
export default function Clients() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { people, consentSessions, admissions, deletedClientIds, clientStatuses, currentUser, deleteClient, restoreDeleted } =
    useDemo();
  const mayWrite = canWrite(currentUser.role);
  const [peek, setPeek] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState<ClientRecord | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientStatusFilter>("active");

  // The date is read once per render rather than inside the domain module, so
  // the compliance clock stays a pure function of (client, today).
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const records = useMemo(
    () =>
      sortRoster(
        buildClientRoster({ people, admissions, consentSessions })
          .filter((c) => !deletedClientIds.includes(c.personId))
          .map((c) => {
            const set = clientStatuses[c.personId];
            return buildClientRecord(set ? { ...c, status: set.status } : c, today);
          }),
      ),
    [people, admissions, consentSessions, deletedClientIds, clientStatuses, today],
  );

  const selected = id ? records.find((c) => c.personId === id) : undefined;

  if (id && !selected) {
    return (
      <>
        <PageHeader title="Client not found" description="That record is not in the directory." />
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => navigate("/clients")}
        >
          Back to the directory
        </button>
      </>
    );
  }

  if (selected) {
    return <ClientRecordView client={selected} />;
  }

  const searched = searchRoster(records, query);
  const visible = status === "all" ? searched : searched.filter((c) => c.status === status);
  const counts: Record<ClientStatusFilter, number> = {
    all: records.length,
    active: records.filter((c) => c.status === "active").length,
    on_hold: records.filter((c) => c.status === "on_hold").length,
    inactive: records.filter((c) => c.status === "inactive").length,
    discharged: records.filter((c) => c.status === "discharged").length,
  };

  return (
    <>
      <PageHeader title="Clients" />

      <ClientDirectory
        clients={visible}
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        counts={counts}
        hiddenBySearch={query.trim() ? searched.length - visible.length : 0}
        onOpen={(personId) => setPeek(records.find((c) => c.personId === personId) ?? null)}
        onAdd={() => {
          navigate("/admissions");
          toast.info("Clients are added through Admissions.", {
            description: "Start a referral here — it becomes a client when the admission is approved.",
          });
        }}
      />

      <ClientPeek
        client={peek}
        mayWrite={mayWrite}
        onClose={() => setPeek(null)}
        onDelete={() => {
          if (peek) {
            setDeleting(peek);
            setPeek(null);
          }
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this client?"
        subject={deleting ? `${deleting.name}${deleting.payer ? ` · ${deleting.payer}` : ""}` : ""}
        consequences={["The client record and everything filed under it"]}
        recoveryDays={recoveryDaysFor("client")}
        confirmLabel="Delete client"
        onConfirm={() => {
          if (!deleting) return;
          const { personId, name } = deleting;
          deleteClient(personId, name);
          setDeleting(null);
          toast(`${name} deleted`, {
            description: `In Settings → Deleted items for ${recoveryDaysFor("client")} days.`,
            action: { label: "Undo", onClick: () => restoreDeleted(personId) },
          });
        }}
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. Renewal dates are computed from the signing packet's own
        expiry clauses, not entered by hand.
      </p>
    </>
  );
}
