import { describe, expect, it } from "vitest";
import { HEAVY_RAIN_INCHES, weatherAdvisory, worthSaying, type Forecast } from "./weather";

const day = (offset: number): string => {
  const d = new Date("2026-08-25T12:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const TODAY = day(0);

const f = (offset: number, over: Partial<Forecast> = {}): Forecast => ({
  date: day(offset),
  sky: "clear",
  high: 90,
  low: 75,
  summary: "Sunny",
  ...over,
});

const heavyRain = (offset: number, over: Partial<Forecast> = {}) =>
  f(offset, { sky: "rain", summary: "Heavy rain", rainInches: 1.8, ...over });

const showers = (offset: number) =>
  f(offset, { sky: "rain", summary: "Scattered showers", rainInches: 0.2 });

describe("what is worth saying", () => {
  // Karynn, 25 August: "Only display the weather if it is something you need to
  // know… I want to keep this screen as clean and calm as possible. Make sure
  // that is coded in." These are the tests that hold that line.

  it("stays quiet about a clear day", () => {
    expect(worthSaying(f(0))).toBe(false);
  });

  it("stays quiet about cloud", () => {
    expect(worthSaying(f(0, { sky: "cloud", summary: "Cloudy" }))).toBe(false);
  });

  it("stays quiet about ordinary rain", () => {
    // The whole point. Rain in a Gulf-coast summer is not news, and a brief
    // that speaks every morning is one nobody reads by Thursday.
    expect(worthSaying(showers(0))).toBe(false);
    expect(worthSaying(f(0, { sky: "rain", summary: "Light rain" }))).toBe(false);
  });

  it("speaks when rain reaches the heavy threshold", () => {
    expect(worthSaying(f(0, { sky: "rain", summary: "Rain", rainInches: HEAVY_RAIN_INCHES }))).toBe(true);
    expect(
      worthSaying(f(0, { sky: "rain", summary: "Rain", rainInches: HEAVY_RAIN_INCHES - 0.01 })),
    ).toBe(false);
  });

  it("speaks about a thunderstorm", () => {
    expect(worthSaying(f(0, { sky: "storm", summary: "Thunderstorms" }))).toBe(true);
  });

  it("speaks about any named advisory, however little rain comes with it", () => {
    // Somebody whose job is weather decided this was worth announcing. Joy
    // does not second-guess a flood watch because the rain total looks small.
    expect(worthSaying(f(0, { alert: "flood_watch" }))).toBe(true);
    expect(worthSaying(f(0, { sky: "cloud", summary: "Cold", alert: "freeze" }))).toBe(true);
  });
});

describe("the brief's weather sentence", () => {
  it("says nothing at all about a calm week", () => {
    expect(weatherAdvisory({ forecast: [f(0), f(1), f(2), f(3)], today: TODAY })).toBeNull();
  });

  it("says nothing about a week of ordinary showers", () => {
    // A whole week of rain and the screen stays calm, because none of it is
    // anything the office would do differently for.
    expect(
      weatherAdvisory({ forecast: [showers(0), showers(1), showers(2), showers(3)], today: TODAY }),
    ).toBeNull();
  });

  it("names the soonest bad day in the words a person uses", () => {
    const a = weatherAdvisory({ forecast: [f(0), heavyRain(1), f(2)], today: TODAY });
    expect(a?.line).toBe("Heavy rain tomorrow.");
    expect(a?.severity).toBe("watch");
  });

  it("says today when it is today", () => {
    expect(weatherAdvisory({ forecast: [heavyRain(0)], today: TODAY })?.line).toBe("Heavy rain today.");
  });

  it("skips the quiet days between two bad ones", () => {
    const a = weatherAdvisory({
      forecast: [f(0), heavyRain(1), showers(2), f(3, { sky: "storm", summary: "Storms" })],
      today: TODAY,
    });
    expect(a?.dates).toEqual([day(1), day(3)]);
  });

  it("escalates to a warning for storms and severe advisories, not for heavy rain", () => {
    expect(weatherAdvisory({ forecast: [f(0, { sky: "storm", summary: "Storms" })], today: TODAY })?.severity).toBe("warn");
    expect(weatherAdvisory({ forecast: [f(0, { alert: "flood_warning" })], today: TODAY })?.severity).toBe("warn");
    expect(weatherAdvisory({ forecast: [f(0, { alert: "hurricane" })], today: TODAY })?.severity).toBe("warn");
    expect(weatherAdvisory({ forecast: [heavyRain(0)], today: TODAY })?.severity).toBe("watch");
    // A watch is not a warning: it takes the quieter treatment.
    expect(weatherAdvisory({ forecast: [heavyRain(0, { alert: "flood_watch" })], today: TODAY })?.severity).toBe("watch");
  });

  it("looks three days ahead and no further", () => {
    // A storm next week is not something this morning's office can act on.
    expect(weatherAdvisory({ forecast: [f(0), f(1), f(2), f(3), f(4, { sky: "storm", summary: "Storms" })], today: TODAY })).toBeNull();
    expect(weatherAdvisory({ forecast: [f(0), f(1), f(2), f(3, { sky: "storm", summary: "Storms" })], today: TODAY })).not.toBeNull();
  });

  it("never looks backwards", () => {
    expect(
      weatherAdvisory({ forecast: [f(-1, { sky: "storm", summary: "Storms" }), f(0), f(1)], today: TODAY }),
    ).toBeNull();
  });

  it("carries the consequence when it knows the schedule", () => {
    const a = weatherAdvisory({
      forecast: [f(0), heavyRain(1), f(2, { sky: "storm", summary: "Storms" })],
      today: TODAY,
      visitsOn: (d) => (d === day(1) ? 4 : d === day(2) ? 3 : 0),
    });
    expect(a?.line).toContain("7 visits are scheduled across those days");
    expect(a?.line).toContain("allow extra travel time");
  });

  it("counts one visit in the singular", () => {
    const a = weatherAdvisory({
      forecast: [f(0), heavyRain(1)],
      today: TODAY,
      visitsOn: (d) => (d === day(1) ? 1 : 0),
    });
    expect(a?.line).toContain("1 visit is scheduled across it");
  });

  it("counts only the days it is actually warning about", () => {
    // The showers on day 2 are not in the advisory, so their visits are not in
    // the count — a number in a brief has to be a number somebody can check.
    const a = weatherAdvisory({
      forecast: [f(0), heavyRain(1), showers(2)],
      today: TODAY,
      visitsOn: () => 5,
    });
    expect(a?.line).toContain("5 visits are scheduled across it");
  });

  it("drops the consequence when nothing is scheduled into the weather", () => {
    const a = weatherAdvisory({ forecast: [f(0), heavyRain(1)], today: TODAY, visitsOn: () => 0 });
    expect(a?.line).toBe("Heavy rain tomorrow.");
  });
});
