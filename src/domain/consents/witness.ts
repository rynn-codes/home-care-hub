/**
 * Who may take a client's signature on the packet.
 *
 * Karynn's rule, 18 Aug 2026: only an RN, or the Admin/Owner, can obtain the
 * authorization signature. That is not a UI preference — the packet has a
 * "JOY HEALTHCARE REPRESENTATIVE" line beside the client's on almost every
 * page, and whoever signs it is attesting that the consents were explained
 * before they were agreed to. A coordinator who cannot answer a clinical
 * question cannot honestly make that attestation.
 *
 * The roles are the ones in `user_role` (0001_foundation.sql), so this rule and
 * the database speak the same vocabulary.
 *
 * THIS MODULE IS NOT THE ENFORCEMENT. A check in React stops the wrong screen
 * being shown; it does not stop anyone holding the anon key from writing the
 * row. The boundary that matters is row level security, and this rule needs a
 * matching policy on consent_sessions before the flow is real. Until then this
 * is a guard rail, and the comment says so rather than letting it look finished.
 */

/**
 * The roles, as Karynn named them on 1 October: Admin/Owner, RN, Operations,
 * Finance, Caregiver, Auditor, Bookkeeper — plus the client contact, who only
 * ever sees the family portal. The earlier intake coordinator, scheduler and
 * HR roles are all Operations now; payroll and billing are Finance. What each
 * one may open lives in domain/access/roles.
 */
export type UserRole =
  | "ceo_admin"
  | "rn_clinical"
  | "operations"
  | "finance"
  | "employee"
  | "client_contact"
  /** A licensure surveyor: read-only, and shown an allowlist of screens. See domain/access/roles. */
  | "auditor"
  /** The bookkeeper: Reports and Billing, nothing clinical. See domain/access/roles. */
  | "bookkeeper";

export const ROLE_LABELS: Record<UserRole, string> = {
  ceo_admin: "Admin / Owner",
  rn_clinical: "RN",
  operations: "Operations",
  finance: "Finance",
  employee: "Caregiver",
  client_contact: "Client contact",
  auditor: "Auditor",
  bookkeeper: "Bookkeeper",
};

export const USER_ROLES: readonly UserRole[] = ["ceo_admin", "rn_clinical", "operations", "finance", "employee", "client_contact", "auditor", "bookkeeper"];

/** A role stored before 1 October reads as the one that replaced it. */
export function normalizeRole(raw: unknown): UserRole {
  const legacy: Record<string, UserRole> = { intake_coordinator: "operations", scheduler: "operations", hr: "operations", payroll: "finance", billing: "finance" };
  if (typeof raw === "string") {
    if ((USER_ROLES as readonly string[]).includes(raw)) return raw as UserRole;
    if (legacy[raw]) return legacy[raw];
  }
  return "operations";
}

/** The only roles that may witness a client's signature on the packet. */
export const WITNESS_ROLES: UserRole[] = ["rn_clinical", "ceo_admin"];

export function canWitnessSignature(role: UserRole | null | undefined): boolean {
  return !!role && WITNESS_ROLES.includes(role);
}

/**
 * Why this person cannot take the signature, said to them rather than about
 * them. A blocked screen that does not explain itself gets worked around.
 */
export function witnessRefusal(role: UserRole | null | undefined): string {
  if (canWitnessSignature(role)) return "";
  if (!role) {
    return "We cannot tell what your role is, so the packet cannot be signed from this session.";
  }
  return `Signing the packet needs an RN or the Admin/Owner present. Your role is ${ROLE_LABELS[role]}, so you can review the consents with the client and record their decisions — an RN completes the signature.`;
}

/**
 * What gets written next to the client's signature.
 *
 * The packet asks for a Joy representative on almost every page, so the record
 * has to name a person, not just a timestamp.
 */
export interface Witness {
  name: string;
  role: UserRole;
}

export function witnessLine(witness: Witness | null): string {
  if (!witness) return "No Joy representative recorded";
  return `${witness.name} · ${ROLE_LABELS[witness.role]}`;
}
