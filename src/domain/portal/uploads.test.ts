import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  resendHint,
  uploadList,
  uploadSummary,
  type UploadItem,
} from "@/domain/portal/uploads";
import { firstShiftReadiness, type Applicant } from "@/domain/hiring/pipeline";
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
    track: "hiring",
    stage: "documents",
    onboardingStage: null,
    stageSince: "2026-08-14",
    appliedOn: "2026-08-10",
    source: "GHL",
    recruiter: null,
    email: "j@example.com",
    phone: "+17135550100",
    availability: "Weekdays",
    drives: false,
    documents: {},
    ...over,
  };
}

const REQS = [
  requirement({ credentialType: "cpr", displayName: "CPR card", blocksSchedulingWhenExpired: true }),
  requirement({ credentialType: "tb", displayName: "TB screening", blocksSchedulingWhenExpired: true }),
  requirement({
    credentialType: "handbook",
    displayName: "Signed handbook",
    blocksSchedulingWhenExpired: false,
  }),
];

describe("uploadList — who supplies what", () => {
  it("does not ask a candidate to photograph her own background check", () => {
    // She has never seen it. Joy runs it. Asking generates a support call
    // that Joy then has to answer.
    const items = uploadList({
      applicant: applicant(),
      requirements: [
        requirement({ credentialType: "background_check", displayName: "Background check", suppliedBy: "agency" }),
        requirement({ credentialType: "cpr", displayName: "CPR card", suppliedBy: "employee" }),
      ],
    });
    expect(items.map((i) => i.credentialType)).toEqual(["cpr"]);
  });

  it("still counts it as missing for the office", () => {
    // The point is whose problem it is, not whether it is a problem.
    const reqs = [
      requirement({ credentialType: "background_check", suppliedBy: "agency" }),
      requirement({ credentialType: "cpr", suppliedBy: "employee" }),
    ];
    const readiness = firstShiftReadiness(applicant(), reqs);
    expect(readiness.missingBlocking).toContain("background_check");
    expect(readiness.ready).toBe(false);
  });
});

describe("uploadList", () => {
  it("puts what stops a first shift at the top", () => {
    // Somebody with six documents to find will do the first two. Those two
    // should be the ones keeping them off the schedule.
    const items = uploadList({ applicant: applicant(), requirements: REQS });
    expect(items[0].blocking).toBe(true);
    expect(items.at(-1)?.blocking).toBe(false);
  });

  it("uses the requirement's own name, not a second lookup table", () => {
    const items = uploadList({ applicant: applicant(), requirements: REQS });
    expect(items.map((i) => i.displayName)).toContain("CPR card");
  });

  it("moves a settled document out of the way", () => {
    const items = uploadList({
      applicant: applicant(),
      submitted: { cpr: { state: "accepted" } },
      requirements: REQS,
    });
    const cpr = items.findIndex((i) => i.credentialType === "cpr");
    const tb = items.findIndex((i) => i.credentialType === "tb");
    expect(cpr).toBeGreaterThan(tb);
  });

  it("tells somebody nothing is needed while a document is being checked", () => {
    const items = uploadList({
      applicant: applicant(),
      submitted: { cpr: { state: "in_review" } },
      requirements: REQS,
    });
    expect(items.find((i) => i.credentialType === "cpr")?.hint).toContain("Nothing more to do");
  });
});

describe("rejection wording", () => {
  it("says what to do, not what a verifier thought", () => {
    // The office needs the precise reason. The candidate needs the next action,
    // and a verifier's note is a staff member's private assessment.
    expect(resendHint("wrong_person")).toContain("Please check and send again");
    expect(resendHint("wrong_document")).toContain("send the right one");
  });

  it("falls back to something useful for a reason it has never seen", () => {
    expect(resendHint("some_new_reason_code")).toBe("Please send this one again.");
    expect(resendHint(null)).toBe("Please send this one again.");
  });

  it("never puts a code-shaped identifier on screen", () => {
    // Deliberately not "the hint must not contain the reason string": one of
    // the codes is `expired`, which is also an ordinary English word that
    // belongs in the sentence. The property is that no internal identifier
    // leaks, and identifiers here are snake_case.
    for (const reason of ["wrong_person", "wrong_document", "unreadable", "expired", "nonsense"]) {
      const hint = resendHint(reason);
      expect(hint).not.toMatch(/[a-z]+_[a-z]+/);
      // And it is a sentence a person can act on, not a fragment.
      expect(hint).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe("uploadSummary", () => {
  const item = (over: Partial<UploadItem>): UploadItem => ({
    credentialType: "x",
    displayName: "X",
    state: "needed",
    hint: "",
    blocking: false,
    ...over,
  });

  it("counts what blocks a first shift ahead of what does not", () => {
    expect(uploadSummary([item({ blocking: true }), item({})])).toBe(
      "One document is needed before your first shift.",
    );
  });

  it("does not claim everything is done while something is in review", () => {
    expect(uploadSummary([item({ state: "in_review" })])).toContain("checking the last few");
  });

  it("says thank you when there is genuinely nothing left", () => {
    expect(uploadSummary([item({ state: "accepted" })])).toBe("Everything is in. Thank you.");
  });
});

describe("checkUpload", () => {
  it("accepts the photo a phone actually takes", () => {
    expect(checkUpload({ type: "image/jpeg", size: 2_000_000 }).ok).toBe(true);
    expect(checkUpload({ type: "image/heic", size: 2_000_000 }).ok).toBe(true);
  });

  it("accepts the PDF a clinic emails", () => {
    expect(checkUpload({ type: "application/pdf", size: 500_000 }).ok).toBe(true);
  });

  it("turns away a file that is not a document, in plain words", () => {
    const r = checkUpload({ type: "video/mp4", size: 1000 });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Please send a photo or a PDF.");
  });

  it("stops a huge upload before it starts, on a phone connection", () => {
    const r = checkUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("too_large");
  });
});
