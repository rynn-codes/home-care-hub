import { useSyncExternalStore } from "react";

/**
 * This device's preferences — how Joy looks here, not what the agency is.
 *
 * Separate from agency settings because they are personal: one person wants
 * a dark screen at night and a My Work row in the menu, and that must not
 * change what the next person at the desk sees.
 */
export type Appearance = "light" | "dark" | "system";

export interface Preferences {
  /** Show My Work as its own row under The Brain. */
  showMyWork: boolean;
  appearance: Appearance;
}

const KEY = "joy.prefs";
export const DEFAULT_PREFERENCES: Preferences = { showMyWork: false, appearance: "light" };

let current: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const p = JSON.parse(raw) as Partial<Preferences>;
    return {
      showMyWork: typeof p.showMyWork === "boolean" ? p.showMyWork : DEFAULT_PREFERENCES.showMyWork,
      appearance:
        p.appearance === "light" || p.appearance === "dark" || p.appearance === "system"
          ? p.appearance
          : DEFAULT_PREFERENCES.appearance,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Preferences that cannot persist still apply for the session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_PREFERENCES);
}

/** Paint the document for an appearance. Dark is a class on <html>, as Tailwind expects. */
export function applyAppearance(appearance: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark =
    appearance === "dark" ||
    (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}
