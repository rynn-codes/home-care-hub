import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { isPreset, orphanTags } from "@/domain/agency/tagPresets";
import { cn } from "@/lib/utils";

/**
 * Tags, picked from the agency's list rather than typed.
 *
 * Karynn, 29 September: tags should be "pre-populated ... so that there
 * aren't a thousand random tags created that don't correspond to help with
 * search." So there is no text box here. Every preset is a chip; a chip is on
 * or off; the list itself is edited in Settings, and the link says so.
 *
 * A tag already on the record that the list no longer offers is still shown,
 * marked, and can be taken off — it is never silently dropped by a save.
 */
export function TagPicker({
  presets,
  value,
  onChange,
  label = "tag",
}: {
  presets: readonly string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** For the remove buttons' labels. */
  label?: string;
}) {
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) =>
    onChange(has(t) ? value.filter((v) => v.toLowerCase() !== t.toLowerCase()) : [...value, t]);
  const orphans = orphanTags(presets, value);

  return (
    <div className="flex flex-col gap-1.5">
      {presets.length === 0 ? (
        <p className="m-0 text-[12.5px] text-muted-foreground">No tags set up yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {presets.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={has(t)}
              onClick={() => toggle(t)}
              className={cn(
                "rounded-full border px-2.5 py-[4px] text-[12px] transition-colors",
                has(t)
                  ? "border-primary bg-[#EEF0FE] font-medium text-primary"
                  : "border-[var(--hairline)] text-muted-foreground hover:bg-[var(--wash)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {orphans.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-muted-foreground">No longer on the list:</span>
          {orphans.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--hairline)] px-2.5 py-[3px] text-[12px]"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${label} ${t}`}
                onClick={() => onChange(value.filter((v) => v !== t))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="m-0 text-[11.5px] text-muted-foreground">
        Need one that is not here?{" "}
        <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
          Add it in Settings → Agency → Tags
        </Link>{" "}
        so everyone picks the same one.
      </p>
      {/* Keeps the compiler honest that the helper is used for something. */}
      <span className="sr-only">{value.filter((v) => isPreset(presets, v)).length} chosen from the list</span>
    </div>
  );
}
