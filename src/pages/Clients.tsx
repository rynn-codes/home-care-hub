import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { ClientRecordView } from "@/components/clients/ClientRecordView";
import { useDemo } from "@/context/DemoDataProvider";
import { seedClients } from "@/lib/clientsSeed";
import {
  buildClientRecord,
  searchRoster,
  sortRoster,
  type ClientInput,
} from "@/domain/clients/roster";

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
 */
export default function Clients() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { people, consentSessions } = useDemo();
  const [query, setQuery] = useState("");

  // The date is read once per render rather than inside the domain module, so
  // the compliance clock stays a pure function of (client, today).
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const records = useMemo(() => {
    // Clients admitted during the demo. They carry only what admission knew, so
    // the directory columns the assessment does not fill stay honestly empty.
    const admitted: ClientInput[] = people
      .filter((p) => p.clientStatus === "active")
      .map((p) => {
        const session = Object.values(consentSessions).find(
          (s) => s.clientName === `${p.firstName} ${p.lastName}`,
        );
        return {
          personId: p.personId,
          firstName: p.firstName,
          lastName: p.lastName,
          preferredName: p.preferredName,
          dateOfBirth: p.dateOfBirth,
          phone: p.phone,
          email: p.email,
          status: "active" as const,
          responsiblePartyName: p.responsiblePartyName,
          responsiblePartyLine: p.responsiblePartyName ? "Responsible party" : null,
          admissionDate: p.admissionDate,
          signedAt: session?.signedAt ?? null,
          decisions: session?.decisions ?? {},
          lastActivity: p.admissionDate ? `Admitted · ${p.admissionDate}` : "Admitted",
        };
      });

    // Seeded clients are dropped when a live admission produced the same person,
    // so admitting somebody never shows them twice.
    const admittedIds = new Set(admitted.map((c) => c.personId));
    const all = [...admitted, ...seedClients.filter((c) => !admittedIds.has(c.personId))];

    return sortRoster(all.map((c) => buildClientRecord(c, today)));
  }, [people, consentSessions, today]);

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
    return <ClientRecordView client={selected} onBack={() => navigate("/clients")} />;
  }

  const visible = searchRoster(records, query);
  const active = records.filter((c) => c.status === "active").length;

  return (
    <>
      <PageHeader
        title="Clients"
        description={`Every care recipient in one place — status, payer, and who is on the case. ${records.length} total · ${active} active.`}
      />

      <ClientDirectory
        clients={visible}
        query={query}
        onQueryChange={setQuery}
        onOpen={(personId) => navigate(`/clients/${personId}`)}
        onAdd={() =>
          toast.info("Clients are added through Admissions.", {
            description: "A referral becomes a client when the admission is approved.",
          })
        }
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. Every client here is fictional. Renewal dates are
        computed from the signing packet's own expiry clauses, not entered by hand.
      </p>
    </>
  );
}
