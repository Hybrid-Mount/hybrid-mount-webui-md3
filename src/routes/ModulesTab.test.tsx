import { fireEvent, render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createModule(defaultMode: "overlay" | "magic" | "hymofs" | "ignore") {
  return {
    id: "demo.module",
    name: "Demo Module",
    version: "1.0.0",
    author: "tester",
    description: "demo",
    is_mounted: true,
    mode: defaultMode,
    rules: {
      default_mode: defaultMode,
      paths: {},
    },
  };
}

describe("ModulesTab", () => {
  beforeEach(() => {
    vi.resetModules();

    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
  });

  async function renderModulesTab(options: {
    hymofsEnabled: boolean;
    hymofsAvailable: boolean;
    moduleDefaultMode: "overlay" | "magic" | "hymofs" | "ignore";
  }) {
    let modules = [createModule(options.moduleDefaultMode)];

    const moduleStoreMock = {
      get modules() {
        return modules;
      },
      set modules(value: typeof modules) {
        modules = value;
      },
      loading: false,
      loadModules: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("../lib/stores/moduleStore", () => ({
      moduleStore: moduleStoreMock,
    }));

    vi.doMock("../lib/stores/hymofsStore", () => ({
      hymofsStore: {
        get enabled() {
          return options.hymofsEnabled;
        },
        get status() {
          return { available: options.hymofsAvailable };
        },
      },
    }));

    vi.doMock("../lib/stores/uiStore", () => ({
      uiStore: {
        showToast: vi.fn(),
        L: {
          common: {
            saving: "Saving",
          },
          modules: {
            searchPlaceholder: "Search modules",
            filterLabel: "Filter modules",
            filterAll: "All",
            emptyState: "No modules found.",
            umountHiddenHint: "Umount modules are hidden.",
            defaultMode: "Default Strategy",
            defaultTag: "Default",
            compatTag: "Compat",
            disableTag: "Disable",
            nativeTag: "Stealth",
            unavailableTag: "Unavailable",
            hymofsUnavailableHint: "HymoFS is enabled but not currently available.",
            modes: {
              overlay: "OverlayFS",
              magic: "Magic Mount",
              hymofs: "HymoFS",
              umount: "Umount",
              short: {
                overlay: "Overlay",
                magic: "Magic",
                hymofs: "HymoFS",
                ignore: "Ignore",
              },
            },
          },
        },
      },
    }));

    vi.doMock("../lib/api", () => ({
      API: {
        saveModuleRules: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.doMock("../components/Skeleton", () => ({
      default: () => <div data-testid="skeleton" />,
    }));

    vi.doMock("../components/BottomActions", () => ({
      default: (props: { children: unknown }) => <div>{props.children}</div>,
    }));

    for (const modulePath of [
      "@material/web/iconbutton/filled-tonal-icon-button.js",
      "@material/web/button/filled-button.js",
      "@material/web/button/filled-tonal-button.js",
      "@material/web/icon/icon.js",
    ]) {
      vi.doMock(modulePath, () => ({}));
    }

    const { default: ModulesTab } = await import("./ModulesTab");
    const result = render(() => <ModulesTab />);

    await waitFor(() => {
      expect(moduleStoreMock.loadModules).toHaveBeenCalledTimes(1);
    });

    return { ...result, moduleStoreMock };
  }

  it("hides the HymoFS strategy option when the master switch is disabled", async () => {
    const { container } = await renderModulesTab({
      hymofsEnabled: false,
      hymofsAvailable: false,
      moduleDefaultMode: "overlay",
    });

    expect(
      container.querySelector('.filter-select option[value="hymofs"]'),
    ).toBeNull();

    const header = container.querySelector(".module-header");
    expect(header).not.toBeNull();
    await fireEvent.click(header!);

    const strategyButtons = Array.from(
      container.querySelectorAll(".strategy-selector .strategy-option"),
    );
    expect(strategyButtons).toHaveLength(3);
    expect(
      strategyButtons.some((node) => node.textContent?.includes("HymoFS")),
    ).toBe(false);
  });

  it("shows a disabled HymoFS strategy button and falls back to ignore when unavailable", async () => {
    const { container } = await renderModulesTab({
      hymofsEnabled: true,
      hymofsAvailable: false,
      moduleDefaultMode: "hymofs",
    });

    expect(
      container.querySelector('.filter-select option[value="hymofs"]'),
    ).not.toBeNull();

    const header = container.querySelector(".module-header");
    expect(header).not.toBeNull();
    await fireEvent.click(header!);

    const strategyButtons = Array.from(
      container.querySelectorAll(
        ".strategy-selector .strategy-option",
      ),
    ) as HTMLButtonElement[];
    const hymofsButton = strategyButtons.find((node) =>
      node.textContent?.includes("HymoFS"),
    );
    const selectedButton = strategyButtons.find((node) =>
      node.classList.contains("selected"),
    );

    expect(hymofsButton).toBeDefined();
    expect(hymofsButton?.disabled).toBe(true);
    expect(hymofsButton?.textContent).toContain("Unavailable");
    expect(selectedButton?.textContent).toContain("Ignore");
  });
});
