/**
 * The e-signature ceremony — Karynn's ruling, 24 August: "DocuSign-style
 * service. Nothing typed."
 *
 * What that changes: nobody types a signature, ever. The signer's legal name
 * is data the record already holds (or ordinary data entry when the record is
 * wrong — typing a NAME into a form field is data entry; typing a SIGNATURE is
 * what's banned). At the pen, the ceremony is the provider pattern DocuSign
 * uses:
 *
 *   1. consent to sign electronically (the ESIGN Act disclosure),
 *   2. adopt a generated signature and initials rendered from the legal name,
 *   3. one action applies them everywhere the packet asks.
 *
 * The real provider is an integration the developer connects; this module is
 * the contract the UI signs against, and the demo runs the provider's embedded
 * ceremony in simulation — labeled as such, never claiming a provider exists.
 */

export interface EsignSigner {
  /** The legal name the signature is generated from. Never typed at signing. */
  legalName: string;
  relationship: string;
}

export interface EsignCeremonyState {
  /** ESIGN Act consent — agreed to sign electronically. */
  consentedAt: string | null;
  /** The generated signature and initials were adopted by the signer. */
  adoptedAt: string | null;
  /** The one action that applies the adopted marks to every page. */
  signedAt: string | null;
}

export const EMPTY_CEREMONY: EsignCeremonyState = {
  consentedAt: null,
  adoptedAt: null,
  signedAt: null,
};

/** Initials generated from the legal name, the way the provider derives them. */
export function deriveInitials(legalName: string): string {
  return legalName
    .split(/[\s-]+/)
    .filter((w) => /[a-zA-Z]/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 4)
    .join("");
}

export type CeremonyRefusal =
  | "no_signer_name"
  | "not_consented"
  | "not_adopted";

export const CEREMONY_REFUSAL_MESSAGES: Record<CeremonyRefusal, string> = {
  no_signer_name: "The signer's legal name has to be on the record before a signature can be generated from it.",
  not_consented: "The signer has to agree to sign electronically before anything else — the provider will not open a ceremony without it.",
  not_adopted: "The signer has to adopt the generated signature and initials before they can be applied.",
};

/** Why the ceremony cannot complete yet — empty when it can. */
export function ceremonyRefusals(signer: EsignSigner, state: EsignCeremonyState): CeremonyRefusal[] {
  const refusals: CeremonyRefusal[] = [];
  if (!signer.legalName.trim()) refusals.push("no_signer_name");
  if (!state.consentedAt) refusals.push("not_consented");
  if (!state.adoptedAt) refusals.push("not_adopted");
  return refusals;
}

/**
 * The provider boundary. `null_provider` is the honest production default
 * until the developer connects a real service; `simulated` is the demo's
 * embedded ceremony, and every surface that shows it says so.
 */
export type EsignProvider = "null_provider" | "simulated";

export const PROVIDER_NOTE =
  "The signing ceremony runs through a DocuSign-style e-signature service. No provider is connected in the prototype — this is the provider's embedded ceremony, simulated, and the record says so.";
