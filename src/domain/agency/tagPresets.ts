/**
 * The tags people may pick from, kept in settings rather than typed freely.
 *
 * Karynn, 29 September: "Under tags for employees, can we have some
 * auto-populated tags? Maybe set that up in settings or something? Bc anybody
 * can put tags up and if they havent been used previously, tags would be
 * useless." And: "Anywhere tags are used, we should have in the settings,
 * pre-populated ones so that there aren't a thousand random tags created that
 * don't correspond to help with search."
 *
 * ── A tag is only useful if two people would choose the same one ─────────
 *
 * Free-text tags drift: "weekends", "Weekend only", "wknds" are three tags
 * for one fact, and a search for any of them misses the other two. So the
 * forms offer a list and nothing else, and the list is edited in one place by
 * whoever runs the office. Adding a tag to the list is deliberate; typing one
 * into a form was not.
 *
 * Each area has its own list, because "hoyer lift" is a caregiver's skill and
 * "survey" is a document's purpose, and one list would offer both everywhere.
 */

export type TagArea = "employees" | "documents";

export const TAG_AREAS: readonly TagArea[] = ["employees", "documents"];

export const TAG_AREA_LABELS: Record<TagArea, string> = {
  employees: "Employee tags",
  documents: "Document tags",
};

export const TAG_AREA_HINTS: Record<TagArea, string> = {
  employees: "Offered on the employee form. Skills, availability and preferences the office schedules by.",
  documents: "Offered when a file is added or edited in Documents.",
};

/**
 * Starting lists. Employee tags are what a home care office actually
 * schedules by; document tags are the ones the library's seed files already
 * carry, so nothing on file is tagged with something the list does not offer.
 */
export const DEFAULT_TAG_PRESETS: Record<TagArea, string[]> = {
  employees: [
    "Weekends",
    "Nights",
    "Overnights",
    "Live-in",
    "Dementia experience",
    "Hospice experience",
    "Hoyer lift",
    "Pet friendly",
    "Non-smoker",
    "Own car",
  ],
  documents: [
    "handbook",
    "onboarding",
    "hipaa",
    "survey",
    "payroll",
    "template",
    "clinical",
    "finance",
    "brand",
    "insurance",
    "reviews",
    "emergency",
    "licence",
  ],
};

/** Trimmed, one space between words, or null for nothing. Case is kept. */
export function cleanTag(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length ? t : null;
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The list with a tag added, unless it is blank or already there in any case. */
export function addPreset(list: readonly string[], raw: string): string[] {
  const t = cleanTag(raw);
  if (!t || list.some((x) => sameTag(x, t))) return [...list];
  return [...list, t];
}

export function removePreset(list: readonly string[], tag: string): string[] {
  return list.filter((x) => !sameTag(x, tag));
}

/** Whether a tag is offered by the list, in any case. */
export function isPreset(list: readonly string[], tag: string): boolean {
  return list.some((x) => sameTag(x, tag));
}

/**
 * Tags on a record that the list no longer offers — kept on the record and
 * shown as such, so removing a preset never silently strips it from people
 * who already carry it.
 */
export function orphanTags(list: readonly string[], tags: readonly string[]): string[] {
  return tags.filter((t) => !isPreset(list, t));
}
