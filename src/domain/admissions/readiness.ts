import { CONSENTS, consentReadiness, type ConsentDecisions } from "@/domain/consents/registry";
import {
  paymentSetupSatisfies,
  PAYMENT_SETUP_LABELS,
  type PaymentSetupState,
} from "@/domain/billing/paymentSetup";

/**
 * Pre-onboarding readiness, and the admission decision.
 *
 * §37 (Sprint 4): the office decides whether to admit. This module computes what
 * is outstanding; a human decides. §26 keeps admissions at "prepare summary" —
 * Joy assembles the picture, it does not approve anyone.
 *
 * §4.2 OF THE BILLING SPECIFICATION shapes the gates: nine of them, each in one
 * of six states, and `ready_for_admission` COMPUTED from the gates — never
 * selected by hand without an override reason and an audit entry. The override
 * is itself the ninth gate: "any documented authorized exception".
 *
 * The rule that shapes the last step, from §10:
 *
 *   > Do not create a second client record when a person becomes admitted.
 *
 * Admission adds a client profile to the person who has been there since the
 * referral. It never mints a new one.
 */

/**
 * §4.2's six states. The old three-state model flattened distinctions that
 * matter: "not started" and "sent back for correction" both read as
 * `outstanding`, and a family three weeks into gathering documents deserves a
 * different row from one nobody has asked yet.
 */
export type GateState =
  | "not_started"
  | "needs_action"
  | "in_review"
  | "ready"
  | "complete"
  | "needs_attention";

export const GATE_STATE_LABELS: Record<GateState, string> = {
  not_started: "Not started",
  needs_action: "Needs action",
  in_review: "In review",
  ready: "Ready",
  complete: "Complete",
  needs_attention: "Needs attention",
};

/** The states a gate may hold without delaying admission. */
export function gateSatisfied(state: GateState): boolean {
  return state === "ready" || state === "complete";
}

export interface ReadinessItem {
  key: string;
  label: string;
  detail: string;
  state: GateState;
  /** False when admission can proceed with this outstanding. */
  required: boolean;
}

/**
 * §4.2's documented authorized exception — the only way past an unsatisfied
 * gate. It is a decision with a name and a reason, and the caller writes the
 * audit entry (`admission.gate_overridden`) in the same breath.
 */
export interface GateOverride {
  reason: string;
  byUserId: string;
  at: string;
}

export interface AdmissionInputs {
  intakeComplete: boolean;
  assessmentComplete: boolean;
  consentDecisions: ConsentDecisions;
  packetSigned: boolean;
  /** §9.2's five states, not a boolean. See billing/paymentSetup.ts. */
  paymentSetup: PaymentSetupState;
  /** Set once the plan of care has been approved by the RN. */
  carePlanApproved: boolean;
  /** Documents the office has asked this family for, and where each stands. */
  requestedDocuments: readonly { label: string; outstanding: boolean }[];
  /** The proposed first day of care. Null when nobody has picked one. */
  startOfCareDate: string | null;
  /** Whether intake named who is responsible and how billing reaches them. */
  billingContactNamed: boolean;
  /** The office has recorded the agreed rate. Cadence is weekly by rule. */
  rateAgreed: boolean;
  override?: GateOverride | null;
}

export function admissionReadiness(input: AdmissionInputs): ReadinessItem[] {
  const consents = consentReadiness(input.consentDecisions);
  const documentsOutstanding = input.requestedDocuments.filter((d) => d.outstanding);

  return [
    {
      key: "intake",
      label: "Phone intake",
      detail: input.intakeComplete
        ? "Completed and carried into the assessment"
        : "Not finished — the assessment inherits from it",
      state: input.intakeComplete ? "complete" : "needs_action",
      required: true,
    },
    {
      key: "assessment",
      label: "RN assessment",
      detail: input.assessmentComplete
        ? "Every packet page can be filled"
        : "Not complete — the packet cannot be produced yet",
      state: input.assessmentComplete ? "complete" : "needs_action",
      required: true,
    },
    {
      key: "consents",
      label: "Consent decisions",
      detail: consents.blockingDeclines.length > 0
        ? `Declined: ${consents.blockingDeclines.map((c) => c.title).join(", ")}`
        : `${consents.decided} of ${consents.total} decided`,
      // A declined mandatory consent is not "outstanding", it is a stop — and
      // not one an override may step past; see checkAdmission.
      state: consents.blockingDeclines.length > 0
        ? "needs_attention"
        : consents.decided === consents.total
          ? "complete"
          : consents.decided === 0
            ? "not_started"
            : "needs_action",
      required: true,
    },
    {
      key: "signature",
      label: "Packet signed",
      detail: input.packetSigned
        ? "One signature and one set of initials on file"
        : "Not signed",
      state: input.packetSigned ? "complete" : "needs_action",
      required: true,
    },
    {
      key: "care_plan",
      label: "Plan of care approved",
      detail: input.carePlanApproved ? "Approved by the RN" : "Awaiting RN approval",
      state: input.carePlanApproved ? "complete" : "in_review",
      required: true,
    },
    {
      key: "documents",
      label: "Requested documents",
      detail:
        input.requestedDocuments.length === 0
          ? "Nothing has been requested"
          : documentsOutstanding.length === 0
            ? "Everything requested has arrived"
            : `Still needed: ${documentsOutstanding.map((d) => d.label).join(", ")}`,
      // Nothing requested is READY, not complete — the office asked for
      // nothing, which is a fine way to be, but different from receiving it all.
      state:
        input.requestedDocuments.length === 0
          ? "ready"
          : documentsOutstanding.length === 0
            ? "complete"
            : "needs_action",
      required: true,
    },
    {
      key: "schedule",
      label: "Start of care planned",
      detail: input.startOfCareDate
        ? `Proposed for ${input.startOfCareDate}`
        : "No start date proposed — nothing downstream can be scheduled",
      state: input.startOfCareDate ? "ready" : "not_started",
      required: true,
    },
    {
      key: "billing_contact",
      label: "Responsible party and billing contact",
      detail: input.billingContactNamed
        ? "Named at intake"
        : "Nobody is named — the first invoice would have nowhere to go",
      state: input.billingContactNamed ? "complete" : "needs_action",
      required: true,
    },
    {
      key: "rate",
      label: "Rate agreement",
      detail: input.rateAgreed
        ? "Agreed rate recorded; invoiced weekly in advance"
        : "No agreed rate on record — the first week cannot be priced",
      state: input.rateAgreed ? "complete" : "needs_action",
      required: true,
    },
    {
      key: "payment",
      label: "Payment setup",
      detail: PAYMENT_SETUP_LABELS[input.paymentSetup],
      state: (
        {
          not_started: "not_started",
          method_needed: "needs_action",
          ready: "ready",
          complete: "complete",
          needs_attention: "needs_attention",
        } as const
      )[input.paymentSetup],
      required: true,
    },
  ];
}

export interface AdmissionDecisionCheck {
  items: ReadinessItem[];
  outstanding: ReadinessItem[];
  blocked: ReadinessItem[];
  canAdmit: boolean;
  /** Set when admission proceeds only because of the documented exception. */
  overridden: boolean;
  /** Plain-language reason when admission cannot proceed. */
  reason: string | null;
}

export function checkAdmission(input: AdmissionInputs): AdmissionDecisionCheck {
  const items = admissionReadiness(input);
  const outstanding = items.filter((i) => i.required && !gateSatisfied(i.state) && i.state !== "needs_attention");
  const blocked = items.filter((i) => i.state === "needs_attention");

  // A payment setup needing attention is a problem to fix, not a refusal of
  // care; a declined mandatory consent is a refusal of the terms care is
  // offered on. Only the consent stop resists the override.
  const hardStops = blocked.filter((i) => i.key === "consents");

  const override =
    input.override && input.override.reason.trim() && input.override.byUserId
      ? input.override
      : null;

  const overridable = [...outstanding, ...blocked.filter((i) => i.key !== "consents")];
  const overridden = Boolean(override) && overridable.length > 0 && hardStops.length === 0;

  const canAdmit =
    hardStops.length === 0 && (overridable.length === 0 || Boolean(override));

  const reason = hardStops.length > 0
    ? `${hardStops[0].label}: ${hardStops[0].detail}. This ends the admission rather than delaying it — an exception cannot be documented past a refused consent.`
    : overridable.length > 0 && !override
      ? `${overridable.length} ${overridable.length === 1 ? "gate is" : "gates are"} not satisfied. Admit anyway only with a documented exception — a reason, a name, and an audit entry.`
      : null;

  return {
    items,
    outstanding,
    blocked,
    canAdmit,
    overridden,
    reason,
  };
}

/** Everything the caregiver and office need on day one. */
export interface StartOfCarePacket {
  clientName: string;
  startDate: string;
  services: string;
  schedule: string;
  /** Consents the client declined, which change what the caregiver may do. */
  restrictions: string[];
  emergencyContact: string;
}

export function startOfCareRestrictions(decisions: ConsentDecisions): string[] {
  const out: string[] = [];
  for (const consent of CONSENTS) {
    if (consent.mandatory) continue;
    if (decisions[consent.key] === "decline") {
      out.push(`${consent.title} — declined. Caregivers must not do this.`);
    }
  }
  return out;
}
