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

  onMount(async () => {
    await uiStore.init();
    await Promise.all([
      configStore.loadConfig(),
      sysStore.ensureStatusLoaded(),
      moduleStore.ensureModulesLoaded(),
    ]);

    const pendingRoutes = routes.filter((route) => route.id !== activeTab());
    let preloadTimer = 0;
    let nextIndex = 0;

    const preloadNextRoute = () => {
      const nextRoute = pendingRoutes[nextIndex++];
      if (!nextRoute) return;

      void nextRoute.load();

      if (nextIndex < pendingRoutes.length) {
        preloadTimer = window.setTimeout(preloadNextRoute, 120);
      }
    };

    preloadTimer = window.setTimeout(preloadNextRoute, 250);
    onCleanup(() => window.clearTimeout(preloadTimer));
  });

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
