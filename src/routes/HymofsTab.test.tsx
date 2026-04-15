import { fireEvent, render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createStatus() {
  return {
    status: "available",
    available: true,
    protocol_version: 14,
    feature_bits: 0x1e7,
    feature_names: ["uname_spoof", "maps_spoof"],
    hooks: ["d_path"],
    rule_count: 1,
    user_hide_rule_count: 0,
    mirror_path: "/dev/hymo_mirror",
    lkm: {
      loaded: true,
      autoload: true,
      kmi_override: "",
      current_kmi: "android15-6.6",
      last_error: null,
    },
    config: {
      enabled: true,
      ignore_protocol_mismatch: false,
      lkm_autoload: true,
      lkm_dir: "/data/adb/modules/hybrid_mount/hymofs_lkm",
      lkm_kmi_override: "",
      mirror_path: "/dev/hymo_mirror",
      enable_kernel_debug: false,
      enable_stealth: true,
      enable_hidexattr: false,
      enable_mount_hide: false,
      enable_maps_spoof: true,
      enable_statfs_spoof: false,
      mount_hide: {
        enabled: false,
        path_pattern: "",
      },
      statfs_spoof: {
        enabled: false,
        path: "",
        spoof_f_type: 0,
      },
      hide_uids: [],
      uname: {
        sysname: "",
        nodename: "",
        release: "spoofed-release",
        version: "spoofed-version",
        machine: "",
        domainname: "",
      },
      uname_release: "spoofed-release",
      uname_version: "spoofed-version",
      cmdline_value: "",
      kstat_rules: [],
      maps_rules: [],
    },
    runtime: {
      snapshot: {},
      hymofs_modules: [],
    },
  };
}

describe("HymofsTab", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function renderHymofsTab() {
    const getOriginalKernelUname = vi.fn().mockResolvedValue({
      release: "6.6.30-android15-gki",
      version: "#1 SMP PREEMPT Mon Apr 7 18:20:00 CST 2026",
    });
    const showToast = vi.fn();

    vi.doMock("../lib/api", () => ({
      API: {
        getHymofsStatus: vi.fn().mockResolvedValue(createStatus()),
        getHymofsRules: vi.fn().mockResolvedValue([]),
        getUserHideRules: vi.fn().mockResolvedValue([]),
        getOriginalKernelUname,
      },
    }));

    vi.doMock("../lib/stores/uiStore", () => ({
      uiStore: {
        showToast,
        L: {
          hymofs: {
            fillOriginalKernel: "Load Original Kernel Values",
            originalKernelLoaded: "Loaded original kernel values",
          },
        },
      },
    }));

    vi.doMock("../lib/stores/hymofsStore", () => ({
      hymofsStore: {
        refreshStatus: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.doMock("../components/BottomActions", () => ({
      default: (props: { children: unknown }) => <div>{props.children}</div>,
    }));

    vi.doMock("../components/Skeleton", () => ({
      default: () => <div data-testid="skeleton" />,
    }));

    for (const modulePath of [
      "@material/web/button/filled-button.js",
      "@material/web/button/outlined-button.js",
      "@material/web/icon/icon.js",
      "@material/web/iconbutton/filled-tonal-icon-button.js",
      "@material/web/textfield/outlined-text-field.js",
    ]) {
      vi.doMock(modulePath, () => ({}));
    }

    const { default: HymofsTab } = await import("./HymofsTab");
    const result = render(() => <HymofsTab />);

    await waitFor(() => {
      expect(result.container.querySelectorAll("md-outlined-text-field").length).toBeGreaterThan(1);
    });

    return { ...result, getOriginalKernelUname, showToast };
  }

  it("loads original kernel values into the uname form", async () => {
    const { container, getOriginalKernelUname, showToast } =
      await renderHymofsTab();

    const button = Array.from(
      container.querySelectorAll("md-outlined-button"),
    ).find((node) =>
      node.textContent?.includes("Load Original Kernel Values"),
    );
    expect(button).toBeDefined();

    await fireEvent.click(button!);

    await waitFor(() => {
      expect(getOriginalKernelUname).toHaveBeenCalledTimes(1);
    });

    const fields = container.querySelectorAll("md-outlined-text-field");
    expect((fields[0] as { value?: string }).value).toBe(
      "6.6.30-android15-gki",
    );
    expect((fields[1] as { value?: string }).value).toBe(
      "#1 SMP PREEMPT Mon Apr 7 18:20:00 CST 2026",
    );
    expect(showToast).toHaveBeenCalledWith(
      "Loaded original kernel values",
      "success",
    );
  });
});
