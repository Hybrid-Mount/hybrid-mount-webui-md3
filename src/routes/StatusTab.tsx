import {
  createMemo,
  createRenderEffect,
  createSignal,
  Show,
  For,
} from "solid-js";
import { uiStore } from "../lib/stores/uiStore";
import { sysStore } from "../lib/stores/sysStore";
import { configStore } from "../lib/stores/configStore";
import { moduleStore } from "../lib/stores/moduleStore";
import { hymofsStore } from "../lib/stores/hymofsStore";
import { ICONS } from "../lib/constants";
import Skeleton from "../components/Skeleton";
import BottomActions from "../components/BottomActions";
import { API } from "../lib/api";
import "./StatusTab.css";

import "@material/web/iconbutton/filled-tonal-icon-button.js";
import "@material/web/icon/icon.js";
import "@material/web/dialog/dialog.js";
import "@material/web/button/text-button.js";
import "@material/web/ripple/ripple.js";

export default function StatusTab() {
  const displayPartitions = createMemo(() => [
    ...new Set(sysStore.activePartitions || []),
  ]);

  const mountedCount = createMemo(
    () => moduleStore.modules?.filter((m) => m.is_mounted).length ?? 0,
  );

  const [showRebootConfirm, setShowRebootConfirm] = createSignal(false);
  const moduleStatsReady = createMemo(
    () => !moduleStore.loading && moduleStore.hasLoaded,
  );
  const modeStats = createMemo(() => ({
    overlay: moduleStore.modeStats?.overlay || 0,
    magic: moduleStore.modeStats?.magic || 0,
    hymofs: moduleStore.modeStats?.hymofs || 0,
  }));

  let statsBarRef: HTMLDivElement | undefined;

  function getModeDisplayName(mode: string | null | undefined) {
    if (!mode) return "Unknown";
    const key = `mode_${mode}` as keyof typeof uiStore.L.config;
    return uiStore.L.config?.[key] || mode.toUpperCase();
  }

  const modeDistribution = createMemo(() => {
    const stats = modeStats();
    const showHymofs = hymofsStore.enabled;
    const overlay = stats.overlay;
    const magic = stats.magic;
    const hymofs = showHymofs ? stats.hymofs : 0;
    const total = overlay + magic + hymofs;

    if (total === 0) return { overlay: 0, magic: 0, hymofs: 0 };
    return {
      overlay: (overlay / total) * 100,
      magic: (magic / total) * 100,
      hymofs: (hymofs / total) * 100,
    };
  });

  createRenderEffect(() => {
    const distribution = modeDistribution();
    const statsBar = statsBarRef;
    if (!statsBar) return;

    statsBar.style.setProperty(
      "--bar-overlay-width",
      `${distribution.overlay}%`,
    );
    statsBar.style.setProperty("--bar-magic-width", `${distribution.magic}%`);
    statsBar.style.setProperty("--bar-hymofs-width", `${distribution.hymofs}%`);
  });

  return (
    <>
      <div class="dialog-container">
        <md-dialog
          open={showRebootConfirm()}
          onclose={() => setShowRebootConfirm(false)}
          class="transparent-scrim"
        >
          <div slot="headline">
            {uiStore.L?.common?.rebootTitle ?? "Reboot System?"}
          </div>
          <div slot="content">
            {uiStore.L?.common?.rebootConfirm ??
              "Are you sure you want to reboot the device?"}
          </div>
          <div slot="actions">
            <md-text-button onClick={() => setShowRebootConfirm(false)}>
              {uiStore.L?.common?.cancel ?? "Cancel"}
            </md-text-button>
            <md-text-button
              onClick={async () => {
                setShowRebootConfirm(false);
                try {
                  await API.reboot();
                } catch (error) {
                  uiStore.showToast(
                    error instanceof Error
                      ? error.message
                      : (uiStore.L?.status?.loadError ?? "Reboot failed"),
                    "error",
                  );
                }
              }}
            >
              {uiStore.L?.common?.reboot ?? "Reboot"}
            </md-text-button>
          </div>
        </md-dialog>
      </div>

      <div class="dashboard-grid">
        <div class="hero-card">
          <Show
            when={!sysStore.loading}
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
                {uiStore.L?.status?.storageTitle ?? "Backend Strategy"}
              </span>
              <span class="hero-value">
                {getModeDisplayName(sysStore.storage?.type)}
              </span>
            </div>

            <div class="mount-base-chip">
              <md-icon class="mount-base-icon">
                <svg viewBox="0 0 24 24">
                  <path d={ICONS.mount_path} />
                </svg>
              </md-icon>
              <span class="mount-base-text">
                {sysStore.systemInfo?.mountBase || "Unknown"}
              </span>
            </div>
          </Show>
        </div>

        <div class="metrics-row">
          <div class="metric-card">
            <Show
              when={moduleStatsReady()}
              fallback={<Skeleton variant="metric" />}
            >
              <div class="metric-icon-bg">
                <svg viewBox="0 0 24 24">
                  <path d={ICONS.modules} />
                </svg>
              </div>
              <span class="metric-value">{mountedCount()}</span>
              <span class="metric-label">
                {uiStore.L?.status?.moduleActive ?? "Active Modules"}
              </span>
            </Show>
          </div>

          <div class="metric-card">
            <Show
              when={!sysStore.loading}
              fallback={<Skeleton variant="metric" />}
            >
              <div class="metric-icon-bg">
                <svg viewBox="0 0 24 24">
                  <path d={ICONS.ksu} />
                </svg>
              </div>
              <span class="metric-value">
                {configStore.config?.mountsource || "-"}
              </span>
              <span class="metric-label">
                {uiStore.L?.config?.mountSource ?? "Mount Source"}
              </span>
            </Show>
          </div>
        </div>

        <div class="mode-stats-card">
          <div class="card-title">
            {uiStore.L?.status?.modeStats ?? "Mode Distribution"}
          </div>
          <Show
            when={moduleStatsReady()}
            fallback={<Skeleton variant="stats-bar" />}
          >
            <div class="stats-bar-container" ref={statsBarRef}>
              <div class="bar-segment bar-overlay"></div>
              <div class="bar-segment bar-magic"></div>
              <Show when={hymofsStore.enabled}>
                <div class="bar-segment bar-hymofs"></div>
              </Show>
            </div>
            <div class="stats-legend">
              <div class="legend-item">
                <div class="legend-dot dot-overlay"></div>
                <span>
                  {(uiStore.L.modules?.modes?.short?.overlay ?? "Overlay") +
                    ": " +
                    modeStats().overlay}
                </span>
              </div>
              <div class="legend-item">
                <div class="legend-dot dot-magic"></div>
                <span>
                  {(uiStore.L.modules?.modes?.short?.magic ?? "Magic") +
                    ": " +
                    modeStats().magic}
                </span>
              </div>
              <Show when={hymofsStore.enabled}>
                <div class="legend-item">
                  <div class="legend-dot dot-hymofs"></div>
                  <span>
                    {(uiStore.L.modules?.modes?.short?.hymofs ?? "HymoFS") +
                      ": " +
                      modeStats().hymofs}
                  </span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        <div class="info-card">
          <div class="card-title">
            {uiStore.L?.status?.sysInfoTitle ?? "System Info"}
          </div>

          <div class="info-row">
            <span class="info-key">
              {uiStore.L?.status?.kernel ?? "Kernel"}
            </span>
            <Show
              when={!sysStore.loading}
              fallback={<Skeleton variant="info-wide" />}
            >
              <span class="info-val">{sysStore.systemInfo?.kernel || "-"}</span>
            </Show>
          </div>

          <div class="info-row">
            <span class="info-key">
              {uiStore.L?.status?.selinux ?? "SELinux"}
            </span>
            <Show
              when={!sysStore.loading}
              fallback={<Skeleton variant="info-narrow" />}
            >
              <span class="info-val">
                {sysStore.systemInfo?.selinux || "-"}
              </span>
            </Show>
          </div>

          <div class="card-title card-title-spaced">
            {uiStore.L?.status?.activePartitions ?? "Partitions"}
          </div>

          <div class="partition-list">
            <Show
              when={!sysStore.loading}
              fallback={<Skeleton variant="chip-row" />}
            >
              <For each={displayPartitions()}>
                {(part) => (
                  <div
                    class={`partition-chip ${(sysStore.activePartitions || []).includes(part) ? "active" : ""}`}
                  >
                    {part}
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>

      <BottomActions>
        <div class="spacer"></div>
        <div class="action-row">
          <md-filled-tonal-icon-button
            class="reboot-btn"
            onClick={() => setShowRebootConfirm(true)}
            title="Reboot"
          >
            <md-icon>
              <svg viewBox="0 0 24 24">
                <path d={ICONS.power} />
              </svg>
            </md-icon>
          </md-filled-tonal-icon-button>

          <md-filled-tonal-icon-button
            onClick={() => sysStore.loadStatus()}
            disabled={sysStore.loading}
            title={uiStore.L?.logs?.refresh}
          >
            <md-icon>
              <svg viewBox="0 0 24 24">
                <path d={ICONS.refresh} />
              </svg>
            </md-icon>
          </md-filled-tonal-icon-button>
        </div>
      </BottomActions>
    </>
  );
}
