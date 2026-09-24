import { useSyncExternalStore } from "react";
import type { TagArea } from "@/domain/agency/tagPresets";
import {
  AGENCY_SWITCHES,
  DEFAULT_AGENCY_SETTINGS,
  type AgencyProfile,
  type AgencySettings,
  type NotificationSettings,
} from "@/domain/agency/settings";

/**
 * Agency settings, kept apart from the demo's record store.
 *
 * Settings are read on almost every screen and written on one, so they get
 * their own tiny external store rather than a slot in DemoDataProvider —
 * changing the geofence must not re-render every consumer of every record.
 *
 * The loader reads field by field, so a blob written by an older build fills
 * in whatever it lacks from the defaults instead of leaving a screen reading
 * `undefined`.
 */
const KEY = "joy.agency";

let current: AgencySettings = load();
const listeners = new Set<() => void>();

function load(): AgencySettings {
  const d = DEFAULT_AGENCY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<AgencySettings> & { tagPresets?: Partial<Record<TagArea, unknown>> };
    return {
      profile: { ...d.profile, ...(p.profile ?? {}) },
      calendarStart: p.calendarStart ?? d.calendarStart,
      planOfCare: p.planOfCare ?? d.planOfCare,
      earlyClockInGraceMinutes:
        typeof p.earlyClockInGraceMinutes === "number" ? p.earlyClockInGraceMinutes : d.earlyClockInGraceMinutes,
      geofenceMeters: typeof p.geofenceMeters === "number" ? p.geofenceMeters : d.geofenceMeters,
      missedClockInEscalationMinutes:
        typeof p.missedClockInEscalationMinutes === "number"
          ? p.missedClockInEscalationMinutes
          : d.missedClockInEscalationMinutes,
      mileageRatePerMile: typeof p.mileageRatePerMile === "number" ? p.mileageRatePerMile : d.mileageRatePerMile,
      profileUndoHours:
        typeof p.profileUndoHours === "number" && p.profileUndoHours > 0 ? p.profileUndoHours : d.profileUndoHours,
      tagPresets: {
        employees: Array.isArray(p.tagPresets?.employees)
          ? (p.tagPresets.employees as string[])
          : [...d.tagPresets.employees],
        documents: Array.isArray(p.tagPresets?.documents)
          ? (p.tagPresets.documents as string[])
          : [...d.tagPresets.documents],
      },
      profitVisibleTo: Array.isArray(p.profitVisibleTo) ? p.profitVisibleTo : d.profitVisibleTo,
      switches: Object.fromEntries(
        AGENCY_SWITCHES.map((s) => [s.key, (p.switches ?? {})[s.key] ?? s.default]),
      ),
      notifications: { ...d.notifications, ...(p.notifications ?? {}) },
    };
  } catch {
    return d;
  }
}

function write(next: AgencySettings) {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Settings that cannot persist still apply for the session.
  }
  listeners.forEach((l) => l());
}

export function setAgencySwitch(key: string, on: boolean) {
  write({ ...current, switches: { ...current.switches, [key]: on } });
}

export function setAgencyProfileField<K extends keyof AgencyProfile>(key: K, value: AgencyProfile[K]) {
  write({ ...current, profile: { ...current.profile, [key]: value } });
}

export function setAgencyField<K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) {
  write({ ...current, [key]: value });
}

export function setTagPresets(area: TagArea, tags: string[]) {
  write({ ...current, tagPresets: { ...current.tagPresets, [area]: tags } });
}

export function setNotification<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
  write({ ...current, notifications: { ...current.notifications, [key]: value } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAgencySettings(): AgencySettings {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_AGENCY_SETTINGS);
}

/** For code outside React. */
export function readAgencySettings(): AgencySettings {
  return current;
}
