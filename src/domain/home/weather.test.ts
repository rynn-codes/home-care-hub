import { describe, expect, it } from "vitest";
import { weatherAdvisory, type Forecast } from "./weather";

const day = (offset: number): string => {
  const d = new Date("2026-08-25T12:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const TODAY = day(0);

const forecast = (...skies: Forecast["sky"][]): Forecast[] =>
  skies.map((sky, i) => ({
    date: day(i),
    sky,
    high: 90,
    low: 75,
    summary: { clear: "Sunny", cloud: "Cloudy", rain: "Heavy rain", storm: "Thunderstorms" }[sky],
  }));

describe("the brief's weather sentence", () => {
  it("says nothing at all about a clear week", () => {
    // The brief stays short when the news is nothing. An advisory that always
    // fires is an advisory nobody reads.
    expect(weatherAdvisory({ forecast: forecast("clear", "cloud", "clear"), today: TODAY })).toBeNull();
  });

  it("ignores cloud", () => {
    expect(weatherAdvisory({ forecast: forecast("cloud", "cloud", "cloud"), today: TODAY })).toBeNull();
  });

  it("names the soonest bad day in the words a person uses", () => {
    const a = weatherAdvisory({ forecast: forecast("clear", "rain", "clear"), today: TODAY });
    expect(a?.line).toBe("Heavy rain tomorrow.");
    expect(a?.severity).toBe("watch");
  });

  it("says today when it is today", () => {
    expect(weatherAdvisory({ forecast: forecast("rain"), today: TODAY })?.line).toBe("Heavy rain today.");
  });

  it("spans to the last bad day when there is more than one", () => {
    const a = weatherAdvisory({ forecast: forecast("clear", "rain", "storm"), today: TODAY });
    expect(a?.line).toMatch(/^Heavy rain tomorrow and \w+day\.$/);
    expect(a?.dates).toEqual([day(1), day(2)]);
  });

  it("escalates to a warning when a storm is in the span", () => {
    expect(weatherAdvisory({ forecast: forecast("clear", "storm"), today: TODAY })?.severity).toBe("warn");
    expect(weatherAdvisory({ forecast: forecast("clear", "rain"), today: TODAY })?.severity).toBe("watch");
  });

  it("looks three days ahead and no further", () => {
    // Rain next week is not something this morning's office can act on.
    expect(weatherAdvisory({ forecast: forecast("clear", "clear", "clear", "clear", "storm"), today: TODAY })).toBeNull();
    expect(weatherAdvisory({ forecast: forecast("clear", "clear", "clear", "storm"), today: TODAY })).not.toBeNull();
  });

  it("never looks backwards", () => {
    const yesterday: Forecast[] = [
      { date: day(-1), sky: "storm", high: 80, low: 70, summary: "Thunderstorms" },
      ...forecast("clear", "clear"),
    ];
    expect(weatherAdvisory({ forecast: yesterday, today: TODAY })).toBeNull();
  });

  it("carries the consequence when it knows the schedule", () => {
    const a = weatherAdvisory({
      forecast: forecast("clear", "rain", "storm"),
      today: TODAY,
      visitsOn: (d) => (d === day(1) ? 4 : d === day(2) ? 3 : 0),
    });
    expect(a?.line).toContain("7 visits are scheduled across those days");
    expect(a?.line).toContain("allow extra travel time");
  });

  it("counts one visit in the singular", () => {
    const a = weatherAdvisory({
      forecast: forecast("clear", "rain"),
      today: TODAY,
      visitsOn: (d) => (d === day(1) ? 1 : 0),
    });
    expect(a?.line).toContain("1 visit is scheduled across it");
  });

  it("drops the consequence when nothing is scheduled into the weather", () => {
    const a = weatherAdvisory({
      forecast: forecast("clear", "rain"),
      today: TODAY,
      visitsOn: () => 0,
    });
    expect(a?.line).toBe("Heavy rain tomorrow.");
  });
});
