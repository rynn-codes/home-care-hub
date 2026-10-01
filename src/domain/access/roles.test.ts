import { describe, expect, it } from "vitest";
import { AUDITOR_AREAS, BOOKKEEPER_AREAS, FINANCE_AREAS, areaForPath, canDoClinical, canView, canWrite, configureOperationsFinance, landingFor, readOnlyReason, whyNotArea } from "./roles";

describe("the auditor role", () => {
  it("sees only the allowlisted areas", () => {
    for (const area of AUDITOR_AREAS) expect(canView("auditor", area)).toBe(true);
    expect(canView("auditor", "billing")).toBe(false);
    expect(canView("auditor", "people")).toBe(false);
    expect(canView("auditor", "settings")).toBe(false);
  });

  it("cannot write, and says why", () => {
    expect(canWrite("auditor")).toBe(false);
    expect(readOnlyReason("auditor")).toMatch(/read-only/);
    expect(readOnlyReason("ceo_admin")).toBeNull();
  });

  it("lands on the first granted area rather than Home", () => {
    expect(landingFor("auditor")).toBe("/clients");
    expect(landingFor("ceo_admin")).toBe("/");
  });

  it("names the area it refuses", () => {
    expect(whyNotArea("auditor", "billing")).toContain("Billing");
    expect(whyNotArea("ceo_admin", "billing")).toBe("");
  });
});

describe("the bookkeeper role", () => {
  it("sees Reports and Billing and nothing about care", () => {
    expect(BOOKKEEPER_AREAS).toEqual(["reports", "billing"]);
    for (const area of BOOKKEEPER_AREAS) expect(canView("bookkeeper", area)).toBe(true);
    for (const area of ["home", "clients", "employees", "scheduling", "payroll", "documents", "settings", "audit", "incidents", "supervision"] as const) {
      expect(canView("bookkeeper", area)).toBe(false);
    }
  });

  it("can record a payment — it is not a read-only session", () => {
    expect(canWrite("bookkeeper")).toBe(true);
    expect(readOnlyReason("bookkeeper")).toBeNull();
  });

  it("lands on Reports and is told why a screen is not theirs", () => {
    expect(landingFor("bookkeeper")).toBe("/reports");
    expect(whyNotArea("bookkeeper", "clients")).toContain("not part of your role");
  });
});

describe("the owner, the RN, Operations and Finance", () => {
  it("lets the owner see everything", () => {
    for (const area of ["settings", "billing", "payroll", "reports", "clients"] as const) expect(canView("ceo_admin", area)).toBe(true);
  });

  it("keeps the money from the RN", () => {
    for (const area of FINANCE_AREAS) expect(canView("rn_clinical", area)).toBe(false);
    for (const area of ["clients", "admissions", "supervision", "scheduling", "documents"] as const) expect(canView("rn_clinical", area)).toBe(true);
  });

  it("keeps the money and the RN's duties from Operations until the owner lets them in", () => {
    configureOperationsFinance([]);
    for (const area of FINANCE_AREAS) expect(canView("operations", area)).toBe(false);
    expect(canView("operations", "scheduling")).toBe(true);
    expect(canView("operations", "hiring")).toBe(true);
    expect(canDoClinical("operations")).toBe(false);
    expect(canDoClinical("rn_clinical")).toBe(true);
    expect(canDoClinical("ceo_admin")).toBe(true);

    configureOperationsFinance(["billing"]);
    expect(canView("operations", "billing")).toBe(true);
    expect(canView("operations", "payroll")).toBe(false);
    configureOperationsFinance([]);
  });

  it("gives Finance the money and the records it bills against, nothing clinical", () => {
    for (const area of ["billing", "payroll", "reports", "clients"] as const) expect(canView("finance", area)).toBe(true);
    for (const area of ["admissions", "supervision", "incidents", "settings", "hiring"] as const) expect(canView("finance", area)).toBe(false);
    expect(canDoClinical("finance")).toBe(false);
  });
});

describe("the router's reading of a path", () => {
  it("takes the longest prefix", () => {
    expect(areaForPath("/reports/audit/evv")).toBe("audit");
    expect(areaForPath("/reports/supervision")).toBe("supervision");
    expect(areaForPath("/reports/investor")).toBe("reports");
    expect(areaForPath("/brain/my-work")).toBe("my_work");
    expect(areaForPath("/brain/operations")).toBe("brain");
    expect(areaForPath("/")).toBe("home");
    expect(areaForPath("/nothing")).toBeNull();
  });
});
