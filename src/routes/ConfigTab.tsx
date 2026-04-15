import { createSignal, createEffect, createMemo, For } from "solid-js";
import { uiStore } from "../lib/stores/uiStore";
import { configStore } from "../lib/stores/configStore";
import { sysStore } from "../lib/stores/sysStore";
import { hymofsStore } from "../lib/stores/hymofsStore";
import { ICONS } from "../lib/constants";
import { API } from "../lib/api";
import { getCookie, setCookie } from "../lib/cookies";
import ChipInput from "../components/ChipInput";
import BottomActions from "../components/BottomActions";
import "./ConfigTab.css";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/button/filled-button.js";
import "@material/web/iconbutton/filled-tonal-icon-button.js";
import "@material/web/icon/icon.js";
import "@material/web/ripple/ripple.js";
import "@material/web/dialog/dialog.js";
import "@material/web/button/text-button.js";
import "@material/web/switch/switch.js";
import type { OverlayMode, AppConfig } from "../lib/types";

const HYMOFS_WARNING_COOKIE = "mhm_hymofs_warning_ack";

export default function ConfigTab() {
  const [initialConfigStr, setInitialConfigStr] = createSignal("");
  const [showResetConfirm, setShowResetConfirm] = createSignal(false);
  const [showHymofsWarning, setShowHymofsWarning] = createSignal(false);
  const [hymofsPending, setHymofsPending] = createSignal(false);
  let mountSourceInputRef: HTMLElement | undefined;

  const isValidPath = (p: string) => !p || (p.startsWith("/") && p.length > 1);
  const invalidModuleDir = createMemo(
    () => !isValidPath(configStore.config.moduledir),
  );

  const isDirty = createMemo(() => {
    if (!initialConfigStr()) return false;
    return JSON.stringify(configStore.config) !== initialConfigStr();
  });

  createEffect(() => {
    if (!configStore.loading && configStore.config) {
      if (
        !initialConfigStr() ||
        initialConfigStr() === JSON.stringify(configStore.config)
      ) {
        setInitialConfigStr(JSON.stringify(configStore.config));
      }
    }
  });

  function updateConfig<K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) {
    configStore.config = { ...configStore.config, [key]: value };
  }

  function save() {
    if (invalidModuleDir()) {
      uiStore.showToast(uiStore.L.config.invalidPath, "error");
      return;
    }
    configStore.saveConfig().then(() => {
      setInitialConfigStr(JSON.stringify(configStore.config));
    });
  }

  function reload() {
    configStore.loadConfig().then(() => {
      setInitialConfigStr(JSON.stringify(configStore.config));
    });
  }

  function reset() {
    setShowResetConfirm(false);
    configStore.resetConfig().then(() => {
      setInitialConfigStr(JSON.stringify(configStore.config));
    });
  }

  async function applyHymofsEnabled(
    enabled: boolean,
    rememberWarning = false,
  ) {
    setHymofsPending(true);
    try {
      await API.setHymofsEnabled(enabled);
      await hymofsStore.refreshStatus();
      if (enabled && rememberWarning) {
        setCookie(HYMOFS_WARNING_COOKIE, "1");
      }
      uiStore.showToast(
        enabled
          ? uiStore.L.config?.hymofsEnabledSuccess || "HymoFS enabled"
          : uiStore.L.config?.hymofsDisabledSuccess || "HymoFS disabled",
        "success",
      );
    } catch (e: any) {
      uiStore.showToast(
        e?.message || uiStore.L.config?.saveFailed || "Failed to save",
        "error",
      );
    } finally {
      setHymofsPending(false);
    }
  }

  function requestHymofsToggle() {
    if (hymofsStore.enabled) {
      void applyHymofsEnabled(false);
      return;
    }
    if (getCookie(HYMOFS_WARNING_COOKIE) === "1") {
      void applyHymofsEnabled(true);
      return;
    }
    setShowHymofsWarning(true);
  }

  function confirmHymofsEnable() {
    setShowHymofsWarning(false);
    void applyHymofsEnabled(true, true);
  }

  function toggle(key: keyof AppConfig) {
    const currentVal = configStore.config[key] as boolean;
    const newVal = !currentVal;

    updateConfig(key, newVal);

    API.saveConfig({ ...configStore.config, [key]: newVal }).catch(() => {
      updateConfig(key, currentVal);
      uiStore.showToast(
        uiStore.L.config?.saveFailed || "Failed to update setting",
        "error",
      );
    });
  }

  function setOverlayMode(mode: string) {
    updateConfig("overlay_mode", mode as OverlayMode);
  }

  const availableModes = createMemo(() => {
    const storageModes = (sysStore.storage as any)?.supported_modes;
    let modes: OverlayMode[];

    if (storageModes && Array.isArray(storageModes)) {
      modes = storageModes as OverlayMode[];
    } else {
      modes =
        sysStore.systemInfo?.supported_overlay_modes ??
        (["tmpfs", "ext4"] as OverlayMode[]);
    }

    if (sysStore.systemInfo?.tmpfs_xattr_supported === false) {
      modes = modes.filter((m) => m !== "tmpfs");
    }

    return modes;
  });

  const MODE_DESCS: Record<OverlayMode, string> = {
    tmpfs: "RAM-based. Fastest I/O, reset on reboot.",
    ext4: "Loopback image. Persistent, saves RAM.",
  };

  return (
    <>
      <div class="dialog-container">
        <md-dialog
          open={showResetConfirm()}
          onclose={() => setShowResetConfirm(false)}
          class="transparent-scrim"
        >
          <div slot="headline">
            {uiStore.L.config?.resetConfigTitle ?? "Reset Configuration?"}
          </div>
          <div slot="content">
            {uiStore.L.config?.resetConfigConfirm ??
              "This will reset all backend settings to defaults. Continue?"}
          </div>
          <div slot="actions">
            <md-text-button onClick={() => setShowResetConfirm(false)}>
              {uiStore.L.common?.cancel ?? "Cancel"}
            </md-text-button>
            <md-text-button onClick={reset}>
              {uiStore.L.config?.resetConfig ?? "Reset Config"}
            </md-text-button>
          </div>
        </md-dialog>

        <md-dialog
          open={showHymofsWarning()}
          onclose={() => setShowHymofsWarning(false)}
          class="transparent-scrim"
        >
          <div slot="headline">
            {uiStore.L.config?.hymofsWarningTitle ??
              "Enable Experimental HymoFS?"}
          </div>
          <div slot="content">
            {uiStore.L.config?.hymofsWarningBody ??
              "HymoFS is experimental. Enabling it will expose the HymoFS tab, allow HymoFS-backed module routing, and permit LKM autoload. Continue only if you know what you are testing."}
          </div>
          <div slot="actions">
            <md-text-button onClick={() => setShowHymofsWarning(false)}>
              {uiStore.L.common?.cancel ?? "Cancel"}
            </md-text-button>
            <md-text-button onClick={confirmHymofsEnable}>
              {uiStore.L.config?.hymofsEnableConfirm ?? "Enable HymoFS"}
            </md-text-button>
          </div>
        </md-dialog>
      </div>

      <div class="config-container">
        <section class="config-group">
          <div class="config-card">
            <div class="card-header">
              <div class="card-icon">
                <md-icon>
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.modules} />
                  </svg>
                </md-icon>
              </div>
              <div class="card-text">
                <span class="card-title">{uiStore.L.config.moduleDir}</span>
                <span class="card-desc">
                  {uiStore.L.config?.moduleDirDesc ??
                    "Set the directory where modules are stored"}
                </span>
              </div>
            </div>

            <div class="input-stack">
              <md-outlined-text-field
                label={uiStore.L.config.moduleDir}
                value={configStore.config.moduledir}
                onInput={(e: Event) =>
                  updateConfig(
                    "moduledir",
                    (e.currentTarget as HTMLInputElement).value,
                  )
                }
                error={invalidModuleDir()}
                supporting-text={
                  invalidModuleDir()
                    ? uiStore.L.config?.invalidModuleDir || "Invalid Path"
                    : ""
                }
                class="full-width-field"
              >
                <md-icon slot="leading-icon">
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.modules} />
                  </svg>
                </md-icon>
              </md-outlined-text-field>
            </div>
          </div>

          <div class="config-card">
            <div class="card-header">
              <div class="card-icon">
                <md-icon>
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.ksu} />
                  </svg>
                </md-icon>
              </div>
              <div class="card-text">
                <span class="card-title">{uiStore.L.config.mountSource}</span>
                <span class="card-desc">
                  {uiStore.L.config?.mountSourceDesc ??
                    "Global mount source namespace (e.g. KSU)"}
                </span>
              </div>
            </div>

            <div class="input-stack">
              <md-outlined-text-field
                ref={(el) => (mountSourceInputRef = el)}
                label={uiStore.L.config.mountSource}
                value={configStore.config.mountsource}
                onInput={(e: Event) =>
                  updateConfig(
                    "mountsource",
                    (e.currentTarget as HTMLInputElement).value,
                  )
                }
                onFocus={() => {
                  setTimeout(() => {
                    mountSourceInputRef?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 300);
                }}
                class="full-width-field"
              >
                <md-icon slot="leading-icon">
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.ksu} />
                  </svg>
                </md-icon>
              </md-outlined-text-field>
            </div>
          </div>
        </section>

        <section class="config-group">
          <div class="config-card">
            <div class="card-header">
              <div class="card-icon">
                <md-icon>
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.storage} />
                  </svg>
                </md-icon>
              </div>
              <div class="card-text">
                <span class="card-title">{uiStore.L.config.partitions}</span>
                <span class="card-desc">
                  {uiStore.L.config?.partitionsDesc ??
                    "Add partitions to mount"}
                </span>
              </div>
            </div>
            <div class="p-input">
              <ChipInput
                values={configStore.config.partitions}
                placeholder="e.g. product, system_ext..."
                onValuesChange={(vals) => updateConfig("partitions", vals)}
              />
            </div>
          </div>
        </section>

        <section class="config-group">
          <div class="config-card">
            <div class="card-header">
              <div class="card-icon">
                <md-icon>
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.save} />
                  </svg>
                </md-icon>
              </div>
              <div class="card-text">
                <span class="card-title">
                  {uiStore.L.config?.overlayMode || "Overlay Mode"}
                </span>
                <span class="card-desc">
                  {uiStore.L.config?.overlayModeDesc ||
                    "Select backing storage strategy"}
                </span>
              </div>
            </div>
            <div class="mode-selector">
              <For each={availableModes()}>
                {(mode) => (
                  <button
                    class={`mode-item ${configStore.config.overlay_mode === mode ? "selected" : ""}`}
                    onClick={() => setOverlayMode(mode)}
                  >
                    <md-ripple></md-ripple>
                    <div class="mode-info">
                      <span class="mode-title">
                        {uiStore.L.config?.[`mode_${mode}`] || mode}
                      </span>
                      <span class="mode-desc">
                        {uiStore.L.config?.[`mode_${mode}Desc`] ||
                          MODE_DESCS[mode]}
                      </span>
                    </div>
                    <div class="mode-check">
                      <md-icon>
                        <svg viewBox="0 0 24 24">
                          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
                        </svg>
                      </md-icon>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="config-card">
            <div class="card-header">
              <div class="card-icon">
                <md-icon>
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.warning} />
                  </svg>
                </md-icon>
              </div>
              <div class="card-text">
                <span class="card-title">
                  {uiStore.L.config?.hymofsMasterTitle ??
                    "Experimental HymoFS"}
                </span>
                <span class="card-desc">
                  {uiStore.L.config?.hymofsMasterDesc ??
                    "Enable the experimental HymoFS backend."}
                </span>
              </div>
            </div>

            <div class="setting-list">
              <div class="list-item">
                <div class="list-text">
                  <span class="list-title">
                    {uiStore.L.config?.hymofsMasterSwitch ?? "Enable HymoFS"}
                  </span>
                  <span class="list-desc">
                    {hymofsStore.enabled
                      ? uiStore.L.config?.hymofsStateEnabled || "Enabled"
                      : uiStore.L.config?.hymofsStateDisabled || "Disabled"}
                  </span>
                </div>
                <md-switch
                  selected={hymofsStore.enabled}
                  disabled={hymofsPending() || hymofsStore.loading}
                  aria-label={
                    uiStore.L.config?.hymofsMasterSwitch || "Enable HymoFS"
                  }
                  onClick={(e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestHymofsToggle();
                  }}
                />
              </div>
            </div>
          </div>

          <div class="options-grid">
            <button
              class={`option-tile clickable tertiary ${configStore.config.disable_umount ? "active" : ""}`}
              onClick={() => toggle("disable_umount")}
            >
              <md-ripple></md-ripple>
              <div class="tile-top">
                <div class="tile-icon">
                  <md-icon>
                    <svg viewBox="0 0 24 24">
                      <path d={ICONS.anchor} />
                    </svg>
                  </md-icon>
                </div>
              </div>
              <div class="tile-bottom">
                <span class="tile-label">{uiStore.L.config.disableUmount}</span>
              </div>
            </button>

            <button
              class={`option-tile clickable tertiary ${configStore.config.enable_overlay_fallback ? "active" : ""}`}
              onClick={() => toggle("enable_overlay_fallback")}
            >
              <md-ripple></md-ripple>
              <div class="tile-top">
                <div class="tile-icon">
                  <md-icon>
                    <svg viewBox="0 0 24 24">
                      <path d={ICONS.shield} />
                    </svg>
                  </md-icon>
                </div>
              </div>
              <div class="tile-bottom">
                <span class="tile-label">
                  {uiStore.L.config?.enableOverlayFallback ||
                    "Enable Overlay Fallback"}
                </span>
              </div>
            </button>
          </div>
        </section>

        <section class="config-group">
          <div class="webui-label">{uiStore.L.config?.webui || "WebUI"}</div>
          <div class="options-grid">
            <button
              class="option-tile clickable error"
              onClick={() => setShowResetConfirm(true)}
              disabled={configStore.saving}
            >
              <md-ripple></md-ripple>
              <div class="tile-top">
                <div class="tile-icon">
                  <md-icon>
                    <svg viewBox="0 0 24 24">
                      <path d={ICONS.replay} />
                    </svg>
                  </md-icon>
                </div>
              </div>
              <div class="tile-bottom">
                <span class="tile-label">
                  {uiStore.L.config?.resetConfig || "Reset Config"}
                </span>
              </div>
            </button>
          </div>
        </section>
      </div>

      <BottomActions>
        <md-filled-tonal-icon-button
          onClick={reload}
          disabled={configStore.loading}
          title={uiStore.L.config.reload}
        >
          <md-icon>
            <svg viewBox="0 0 24 24">
              <path d={ICONS.refresh} />
            </svg>
          </md-icon>
        </md-filled-tonal-icon-button>

        <div class="spacer"></div>

        <md-filled-button
          onClick={save}
          disabled={configStore.saving || !isDirty()}
        >
          <md-icon slot="icon">
            <svg viewBox="0 0 24 24">
              <path d={ICONS.save} />
            </svg>
          </md-icon>
          {configStore.saving ? uiStore.L.common.saving : uiStore.L.config.save}
        </md-filled-button>
      </BottomActions>
    </>
  );
}
