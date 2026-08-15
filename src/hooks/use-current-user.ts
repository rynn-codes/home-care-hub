import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrentUser {
  /** Preferred first name, for the greeting. Empty until a session resolves. */
  firstName: string;
  loading: boolean;
}

function firstNameFrom(metadata: Record<string, unknown> | undefined, email: string | undefined) {
  const preferred = metadata?.preferred_name ?? metadata?.first_name ?? metadata?.full_name;
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim().split(/\s+/)[0];
  }
  if (email) {
    const handle = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (handle) return handle.split(" ")[0].replace(/^./, (c) => c.toUpperCase());
  }
  return "";
}

/**
 * The signed-in user's preferred first name.
 *
 * The greeting was previously a hardcoded constant. Revision 3 asks for the
 * signed-in user's preferred first name, so this reads the session and degrades
 * to a nameless greeting rather than addressing the user by someone else's name.
 */
export function useCurrentUser(): CurrentUser {
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const user = data.session?.user;
        setFirstName(firstNameFrom(user?.user_metadata, user?.email));
      })
      .catch(() => {
        /* No session available; the greeting falls back to no name. */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setFirstName(firstNameFrom(session?.user?.user_metadata, session?.user?.email));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { firstName, loading };
}
