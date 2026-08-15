import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Session guard for the application shell.
 *
 * Every route previously rendered without a session — the Login page existed but
 * nothing enforced it. This closes the client-side half of that gap.
 *
 * It is only half. A guard in React protects the screens, not the data: anyone
 * holding the anon key can call PostgREST directly. The boundary that actually
 * matters is the row level security in supabase/migrations/0003_rls.sql, which
 * scopes every table by organization and role. This component exists so people
 * are not shown an empty shell they have no right to, not to keep data safe.
 */
export function RequireAuth() {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const location = useLocation();

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState(data.session ? "in" : "out");
      })
      .catch(() => {
        // Treat an unreachable auth service as signed out. Failing open would
        // hand the shell to anyone whose network happens to be broken.
        if (active) setState("out");
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(session ? "in" : "out");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <span className="text-sm text-muted-foreground">Checking your session…</span>
      </div>
    );
  }

  if (state === "out") {
    // Carry the attempted path so sign-in returns the user where they were going.
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
