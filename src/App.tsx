import {
  createEffect,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Show,
  lazy,
  For,
} from "solid-js";
import { uiStore } from "./lib/stores/uiStore";
import { configStore } from "./lib/stores/configStore";
import { sysStore } from "./lib/stores/sysStore";
import { moduleStore } from "./lib/stores/moduleStore";
import TopBar from "./components/TopBar";
import NavBar from "./components/NavBar";
import Toast from "./components/Toast";

const loadStatusTab = () => import("./routes/StatusTab");
const loadConfigTab = () => import("./routes/ConfigTab");
const loadModulesTab = () => import("./routes/ModulesTab");
const loadInfoTab = () => import("./routes/InfoTab");

const routes = [
  { id: "status", load: loadStatusTab, component: lazy(loadStatusTab) },
  { id: "config", load: loadConfigTab, component: lazy(loadConfigTab) },
  { id: "modules", load: loadModulesTab, component: lazy(loadModulesTab) },
  { id: "info", load: loadInfoTab, component: lazy(loadInfoTab) },
];

export default function App() {
  const [activeTab, setActiveTab] = createSignal("status");
  const [dragOffset, setDragOffset] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [visitedTabs, setVisitedTabs] = createSignal(
    new Set<string>([activeTab()]),
  );

  let containerRef: HTMLDivElement | undefined;
  let containerWidth = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let ticking = false;
  let rafId: number | null = null;
  let preloadTimer: number | undefined;
  let disposed = false;

  const visibleTabs = createMemo(() => routes.map((r) => r.id));

  const baseTranslateX = createMemo(() => {
    const index = visibleTabs().indexOf(activeTab());
    return index * -(100 / visibleTabs().length);
  });

  createEffect(() => {
    const currentTab = activeTab();
    setVisitedTabs((prev) => {
      if (prev.has(currentTab)) return prev;
      const next = new Set(prev);
      next.add(currentTab);
      return next;
    });
  });

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    setIsDragging(true);
    setDragOffset(0);
    ticking = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging()) return;
    const currentX = e.changedTouches[0].screenX;
    const currentY = e.changedTouches[0].screenY;
    let diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (Math.abs(diffY) > Math.abs(diffX)) return;
    if (e.cancelable) e.preventDefault();

    if (!ticking) {
      ticking = true;
      rafId = requestAnimationFrame(() => {
        ticking = false;
        rafId = null;
        if (!isDragging()) return;
        const tabs = visibleTabs();
        const currentIndex = tabs.indexOf(activeTab());
        if (
          (currentIndex === 0 && diffX > 0) ||
          (currentIndex === tabs.length - 1 && diffX < 0)
        ) {
          diffX = diffX / 3;
        }
        setDragOffset(diffX);
      });
    }
  }

  function handleTouchEnd() {
    if (!isDragging()) return;
    setIsDragging(false);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      ticking = false;
    }
    if (containerRef) containerWidth = containerRef.clientWidth;
    const threshold = containerWidth * 0.33 || 80;
    const tabs = visibleTabs();
    const currentIndex = tabs.indexOf(activeTab());
    let nextIndex = currentIndex;
    const currentOffset = dragOffset();

    if (currentOffset < -threshold && currentIndex < tabs.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (currentOffset > threshold && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }
    if (nextIndex !== currentIndex) setActiveTab(tabs[nextIndex]);
    setDragOffset(0);
  }

  onCleanup(() => {
    disposed = true;
    if (preloadTimer !== undefined) {
      window.clearTimeout(preloadTimer);
    }
  });

  onMount(() => {
    const viewport = window.visualViewport;
    const rootStyle = document.documentElement.style;
    const readBottomInset = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--bottom-inset")
        .trim();
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    };

    if (viewport) {
      let viewportRafId = 0;
      let lastInset = -1;
      let stableBottomInset = readBottomInset();
      let navShiftTimer: number | undefined;
      let pendingNavShift = 0;
      let appliedNavShift = -1;

      const applyNavShift = (shift: number) => {
        if (Math.abs(appliedNavShift - shift) < 2) return;
        appliedNavShift = shift;
        rootStyle.setProperty("--bottom-nav-keyboard-shift", `${shift}px`);
      };

      rootStyle.setProperty("--stable-bottom-inset", `${stableBottomInset}px`);
      applyNavShift(0);

      const updateViewportBottomOffset = () => {
        if (viewportRafId) return;

        viewportRafId = window.requestAnimationFrame(() => {
          viewportRafId = 0;
          const inset = Math.max(
            0,
            Math.round(
              window.innerHeight - viewport.height - viewport.offsetTop,
            ),
          );

          if (inset <= stableBottomInset + 2) {
            const nextStableInset = readBottomInset();
            if (Math.abs(nextStableInset - stableBottomInset) >= 2) {
              stableBottomInset = nextStableInset;
              rootStyle.setProperty(
                "--stable-bottom-inset",
                `${stableBottomInset}px`,
              );
            }
          }

          const navShift = Math.max(0, inset - stableBottomInset);
          if (lastInset < 0 || navShift === 0) {
            if (navShiftTimer !== undefined) {
              window.clearTimeout(navShiftTimer);
              navShiftTimer = undefined;
            }
            applyNavShift(navShift);
          } else {
            pendingNavShift = navShift;
            if (navShiftTimer !== undefined) {
              window.clearTimeout(navShiftTimer);
            }
            navShiftTimer = window.setTimeout(() => {
              navShiftTimer = undefined;
              applyNavShift(pendingNavShift);
            }, 80);
          }

          if (Math.abs(lastInset - inset) < 2) return;
          lastInset = inset;
          rootStyle.setProperty("--viewport-bottom-offset", `${inset}px`);
        });
      };

      updateViewportBottomOffset();
      viewport.addEventListener("resize", updateViewportBottomOffset);
      viewport.addEventListener("scroll", updateViewportBottomOffset);
      window.addEventListener("orientationchange", updateViewportBottomOffset);

      onCleanup(() => {
        if (viewportRafId) window.cancelAnimationFrame(viewportRafId);
        if (navShiftTimer !== undefined) {
          window.clearTimeout(navShiftTimer);
        }
        viewport.removeEventListener("resize", updateViewportBottomOffset);
        viewport.removeEventListener("scroll", updateViewportBottomOffset);
        window.removeEventListener(
          "orientationchange",
          updateViewportBottomOffset,
        );
        rootStyle.removeProperty("--bottom-nav-keyboard-shift");
        rootStyle.removeProperty("--stable-bottom-inset");
        rootStyle.removeProperty("--viewport-bottom-offset");
      });
    }

    void initializeApp();
  });

  async function initializeApp() {
    await uiStore.init();
    await Promise.all([
      configStore.loadConfig(),
      sysStore.ensureStatusLoaded(),
      moduleStore.ensureModulesLoaded(),
    ]);

    if (disposed) return;

    const pendingRoutes = routes.filter((route) => route.id !== activeTab());
    let nextIndex = 0;

    const preloadNextRoute = () => {
      if (disposed) return;

      const nextRoute = pendingRoutes[nextIndex++];
      if (!nextRoute) return;

      void nextRoute.load();

      if (nextIndex < pendingRoutes.length) {
        preloadTimer = window.setTimeout(preloadNextRoute, 120);
      }
    };

    preloadTimer = window.setTimeout(preloadNextRoute, 250);
  }

  return (
    <div class="app-root">
      <Show
        when={uiStore.isReady}
        fallback={
          <div class="loading-container">
            <div class="spinner"></div>
            <span class="loading-text">Loading...</span>
          </div>
        }
      >
        <TopBar />
        <main
          class="main-content"
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div
            class="swipe-track"
            style={{
              transform: `translateX(calc(${baseTranslateX()}% + ${dragOffset()}px))`,
              width: `${visibleTabs().length * 100}%`,
              transition: isDragging()
                ? "none"
                : "transform 0.4s cubic-bezier(0.2, 1, 0.2, 1)",
            }}
          >
            <For each={routes}>
              {(route) => (
                <div
                  class="swipe-page"
                  style={{ width: `${100 / visibleTabs().length}%` }}
                >
                  <Show
                    when={visitedTabs().has(route.id)}
                    fallback={<div class="page-scroller" aria-hidden="true" />}
                  >
                    <div class="page-scroller">
                      <route.component />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </main>
        <NavBar
          activeTab={activeTab()}
          onTabChange={setActiveTab}
          tabs={routes}
        />
      </Show>
      <Toast />
    </div>
  );
}
