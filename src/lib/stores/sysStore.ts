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

  async function loadStatus() {
    setLoading(true);
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
    } catch (e) {
      console.error("Failed to load system status", e);
      uiStore.showToast(
        uiStore.L.status?.loadError || "Failed to load system status",
        "error",
      );
    }
    setLoading(false);
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
    loadStatus,
  };
};

export const sysStore = createRoot(createSysStore);
