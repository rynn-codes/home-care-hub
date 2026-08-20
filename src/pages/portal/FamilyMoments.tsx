import { useMemo } from "react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { momentsTimeline } from "@/domain/portal/moments";
import { preferencesForVisit } from "@/domain/portal/preferences";
import { seedMoments, seedPreferences } from "@/lib/familyPortalSeed";

/**
 * The moments timeline — §16, and §17's preferences below it.
 *
 * §16: "This should feel like a warm care history—not a social-media feed. Do
 * not add likes, followers, public sharing, or unnecessary gamification."
 *
 * So there is nothing to tap. No counts, no reactions, no author line, no
 * share button. `momentsTimeline` returns three fields — id, when, body — and
 * there is deliberately nothing else to render. A byline would turn a note
 * about somebody's father into a post by somebody.
 */
export default function FamilyMoments() {
  const { grant } = usePortalSession();
  const asOf = useMemo(() => new Date(), []);
  const entries = useMemo(() => momentsTimeline(seedMoments, asOf), [asOf]);

  // Approved only. A suggestion nobody has reviewed must not read as something
  // Joy has agreed — including back to the family who suggested it.
  const preferences = useMemo(() => preferencesForVisit(seedPreferences, "p-marcus"), []);

  const subjectName = grant?.subjectName ?? "your family member";

  return (
    <PortalFrame>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">Moments</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Little things from {subjectName}'s days, shared by the caregivers who were there.
      </p>

      <div className="mt-8 space-y-6">
        {entries.map((entry) => (
          <div key={entry.id}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.when}
            </p>
            <p className="mt-1.5 text-base leading-relaxed">{entry.body}</p>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-5 text-base text-muted-foreground">
            Nothing here yet. Caregivers share these when there's something nice to pass on.
          </p>
        )}
      </div>

      {/* --------------------------------------------------- §17 ------- */}
      <div className="mt-12 rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Getting to know {subjectName}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Things we've noted down so whoever visits knows them a little. Tell us anything we've
          missed.
        </p>
        <ul className="mt-4 space-y-2">
          {preferences.map((pref) => (
            <li key={pref} className="flex gap-2.5 text-base">
              <span className="text-muted-foreground" aria-hidden="true">
                •
              </span>
              {pref}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Call us any time on{" "}
        <a href="tel:+17132319662" className="underline underline-offset-4">
          (713) 231-9662
        </a>
        .
      </p>
    </PortalFrame>
  );
}
