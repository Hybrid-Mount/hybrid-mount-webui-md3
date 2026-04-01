import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, onMount } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

type RouteId = "status" | "config" | "modules" | "info";

function createRouteComponent(
  routeId: RouteId,
  mountCounts: Record<RouteId, number>,
) {
  return function MockRoute() {
    const [count, setCount] = createSignal(0);

    onMount(() => {
      mountCounts[routeId] += 1;
    });

    return (
      <section data-testid={`${routeId}-route`}>
        <div>{`${routeId} count ${count()}`}</div>
        <button
          type="button"
          aria-label={`${routeId}-increment`}
          onClick={() => setCount((value) => value + 1)}
        >
          increment
        </button>
      </section>
    );
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads app stores on startup and only mounts tab content after first visit", async () => {
    const mountCounts: Record<RouteId, number> = {
      status: 0,
      config: 0,
      modules: 0,
      info: 0,
    };

    const uiStoreMock = {
      get isReady() {
        return true;
      },
      init: vi.fn().mockResolvedValue(undefined),
    };

    const configStoreMock = {
      loadConfig: vi.fn().mockResolvedValue(undefined),
    };

    const sysStoreMock = {
      ensureStatusLoaded: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("./lib/stores/uiStore", () => ({
      uiStore: uiStoreMock,
    }));

    vi.doMock("./lib/stores/configStore", () => ({
      configStore: configStoreMock,
    }));

    vi.doMock("./lib/stores/sysStore", () => ({
      sysStore: sysStoreMock,
    }));

    vi.doMock("./components/TopBar", () => ({
      default: () => <div data-testid="top-bar">top bar</div>,
    }));

    vi.doMock("./components/Toast", () => ({
      default: () => <div data-testid="toast">toast</div>,
    }));

    vi.doMock("./components/NavBar", () => ({
      default: (props: {
        tabs: { id: string }[];
        onTabChange: (id: string) => void;
      }) => (
        <nav>
          {props.tabs.map((tab) => (
            <button
              type="button"
              aria-label={`nav:${tab.id}`}
              onClick={() => props.onTabChange(tab.id)}
            >
              {tab.id}
            </button>
          ))}
        </nav>
      ),
    }));

    vi.doMock("./routes/StatusTab", () => ({
      default: createRouteComponent("status", mountCounts),
    }));

    vi.doMock("./routes/ConfigTab", () => ({
      default: createRouteComponent("config", mountCounts),
    }));

    vi.doMock("./routes/ModulesTab", () => ({
      default: createRouteComponent("modules", mountCounts),
    }));

    vi.doMock("./routes/InfoTab", () => ({
      default: createRouteComponent("info", mountCounts),
    }));

    const { default: App } = await import("./App");

    render(() => <App />);

    expect(await screen.findByTestId("status-route")).toBeInTheDocument();
    expect(screen.queryByTestId("config-route")).not.toBeInTheDocument();
    expect(mountCounts.status).toBe(1);
    expect(mountCounts.config).toBe(0);

    await waitFor(() => {
      expect(uiStoreMock.init).toHaveBeenCalledTimes(1);
      expect(configStoreMock.loadConfig).toHaveBeenCalledTimes(1);
      expect(sysStoreMock.ensureStatusLoaded).toHaveBeenCalledTimes(1);
    });

    await fireEvent.click(screen.getByRole("button", { name: "nav:config" }));

    expect(await screen.findByTestId("config-route")).toBeInTheDocument();
    expect(mountCounts.config).toBe(1);

    await fireEvent.click(
      screen.getByRole("button", { name: "config-increment" }),
    );
    expect(screen.getByText("config count 1")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "nav:status" }));
    await fireEvent.click(screen.getByRole("button", { name: "nav:config" }));

    expect(screen.getByText("config count 1")).toBeInTheDocument();
    expect(mountCounts.config).toBe(1);
    expect(mountCounts.modules).toBe(0);
    expect(mountCounts.info).toBe(0);
  });
});
