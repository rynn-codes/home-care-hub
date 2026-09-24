import type { ClientInput } from "@/domain/clients/roster";
import { consentSessionForClient, type DemoState } from "@/lib/demoStore";
import { seedClients } from "@/lib/clientsSeed";

/**
 * Everyone in the Clients directory: the seed plus anyone admitted in the demo.
 *
 * §10: admission does not create a second record. A client admitted through
 * the demo appears here by gaining a client profile on the people row that
 * already existed, carrying only what admission knew, so the directory columns
 * the assessment does not fill stay honestly empty. A seeded client is dropped
 * when a live admission produced the same person, so admitting somebody never
 * shows them twice.
 *
 * Statuses set on the record and deletions are layered on by the caller — see
 * pages/Clients — because they are decisions about the record, not the roster.
 */
export function buildClientRoster(
  state: Pick<DemoState, "people" | "admissions" | "consentSessions">,
): ClientInput[] {
  const admitted: ClientInput[] = state.people
    .filter((p) => p.clientStatus === "active")
    .map((p) => {
      const session = consentSessionForClient(
        { admissions: state.admissions, consentSessions: state.consentSessions },
        `${p.firstName} ${p.lastName}`,
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

  const admittedIds = new Set(admitted.map((c) => c.personId));
  return [...admitted, ...seedClients.filter((c) => !admittedIds.has(c.personId))];
}
