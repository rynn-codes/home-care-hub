import type { Forecast } from "@/domain/home/weather";

/**
 * A seeded Houston forecast, anchored to the current agency week.
 *
 * SEEDED, NOT LIVE. Joy has no weather provider wired; this is demo data so the
 * brief's rule can be seen working, and every surface that prints it says so.
 * Swapping in a real forecast means replacing this file — `weatherAdvisory`
 * and the brief read the `Forecast` shape and nothing else.
 *
 * The week deliberately turns: two clear days, then Gulf-coast rain arriving
 * midweek. A forecast where nothing happens would demonstrate nothing.
 */
const today = new Date();
const day = (offset: number): string => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const seedForecast: Forecast[] = [
  { date: day(0), sky: "clear", high: 96, low: 78, summary: "Sunny and hot" },
  { date: day(1), sky: "cloud", high: 94, low: 77, summary: "Cloud building" },
  { date: day(2), sky: "rain", high: 88, low: 76, summary: "Heavy rain moving in" },
  { date: day(3), sky: "storm", high: 85, low: 75, summary: "Thunderstorms" },
  { date: day(4), sky: "rain", high: 87, low: 75, summary: "Showers easing" },
  { date: day(5), sky: "cloud", high: 91, low: 76, summary: "Drying out" },
  { date: day(6), sky: "clear", high: 95, low: 78, summary: "Clear again" },
];

/** Today's conditions, for the strip at the top of Home. */
export const todaysWeather = seedForecast[0];
