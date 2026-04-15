import { createSignal, createRoot } from "solid-js";
import type { HymofsConfig, HymofsLkmStatus, HymofsStatus } from "../types";
import { API } from "../api";
import { uiStore } from "./uiStore";

function defaultHymofsConfig(lkm: HymofsLkmStatus): HymofsConfig {
  return {
    enabled: false,
    ignore_protocol_mismatch: false,
    lkm_autoload: lkm.autoload,
    lkm_dir: "",
    lkm_kmi_override: lkm.kmi_override || "",
    mirror_path: "",
    enable_kernel_debug: false,
    enable_stealth: false,
    enable_hidexattr: false,
    enable_mount_hide: false,
    enable_maps_spoof: false,
    enable_statfs_spoof: false,
    mount_hide: { enabled: false, path_pattern: "" },
    statfs_spoof: { enabled: false, path: "", spoof_f_type: 0 },
    hide_uids: [],
    uname: {
      sysname: "",
      nodename: "",
      release: "",
      version: "",
      machine: "",
      domainname: "",
    },
    uname_release: "",
    uname_version: "",
    cmdline_value: "",
    kstat_rules: [],
    maps_rules: [],
  };
}

export function buildUnloadedHymofsStatus(
  lkm: HymofsLkmStatus,
  previousConfig?: HymofsConfig,
): HymofsStatus {
  return {
    status: "lkm_not_loaded",
    available: false,
    protocol_version: null,
    feature_bits: 0,
    feature_names: [],
    hooks: [],
    rule_count: 0,
    user_hide_rule_count: 0,
    mirror_path: previousConfig?.mirror_path || "",
    lkm,
    config: previousConfig ?? defaultHymofsConfig(lkm),
  };
}

function synthesizeUnloadedLkm(previous: HymofsStatus | null): HymofsLkmStatus {
  const prevLkm = previous?.lkm;
  return {
    loaded: false,
    module_name: prevLkm?.module_name,
    autoload: prevLkm?.autoload ?? false,
    kmi_override: prevLkm?.kmi_override ?? "",
    current_kmi: prevLkm?.current_kmi,
    search_dir: prevLkm?.search_dir,
    module_file: prevLkm?.module_file,
    last_error: null,
  };
}

async function fetchStatus(
  lkmLoaded: boolean,
  previous: HymofsStatus | null,
): Promise<HymofsStatus> {
  if (lkmLoaded) {
    return API.getHymofsStatus();
  }
  return buildUnloadedHymofsStatus(synthesizeUnloadedLkm(previous), previous?.config);
}

const createHymofsStore = () => {
  const [status, setStatus] = createSignal<HymofsStatus | null>(null);
  const [loading, setLoading] = createSignal(false);
  let pendingLoad: Promise<void> | null = null;
  let hasLoaded = false;

  async function loadStatus(showError = true) {
    if (pendingLoad) return pendingLoad;

    setLoading(true);
    pendingLoad = (async () => {
      try {
        const lkmLoaded = await API.isHymofsLkmLoaded();
        const nextStatus = await fetchStatus(lkmLoaded, status());
        setStatus(nextStatus);
        hasLoaded = true;
      } catch (e) {
        setStatus(null);
        if (showError) {
          uiStore.showToast(
            uiStore.L.hymofs?.loadError || "Failed to load HymoFS status",
            "error",
          );
        }
      } finally {
        setLoading(false);
        pendingLoad = null;
      }
    })();

    return pendingLoad;
  }

  function ensureStatusLoaded() {
    if (hasLoaded) return Promise.resolve();
    return loadStatus(false);
  }

  return {
    get status() {
      return status();
    },
    get enabled() {
      return Boolean(status()?.config?.enabled);
    },
    get loading() {
      return loading();
    },
    ensureStatusLoaded,
    refreshStatus: () => loadStatus(true),
  };
};

export const hymofsStore = createRoot(createHymofsStore);
