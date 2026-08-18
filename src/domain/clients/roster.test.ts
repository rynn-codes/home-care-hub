import { describe, expect, it } from "vitest";
import {
  ageOn,
  buildClientRecord,
  clientCompliance,
  refusedConsents,
  searchRoster,
  sortRoster,
  type ClientInput,
} from "@/domain/clients/roster";

const TODAY = "2026-08-18";

const base: ClientInput = {
  personId: "per-1",
  firstName: "Ada",
  lastName: "Fenwick",
  dateOfBirth: "1944-03-02",
  admissionDate: "2026-01-10",
  signedAt: "2026-01-08T15:00:00.000Z",
  decisions: {},
};

describe("compliance clock", () => {
  // The packet's own expiry clauses. Getting these wrong means the agency
  // believes it holds a valid authorization when it does not.
  it("expires the records authorizations twelve months after signature", () => {
    const items = clientCompliance(base, TODAY);
    const disclose = items.find((i) => i.key === "disclose_records");
    expect(disclose?.dueOn).toBe("2027-01-08");
    expect(disclose?.state).toBe("ok");
  });

  it("runs the annual supervisory visit from start of care, not from signing", () => {
    const items = clientCompliance(base, TODAY);
    // Signed 8 Jan, care started 10 Jan. The visit is due from the later date.
    expect(items.find((i) => i.key === "annual_supervision")?.dueOn).toBe("2027-01-10");
  });

  it("flags an authorization that has already lapsed", () => {
    const items = clientCompliance({ ...base, signedAt: "2025-06-01T00:00:00.000Z" }, TODAY);
    const disclose = items.find((i) => i.key === "disclose_records");
    expect(disclose?.state).toBe("overdue");
    expect(disclose?.daysRemaining).toBeLessThan(0);
  });

  it("gives warning before it lapses, not on the day", () => {
    // Signed 1 October 2025, so it expires 1 October 2026 — inside the window.
    const items = clientCompliance({ ...base, signedAt: "2025-10-01T00:00:00.000Z" }, TODAY);
    expect(items.find((i) => i.key === "disclose_records")?.state).toBe("due_soon");
  });

  // A February renewal must not silently gain three days.
  it("clamps a month-end signature rather than rolling into the next month", () => {
    const items = clientCompliance({ ...base, signedAt: "2026-01-31T00:00:00.000Z" }, TODAY);
    expect(items.find((i) => i.key === "disclose_records")?.dueOn).toBe("2027-01-31");

    const feb = clientCompliance(
      { ...base, admissionDate: null, signedAt: "2024-02-29T00:00:00.000Z" },
      TODAY,
    );
    expect(feb.find((i) => i.key === "disclose_records")?.dueOn).toBe("2025-02-28");
  });

  // activateClient records a start date; other callers hand over a full
  // timestamp. Parsing "2026-06-01T00:00:00.000Z" + "T00:00:00Z" threw and took
  // the whole client record down with it.
  it("accepts a date or a full timestamp without throwing", () => {
    const fromTimestamp = clientCompliance(
      { ...base, admissionDate: "2026-01-10T09:30:00.000Z" },
      TODAY,
    );
    expect(fromTimestamp.find((i) => i.key === "annual_supervision")?.dueOn).toBe("2027-01-10");
  });

  it("treats an unparseable date as nothing on file rather than crashing", () => {
    const items = clientCompliance({ ...base, signedAt: "not a date" }, TODAY);
    expect(items.find((i) => i.key === "disclose_records")?.state).toBe("missing");
  });

  it("reports a client who never signed as missing, not as overdue", () => {
    const items = clientCompliance({ ...base, signedAt: null, admissionDate: null }, TODAY);
    expect(items.every((i) => i.state === "missing")).toBe(true);
    expect(items.every((i) => i.dueOn === null)).toBe(true);
  });

  // Nagging about a refused authorization would push someone to go back and
  // ask again until they got a different answer.
  it("does not chase an authorization the client declined", () => {
    const items = clientCompliance(
      { ...base, decisions: { disclose_medical_records: "decline" } },
      TODAY,
    );
    expect(items.map((i) => i.key)).not.toContain("disclose_records");
    expect(items.map((i) => i.key)).toContain("release_records");
  });

  it("stops the clock once a client is discharged", () => {
    const record = buildClientRecord(
      { ...base, status: "discharged", signedAt: "2024-01-01T00:00:00.000Z" },
      TODAY,
    );
    expect(record.compliance).toEqual([]);
    expect(record.needsAttention).toEqual([]);
  });
});

describe("client record", () => {
  it("carries refusals through as caregiver restrictions", () => {
    const record = buildClientRecord(
      { ...base, decisions: { transportation: "decline", photograph: "decline" } },
      TODAY,
    );
    expect(record.restrictions.join(" ")).toMatch(/must not drive/i);
    expect(record.restrictions.join(" ")).toMatch(/no photographs/i);
    expect(refusedConsents(record.decisions).map((c) => c.key)).toEqual(
      expect.arrayContaining(["transportation", "photograph"]),
    );
  });

  it("computes age from date of birth as of a given day", () => {
    expect(ageOn("1944-03-02", TODAY)).toBe(82);
    // The day before their birthday they are still the younger age.
    expect(ageOn("1944-08-19", TODAY)).toBe(81);
    expect(ageOn(null, TODAY)).toBeNull();
  });

  it("prefers what the client is called over their legal first name", () => {
    const record = buildClientRecord({ ...base, preferredName: "Addie" }, TODAY);
    expect(record.name).toBe("Ada Fenwick");
    expect(record.preferredName).toBe("Addie");
    expect(record.initials).toBe("AF");
  });
});

describe("directory ordering", () => {
  const make = (name: string, signedAt: string | null, status?: ClientInputStatus) =>
    buildClientRecord(
      { ...base, personId: name, firstName: name, lastName: "X", signedAt, admissionDate: signedAt, status },
      TODAY,
    );
  type ClientInputStatus = ClientInput["status"];

  // Alphabetical order hides the one person whose authorization lapsed behind
  // twenty who are fine.
  it("puts clients needing attention above clients who are fine", () => {
    const fine = make("Zoe", "2026-06-01T00:00:00.000Z");
    const lapsed = make("Abe", "2025-01-01T00:00:00.000Z");
    const order = sortRoster([fine, lapsed]).map((c) => c.name);
    expect(order[0]).toBe("Abe X");
  });

  it("sinks discharged clients to the bottom even when their papers lapsed", () => {
    const discharged = make("Abe", "2020-01-01T00:00:00.000Z", "discharged");
    const active = make("Zoe", "2026-06-01T00:00:00.000Z");
    expect(sortRoster([discharged, active]).map((c) => c.name)).toEqual(["Zoe X", "Abe X"]);
  });

  it("searches name, location, payer, caregiver and services together", () => {
    const record = buildClientRecord(
      { ...base, caregiver: "Chanel P", services: ["Personal Care"], location: "Katy" },
      TODAY,
    );
    expect(searchRoster([record], "chanel")).toHaveLength(1);
    expect(searchRoster([record], "katy")).toHaveLength(1);
    expect(searchRoster([record], "personal")).toHaveLength(1);
    expect(searchRoster([record], "nobody")).toHaveLength(0);
    expect(searchRoster([record], "  ")).toHaveLength(1);
  });
});
