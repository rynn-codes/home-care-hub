import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/hooks/use-autosave";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("debounces: rapid typing produces one write with the latest value", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<string>({ save, delay: 500 }));

    act(() => {
      result.current.change("M");
      result.current.change("Ma");
      result.current.change("Marcus");
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toBe("Marcus");
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  // Draft recovery: the Sprint 1 exit criterion "refresh does not lose work".
  it("keeps a local draft while unsaved and recovers it", async () => {
    const storage = memoryStorage();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutosave<{ note: string }>({ save, delay: 500, draftKey: "intake:1", storage }),
    );

    act(() => result.current.change({ note: "two recent falls" }));
    expect(storage.getItem("intake:1")).toContain("two recent falls");

    // A fresh mount, as after a refresh, finds the draft.
    const { result: remounted } = renderHook(() =>
      useAutosave<{ note: string }>({ save, delay: 500, draftKey: "intake:1", storage }),
    );
    expect(remounted.current.recoverDraft()).toEqual({ note: "two recent falls" });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));
    // Once the server has it, the local copy is no longer the source of truth.
    expect(storage.getItem("intake:1")).toBeNull();
  });

  it("preserves the draft and reports the failure when a write fails", async () => {
    const storage = memoryStorage();
    const save = vi.fn().mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() =>
      useAutosave<string>({ save, delay: 100, draftKey: "intake:2", storage }),
    );

    act(() => result.current.change("important note"));
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.hasUnsavedChanges).toBe(true);
    // The work must still be here. Losing it is the failure this guards against.
    expect(storage.getItem("intake:2")).toContain("important note");
  });

  // Stale-write protection, required by section 14. A slow earlier response must
  // never overwrite a newer one — silent data loss that is very hard to debug.
  it("does not let a slow earlier write clobber a newer one", async () => {
    const resolvers: Array<() => void> = [];
    const save = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => resolvers.push(resolve)),
    );

    const { result } = renderHook(() => useAutosave<string>({ save, delay: 50 }));

    act(() => result.current.change("first"));
    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    act(() => result.current.change("second"));
    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[0][1].version).toBeLessThan(save.mock.calls[1][1].version);

    // Resolve the newer write first, then the older one.
    await act(async () => {
      resolvers[1]();
      resolvers[0]();
    });

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("saveNow flushes immediately, for section navigation and Save & exit", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<string>({ save, delay: 5000 }));

    act(() => result.current.change("value"));
    await act(async () => {
      await result.current.saveNow();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe("value");
  });
});
