import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Module } from "../types";

const apiMock = {
  scanModules: vi.fn(),
  saveModules: vi.fn(),
};

const uiStoreMock = {
  L: {
    modules: {
      scanError: "Failed to load modules",
      saveFailed: "Failed to save module modes",
    },
    common: {
      saved: "Saved",
    },
  },
  showToast: vi.fn(),
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("moduleStore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("../api", () => ({
      API: apiMock,
    }));

    vi.doMock("./uiStore", () => ({
      uiStore: uiStoreMock,
    }));
  });

  it("deduplicates the initial module load and caches the result", async () => {
    const modulesDeferred = createDeferred<Module[]>();

    apiMock.scanModules.mockReturnValue(modulesDeferred.promise);

    const { moduleStore } = await import("./moduleStore");

    const pendingA = moduleStore.ensureModulesLoaded();
    const pendingB = moduleStore.ensureModulesLoaded();

    expect(apiMock.scanModules).toHaveBeenCalledTimes(1);

    modulesDeferred.resolve([
      {
        id: "mod-a",
        name: "Module A",
        version: "1.0.0",
        author: "tester",
        description: "A",
        is_mounted: true,
        mode: "overlay",
        rules: {
          default_mode: "overlay",
          paths: {},
        },
      },
    ]);

    await Promise.all([pendingA, pendingB]);

    expect(moduleStore.modules).toHaveLength(1);
    expect(moduleStore.hasLoaded).toBe(true);

    await moduleStore.ensureModulesLoaded();

    expect(apiMock.scanModules).toHaveBeenCalledTimes(1);
    expect(uiStoreMock.showToast).not.toHaveBeenCalled();
  });

  it("normalizes legacy auto mode and reports overlay statistics consistently", async () => {
    apiMock.scanModules.mockResolvedValue([
      {
        id: "overlay-mod",
        name: "Overlay Module",
        version: "1.0.0",
        author: "tester",
        description: "A",
        is_mounted: true,
        mode: "auto",
        rules: {
          default_mode: "auto",
          paths: {},
        },
      },
      {
        id: "magic-mod",
        name: "Magic Module",
        version: "1.0.0",
        author: "tester",
        description: "B",
        is_mounted: true,
        mode: "magic",
        rules: {
          default_mode: "magic",
          paths: {},
        },
      },
    ] as any);

    const { moduleStore } = await import("./moduleStore");

    await moduleStore.ensureModulesLoaded();

    expect(moduleStore.modules[0].mode).toBe("overlay");
    expect(moduleStore.modules[0].rules.default_mode).toBe("overlay");
    expect(moduleStore.modeStats).toEqual({ overlay: 1, magic: 1 });
  });

  it("still allows an explicit manual refresh after the cached initial load", async () => {
    apiMock.scanModules.mockResolvedValue([]);

    const { moduleStore } = await import("./moduleStore");

    await moduleStore.ensureModulesLoaded();
    await moduleStore.loadModules();

    expect(apiMock.scanModules).toHaveBeenCalledTimes(2);
  });
});
