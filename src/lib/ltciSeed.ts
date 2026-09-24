import type { LtciEnrollment } from "@/domain/billing/ltci";
import { seedClients } from "@/lib/clientsSeed";

/**
 * The three clients on a long-term care policy, and their carriers.
 *
 * Marilyn K, Jessie C and Pamela P are not real people (Karynn, 29
 * September: "You can add mock data"), so the carriers, policy numbers and
 * claims lines here are placeholders in the unreachable ranges: 555 fax
 * numbers and example.com addresses. Everybody else is private pay only.
 */

const ON_A_POLICY = ["c-marilyn", "c-jessie", "c-pamela"] as const;

const CARRIERS = {
  bankers: { name: "Bankers Life", fax: "(800) 555-0147", email: "ltcclaims@bankerslife.example.com" },
  aetna: { name: "Aetna", fax: "(800) 555-0162", email: "ltcclaims@aetna.example.com" },
} as const;

const POLICIES: Record<string, { carrier: keyof typeof CARRIERS; policy: string }> = {
  "c-marilyn": { carrier: "bankers", policy: "BL-0114-5582" },
  "c-pamela": { carrier: "bankers", policy: "BL-0114-5617" },
  "c-jessie": { carrier: "aetna", policy: "AET-77-401938" },
};

export const seedLtciEnrollments: LtciEnrollment[] = seedClients
  .filter((c) => (ON_A_POLICY as readonly string[]).includes(c.personId))
  .map((c) => {
    const policy = POLICIES[c.personId];
    const carrier = policy ? CARRIERS[policy.carrier] : null;
    return {
      clientPersonId: c.personId,
      clientName: `${c.firstName} ${c.lastName}`,
      carrier: carrier?.name ?? null,
      policyReference: policy?.policy ?? null,
      claimsFax: carrier?.fax ?? null,
      claimsEmail: carrier?.email ?? null,
      releaseOnFile: true,
      releaseExpiresOn: null,
    };
  });
