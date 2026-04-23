import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { API } from "../lib/api";
import { ICONS } from "../lib/constants";
import { uiStore } from "../lib/stores/uiStore";
import { hymofsStore } from "../lib/stores/hymofsStore";
import type { HymofsRuleEntry, HymofsStatus } from "../lib/types";
import BottomActions from "../components/BottomActions";
import Skeleton from "../components/Skeleton";
import "./HymofsTab.css";
import "./StatusTab.css";

import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/dialog/dialog.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/filled-tonal-icon-button.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";
import "@material/web/ripple/ripple.js";
import "@material/web/textfield/outlined-text-field.js";

const KNOWN_KMI_OPTIONS = [
  "android12-5.10",
  "android13-5.10",
  "android13-5.15",
  "android14-5.15",
  "android14-6.1",
  "android15-6.6",
  "android16-6.12",
] as const;
const EXPAND_MORE_ICON = "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z";

function ruleKind(rule: HymofsRuleEntry) {
  return String(rule.type || rule.rule_type || "UNKNOWN").toUpperCase();
}

function parseUnsignedInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  const parsed = /^0x/i.test(trimmed)
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return parsed;
}

export default function HymofsTab() {
  const [rules, setRules] = createSignal<HymofsRuleEntry[]>([]);
  const [userHideRules, setUserHideRules] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [pending, setPending] = createSignal(false);
  const [showKmiDialog, setShowKmiDialog] = createSignal(false);
  const [expandedSection, setExpandedSection] = createSignal<string | null>(
    null,
  );
  const [forms, setForms] = createStore({
    kmi: "",
    release: "",
    version: "",
    cmdline: "",
    mapsTargetIno: "",
    mapsTargetDev: "0",
    mapsSpoofedIno: "",
    mapsSpoofedDev: "0",
    mapsPath: "",
    userHidePath: "",
  });

  function syncForms(nextStatus: HymofsStatus) {
    const config = nextStatus.config;
    const uname = config.uname || {
      sysname: "",
      nodename: "",
      release: "",
      version: "",
      machine: "",
      domainname: "",
    };

    setForms({
      kmi: nextStatus.lkm?.kmi_override || config.lkm_kmi_override || "",
      release: uname.release || config.uname_release || "",
      version: uname.version || config.uname_version || "",
      cmdline: config.cmdline_value || "",
      mapsTargetIno: "",
      mapsTargetDev: "0",
      mapsSpoofedIno: "",
      mapsSpoofedDev: "0",
      mapsPath: "",
      userHidePath: "",
    });
  }

  async function load() {
    setLoading(true);
    try {
      await hymofsStore.refreshStatus();
      const nextStatus = hymofsStore.status;
      const nextUserHideRules = await API.getUserHideRules();
      const nextRules = nextStatus?.lkm?.loaded
        ? await API.getHymofsRules()
        : [];
      if (nextStatus) {
        syncForms(nextStatus);
      }
      setRules(nextRules);
      setUserHideRules(nextUserHideRules);
    } catch (e: any) {
      uiStore.showToast(
        e?.message || uiStore.L.hymofs?.loadError || "Failed to load HymoFS",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setPending(true);
    try {
      await action();
      await load();
      uiStore.showToast(success, "success");
    } catch (e: any) {
      uiStore.showToast(e?.message || "Action failed", "error");
    } finally {
      setPending(false);
    }
  }

  async function fillOriginalKernelUname() {
    setPending(true);
    try {
      const original = await API.getOriginalKernelUname();
      setForms("release", original.release || "");
      setForms("version", original.version || "");
      uiStore.showToast(
        uiStore.L.hymofs?.originalKernelLoaded ??
          "Loaded original kernel values",
        "success",
      );
    } catch (e: any) {
      uiStore.showToast(
        e?.message ||
          uiStore.L.hymofs?.originalKernelLoadFailed ||
          "Failed to read original kernel values",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  onMount(() => {
    void load();
  });

  const status = createMemo(() => hymofsStore.status);
  const config = createMemo(() => status()?.config);
  const lkm = createMemo(() => status()?.lkm);
  const activeModules = createMemo(
    () => status()?.runtime?.hymofs_modules || [],
  );
  const mapsSpoofSupported = createMemo(() =>
    (status()?.feature_names || []).includes("maps_spoof"),
  );
  const kmiOptions = createMemo(() => {
    const options = ["", ...KNOWN_KMI_OPTIONS];
    if (forms.kmi && !options.includes(forms.kmi)) {
      options.push(forms.kmi);
    }
    return options;
  });
  const heroStatusText = createMemo(() => {
    if (loading()) {
      return uiStore.L.hymofs?.statusLoading ?? "Loading";
    }
    if (status()?.status === "disabled") {
      return uiStore.L.hymofs?.statusDisabled ?? "Disabled";
    }
    return status()?.available
      ? (uiStore.L.hymofs?.statusWorking ?? "Working")
      : (uiStore.L.hymofs?.statusUnavailable ?? "Unavailable");
  });
  const autoloadText = createMemo(() =>
    lkm()?.autoload
      ? (uiStore.L.hymofs?.autoloadOn ?? "Autoload On")
      : (uiStore.L.hymofs?.autoloadOff ?? "Autoload Off"),
  );
  const rulesSummaryText = createMemo(() =>
    (
      uiStore.L.hymofs?.rulesVisibleSummary ??
      "{count} active rules visible from userspace"
    ).replace("{count}", String(rules().length)),
  );
  const heroSubtitleText = createMemo(
    () =>
      `API ${status()?.protocol_version ?? "-"} · ${uiStore.L.hymofs?.rulesBadge ?? "Rules"} ${status()?.rule_count ?? 0}`,
  );
  const statusChipText = createMemo(
    () => status()?.mirror_path || config()?.mirror_path || "-",
  );

  function toggleSection(id: string) {
    setExpandedSection((current) => (current === id ? null : id));
  }

  function isSectionExpanded(id: string) {
    return expandedSection() === id;
  }

  return (
    <>
      <div class="dialog-container">
        <md-dialog
          open={showKmiDialog()}
          onclose={() => setShowKmiDialog(false)}
          class="transparent-scrim"
        >
          <div slot="headline">
            {uiStore.L.hymofs?.kmiOverride ?? "KMI Override"}
          </div>
          <div slot="content" class="hymofs-kmi-dialog">
            <md-list>
              <For each={kmiOptions()}>
                {(option) => {
                  const label = option
                    ? option
                    : (uiStore.L.hymofs?.autoKmi ?? "Auto Detect");

                  return (
                    <md-list-item
                      class="lang-option"
                      type="button"
                      onClick={() => {
                        setForms("kmi", option);
                        setShowKmiDialog(false);
                      }}
                    >
                      <div slot="headline">{label}</div>
                      <Show when={forms.kmi === option}>
                        <md-icon slot="end">
                          <svg viewBox="0 0 24 24">
                            <path d={ICONS.check} />
                          </svg>
                        </md-icon>
                      </Show>
                    </md-list-item>
                  );
                }}
              </For>
            </md-list>
          </div>
          <div slot="actions">
            <md-text-button onClick={() => setShowKmiDialog(false)}>
              {uiStore.L.common?.cancel ?? "Cancel"}
            </md-text-button>
          </div>
        </md-dialog>
      </div>

      <div class="hymofs-page">
        <div class="dashboard-grid hymofs-dashboard-grid">
          <section class="hero-card hymofs-status-card">
            <Show
              when={!loading()}
              fallback={
                <div class="skeleton-col">
                  <Skeleton variant="hero-label" />
                  <Skeleton variant="hero-title" />
                  <Skeleton variant="hero-caption" />
                </div>
              }
            >
              <div class="hero-content">
                <span class="hero-label">
                  {uiStore.L.hymofs?.title ?? "HymoFS Runtime"}
                </span>
                <span class="hero-value">{heroStatusText()}</span>
                <span class="hymofs-hero-caption">{heroSubtitleText()}</span>
              </div>

              <div class="mount-base-chip">
                <md-icon class="mount-base-icon">
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.mount_path} />
                  </svg>
                </md-icon>
                <span class="mount-base-text">{statusChipText()}</span>
              </div>
            </Show>
          </section>
        </div>

        <div class="hymofs-grid">
          <section
            class={`hymofs-card hymofs-section ${isSectionExpanded("lkm") ? "expanded" : ""}`}
          >
            <button
              class="hymofs-section-toggle"
              type="button"
              aria-expanded={isSectionExpanded("lkm") ? "true" : "false"}
              aria-controls="hymofs-section-lkm"
              onClick={() => toggleSection("lkm")}
            >
              <div class="hymofs-card-head hymofs-section-toggle-inner">
                <div>
                  <div class="hymofs-card-title">
                    {uiStore.L.hymofs?.lkmTitle ?? "Kernel Module"}
                  </div>
                </div>
                <div class="hymofs-section-toggle-end">
                  <div class={`state-pill ${lkm()?.autoload ? "active" : ""}`}>
                    {autoloadText()}
                  </div>
                  <md-icon class="hymofs-section-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d={EXPAND_MORE_ICON} />
                    </svg>
                  </md-icon>
                </div>
              </div>
            </button>
            <div class="hymofs-section-body-wrapper" id="hymofs-section-lkm">
              <div class="hymofs-section-body-inner">
                <div class="hymofs-section-body">
                  <div class="meta-list">
                    <div class="meta-row">
                      <span>
                        {uiStore.L.hymofs?.currentKmi ?? "Current KMI"}
                      </span>
                      <strong>{lkm()?.current_kmi || "-"}</strong>
                    </div>
                  </div>
                  <div class="field-row">
                    <button
                      class="hymofs-select-button"
                      type="button"
                      disabled={pending()}
                      onClick={() => setShowKmiDialog(true)}
                    >
                      <div class="hymofs-select-button-label">
                        {uiStore.L.hymofs?.kmiOverride ?? "KMI Override"}
                      </div>
                      <div class="hymofs-select-button-value">
                        {forms.kmi ||
                          (uiStore.L.hymofs?.autoKmi ?? "Auto Detect")}
                      </div>
                    </button>
                  </div>
                  <div class="button-row">
                    <md-filled-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () => API.setHymofsLkmKmi(forms.kmi),
                          uiStore.L.hymofs?.saveKmi ?? "KMI saved",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.saveKmi ?? "Save KMI"}
                    </md-filled-button>
                  </div>
                  <div class="button-row">
                    <md-outlined-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            API.setHymofsLkmAutoload(!Boolean(lkm()?.autoload)),
                          uiStore.L.hymofs?.autoloadUpdated ??
                            "Autoload updated",
                        )
                      }
                    >
                      {lkm()?.autoload
                        ? (uiStore.L.hymofs?.disableAutoload ??
                          "Disable autoload")
                        : (uiStore.L.hymofs?.enableAutoload ??
                          "Enable autoload")}
                    </md-outlined-button>
                    <md-filled-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            lkm()?.loaded
                              ? API.unloadHymofsLkm()
                              : API.loadHymofsLkm(),
                          lkm()?.loaded
                            ? (uiStore.L.hymofs?.unloadLkm ?? "LKM unloaded")
                            : (uiStore.L.hymofs?.loadLkm ?? "LKM loaded"),
                        )
                      }
                    >
                      {lkm()?.loaded
                        ? (uiStore.L.hymofs?.unloadLkm ?? "Unload LKM")
                        : (uiStore.L.hymofs?.loadLkm ?? "Load LKM")}
                    </md-filled-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            class={`hymofs-card hymofs-section ${isSectionExpanded("runtime") ? "expanded" : ""}`}
          >
            <button
              class="hymofs-section-toggle"
              type="button"
              aria-expanded={isSectionExpanded("runtime") ? "true" : "false"}
              aria-controls="hymofs-section-runtime"
              onClick={() => toggleSection("runtime")}
            >
              <div class="hymofs-card-head hymofs-section-toggle-inner">
                <div>
                  <div class="hymofs-card-title">
                    {uiStore.L.hymofs?.runtimeTitle ?? "Runtime"}
                  </div>
                </div>
                <md-icon class="hymofs-section-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d={EXPAND_MORE_ICON} />
                  </svg>
                </md-icon>
              </div>
            </button>
            <div
              class="hymofs-section-body-wrapper"
              id="hymofs-section-runtime"
            >
              <div class="hymofs-section-body-inner">
                <div class="hymofs-section-body">
                  <div class="hymofs-config-grid">
                    <button
                      class={`hymofs-config-tile ${config()?.enable_stealth ? "active" : ""}`}
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            API.setHymofsStealth(
                              !Boolean(config()?.enable_stealth),
                            ),
                          uiStore.L.hymofs?.stealthUpdated ?? "Stealth updated",
                        )
                      }
                    >
                      <md-ripple></md-ripple>
                      <div class="hymofs-config-icon">
                        <md-icon>
                          <svg viewBox="0 0 24 24">
                            <path d={ICONS.ghost} />
                          </svg>
                        </md-icon>
                      </div>
                      <span class="hymofs-config-label">
                        {uiStore.L.hymofs?.stealthTitle ?? "Stealth"}
                      </span>
                    </button>
                    <button
                      class={`hymofs-config-tile ${config()?.enable_hidexattr ? "active" : ""}`}
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            API.setHymofsHidexattr(
                              !Boolean(config()?.enable_hidexattr),
                            ),
                          uiStore.L.hymofs?.hidexattrUpdated ??
                            "HideXattr updated",
                        )
                      }
                    >
                      <md-ripple></md-ripple>
                      <div class="hymofs-config-icon">
                        <md-icon>
                          <svg viewBox="0 0 24 24">
                            <path d={ICONS.visibility_off} />
                          </svg>
                        </md-icon>
                      </div>
                      <span class="hymofs-config-label">
                        {uiStore.L.hymofs?.hidexattrTitle ?? "HideXattr"}
                      </span>
                    </button>
                    <button
                      class={`hymofs-config-tile ${config()?.enable_kernel_debug ? "active" : ""}`}
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            API.setHymofsDebug(
                              !Boolean(config()?.enable_kernel_debug),
                            ),
                          uiStore.L.hymofs?.kernelDebugUpdated ??
                            "Kernel debug updated",
                        )
                      }
                    >
                      <md-ripple></md-ripple>
                      <div class="hymofs-config-icon">
                        <md-icon>
                          <svg viewBox="0 0 24 24">
                            <path d={ICONS.bug} />
                          </svg>
                        </md-icon>
                      </div>
                      <span class="hymofs-config-label">
                        {uiStore.L.hymofs?.kernelDebugTitle ?? "Kernel Debug"}
                      </span>
                    </button>
                  </div>
                  <Show
                    when={
                      !status()?.available &&
                      status()?.status !== "disabled" &&
                      !lkm()?.loaded
                    }
                  >
                    <div class="runtime-note warning">
                      {uiStore.L.hymofs?.lkmUnavailableHint ??
                        "HymoFS is enabled, but the kernel module is not loaded yet."}
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </section>

          <section
            class={`hymofs-card hymofs-section ${isSectionExpanded("identity") ? "expanded" : ""}`}
          >
            <button
              class="hymofs-section-toggle"
              type="button"
              aria-expanded={isSectionExpanded("identity") ? "true" : "false"}
              aria-controls="hymofs-section-identity"
              onClick={() => toggleSection("identity")}
            >
              <div class="hymofs-card-head hymofs-section-toggle-inner">
                <div>
                  <div class="hymofs-card-title">
                    {uiStore.L.hymofs?.identityTitle ?? "Identity Spoof"}
                  </div>
                </div>
                <md-icon class="hymofs-section-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d={EXPAND_MORE_ICON} />
                  </svg>
                </md-icon>
              </div>
            </button>
            <div
              class="hymofs-section-body-wrapper"
              id="hymofs-section-identity"
            >
              <div class="hymofs-section-body-inner">
                <div class="hymofs-section-body field-stack">
                  <md-outlined-text-field
                    class="full-field hymofs-input-field"
                    label={uiStore.L.hymofs?.unameRelease ?? "Uname Release"}
                    value={forms.release}
                    onInput={(e: Event) =>
                      setForms(
                        "release",
                        (e.currentTarget as HTMLInputElement).value,
                      )
                    }
                    disabled={pending()}
                  />
                  <md-outlined-text-field
                    class="full-field hymofs-input-field"
                    label={uiStore.L.hymofs?.unameVersion ?? "Uname Version"}
                    value={forms.version}
                    onInput={(e: Event) =>
                      setForms(
                        "version",
                        (e.currentTarget as HTMLInputElement).value,
                      )
                    }
                    disabled={pending()}
                  />
                  <div class="button-row">
                    <md-outlined-button
                      disabled={pending()}
                      onClick={() => void fillOriginalKernelUname()}
                    >
                      {uiStore.L.hymofs?.fillOriginalKernel ??
                        "Load Original Kernel Values"}
                    </md-outlined-button>
                    <md-filled-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () =>
                            API.setHymofsUname({
                              release: forms.release,
                              version: forms.version,
                            }),
                          uiStore.L.hymofs?.applyUname ?? "Uname applied",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.applyUname ?? "Apply Uname"}
                    </md-filled-button>
                    <md-outlined-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () => API.clearHymofsUname(),
                          uiStore.L.hymofs?.clearUname ?? "Uname cleared",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.clearUname ?? "Clear Uname"}
                    </md-outlined-button>
                  </div>
                  <md-outlined-text-field
                    class="full-field hymofs-input-field"
                    label={uiStore.L.hymofs?.cmdlineValue ?? "Cmdline Value"}
                    value={forms.cmdline}
                    onInput={(e: Event) =>
                      setForms(
                        "cmdline",
                        (e.currentTarget as HTMLInputElement).value,
                      )
                    }
                    disabled={pending()}
                  />
                  <div class="button-row">
                    <md-filled-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () => API.setHymofsCmdline(forms.cmdline),
                          uiStore.L.hymofs?.applyCmdline ?? "Cmdline applied",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.applyCmdline ?? "Apply Cmdline"}
                    </md-filled-button>
                    <md-outlined-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () => API.clearHymofsCmdline(),
                          uiStore.L.hymofs?.clearCmdline ?? "Cmdline cleared",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.clearCmdline ?? "Clear Cmdline"}
                    </md-outlined-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            class={`hymofs-card hymofs-section ${isSectionExpanded("user-hide") ? "expanded" : ""}`}
          >
            <button
              class="hymofs-section-toggle"
              type="button"
              aria-expanded={isSectionExpanded("user-hide") ? "true" : "false"}
              aria-controls="hymofs-section-user-hide"
              onClick={() => toggleSection("user-hide")}
            >
              <div class="hymofs-card-head hymofs-section-toggle-inner">
                <div>
                  <div class="hymofs-card-title">
                    {uiStore.L.hymofs?.userHideTitle ?? "User Hide Rules"}
                  </div>
                </div>
                <md-icon class="hymofs-section-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d={EXPAND_MORE_ICON} />
                  </svg>
                </md-icon>
              </div>
            </button>
            <div
              class="hymofs-section-body-wrapper"
              id="hymofs-section-user-hide"
            >
              <div class="hymofs-section-body-inner">
                <div class="hymofs-section-body field-stack">
                  <md-outlined-text-field
                    class="full-field hymofs-input-field"
                    label={
                      uiStore.L.hymofs?.userHidePathLabel ??
                      "Persistent Hide Path"
                    }
                    value={forms.userHidePath}
                    onInput={(e: Event) =>
                      setForms(
                        "userHidePath",
                        (e.currentTarget as HTMLInputElement).value,
                      )
                    }
                    disabled={pending()}
                  />
                  <div class="button-row">
                    <md-filled-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(() => {
                          const path = forms.userHidePath.trim();
                          if (!path) {
                            throw new Error(
                              uiStore.L.hymofs?.userHidePathRequired ??
                                "Hide path cannot be empty",
                            );
                          }
                          return API.addUserHideRule(path);
                        }, uiStore.L.hymofs?.hideRuleAdded ?? "Hide rule added")
                      }
                    >
                      {uiStore.L.hymofs?.addHideRule ?? "Add Hide Rule"}
                    </md-filled-button>
                    <md-outlined-button
                      disabled={pending()}
                      onClick={() =>
                        runAction(
                          () => API.applyUserHideRules(),
                          uiStore.L.hymofs?.hideRulesApplied ??
                            "User hide rules applied",
                        )
                      }
                    >
                      {uiStore.L.hymofs?.applyHideRules ?? "Apply Stored Hides"}
                    </md-outlined-button>
                  </div>
                  <div class="hide-rule-list">
                    <For each={userHideRules()}>
                      {(path) => (
                        <div class="hide-rule-item">
                          <span class="hide-rule-path mono">{path}</span>
                          <button
                            class="hide-rule-remove"
                            type="button"
                            disabled={pending()}
                            onClick={() =>
                              runAction(
                                () => API.removeUserHideRule(path),
                                uiStore.L.hymofs?.hideRuleRemoved ??
                                  "Hide rule removed",
                              )
                            }
                          >
                            {uiStore.L.hymofs?.removeHideRule ?? "Remove"}
                          </button>
                        </div>
                      )}
                    </For>
                    <Show when={userHideRules().length === 0}>
                      <div class="empty-inline-note">
                        {uiStore.L.hymofs?.noUserHideRules ??
                          "No persistent user hide rules yet."}
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Show when={status()?.available && mapsSpoofSupported()}>
            <section
              class={`hymofs-card hymofs-section ${isSectionExpanded("maps") ? "expanded" : ""}`}
            >
              <button
                class="hymofs-section-toggle"
                type="button"
                aria-expanded={isSectionExpanded("maps") ? "true" : "false"}
                aria-controls="hymofs-section-maps"
                onClick={() => toggleSection("maps")}
              >
                <div class="hymofs-card-head hymofs-section-toggle-inner">
                  <div>
                    <div class="hymofs-card-title">
                      {uiStore.L.hymofs?.mapsTitle ?? "Maps Spoof Rules"}
                    </div>
                  </div>
                  <div class="hymofs-section-toggle-end">
                    <div class="state-pill">
                      {config()?.maps_rules?.length ?? 0}
                    </div>
                    <md-icon class="hymofs-section-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d={EXPAND_MORE_ICON} />
                      </svg>
                    </md-icon>
                  </div>
                </div>
              </button>
              <div class="hymofs-section-body-wrapper" id="hymofs-section-maps">
                <div class="hymofs-section-body-inner">
                  <div class="hymofs-section-body field-stack">
                    <div class="meta-list">
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.mapsRuleCount ?? "Maps rules"}
                        </span>
                        <strong>{config()?.maps_rules?.length ?? 0}</strong>
                      </div>
                    </div>
                    <div class="sub-grid">
                      <md-outlined-text-field
                        class="full-field hymofs-input-field"
                        label={
                          uiStore.L.hymofs?.mapsTargetIno ?? "Target Inode"
                        }
                        value={forms.mapsTargetIno}
                        onInput={(e: Event) =>
                          setForms(
                            "mapsTargetIno",
                            (e.currentTarget as HTMLInputElement).value,
                          )
                        }
                        disabled={pending()}
                      />
                      <md-outlined-text-field
                        class="full-field hymofs-input-field"
                        label={
                          uiStore.L.hymofs?.mapsTargetDev ?? "Target Device"
                        }
                        value={forms.mapsTargetDev}
                        onInput={(e: Event) =>
                          setForms(
                            "mapsTargetDev",
                            (e.currentTarget as HTMLInputElement).value,
                          )
                        }
                        disabled={pending()}
                      />
                      <md-outlined-text-field
                        class="full-field hymofs-input-field"
                        label={
                          uiStore.L.hymofs?.mapsSpoofedIno ?? "Spoofed Inode"
                        }
                        value={forms.mapsSpoofedIno}
                        onInput={(e: Event) =>
                          setForms(
                            "mapsSpoofedIno",
                            (e.currentTarget as HTMLInputElement).value,
                          )
                        }
                        disabled={pending()}
                      />
                      <md-outlined-text-field
                        class="full-field hymofs-input-field"
                        label={
                          uiStore.L.hymofs?.mapsSpoofedDev ?? "Spoofed Device"
                        }
                        value={forms.mapsSpoofedDev}
                        onInput={(e: Event) =>
                          setForms(
                            "mapsSpoofedDev",
                            (e.currentTarget as HTMLInputElement).value,
                          )
                        }
                        disabled={pending()}
                      />
                    </div>
                    <md-outlined-text-field
                      class="full-field hymofs-input-field"
                      label={
                        uiStore.L.hymofs?.mapsSpoofedPath ?? "Spoofed Path"
                      }
                      value={forms.mapsPath}
                      onInput={(e: Event) =>
                        setForms(
                          "mapsPath",
                          (e.currentTarget as HTMLInputElement).value,
                        )
                      }
                      disabled={pending()}
                    />
                    <div class="button-row">
                      <md-filled-button
                        disabled={pending()}
                        onClick={() =>
                          runAction(() => {
                            const spoofedPath = forms.mapsPath.trim();
                            if (!spoofedPath) {
                              throw new Error(
                                uiStore.L.hymofs?.mapsPathRequired ??
                                  "Spoofed path cannot be empty",
                              );
                            }
                            return API.addHymofsMapsRule({
                              target_ino: parseUnsignedInput(
                                forms.mapsTargetIno,
                                "target inode",
                              ),
                              target_dev: parseUnsignedInput(
                                forms.mapsTargetDev,
                                "target device",
                              ),
                              spoofed_ino: parseUnsignedInput(
                                forms.mapsSpoofedIno,
                                "spoofed inode",
                              ),
                              spoofed_dev: parseUnsignedInput(
                                forms.mapsSpoofedDev,
                                "spoofed device",
                              ),
                              spoofed_pathname: spoofedPath,
                            });
                          }, uiStore.L.hymofs?.mapsRuleAdded ?? "Maps spoof rule added")
                        }
                      >
                        {uiStore.L.hymofs?.mapsAddRule ?? "Add Maps Rule"}
                      </md-filled-button>
                      <md-outlined-button
                        disabled={pending()}
                        onClick={() =>
                          runAction(
                            () => API.clearHymofsMapsRules(),
                            uiStore.L.hymofs?.mapsCleared ??
                              "Maps rules cleared",
                          )
                        }
                      >
                        {uiStore.L.hymofs?.mapsClear ?? "Clear Maps Rules"}
                      </md-outlined-button>
                    </div>
                    <div class="hide-rule-list">
                      <For each={config()?.maps_rules || []}>
                        {(rule) => (
                          <div class="hide-rule-item">
                            <div class="hide-rule-path">
                              <div class="mono">{rule.spoofed_pathname}</div>
                              <div class="secondary-inline mono">
                                {(
                                  uiStore.L.hymofs?.mapsRuleSummary ??
                                  "target {target} -> spoof {spoofed}"
                                )
                                  .replace(
                                    "{target}",
                                    `${rule.target_ino}:${rule.target_dev}`,
                                  )
                                  .replace(
                                    "{spoofed}",
                                    `${rule.spoofed_ino}:${rule.spoofed_dev}`,
                                  )}
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={(config()?.maps_rules?.length || 0) === 0}>
                        <div class="empty-inline-note">
                          {uiStore.L.hymofs?.mapsEmpty ??
                            "No maps spoof rules configured."}
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </Show>

          <section
            class={`hymofs-card hymofs-section ${isSectionExpanded("features") ? "expanded" : ""}`}
          >
            <button
              class="hymofs-section-toggle"
              type="button"
              aria-expanded={isSectionExpanded("features") ? "true" : "false"}
              aria-controls="hymofs-section-features"
              onClick={() => toggleSection("features")}
            >
              <div class="hymofs-card-head hymofs-section-toggle-inner">
                <div>
                  <div class="hymofs-card-title">
                    {uiStore.L.hymofs?.featuresTitle ?? "Capabilities"}
                  </div>
                </div>
                <md-icon class="hymofs-section-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d={EXPAND_MORE_ICON} />
                  </svg>
                </md-icon>
              </div>
            </button>
            <div
              class="hymofs-section-body-wrapper"
              id="hymofs-section-features"
            >
              <div class="hymofs-section-body-inner">
                <div class="hymofs-section-body">
                  <Show
                    when={!loading()}
                    fallback={<Skeleton variant="feature-card" />}
                  >
                    <div class="meta-list">
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.featureBits ?? "Feature bits"}
                        </span>
                        <strong>{status()?.feature_bits ?? 0}</strong>
                      </div>
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.hideUidCount ?? "Hide UIDs"}
                        </span>
                        <strong>{config()?.hide_uids?.length ?? 0}</strong>
                      </div>
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.userHideCount ?? "User hide rules"}
                        </span>
                        <strong>{status()?.user_hide_rule_count ?? 0}</strong>
                      </div>
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.mapsRuleCount ?? "Maps rules"}
                        </span>
                        <strong>{config()?.maps_rules?.length ?? 0}</strong>
                      </div>
                      <div class="meta-row">
                        <span>
                          {uiStore.L.hymofs?.kstatRuleCount ?? "Kstat rules"}
                        </span>
                        <strong>{config()?.kstat_rules?.length ?? 0}</strong>
                      </div>
                    </div>
                    <div class="chip-section">
                      <For each={status()?.feature_names || []}>
                        {(name) => <span class="feature-chip">{name}</span>}
                      </For>
                    </div>
                    <div class="chip-section subdued">
                      <For each={status()?.hooks || []}>
                        {(name) => (
                          <span class="feature-chip hook">{name}</span>
                        )}
                      </For>
                    </div>
                    <div class="chip-section">
                      <For each={activeModules()}>
                        {(name) => (
                          <span class="feature-chip active-module">{name}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section
          class={`hymofs-card hymofs-section rules-card ${isSectionExpanded("rules") ? "expanded" : ""}`}
        >
          <button
            class="hymofs-section-toggle"
            type="button"
            aria-expanded={isSectionExpanded("rules") ? "true" : "false"}
            aria-controls="hymofs-section-rules"
            onClick={() => toggleSection("rules")}
          >
            <div class="hymofs-card-head hymofs-section-toggle-inner">
              <div>
                <div class="hymofs-card-title">
                  {uiStore.L.hymofs?.rulesTitle ?? "Active Rules"}
                </div>
                <div class="hymofs-card-subtitle">{rulesSummaryText()}</div>
              </div>
              <md-icon class="hymofs-section-chevron" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d={EXPAND_MORE_ICON} />
                </svg>
              </md-icon>
            </div>
          </button>
          <div class="hymofs-section-body-wrapper" id="hymofs-section-rules">
            <div class="hymofs-section-body-inner">
              <div class="hymofs-section-body">
                <Show
                  when={!loading()}
                  fallback={
                    <div class="rule-list">
                      <Skeleton variant="rule-card" />
                      <Skeleton variant="rule-card" />
                    </div>
                  }
                >
                  <div class="rule-list">
                    <For each={rules()}>
                      {(rule) => (
                        <div class="rule-card">
                          <div class="rule-head">
                            <span
                              class={`rule-kind ${ruleKind(rule).toLowerCase()}`}
                            >
                              {ruleKind(rule)}
                            </span>
                            <Show when={rule.file_type != null}>
                              <span class="rule-aux">
                                {`${uiStore.L.hymofs?.dtypeLabel ?? "dtype"} ${rule.file_type}`}
                              </span>
                            </Show>
                          </div>
                          <div class="rule-main mono">
                            {rule.target || rule.path || rule.args || "-"}
                          </div>
                          <Show when={rule.source}>
                            <div class="rule-sub mono">{rule.source}</div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomActions>
        <md-filled-tonal-icon-button
          disabled={pending()}
          onClick={() => load()}
          title={uiStore.L.hymofs?.refresh ?? "Refresh"}
        >
          <md-icon>
            <svg viewBox="0 0 24 24">
              <path d={ICONS.refresh} />
            </svg>
          </md-icon>
        </md-filled-tonal-icon-button>
        <div class="spacer"></div>

        <md-filled-button
          disabled={pending()}
          onClick={() =>
            runAction(
              () => API.clearHymofsRules(),
              uiStore.L.hymofs?.clearRules ?? "Rules cleared",
            )
          }
        >
          <md-icon slot="icon">
            <svg viewBox="0 0 24 24">
              <path d={ICONS.delete} />
            </svg>
          </md-icon>
          {uiStore.L.hymofs?.clearRules ?? "Clear Rules"}
        </md-filled-button>
      </BottomActions>
    </>
  );
}
