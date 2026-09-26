import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * "Arrive here and open X" — read once from the route state, then cleared.
 *
 * Karynn, 29 September: "New button at the top right, doesn't work on every
 * page." It did navigate — to Admissions, Hiring, Scheduling — but then stood
 * there, and on Admissions itself that is indistinguishable from nothing
 * happening. The menu now says which dialog it wants and the page opens it.
 *
 * The state is cleared after it is read so a refresh, or Back, does not open
 * the dialog a second time. Same pattern as Scheduling's `scheduleFor`.
 *
 * The value also resets to null a tick after it is handed over, so the same
 * request twice in a row — "New Client" from Admissions, close it, "New
 * Client" again — is seen as a change both times. Without that the second
 * click navigated to the same value and the screen, watching for a change,
 * saw none.
 */
export function useOpenRequest<T extends string>(): T | null {
  const { state } = useLocation();
  const requested = (state as { open?: T } | null)?.open ?? null;
  const [once, setOnce] = useState<T | null>(null);

  useEffect(() => {
    if (!requested) return;
    setOnce(requested);
    window.history.replaceState(
      { ...(window.history.state ?? {}), usr: { ...((state as object | null) ?? {}), open: undefined } },
      "",
    );
  }, [requested, state]);

  useEffect(() => {
    if (!once) return;
    const t = setTimeout(() => setOnce(null), 0);
    return () => clearTimeout(t);
  }, [once]);

  return once;
}
