import { describe, expect, it } from "vitest";
import { seedDocuments } from "@/lib/documentsSeed";
import {
  DEFAULT_TAG_PRESETS,
  addPreset,
  cleanTag,
  isPreset,
  orphanTags,
  removePreset,
} from "./tagPresets";

describe("tag presets", () => {
  it("cleans what is typed and keeps its case", () => {
    expect(cleanTag("  Hoyer   lift ")).toBe("Hoyer lift");
    expect(cleanTag("   ")).toBeNull();
  });

  it("adds once, whatever the case", () => {
    const list = addPreset(["Weekends"], "weekends");
    expect(list).toEqual(["Weekends"]);
    expect(addPreset(list, " Nights ")).toEqual(["Weekends", "Nights"]);
    expect(addPreset(list, "")).toEqual(["Weekends"]);
  });

  it("removes in any case and reports what is offered", () => {
    expect(removePreset(["Weekends", "Nights"], "WEEKENDS")).toEqual(["Nights"]);
    expect(isPreset(["Weekends"], "weekends")).toBe(true);
    expect(isPreset(["Weekends"], "Nights")).toBe(false);
  });

  it("keeps a record's tag that the list no longer offers, and names it", () => {
    expect(orphanTags(["Weekends"], ["Weekends", "Fridays only"])).toEqual(["Fridays only"]);
  });

  it("offers every tag the seed library already carries", () => {
    for (const d of seedDocuments) {
      for (const t of d.tags) expect(isPreset(DEFAULT_TAG_PRESETS.documents, t)).toBe(true);
    }
  });

  it("has no duplicate defaults", () => {
    for (const list of Object.values(DEFAULT_TAG_PRESETS)) {
      const lower = list.map((t) => t.toLowerCase());
      expect(new Set(lower).size).toBe(lower.length);
    }
  });
});
