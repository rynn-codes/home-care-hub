/**
 * The portal's frame. One column, warm neutral, nothing else.
 *
 * §1: "Do not force caregivers or families into the CEO/admin dashboard." So
 * there is no sidebar, no breadcrumb and no global navigation here — the
 * portal is not the admin app with things hidden, it is a different surface
 * that happens to share a backend.
 *
 * §27's palette rule is held by using the app's existing warm background token
 * rather than a new one. Joy blue arrives only on the primary button and the
 * focus ring: "an accent, not the screen".
 */
export function PortalFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-10">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
