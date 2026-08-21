import { describe, expect, it } from "vitest";
import {
  isRegisteredNurse,
  rnRefusal,
  type ClinicalIdentity,
} from "@/domain/clinical/registeredNurse";

const TODAY = "2026-08-21";

const karynn: ClinicalIdentity = {
  // The owner, who is also the RN. This is the case a role check cannot express.
  role: "ceo_admin",
  rnLicence: { number: "RN-000000", state: "TX", expiresOn: "2027-04-30" },
};

const clinicalManagerNoLicence: ClinicalIdentity = { role: "rn_clinical", rnLicence: null };

const lapsed: ClinicalIdentity = {
  role: "rn_clinical",
  rnLicence: { number: "RN-111111", state: "TX", expiresOn: "2026-07-31" },
};

describe("who counts as an RN", () => {
  it("says yes to the owner who holds a licence", () => {
    // Narrowing supervisory visits to the `rn_clinical` role would have locked
    // Karynn out of the one task she personally does.
    expect(isRegisteredNurse(karynn, TODAY)).toBe(true);
  });

  it("says no to the clinical role with no licence on file", () => {
    // The title is not the licence. Texas cares about the second one.
    expect(isRegisteredNurse(clinicalManagerNoLicence, TODAY)).toBe(false);
  });

  it("says no the day after a licence expires", () => {
    expect(isRegisteredNurse(lapsed, TODAY)).toBe(false);
    expect(isRegisteredNurse(lapsed, "2026-07-31")).toBe(true);
  });

  it("says no to a scheduler, an administrator and nobody at all", () => {
    expect(isRegisteredNurse({ role: "scheduler" }, TODAY)).toBe(false);
    expect(isRegisteredNurse({ role: "ceo_admin" }, TODAY)).toBe(false);
    expect(isRegisteredNurse(null, TODAY)).toBe(false);
  });
});

describe("the refusal", () => {
  it("tells a lapsed nurse the date, because they will assume it is a bug", () => {
    expect(rnRefusal(lapsed, TODAY)).toContain("2026-07-31");
  });

  it("distinguishes no licence from an expired one", () => {
    expect(rnRefusal(clinicalManagerNoLicence, TODAY)).toContain("no RN licence on file");
  });

  it("says nothing when there is nothing to refuse", () => {
    expect(rnRefusal(karynn, TODAY)).toBe("");
  });
});
