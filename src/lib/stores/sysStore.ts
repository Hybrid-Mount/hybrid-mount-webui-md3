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
        const [d, v, s, info] = await Promise.all([
          API.getDeviceStatus(),
          API.getVersion(),
          API.getStorageUsage(),
          API.getSystemInfo(),
        ]);
        setDevice(d);
        setVersion(v);
        setStorage(s);
        setSystemInfo(info);
        setActivePartitions(info.activeMounts || []);
        hasLoaded = true;
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
