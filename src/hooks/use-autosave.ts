import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

export interface AutosaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
  /** True when a change is buffered locally but not yet accepted by the server. */
  hasUnsavedChanges: boolean;
  error: string | null;
}

export interface UseAutosaveOptions<T> {
  /** Persists the value. Rejecting marks the change unsaved; it is never dropped. */
  save: (value: T, signal: { version: number }) => Promise<void>;
  /** Debounce window in ms. */
  delay?: number;
  /** Key for the local draft. Omit to disable local persistence. */
  draftKey?: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

/**
 * Debounced autosave with local draft recovery and stale-write protection.
 *
 * Section 14 makes all of this mandatory, and section 43 sets the tone: preserve
 * the user's work, and never report a generic failure when a more useful state
 * is known. The rules encoded here:
 *
 *   - Local state updates immediately; the server write is debounced.
 *   - A draft is written locally on every change, so a refresh or a crash
 *     mid-intake recovers rather than losing the section.
 *   - Writes carry a monotonic version. A slow response from an older write can
 *     never overwrite a newer one — the classic autosave data-loss bug.
 *   - A failed write keeps the draft and surfaces the failure. It does not
 *     silently retry forever and it does not discard the change.
 */
export function useAutosave<T>({
  save,
  delay = 800,
  draftKey,
  storage,
}: UseAutosaveOptions<T>) {
  const [state, setState] = useState<AutosaveState>({
    status: "idle",
    lastSavedAt: null,
    hasUnsavedChanges: false,
    error: null,
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);
  const acknowledged = useRef(0);
  const pending = useRef<T | null>(null);

  const store = useCallback((): UseAutosaveOptions<T>["storage"] | null => {
    if (storage) return storage;
    if (typeof window === "undefined") return null;
    return window.localStorage;
  }, [storage]);

  const flush = useCallback(async () => {
    if (pending.current === null) return;

    const value = pending.current;
    const mine = ++version.current;
    setState((s) => ({ ...s, status: "saving", error: null }));

    try {
      await save(value, { version: mine });

      // A newer write started while this one was in flight. Its result wins;
      // this one must not report success or clear the draft.
      if (mine < acknowledged.current) return;
      acknowledged.current = mine;

      if (mine === version.current) {
        pending.current = null;
        if (draftKey) store()?.removeItem(draftKey);
        setState({
          status: "saved",
          lastSavedAt: new Date(),
          hasUnsavedChanges: false,
          error: null,
        });
      }
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setState((s) => ({
        ...s,
        status: offline ? "offline" : "error",
        hasUnsavedChanges: true,
        error:
          offline
            ? "We couldn't sync the last change yet. Your work is saved on this device."
            : err instanceof Error
              ? err.message
              : "We couldn't save the last change. Your work is safe here.",
      }));
    }
  }, [save, draftKey, store]);

  /** Record a change. Returns immediately; the server write is debounced. */
  const change = useCallback(
    (value: T) => {
      pending.current = value;
      setState((s) => ({ ...s, hasUnsavedChanges: true }));

      if (draftKey) {
        try {
          store()?.setItem(draftKey, JSON.stringify({ value, at: Date.now() }));
        } catch {
          // A full or unavailable storage must not break typing.
        }
      }

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, draftKey, flush, store],
  );

  /** Save now — for section navigation and Save & exit, which must not race the timer. */
  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await flush();
  }, [flush]);

  /** Recover a draft left by an interrupted session. */
  const recoverDraft = useCallback((): T | null => {
    if (!draftKey) return null;
    try {
      const raw = store()?.getItem(draftKey);
      if (!raw) return null;
      return (JSON.parse(raw) as { value: T }).value;
    } catch {
      return null;
    }
  }, [draftKey, store]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { ...state, change, saveNow, recoverDraft };
}
