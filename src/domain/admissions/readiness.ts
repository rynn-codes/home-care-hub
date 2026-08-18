import { CONSENTS, consentReadiness, type ConsentDecisions } from "@/domain/consents/registry";

/**
 * Pre-onboarding readiness, and the admission decision.
 *
 * §37 (Sprint 4): the office decides whether to admit. This module computes what
 * is outstanding; a human decides. §26 keeps admissions at "prepare summary" —
 * Joy assembles the picture, it does not approve anyone.
 *
 * The rule that shapes the last step, from §10:
 *
 *   > Do not create a second client record when a person becomes admitted.
 *
 * Admission adds a client profile to the person who has been there since the
 * referral. It never mints a new one.
 */

export type ReadinessState = "ready" | "outstanding" | "blocked";

export interface ReadinessItem {
  key: string;
  label: string;
  detail: string;
  state: ReadinessState;
  /** False when admission can proceed with this outstanding. */
  required: boolean;
}

export interface AdmissionInputs {
  intakeComplete: boolean;
  assessmentComplete: boolean;
  consentDecisions: ConsentDecisions;
  packetSigned: boolean;
  /** Set once the office has recorded how the client will pay. */
  paymentSetUp: boolean;
  /** Set once the plan of care has been approved by the RN. */
  carePlanApproved: boolean;
}

export function admissionReadiness(input: AdmissionInputs): ReadinessItem[] {
  const consents = consentReadiness(input.consentDecisions);

  return [
    {
      key: "intake",
      label: "Phone intake",
      detail: input.intakeComplete
        ? "Completed and carried into the assessment"
        : "Not finished — the assessment inherits from it",
      state: input.intakeComplete ? "ready" : "outstanding",
      required: true,
    },
    {
      key: "assessment",
      label: "RN assessment",
      detail: input.assessmentComplete
        ? "Every packet page can be filled"
        : "Not complete — the packet cannot be produced yet",
      state: input.assessmentComplete ? "ready" : "outstanding",
      required: true,
    },
    {
      key: "consents",
      label: "Consent decisions",
      detail: consents.blockingDeclines.length > 0
        ? `Declined: ${consents.blockingDeclines.map((c) => c.title).join(", ")}`
        : `${consents.decided} of ${consents.total} decided`,
      // A declined mandatory consent is not "outstanding", it is a stop.
      state: consents.blockingDeclines.length > 0
        ? "blocked"
        : consents.decided === consents.total
          ? "ready"
          : "outstanding",
      required: true,
    },
    {
      key: "signature",
      label: "Packet signed",
      detail: input.packetSigned
        ? "One signature and one set of initials on file"
        : "Not signed",
      state: input.packetSigned ? "ready" : "outstanding",
      required: true,
    },
    {
      key: "care_plan",
      label: "Plan of care approved",
      detail: input.carePlanApproved ? "Approved by the RN" : "Awaiting RN approval",
      state: input.carePlanApproved ? "ready" : "outstanding",
      required: true,
    },
    {
      key: "payment",
      label: "Payment set up",
      detail: input.paymentSetUp
        ? "Method recorded and rates e-mailed"
        : "Not set up — billing cannot invoice the first week",
      state: input.paymentSetUp ? "ready" : "outstanding",
      required: true,
    },
  ];
}

export interface AdmissionDecisionCheck {
  items: ReadinessItem[];
  outstanding: ReadinessItem[];
  blocked: ReadinessItem[];
  canAdmit: boolean;
  /** Plain-language reason when admission cannot proceed. */
  reason: string | null;
}

export function checkAdmission(input: AdmissionInputs): AdmissionDecisionCheck {
  const items = admissionReadiness(input);
  const outstanding = items.filter((i) => i.required && i.state === "outstanding");
  const blocked = items.filter((i) => i.state === "blocked");

  const reason = blocked.length > 0
    ? `${blocked[0].label}: ${blocked[0].detail}. This ends the admission rather than delaying it.`
    : outstanding.length > 0
      ? `${outstanding.length} ${outstanding.length === 1 ? "item is" : "items are"} still outstanding.`
      : null;

  return {
    items,
    outstanding,
    blocked,
    canAdmit: outstanding.length === 0 && blocked.length === 0,
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
