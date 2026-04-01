import "@testing-library/jest-dom/vitest";
import { cleanup } from "@solidjs/testing-library";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

if (!("IntersectionObserver" in window)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly scrollMargin = "";
    readonly thresholds = [0];

    disconnect() {}

    observe() {}

    takeRecords() {
      return [];
    }

    unobserve() {}
  }

  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: MockIntersectionObserver,
  });
}

if (!("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
