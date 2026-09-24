/**
 * Where Joy Health takes clients, by ZIP.
 *
 * Joy is licensed in Texas and works greater Houston. A lead's ZIP is the
 * one thing the office can check in the first ten seconds of a call, so the
 * lead form confirms it as it is typed: in the area, in the state but not on
 * our list, or out of state altogether.
 *
 * The city map is the Houston suburbs Joy actually reaches, not a gazetteer.
 * A ZIP in Texas that is not on it still saves — it just asks for the city.
 */

const TEXAS_ZIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [75000, 79999],
  [88500, 88599],
];

export function zipDigits(input: string): string {
  return input.replace(/\D+/g, "").slice(0, 5);
}

export function isCompleteZip(input: string): boolean {
  return zipDigits(input).length === 5;
}

export function isTexasZip(input: string): boolean {
  const n = Number(zipDigits(input));
  return Number.isInteger(n) ? TEXAS_ZIP_RANGES.some(([lo, hi]) => n >= lo && n <= hi) : false;
}

const CITY_BY_ZIP: Record<string, string> = {
  77401: "Bellaire",
  77406: "Richmond",
  77407: "Richmond",
  77469: "Richmond",
  77459: "Missouri City",
  77477: "Stafford",
  77478: "Sugar Land",
  77479: "Sugar Land",
  77487: "Sugar Land",
  77496: "Sugar Land",
  77449: "Katy",
  77450: "Katy",
  77493: "Katy",
  77494: "Katy",
  77581: "Pearland",
  77584: "Pearland",
  77588: "Pearland",
  77546: "Friendswood",
  77573: "League City",
  77598: "Webster",
  77502: "Pasadena",
  77503: "Pasadena",
  77504: "Pasadena",
  77505: "Pasadena",
  77506: "Pasadena",
  77507: "Pasadena",
  77338: "Humble",
  77346: "Humble",
  77396: "Humble",
  77339: "Kingwood",
  77345: "Kingwood",
  77373: "Spring",
  77379: "Spring",
  77383: "Spring",
  77386: "Spring",
  77388: "Spring",
  77380: "The Woodlands",
  77381: "The Woodlands",
  77382: "The Woodlands",
  77384: "The Woodlands",
  77389: "The Woodlands",
  77375: "Tomball",
  77377: "Tomball",
  77429: "Cypress",
  77433: "Cypress",
  77520: "Baytown",
  77521: "Baytown",
  77523: "Baytown",
  77301: "Conroe",
  77302: "Conroe",
  77303: "Conroe",
  77304: "Conroe",
  77306: "Conroe",
};

/** The city for a ZIP Joy serves, or null when it is not one we know. */
export function cityForZip(input: string): string | null {
  const zip = zipDigits(input);
  if (zip.length !== 5) return null;
  if (CITY_BY_ZIP[zip]) return CITY_BY_ZIP[zip];
  const n = Number(zip);
  return n >= 77001 && n <= 77099 ? "Houston" : null;
}

const COUNTY_BY_ZIP: Record<string, string> = {
  77406: "Fort Bend",
  77407: "Fort Bend",
  77469: "Fort Bend",
  77477: "Fort Bend",
  77478: "Fort Bend",
  77479: "Fort Bend",
  77487: "Fort Bend",
  77496: "Fort Bend",
  77401: "Harris",
  77449: "Harris",
  77450: "Harris",
  77598: "Harris",
  77502: "Harris",
  77503: "Harris",
  77504: "Harris",
  77505: "Harris",
  77506: "Harris",
  77507: "Harris",
  77338: "Harris",
  77346: "Harris",
  77396: "Harris",
  77339: "Harris",
  77345: "Harris",
  77373: "Harris",
  77379: "Harris",
  77383: "Harris",
  77388: "Harris",
  77375: "Harris",
  77377: "Harris",
  77429: "Harris",
  77433: "Harris",
  77520: "Harris",
  77521: "Harris",
  77581: "Brazoria",
  77584: "Brazoria",
  77588: "Brazoria",
  77573: "Galveston",
  77380: "Montgomery",
  77381: "Montgomery",
  77382: "Montgomery",
  77384: "Montgomery",
  77301: "Montgomery",
  77302: "Montgomery",
  77303: "Montgomery",
  77304: "Montgomery",
  77306: "Montgomery",
};

export function countyForZip(input: string): string | null {
  const zip = zipDigits(input);
  if (zip.length !== 5) return null;
  if (COUNTY_BY_ZIP[zip]) return COUNTY_BY_ZIP[zip];
  const n = Number(zip);
  return n >= 77001 && n <= 77099 ? "Harris" : null;
}

export type ServiceAreaStatus = "unknown" | "out_of_state" | "in_state" | "in_area";

export interface ServiceAreaCheck {
  status: ServiceAreaStatus;
  city: string | null;
  /** What the form says under the field. */
  text: string;
}

export function serviceAreaForZip(input: string): ServiceAreaCheck {
  if (!isCompleteZip(input)) {
    return { status: "unknown", city: null, text: "Enter a ZIP to confirm the service area." };
  }
  if (!isTexasZip(input)) {
    return {
      status: "out_of_state",
      city: null,
      text: "Joy Health only takes clients in Texas — that ZIP is out of state.",
    };
  }
  const city = cityForZip(input);
  return city
    ? { status: "in_area", city, text: `${city} is inside the Joy Health service area.` }
    : { status: "in_state", city: null, text: "That ZIP is in Texas. Add the city — it is not one we have on file yet." };
}

/** "(713) 555-0100" as the digits arrive. Leaves anything over ten digits alone. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  const n = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (n.length > 10) return raw;
  if (n.length === 0) return "";
  if (n.length <= 3) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}
