import { describe, expect, it } from "vitest";
import { HOLIDAY_LABELS, easterSunday, holidayOn, holidaysFor } from "@/domain/billing/holidays";

describe("the seven holidays in the service agreement", () => {
  it("is exactly the seven the client signed", () => {
    // Not the federal list. A client charged 1.5× for Veterans Day would be
    // charged something they never agreed to.
    expect(Object.keys(HOLIDAY_LABELS).sort()).toEqual([
      "christmas_day",
      "easter_sunday",
      "independence_day",
      "labor_day",
      "memorial_day",
      "new_years_day",
      "thanksgiving",
    ]);
  });

  it("finds the fixed ones", () => {
    const h = holidaysFor(2026);
    expect(h.new_years_day).toBe("2026-01-01");
    expect(h.independence_day).toBe("2026-07-04");
    expect(h.christmas_day).toBe("2026-12-25");
  });

  it("computes the moving ones rather than listing them", () => {
    // A hardcoded table is correct until January and silently wrong after.
    const h2026 = holidaysFor(2026);
    expect(h2026.memorial_day).toBe("2026-05-25");
    expect(h2026.labor_day).toBe("2026-09-07");
    expect(h2026.thanksgiving).toBe("2026-11-26");

    const h2027 = holidaysFor(2027);
    expect(h2027.memorial_day).toBe("2027-05-31");
    expect(h2027.labor_day).toBe("2027-09-06");
    expect(h2027.thanksgiving).toBe("2027-11-25");
  });

  it("gets Easter right across several years", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
    expect(easterSunday(2030)).toBe("2030-04-21");
  });

  it("identifies a holiday from a visit's date", () => {
    expect(holidayOn("2026-12-25T09:00:00")).toBe("christmas_day");
    expect(holidayOn("2026-11-26T09:00:00")).toBe("thanksgiving");
    expect(holidayOn("2026-12-24T09:00:00")).toBeNull();
  });

  it("does not let a timezone move a shift onto a holiday", () => {
    // 9pm Christmas Eve in Houston is already Christmas Day in UTC. Billing
    // 1.5× for that would be a charge the client never agreed to.
    expect(holidayOn("2026-12-24T21:00:00")).toBeNull();
  });
});
