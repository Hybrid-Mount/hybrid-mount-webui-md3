import { render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

function triggerClick(node: Element) {
  node.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

describe("ConfigTab", () => {
  const warningCookie = "mhm_hymofs_warning_ack";

  beforeEach(() => {
    vi.resetModules();
    clearCookie(warningCookie);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  async function renderConfigTab() {
    const setHymofsEnabled = vi.fn().mockResolvedValue(undefined);
    const refreshStatus = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    vi.doMock("../lib/api", () => ({
      API: {
        setHymofsEnabled,
        saveConfig: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.doMock("../lib/stores/uiStore", () => ({
      uiStore: {
        showToast,
        L: {
          common: { cancel: "Cancel", saving: "Saving" },
          config: {
            invalidPath: "Invalid path detected",
            saveFailed: "Failed to save",
            save: "Save",
            hymofsMasterSwitch: "Enable HymoFS",
            hymofsWarningTitle: "Enable Experimental HymoFS?",
            hymofsEnableConfirm: "Enable HymoFS",
            hymofsEnabledSuccess: "HymoFS enabled",
            hymofsDisabledSuccess: "HymoFS disabled",
          },
        },
      },
    }));

    vi.doMock("../lib/stores/configStore", () => ({
      configStore: {
        config: {
          moduledir: "/data/adb/modules",
          mountsource: "KSU",
          partitions: [],
          overlay_mode: "ext4",
          disable_umount: false,
          enable_overlay_fallback: false,
        },
        loading: false,
        saving: false,
        saveConfig: vi.fn().mockResolvedValue(undefined),
        loadConfig: vi.fn().mockResolvedValue(undefined),
        resetConfig: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.doMock("../lib/stores/sysStore", () => ({
      sysStore: {
        storage: { supported_modes: ["tmpfs", "ext4"] },
        systemInfo: { supported_overlay_modes: ["tmpfs", "ext4"] },
      },
    }));

    vi.doMock("../lib/stores/hymofsStore", () => ({
      hymofsStore: {
        enabled: false,
        loading: false,
        refreshStatus,
      },
    }));

    for (const modulePath of [
      "@material/web/textfield/outlined-text-field.js",
      "@material/web/button/filled-button.js",
      "@material/web/iconbutton/filled-tonal-icon-button.js",
      "@material/web/icon/icon.js",
      "@material/web/ripple/ripple.js",
      "@material/web/dialog/dialog.js",
      "@material/web/button/text-button.js",
      "@material/web/switch/switch.js",
    ]) {
      vi.doMock(modulePath, () => ({}));
    }

    vi.doMock("../components/ChipInput", () => ({
      default: () => <div data-testid="chip-input" />,
    }));

    vi.doMock("../components/BottomActions", () => ({
      default: (props: { children: any }) => <div>{props.children}</div>,
    }));

    const { default: ConfigTab } = await import("./ConfigTab");
    const result = render(() => <ConfigTab />);

    return {
      ...result,
      setHymofsEnabled,
      refreshStatus,
      showToast,
    };
  }

  it("shows the warning dialog on first enable", async () => {
    const { container } = await renderConfigTab();

    const toggleButton = container.querySelector(
      'button[aria-label="Enable HymoFS"]',
    );
    expect(toggleButton).not.toBeNull();

    triggerClick(toggleButton!);

    const saveButton = Array.from(
      container.querySelectorAll("md-filled-button"),
    ).find((node) => node.textContent?.includes("Save"));
    expect(saveButton).toBeDefined();
    await waitFor(() => {
      expect(saveButton?.hasAttribute("disabled")).toBe(false);
    });

    triggerClick(saveButton!);

    const dialogs = container.querySelectorAll("md-dialog");
    expect((dialogs[1] as { open?: boolean } | undefined)?.open).toBe(true);
  });

  it("remembers the warning with a cookie and skips it next time", async () => {
    const renderResult = await renderConfigTab();

    const firstToggle = renderResult.container.querySelector(
      'button[aria-label="Enable HymoFS"]',
    );
    expect(firstToggle).not.toBeNull();
    triggerClick(firstToggle!);

    const saveButton = Array.from(
      renderResult.container.querySelectorAll("md-filled-button"),
    ).find((node) => node.textContent?.includes("Save"));
    expect(saveButton).toBeDefined();
    await waitFor(() => {
      expect(saveButton?.hasAttribute("disabled")).toBe(false);
    });
    triggerClick(saveButton!);

    const confirmButton = Array.from(
      renderResult.container.querySelectorAll("md-text-button"),
    ).find((node) => node.textContent?.includes("Enable HymoFS"));
    expect(confirmButton).not.toBeUndefined();

    triggerClick(confirmButton!);

    await waitFor(() => {
      expect(renderResult.setHymofsEnabled).toHaveBeenCalledWith(true);
      expect(document.cookie).toContain(`${warningCookie}=1`);
    });

    renderResult.unmount();
    document.cookie = `${warningCookie}=1; Path=/`;

    const secondRender = await renderConfigTab();
    const secondToggle = secondRender.container.querySelector(
      'button[aria-label="Enable HymoFS"]',
    );
    expect(secondToggle).not.toBeNull();
    triggerClick(secondToggle!);

    const secondSaveButton = Array.from(
      secondRender.container.querySelectorAll("md-filled-button"),
    ).find((node) => node.textContent?.includes("Save"));
    expect(secondSaveButton).toBeDefined();
    await waitFor(() => {
      expect(secondSaveButton?.hasAttribute("disabled")).toBe(false);
    });

    secondRender.setHymofsEnabled.mockClear();
    triggerClick(secondSaveButton!);

    await waitFor(() => {
      expect(secondRender.setHymofsEnabled).toHaveBeenCalledWith(true);
    });

    const dialogs = secondRender.container.querySelectorAll("md-dialog");
    expect((dialogs[1] as { open?: boolean } | undefined)?.open).toBe(false);
  });
});
