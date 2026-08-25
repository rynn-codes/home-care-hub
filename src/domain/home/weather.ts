/**
 * Weather, as an operational fact rather than decoration.
 *
 * Karynn, 25 August: "In the morning brief, if there is upcoming bad weather,
 * rainy weather. Add that to the brief." And immediately after: "Only display
 * the weather if it is something you need to know — like heavy rain, flooding,
 * upcoming bad weather. I want to keep this screen as clean and calm as
 * possible. Make sure that is coded in."
 *
 * So the bar is set here, in code, rather than left to whoever writes the
 * seed or wires the provider later.
 *
 *   WHAT EARNS A LINE IN THE BRIEF
 *   1. A named advisory from the forecaster — a flood watch, a tropical
 *      storm, a freeze. Somebody whose job is weather decided this was worth
 *      announcing; Joy does not second-guess that.
 *   2. A thunderstorm. Caregivers drive between visits; storms mean late
 *      arrivals and cancelled care.
 *   3. Rain at or above HEAVY_RAIN_INCHES in a day. Houston floods on
 *      rainfall rate, and an inch is where roads start to go.
 *
 *   WHAT DOES NOT
 *   Ordinary rain, showers, cloud, wind, heat, and anything at all outside
 *   HORIZON_DAYS. "Rain tomorrow" is not news in a Gulf-coast summer, and a
 *   brief that speaks every morning is one nobody reads by Thursday.
 *
 * A clear-enough week produces no sentence, no card, and no empty space where
 * a card would have been. Silence is the default and it is the common case.
 */

export type Sky = "clear" | "cloud" | "rain" | "storm";

/**
 * A named advisory as the forecaster issued it. Anything in this list is worth
 * saying regardless of how much rain comes with it — that is the point of an
 * advisory. Gulf-coast-shaped, because Joy is in Houston.
 */
export type WeatherAlert =
  | "flood_watch"
  | "flood_warning"
  | "severe_thunderstorm"
  | "tropical_storm"
  | "hurricane"
  | "freeze";

/** Rainfall, in inches in a day, at which roads start to matter. */
export const HEAVY_RAIN_INCHES = 1;

/** How far ahead the brief looks. Three days is what an office can act on. */
export const HORIZON_DAYS = 3;

/** Advisories that mean "do not drive if you can avoid it". */
const SEVERE: readonly WeatherAlert[] = [
  "flood_warning",
  "hurricane",
  "tropical_storm",
  "severe_thunderstorm",
];

export interface Forecast {
  /** ISO date. */
  date: string;
  sky: Sky;
  high: number;
  low: number;
  /** What the forecaster called it. */
  summary: string;
  /** Expected rainfall in inches. Absent is treated as none. */
  rainInches?: number;
  /** A named advisory, if the forecaster issued one. */
  alert?: WeatherAlert;
}

/**
 * The rule, in one place, so it can be read and tested without reading the
 * component. Everything the brief chooses to stay quiet about goes through
 * here and returns false.
 */
export function worthSaying(f: Forecast): boolean {
  if (f.alert) return true;
  if (f.sky === "storm") return true;
  return f.sky === "rain" && (f.rainInches ?? 0) >= HEAVY_RAIN_INCHES;
}

export interface WeatherAdvisory {
  /** The sentence for the brief. */
  line: string;
  /** The advisories and storms take the stronger treatment; heavy rain does not. */
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
 * The brief's weather sentence, or null when there is nothing worth saying —
 * which is most mornings, by design.
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
  /** How far ahead to look. Defaults to HORIZON_DAYS. */
  horizonDays?: number;
}): WeatherAdvisory | null {
  const horizon = input.horizonDays ?? HORIZON_DAYS;
  const start = new Date(`${input.today}T12:00:00`).getTime();

  const bad = input.forecast
    .filter(worthSaying)
    .filter((f) => {
      const delta = Math.round((new Date(`${f.date}T12:00:00`).getTime() - start) / 86_400_000);
      return delta >= 0 && delta <= horizon;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (bad.length === 0) return null;

  const first = bad[0];
  const severity =
    bad.some((f) => f.sky === "storm" || (f.alert && SEVERE.includes(f.alert))) ? "warn" : "watch";

  // Name the span in the words a person would use.
  const when =
    bad.length === 1
      ? dayName(first.date, input.today)
      : `${dayName(first.date, input.today)} and ${dayName(bad[bad.length - 1].date, input.today)}`;

  const visits = input.visitsOn ? bad.reduce((n, f) => n + input.visitsOn!(f.date), 0) : 0;

  const consequence =
    visits > 0
      ? ` ${visits} ${visits === 1 ? "visit is" : "visits are"} scheduled across ${
          bad.length === 1 ? "it" : "those days"
        } — allow extra travel time.`
      : "";

  return {
    line: `${first.summary} ${when}.${consequence}`,
    severity,
    dates: bad.map((f) => f.date),
  };
}
