import { PortalFrame } from "@/components/portal/PortalFrame";
import { usePortalSession } from "@/context/PortalSessionProvider";

/**
 * The family portal's landing place, before the family portal exists.
 *
 * §18–24 are real and not built yet — they are steps 11 to 15 of §29's
 * sequence. This page exists because the choose screen can route here today,
 * and an app that navigates itself into a 404 is a defect regardless of what
 * is scheduled.
 *
 * It says what is true rather than showing an empty shell of the real thing. A
 * placeholder dressed up as a working portal would leave somebody waiting for a
 * schedule that was never going to load.
 */
export default function FamilyHome() {
  const { grant } = usePortalSession();

  return (
    <PortalFrame>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        Hi {grant?.greetingName}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Your family portal is being built. When it's ready you'll see{" "}
        {grant?.subjectName ?? "your family member"}'s schedule, visits and documents here, and
        we'll text you the moment it's live.
      </p>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Until then, please call the office for anything you need.
      </p>
      <a
        href="tel:+17132319662"
        className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-medium text-primary-foreground"
      >
        Call (713) 231-9662
      </a>
    </PortalFrame>
  );
}
