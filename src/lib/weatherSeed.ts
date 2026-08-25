import type { Forecast } from "@/domain/home/weather";

/**
 * A seeded Houston forecast, anchored to today.
 *
 * SEEDED, NOT LIVE. Joy has no weather provider wired; this is demo data so
 * the brief's rule can be seen working, and every surface that prints it says
 * so. Swapping in a real forecast means replacing this file — `weatherAdvisory`
 * reads the `Forecast` shape and nothing else.
 *
 * The week is built to exercise the threshold in both directions, because a
 * seed where everything qualifies proves nothing about a rule whose job is
 * mostly to stay quiet:
 *
 *   day 0  clear                        — silent
 *   day 1  cloud                        — silent
 *   day 2  HEAVY rain, 1.8"             — SPEAKS
 *   day 3  storm under a flood watch    — SPEAKS, and takes the amber
 *   day 4  ordinary showers, 0.2"       — SILENT, and this is the point
 *   day 5  cloud                        — silent
 *   day 6  clear                        — silent
 *
 * Day 4 is the one that matters. It is rain, it is within the horizon, and the
 * brief says nothing about it — which is Karynn's instruction, 25 August, that
 * the screen stay calm and only speak when there is something to know.
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
  { date: day(2), sky: "rain", high: 88, low: 76, summary: "Heavy rain moving in", rainInches: 1.8 },
  {
    date: day(3),
    sky: "storm",
    high: 85,
    low: 75,
    summary: "Storms and street flooding likely",
    rainInches: 2.4,
    alert: "flood_watch",
  },
  { date: day(4), sky: "rain", high: 87, low: 75, summary: "Scattered showers", rainInches: 0.2 },
  { date: day(5), sky: "cloud", high: 91, low: 76, summary: "Drying out" },
  { date: day(6), sky: "clear", high: 95, low: 78, summary: "Clear again" },
];

/** Today's conditions, for the strip at the top of Home. */
export const todaysWeather = seedForecast[0];
