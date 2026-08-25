/**
 * Weather, as an operational fact rather than decoration.
 *
 * Karynn, 25 August: "In the morning brief, if there is upcoming bad weather,
 * rainy weather. Add that to the brief."
 *
 * For a home-care agency this is not small talk. Caregivers drive between
 * visits; storms mean late arrivals, cancelled visits and, on the Gulf coast,
 * the emergency-priority levels the assessment records for every client. The
 * brief should say it before the office finds out from a phone call.
 *
 * The rule: name the soonest bad day, say what is scheduled into it, and stop.
 * A forecast for a clear week produces no sentence at all — the brief stays
 * short when the news is nothing.
 */

export type Sky = "clear" | "cloud" | "rain" | "storm";

export interface Forecast {
  /** ISO date. */
  date: string;
  sky: Sky;
  high: number;
  low: number;
  /** What the forecaster called it. */
  summary: string;
}

/** Rain and storms are worth a sentence; cloud is not. */
const isBad = (s: Sky) => s === "rain" || s === "storm";

export interface WeatherAdvisory {
  /** The sentence for the brief. */
  line: string;
  /** Storm days earn the stronger treatment. */
  severity: "watch" | "warn";
  /** The dates the advisory covers, for anything that wants to mark them. */
  dates: string[];
}

const dayName = (iso: string, today: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const delta = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  return d.toLocaleDateString([], { weekday: "long" });
};

/**
 * The brief's weather sentence, or null when the week is fine.
 *
 * `visitsOn` lets the caller say how many visits fall on a given date, so the
 * sentence can carry the consequence rather than only the forecast. Pass
 * nothing and it simply names the weather.
 */
export function weatherAdvisory(input: {
  forecast: readonly Forecast[];
  today: string;
  /** How many visits are scheduled on a date. */
  visitsOn?: (date: string) => number;
  /** How far ahead to look. Three days is what an office can act on. */
  horizonDays?: number;
}): WeatherAdvisory | null {
  const horizon = input.horizonDays ?? 3;
  const start = new Date(`${input.today}T12:00:00`).getTime();

  const bad = input.forecast
    .filter((f) => isBad(f.sky))
    .filter((f) => {
      const delta = Math.round((new Date(`${f.date}T12:00:00`).getTime() - start) / 86_400_000);
      return delta >= 0 && delta <= horizon;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (bad.length === 0) return null;

  const first = bad[0];
  const severity = bad.some((f) => f.sky === "storm") ? "warn" : "watch";

  // Name the span in the words a person would use.
  const when =
    bad.length === 1
      ? dayName(first.date, input.today)
      : `${dayName(first.date, input.today)} and ${dayName(bad[bad.length - 1].date, input.today)}`;

  const visits = input.visitsOn
    ? bad.reduce((n, f) => n + input.visitsOn!(f.date), 0)
    : 0;

  const consequence =
    visits > 0
      ? ` ${visits} ${visits === 1 ? "visit is" : "visits are"} scheduled across ${bad.length === 1 ? "it" : "those days"} — allow extra travel time.`
      : "";

  return {
    line: `${first.summary} ${when}.${consequence}`,
    severity,
    dates: bad.map((f) => f.date),
  };
}
