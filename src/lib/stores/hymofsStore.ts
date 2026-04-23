import { createSignal, createRoot } from "solid-js";
import type { HymofsStatus } from "../types";
import { API } from "../api";
import { uiStore } from "./uiStore";

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
        const nextStatus = await API.getHymofsStatus();
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
