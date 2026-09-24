/**
 * Approved service locations.
 *
 * Care is delivered at the client's home unless the office has approved
 * somewhere else — a daughter's house, a day centre, a dialysis clinic. A
 * caregiver can propose a place from the field; it sits as pending until a
 * person approves or declines it, and a clock-out taken there says so.
 */

export type LocationStatus = "primary" | "approved" | "pending";

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  primary: "Primary",
  approved: "Approved",
  pending: "Pending",
};

export interface ApprovedLocation {
  id: string;
  clientPersonId: string;
  label: string;
  address: string | null;
  status: LocationStatus;
  addedBy: string;
  addedOn: string;
  decidedBy?: string;
  decidedOn?: string;
}

export function homeLocation(clientPersonId: string): ApprovedLocation {
  return { id: `${clientPersonId}:home`, clientPersonId, label: "Client's home", address: null, status: "primary", addedBy: "", addedOn: "" };
}

/** A client's locations, home first, then approved, then pending. */
export function locationsFor(all: readonly ApprovedLocation[], clientPersonId: string): ApprovedLocation[] {
  const mine = all.filter((l) => l.clientPersonId === clientPersonId);
  const home = mine.find((l) => l.id === `${clientPersonId}:home`) ?? homeLocation(clientPersonId);
  const rest = mine.filter((l) => l.id !== home.id);
  const order: Record<LocationStatus, number> = { primary: 0, approved: 1, pending: 2 };
  return [home, ...rest.sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label))];
}

export function searchLocations(list: readonly ApprovedLocation[], query: string): ApprovedLocation[] {
  const q = query.trim().toLowerCase();
  return q === "" ? [...list] : list.filter((l) => l.label.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q));
}

export function proposeLocation(input: { clientPersonId: string; label: string; address: string; by: string; at: string }): ApprovedLocation {
  return {
    id: `loc-${input.clientPersonId}-${input.at}`,
    clientPersonId: input.clientPersonId,
    label: input.label.trim() || input.address.trim(),
    address: input.address.trim() || null,
    status: "pending",
    addedBy: input.by,
    addedOn: input.at,
  };
}

export function validateProposal(input: { label: string; address: string }): string | null {
  if (input.address.trim() === "") return "Type the address.";
  if (input.label.trim() === "") return "Give it a name — what the family calls it.";
  return null;
}

export function isPending(location: ApprovedLocation | null | undefined): boolean {
  return location?.status === "pending";
}

/** Where a clock event was taken. */
export type ClockPlaceKind = "service_address" | "other" | "not_recorded";

export const CLOCK_PLACE_LABELS: Record<ClockPlaceKind, string> = {
  service_address: "The client's home",
  other: "Somewhere else",
  not_recorded: "Not recorded",
};

export interface ClockPlace {
  kind: ClockPlaceKind;
  where: string;
}

export function validateClockPlace(place: ClockPlace): string | null {
  return place.kind === "other" && place.where.trim() === "" ? "Say where the clock-out was taken." : null;
}
