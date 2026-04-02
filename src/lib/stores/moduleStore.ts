import { createSignal, createMemo, createRoot } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { API } from "../api";
import { normalizeModuleMode } from "../moduleMode";
import { uiStore } from "./uiStore";
import type { Module, ModeStats } from "../types";

const createModuleStore = () => {
  const [modules, setModulesStore] = createStore<Module[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  let pendingLoad: Promise<void> | null = null;
  let hasLoaded = false;

  function normalizeModule(module: Module): Module {
    return {
      ...module,
      mode: normalizeModuleMode(module.mode),
      rules: {
        ...module.rules,
        default_mode: normalizeModuleMode(module.rules.default_mode),
      },
    };
  }

  const modeStats = createMemo((): ModeStats => {
    const stats = { overlay: 0, magic: 0 };
    modules.forEach((m) => {
      if (!m.is_mounted) return;
      const mode = normalizeModuleMode(m.mode);
      if (mode === "overlay") stats.overlay++;
      else if (mode === "magic") stats.magic++;
    });
    return stats;
  });

  async function loadModules() {
    if (pendingLoad) return pendingLoad;

    setLoading(true);
    pendingLoad = (async () => {
      try {
        const data = (await API.scanModules()).map((module) =>
          normalizeModule(module as Module),
        );
        setModulesStore(reconcile(data));
        hasLoaded = true;
      } catch (e: any) {
        uiStore.showToast(
          uiStore.L.modules?.scanError || "Failed to load modules",
          "error",
        );
      } finally {
        setLoading(false);
        pendingLoad = null;
      }
    })();

    return pendingLoad;
  }

  function ensureModulesLoaded() {
    if (hasLoaded) return Promise.resolve();
    return loadModules();
  }

  async function saveModules() {
    setSaving(true);
    try {
      await API.saveModules(modules);
      uiStore.showToast(uiStore.L.common?.saved || "Saved", "success");
    } catch (e: any) {
      uiStore.showToast(
        uiStore.L.modules?.saveFailed || "Failed to save module modes",
        "error",
      );
    }
    setSaving(false);
  }

  return {
    get modules() {
      return modules;
    },
    set modules(v) {
      setModulesStore(reconcile(v.map(normalizeModule)));
    },
    get loading() {
      return loading();
    },
    get saving() {
      return saving();
    },
    get hasLoaded() {
      return hasLoaded;
    },
    get modeStats() {
      return modeStats();
    },
    ensureModulesLoaded,
    loadModules,
    saveModules,
  };
};

export const moduleStore = createRoot(createModuleStore);
