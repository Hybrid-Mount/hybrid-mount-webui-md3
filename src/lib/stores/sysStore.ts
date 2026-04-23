import { createSignal, createRoot } from "solid-js";
import { API } from "../api";
import { APP_VERSION } from "../constants_gen";
import { uiStore } from "./uiStore";
import type { StorageStatus, SystemInfo, DeviceInfo } from "../types";

const createSysStore = () => {
  const [device, setDevice] = createSignal<DeviceInfo>({
    model: "-",
    android: "-",
    kernel: "-",
    selinux: "-",
  });
  const [version, setVersion] = createSignal(APP_VERSION);
  const [storage, setStorage] = createSignal<StorageStatus>({ type: null });
  const [systemInfo, setSystemInfo] = createSignal<SystemInfo>({
    kernel: "-",
    selinux: "-",
    mountBase: "-",
    activeMounts: [],
  });
  const [activePartitions, setActivePartitions] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  let pendingLoad: Promise<void> | null = null;
  let hasLoaded = false;

  async function loadStatus() {
    if (pendingLoad) return pendingLoad;

    setLoading(true);
    pendingLoad = (async () => {
      try {
        const [deviceResult, versionResult, storageResult, systemInfoResult] =
          await Promise.allSettled([
          API.getDeviceStatus(),
          API.getVersion(),
          API.getStorageUsage(),
          API.getSystemInfo(),
          ]);
        let loadedAny = false;
        let failedAny = false;

        if (deviceResult.status === "fulfilled") {
          setDevice(deviceResult.value);
          loadedAny = true;
        } else {
          failedAny = true;
          console.error("Failed to load device status", deviceResult.reason);
        }

        if (versionResult.status === "fulfilled") {
          setVersion(versionResult.value);
          loadedAny = true;
        } else {
          failedAny = true;
          console.error("Failed to load version", versionResult.reason);
        }

        if (storageResult.status === "fulfilled") {
          setStorage(storageResult.value);
          loadedAny = true;
        } else {
          failedAny = true;
          console.error("Failed to load storage status", storageResult.reason);
        }

        if (systemInfoResult.status === "fulfilled") {
          setSystemInfo(systemInfoResult.value);
          setActivePartitions(systemInfoResult.value.activeMounts || []);
          loadedAny = true;
        } else {
          failedAny = true;
          console.error("Failed to load system info", systemInfoResult.reason);
        }

        hasLoaded = hasLoaded || loadedAny;

        if (failedAny) {
          uiStore.showToast(
            uiStore.L.status?.loadError || "Failed to load system status",
            "error",
          );
        }
      } catch (e) {
        console.error("Failed to load system status", e);
        uiStore.showToast(
          uiStore.L.status?.loadError || "Failed to load system status",
          "error",
        );
      } finally {
        setLoading(false);
        pendingLoad = null;
      }
    })();

    return pendingLoad;
  }

  function ensureStatusLoaded() {
    if (hasLoaded) return Promise.resolve();
    return loadStatus();
  }

  return {
    get device() {
      return device();
    },
    get version() {
      return version();
    },
    get storage() {
      return storage();
    },
    get systemInfo() {
      return systemInfo();
    },
    get activePartitions() {
      return activePartitions();
    },
    get loading() {
      return loading();
    },
    ensureStatusLoaded,
    loadStatus,
  };
};

export const sysStore = createRoot(createSysStore);
