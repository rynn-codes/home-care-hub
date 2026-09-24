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

  return once;
}
