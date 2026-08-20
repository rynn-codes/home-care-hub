import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { modeBanner } from "@/domain/portal/mode";
import { portalRoute } from "@/domain/portal/identity";

/**
 * The portal's front door.
 *
 * Same honest caveat as `RequireAuth`: this protects screens, not data. The
 * boundary that matters is row level security, and the portal's policies are
 * not written yet — there is no RLS policy for the `employee` role, which is a
 * gap recorded rather than papered over. A developer reading this should not
 * take a passing guard here as evidence the data is safe.
 *
 * What it does do is make sure nobody lands on an application form or a care
 * plan without a verified phone behind them, and that the mode they are in is
 * stated on the page rather than implied.
 */
export function RequirePortal({ audience }: { audience?: "workforce" | "family" }) {
  const { grant, resolution } = usePortalSession();
  const location = useLocation();

  if (!grant) {
    if (resolution?.outcome === "choose") return <Navigate to="/portal/choose" replace />;
    if (resolution?.outcome === "none") return <Navigate to="/portal/closed" replace />;
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/portal/login?next=${encodeURIComponent(next)}`} replace />;
  }

  // Holding a workforce grant does not entitle you to the family portal.
  //
  // Where to send them depends on whether they have anywhere else to go. Only
  // somebody holding both grants gets the picker; for everybody else it would
  // be a screen with one option, which reads as a choice and is a dead end.
  // They are simply put back where they belong.
  if (audience && grant.audience !== audience) {
    const holdsRequested = resolution?.choices.some((g) => g.audience === audience) ?? false;
    return <Navigate to={holdsRequested ? "/portal/choose" : portalRoute(grant)} replace />;
  }

  return (
    <>
      {/* §27 keeps this plain, but it is deliberately words rather than an
          icon. Karynn chose remember-and-resume over asking every time, and
          that trade is only safe while the mode is impossible to miss. */}
      {resolution?.mustShowIndicator && (
        <div className="border-b border-border bg-surface-muted px-5 py-2.5">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
            <span className="text-xs font-medium">{modeBanner(grant)}</span>
            <a href="/portal/choose" className="text-xs text-muted-foreground underline underline-offset-4">
              Switch
            </a>
          </div>
        </div>
      )}
      <Outlet />
    </>
  );
}
