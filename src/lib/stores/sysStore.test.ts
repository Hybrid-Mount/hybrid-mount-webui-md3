import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = {
  getDeviceStatus: vi.fn(),
  getVersion: vi.fn(),
  getStorageUsage: vi.fn(),
  getSystemInfo: vi.fn(),
};

const uiStoreMock = {
  L: {
    status: {
      loadError: "Failed to load system status",
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

describe("sysStore", () => {
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

  it("deduplicates the initial status load and caches the result", async () => {
    const deviceDeferred = createDeferred<{
      model: string;
      android: string;
      kernel: string;
      selinux: string;
    }>();

    apiMock.getDeviceStatus.mockReturnValue(deviceDeferred.promise);
    apiMock.getVersion.mockResolvedValue("1.2.3");
    apiMock.getStorageUsage.mockResolvedValue({ type: "ext4" });
    apiMock.getSystemInfo.mockResolvedValue({
      kernel: "5.10.0",
      selinux: "Enforcing",
      mountBase: "/data/adb/modules",
      activeMounts: ["system", "vendor"],
    });

    const { sysStore } = await import("./sysStore");

    const pendingA = sysStore.ensureStatusLoaded();
    const pendingB = sysStore.ensureStatusLoaded();

    expect(apiMock.getDeviceStatus).toHaveBeenCalledTimes(1);
    expect(apiMock.getVersion).toHaveBeenCalledTimes(1);
    expect(apiMock.getStorageUsage).toHaveBeenCalledTimes(1);
    expect(apiMock.getSystemInfo).toHaveBeenCalledTimes(1);

    deviceDeferred.resolve({
      model: "Pixel 9",
      android: "15 (API 35)",
      kernel: "5.10.0",
      selinux: "Enforcing",
    });

    await Promise.all([pendingA, pendingB]);

    expect(sysStore.device.model).toBe("Pixel 9");
    expect(sysStore.version).toBe("1.2.3");
    expect(sysStore.storage.type).toBe("ext4");
    expect(sysStore.systemInfo.mountBase).toBe("/data/adb/modules");
    expect(sysStore.activePartitions).toEqual(["system", "vendor"]);

    await sysStore.ensureStatusLoaded();

    expect(apiMock.getDeviceStatus).toHaveBeenCalledTimes(1);
    expect(apiMock.getVersion).toHaveBeenCalledTimes(1);
    expect(uiStoreMock.showToast).not.toHaveBeenCalled();
  });

  it("still allows an explicit manual refresh after the cached initial load", async () => {
    apiMock.getDeviceStatus.mockResolvedValue({
      model: "Pixel 9",
      android: "15 (API 35)",
      kernel: "5.10.0",
      selinux: "Enforcing",
    });
    apiMock.getVersion.mockResolvedValue("1.2.3");
    apiMock.getStorageUsage.mockResolvedValue({ type: "tmpfs" });
    apiMock.getSystemInfo.mockResolvedValue({
      kernel: "5.10.0",
      selinux: "Enforcing",
      mountBase: "/data/adb/modules",
      activeMounts: ["system"],
    });

    const { sysStore } = await import("./sysStore");

    await sysStore.ensureStatusLoaded();
    await sysStore.loadStatus();

    expect(apiMock.getDeviceStatus).toHaveBeenCalledTimes(2);
    expect(apiMock.getVersion).toHaveBeenCalledTimes(2);
  });
});
