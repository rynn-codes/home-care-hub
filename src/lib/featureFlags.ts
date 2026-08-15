/**
 * Feature flags for integrations that are specified but not yet live.
 *
 * Section 41: the app must remain usable when every one of these is off, and it
 * must never show fake success. A flag being off means the feature is absent and
 * says so — not that a mock quietly stands in for it.
 *
 * All flags default to OFF. An unset variable in a fresh environment must not
 * light up an integration whose credentials do not exist.
 */

export const FEATURE_FLAG_KEYS = [
  "AI_PHONE_INTAKE_ENABLED",
  "AI_ASSESSMENT_ENABLED",
  "SPRUCE_ENABLED",
  "GHL_ENABLED",
  "GUSTO_ENABLED",
  "CONSENT_PDF_GENERATION_ENABLED",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlag, boolean>;

/**
 * Only the exact string "true" enables a flag.
 *
 * Deliberately strict. Vite exposes env vars as strings, so a loose check makes
 * the string "false" truthy and silently switches on an integration that cannot
 * work — the worst possible failure for a flag whose job is to keep the app
 * honest about what is connected.
 */
export function parseFlag(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toLowerCase() === "true";
}

export function readFeatureFlags(env: Record<string, unknown>): FeatureFlags {
  return FEATURE_FLAG_KEYS.reduce((flags, key) => {
    flags[key] = parseFlag(env[`VITE_${key}`]);
    return flags;
  }, {} as FeatureFlags);
}

export const featureFlags: FeatureFlags = readFeatureFlags(
  import.meta.env as unknown as Record<string, unknown>,
);

export function isEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
