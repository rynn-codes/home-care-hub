/**
 * The office number, as something you can actually hit.
 *
 * WCAG 2.5.5 exempts a link inside a sentence from the 44×44 target size, and
 * this is one — so the exemption applies and the rule is satisfied either way.
 * It is still the wrong place to take the exemption. A caregiver ringing the
 * office is doing it one-handed, outdoors, usually because something has gone
 * wrong, and a 16-pixel-tall tap target is the moment she gives up and drives
 * back.
 *
 * `py-3 -my-3` grows the hit area without moving the line: the padding extends
 * the box, the negative margin pulls the layout back. The text stays in the
 * sentence and the target is twice the height.
 *
 * One component rather than eight copies, because the number itself is a rule —
 * Karynn, 15 Aug: "Only use our office number 713-231-9662." Anyone tempted to
 * paste a mobile has to go past this file.
 */

export const OFFICE_NUMBER = "(713) 231-9662";
export const OFFICE_NUMBER_E164 = "+17132319662";

export function OfficeNumber({ className }: { className?: string }) {
  return (
    <a
      href={`tel:${OFFICE_NUMBER_E164}`}
      className={
        className ??
        "inline-block -my-3 py-3 underline underline-offset-4 decoration-from-font"
      }
    >
      {OFFICE_NUMBER}
    </a>
  );
}
