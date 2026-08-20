import { PortalFrame } from "@/components/portal/PortalFrame";

/**
 * Verified, but nothing open.
 *
 * A real outcome rather than an error: a candidate Joy decided against, a
 * discharged client's daughter, a former employee. `resolvePortal` returns
 * `none` for all of them and this is where they land.
 *
 * It says nothing about why. Telling someone their application was
 * unsuccessful is a conversation the office has, not a line a login screen
 * delivers, and a portal that announced "you were not hired" would be doing
 * that badly to somebody standing at a bus stop.
 */
export default function PortalClosed() {
  return (
    <PortalFrame>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        Nothing open right now
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        We don't have anything waiting for you at the moment. If you think that's wrong,
        please call the office — we're happy to check.
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
