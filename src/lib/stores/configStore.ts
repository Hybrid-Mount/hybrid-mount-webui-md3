import { createSignal, createRoot } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { API } from "../api";
import { DEFAULT_CONFIG } from "../constants";
import { uiStore } from "./uiStore";
import type { AppConfig } from "../types";

interface SaveConfigOptions {
  showSuccess?: boolean;
  showError?: boolean;
}

const createConfigStore = () => {
  const [config, setConfigStore] = createStore<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await API.loadConfig();
      setConfigStore(reconcile(data));
      return true;
    } catch (e: any) {
      uiStore.showToast(
        uiStore.L.config?.loadError || "Failed to load config",
        "error",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(
    nextConfig: AppConfig = config,
    options: SaveConfigOptions = {},
  ) {
    const { showSuccess = true, showError = true } = options;
    setSaving(true);
    try {
      await API.saveConfig(nextConfig);
      if (showSuccess) {
        uiStore.showToast(uiStore.L.common?.saved || "Saved", "success");
      }
      return true;
    } catch (e: any) {
      if (showError) {
        uiStore.showToast(
          uiStore.L.config?.saveFailed || "Failed to save config",
          "error",
        );
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function resetConfig() {
    setSaving(true);
    try {
      await API.resetConfig();
      const loaded = await loadConfig();
      if (!loaded) {
        return false;
      }
      uiStore.showToast(
        uiStore.L.config?.resetSuccess || "Config reset to defaults",
        "success",
      );
      return true;
    } catch (e: any) {
      uiStore.showToast(
        uiStore.L.config?.saveFailed || "Failed to reset config",
        "error",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    get config() {
      return config;
    },
    set config(v) {
      setConfigStore(reconcile(v));
    },
    get loading() {
      return loading();
    },
    get saving() {
      return saving();
    },
    loadConfig,
    saveConfig,
    resetConfig,
  };
};

export const configStore = createRoot(createConfigStore);
