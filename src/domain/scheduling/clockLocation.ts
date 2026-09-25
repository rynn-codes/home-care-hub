import { distanceLabel } from "@/domain/monitors/location";

/**
 * Where a clock-in happened, against where it should have.
 *
 * The phone reports a position and how sure it is; the client's address has a
 * position when the office has mapped it. The verdict is honest about both
 * gaps: no map for the address means Joy cannot say, and a phone that is only
 * sure to half a mile is not evidence of anything. Only a clear miss is
 * reported to the office, and even then the caregiver is clocked in unless the
 * agency has chosen to refuse out-of-range clocks.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DevicePoint extends GeoPoint {
  /** Metres. The phone's own estimate of how far off it might be. */
  accuracy: number;
}

export type LocationVerdict = "no_client_location" | "no_location" | "in_range" | "uncertain" | "out_of_range";

export interface LocationCheck {
  verdict: LocationVerdict;
  /** What the caregiver sees. */
  message: string;
  /** What the office sees, when the clock is worth its attention. */
  officeLine: string | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  radiusMeters: number;
}

export const DEFAULT_RADIUS_METERS = 150;
/** A reading less certain than this is no reading. */
export const MAX_USABLE_ACCURACY_METERS = 500;

const EARTH_RADIUS_METERS = 6_371_000;

export function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const la = rad(a.lat);
  const lb = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
}

export function locationCheck(input: {
  clientAt: GeoPoint | null;
  deviceAt: DevicePoint | null;
  radiusMeters?: number;
  caregiverName?: string;
  clientName?: string;
  action: "in" | "out";
}): LocationCheck {
  const radius = input.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const empty = { distanceMeters: null, accuracyMeters: null, radiusMeters: radius, officeLine: null };
  if (!input.clientAt) {
    return { ...empty, verdict: "no_client_location", message: "Clocked in. We have no map location for this address yet." };
  }
  if (!input.deviceAt || input.deviceAt.accuracy > MAX_USABLE_ACCURACY_METERS) {
    return {
      ...empty,
      accuracyMeters: input.deviceAt?.accuracy ?? null,
      verdict: "no_location",
      message: "Your phone could not work out where you are. Clocked in anyway — the office can see the location was not available.",
    };
  }
  const distance = metersBetween(input.clientAt, input.deviceAt);
  const accuracy = Math.round(input.deviceAt.accuracy);
  const base = { distanceMeters: distance, accuracyMeters: accuracy, radiusMeters: radius };
  if (distance <= radius) return { ...base, verdict: "in_range", message: "At the client's address.", officeLine: null };

  const who = input.caregiverName ?? "Somebody";
  const forWhom = input.clientName ? ` for ${input.clientName}` : "";
  const verb = input.action === "out" ? "clock out" : "clock in";
  if (distance - accuracy <= radius) {
    return {
      ...base,
      verdict: "uncertain",
      message: "Clocked in. Your phone's location is not precise enough to confirm the address.",
      officeLine: `${who} tried to ${verb}${forWhom} from ${distanceLabel(distance)} away, but the phone's location was only accurate to ${distanceLabel(accuracy)}.`,
    };
  }
  return {
    ...base,
    verdict: "out_of_range",
    message: `You are ${distanceLabel(distance)} from ${input.clientName ?? "the client"}'s address.`,
    officeLine: `${who} tried to ${verb}${forWhom} from ${distanceLabel(distance)} away.`,
  };
}

export function isOutOfRange(check: LocationCheck): boolean {
  return check.verdict === "out_of_range";
}

/** A clear miss or a doubtful one both go on the office's list. */
export function worthTellingOffice(check: LocationCheck): boolean {
  return check.verdict === "out_of_range" || check.verdict === "uncertain";
}
