import { describe, expect, it } from "vitest";
import { onboardingStatus, type GustoStatus } from "@/domain/portal/onboarding";
import { NullHrOnboardingService } from "@/domain/portal/memoryAdapters";
import type { Applicant } from "@/domain/hiring/pipeline";
import type { CredentialRequirement } from "@/domain/documents/types";

function requirement(over: Partial<CredentialRequirement> = {}): CredentialRequirement {
  return {
    credentialType: "cpr",
    displayName: "CPR card",
    folderType: "credentials",
    sensitivity: "standard",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [60],
    active: true,
    ...over,
  } as CredentialRequirement;
}

function applicant(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "a1",
    name: "Jamisha Harper",
    roleApplied: "Caregiver",
    track: "onboarding",
    stage: "offer",
    onboardingStage: "online_orientation",
    stageSince: "2026-08-18",
    appliedOn: "2026-08-01",
    source: "GHL",
    recruiter: null,
    email: "j@example.com",
    phone: "+17135550100",
    availability: "Weekdays",
    drives: false,
    documents: {},
    offerAcceptedOn: "2026-08-18",
    ...over,
  };
}

const NOTHING_OUTSTANDING: CredentialRequirement[] = [];
const NO_ORIENTATION = { onlineOrientation: null, fieldOrientation: null };

function build(over: Partial<Parameters<typeof onboardingStatus>[0]> = {}) {
  return onboardingStatus({
    applicant: applicant(),
    applicationSubmitted: true,
    gusto: null,
    orientation: NO_ORIENTATION,
    requirements: NOTHING_OUTSTANDING,
    ...over,
  });
}

function line(view: ReturnType<typeof onboardingStatus>, label: string) {
  return view.lines.find((l) => l.label === label);
}

describe("§6 — the portal changes state, it does not become a second one", () => {
  it("adds the offer line the candidate view does not have", () => {
    expect(line(build(), "Offer")?.value).toBe("Accepted");
  });

  it("produces the same StatusLine shape the candidate screen renders", () => {
    // §6: no second account, no second application, no second screen.
    for (const l of build().lines) {
      expect(l).toHaveProperty("label");
      expect(l).toHaveProperty("value");
      expect(["done", "in_progress", "waiting", "attention"]).toContain(l.state);
    }
  });
});

describe("Gusto", () => {
  it("does not claim setup is under way when nothing is connected", () => {
    // The addendum's mockup shows 'In Progress'. Joy cannot honestly say that
    // today — it would tell a new hire their W-4 was moving when Joy has no
    // idea, and the first person to discover otherwise would be them, on
    // payday.
    const view = build({ gusto: null });
    expect(line(view, "Gusto HR setup")?.value).toBe("Ready for you");
    expect(line(view, "Gusto HR setup")?.value).not.toBe("In progress");
  });

  it("reports the real state once the provider is wired", () => {
    const gusto: GustoStatus = { step: "in_progress", url: "https://gusto.example/x" };
    expect(line(build({ gusto }), "Gusto HR setup")?.value).toBe("In progress");
  });

  it("sends them to Gusto rather than rebuilding the form", () => {
    const gusto: GustoStatus = { step: "not_started", url: "https://gusto.example/x" };
    const view = build({ gusto });
    expect(view.action?.to).toBe("https://gusto.example/x");
    expect(view.detail).toContain("W-4, I-9 and direct deposit");
  });

  it("offers no button when there is no link to send them to", () => {
    // Better than a button that goes nowhere.
    expect(build({ gusto: null }).action).toBeNull();
  });

  it("stops asking once it is complete", () => {
    const gusto: GustoStatus = { step: "complete", url: "https://gusto.example/x" };
    expect(build({ gusto }).headline).not.toContain("payroll");
    expect(line(build({ gusto }), "Gusto HR setup")?.state).toBe("done");
  });

  it("has an adapter that admits it is not connected", async () => {
    const service = new NullHrOnboardingService();
    expect(await service.status("e1")).toBeNull();
    expect(await service.onboardingUrl("e1")).toBeNull();
  });
});

describe("what to do next", () => {
  const complete: GustoStatus = { step: "complete", url: null };

  it("puts a missing credential ahead of everything else", () => {
    const view = build({
      requirements: [requirement({ credentialType: "cpr", displayName: "CPR card" })],
      gusto: null,
    });
    expect(view.headline).toContain("CPR card");
    expect(view.action?.to).toBe("/portal/work/documents");
  });

  it("does not hand a new hire a button for Joy's own background check", () => {
    const view = build({
      requirements: [
        requirement({ credentialType: "background_check", displayName: "Background check", suppliedBy: "agency" }),
      ],
      gusto: complete,
    });
    expect(view.headline).not.toContain("Background check");
    expect(line(view, "Documents")?.value).toBe("All received");
  });

  it("gives no button while the office owes them a date", () => {
    // §5's rule does not stop applying once somebody is hired.
    const view = build({ gusto: complete, orientation: NO_ORIENTATION });
    expect(view.action).toBeNull();
    expect(view.headline).toBe("You're almost ready");
  });

  it("says when orientation is, once it is booked", () => {
    const view = build({
      gusto: complete,
      orientation: { onlineOrientation: "24 Aug", fieldOrientation: null },
    });
    expect(view.headline).toBe("Orientation is 24 Aug");
    expect(view.detail).toContain("confirm your field orientation");
  });

  it("distinguishes an unbooked orientation from an unbooked field orientation", () => {
    // Both are absent; only one is phrased as the office's job.
    const view = build({ gusto: complete });
    expect(line(view, "Orientation")?.value).toBe("The office will confirm");
    expect(line(view, "Field orientation")?.value).toBe("Not scheduled");
  });

  it("still asks an unfinished application to be finished first", () => {
    const view = build({ applicationSubmitted: false, gusto: complete });
    expect(view.headline).toBe("Finish your application");
  });
});
