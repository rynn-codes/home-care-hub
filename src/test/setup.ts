import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * jsdom implements neither of these, and both are needed to render real
 * components rather than only test pure functions.
 *
 * `ResizeObserver` is used by the OTP input; without it the login screen throws
 * on mount and every assertion about it becomes a test of the polyfill's
 * absence. `scrollTo` is called when the application form advances a step.
 *
 * Stubbing them is honest here — neither does anything the tests assert on. A
 * test that depended on real layout measurement would need a browser, and that
 * is what the Playwright pass is for.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!window.scrollTo) {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}
