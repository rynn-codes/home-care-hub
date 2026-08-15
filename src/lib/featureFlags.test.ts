import { describe, expect, it } from "vitest";
import { FEATURE_FLAG_KEYS, parseFlag, readFeatureFlags } from "@/lib/featureFlags";

describe("feature flags", () => {
  it("defaults every flag to off when nothing is set", () => {
    const flags = readFeatureFlags({});
    for (const key of FEATURE_FLAG_KEYS) {
      expect(flags[key], `${key} should default to off`).toBe(false);
    }
  });

  it("covers the six flags the brief specifies", () => {
    expect([...FEATURE_FLAG_KEYS].sort()).toEqual(
      [
        "AI_ASSESSMENT_ENABLED",
        "AI_PHONE_INTAKE_ENABLED",
        "CONSENT_PDF_GENERATION_ENABLED",
        "GHL_ENABLED",
        "GUSTO_ENABLED",
        "SPRUCE_ENABLED",
      ].sort(),
    );
  });

  it('enables a flag only on the exact string "true"', () => {
    expect(parseFlag("true")).toBe(true);
    expect(parseFlag("TRUE")).toBe(true);
    expect(parseFlag(" true ")).toBe(true);
  });

  // The failure that matters: env vars arrive as strings, so a loose truthiness
  // check makes "false" enable an integration whose credentials do not exist,
  // and the app starts showing fake success.
  it('never enables a flag for the string "false" or other junk', () => {
    for (const raw of ["false", "FALSE", "0", "", "no", "1", "yes", undefined, null, 0, true]) {
      expect(parseFlag(raw), `${String(raw)} must not enable a flag`).toBe(false);
    }
  });

  it("reads the VITE_ prefixed variable for each flag", () => {
    const flags = readFeatureFlags({
      VITE_SPRUCE_ENABLED: "true",
      VITE_GUSTO_ENABLED: "false",
    });
    expect(flags.SPRUCE_ENABLED).toBe(true);
    expect(flags.GUSTO_ENABLED).toBe(false);
    expect(flags.AI_PHONE_INTAKE_ENABLED).toBe(false);
  });
});
