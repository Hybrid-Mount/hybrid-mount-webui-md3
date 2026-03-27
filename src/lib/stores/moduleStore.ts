import { createSignal, createMemo, createRoot } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { API } from "../api";
import { uiStore } from "./uiStore";
import type { Module, ModeStats } from "../types";

const createModuleStore = () => {
  const [modules, setModulesStore] = createStore<Module[]>([]);
  const [loading, setLoading] = createSignal(false);

  const modeStats = createMemo((): ModeStats => {
    const stats = { auto: 0, magic: 0 };
    modules.forEach((m) => {
      if (!m.is_mounted) return;
      if (m.mode === "auto") stats.auto++;
      else if (m.mode === "magic") stats.magic++;
    });
    return stats;
  });

  async function loadModules() {
    setLoading(true);
    try {
      const data = await API.scanModules();
      setModulesStore(reconcile(data));
    } catch (e: any) {
      uiStore.showToast(
        uiStore.L.modules?.scanError || "Failed to load modules",
        "error",
      );
    }
    setLoading(false);
  }

  return {
    get modules() {
      return modules;
    },
    set modules(v) {
      setModulesStore(reconcile(v));
    },
    get loading() {
      return loading();
    },
    get modeStats() {
      return modeStats();
    },
    loadModules,
  };
};

export const moduleStore = createRoot(createModuleStore);
