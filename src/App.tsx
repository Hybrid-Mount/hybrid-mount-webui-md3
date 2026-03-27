import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  Show,
  lazy,
  For,
} from "solid-js";
import { uiStore } from "./lib/stores/uiStore";
import { configStore } from "./lib/stores/configStore";
import { sysStore } from "./lib/stores/sysStore";
import TopBar from "./components/TopBar";
import NavBar from "./components/NavBar";
import Toast from "./components/Toast";

const routes = [
  { id: "status", component: lazy(() => import("./routes/StatusTab")) },
  { id: "config", component: lazy(() => import("./routes/ConfigTab")) },
  { id: "modules", component: lazy(() => import("./routes/ModulesTab")) },
  { id: "info", component: lazy(() => import("./routes/InfoTab")) },
];
const visibleTabIds = routes.map((r) => r.id);

export default function App() {
  const [activeTab, setActiveTab] = createSignal("status");
  const [dragOffset, setDragOffset] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [mountedTabs, setMountedTabs] = createSignal<Set<string>>(
    new Set(["status"]),
  );

  let containerRef: HTMLDivElement | undefined;
  let containerWidth = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let ticking = false;
  let rafId: number | null = null;
  let swipeTrackRef: HTMLDivElement | undefined;

  const baseTranslateX = createMemo(() => visibleTabIds.indexOf(activeTab()) * -100);

  const activeTabIndex = createMemo(() => visibleTabIds.indexOf(activeTab()));

  createEffect(() => {
    const current = activeTab();
    setMountedTabs((prev) => {
      if (prev.has(current)) return prev;
      const next = new Set(prev);
      next.add(current);
      return next;
    });
  });

  createEffect(() => {
    if (!swipeTrackRef) return;
    const translate = `translateX(calc(${baseTranslateX()}% + ${dragOffset()}px))`;
    swipeTrackRef.style.transform = translate;
  });

  const shouldRenderTab = (tabId: string) => {
    if (mountedTabs().has(tabId)) return true;
    const index = visibleTabIds.indexOf(tabId);
    if (index === -1) return false;
    return Math.abs(index - activeTabIndex()) <= 1;
  };

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
        const tabs = visibleTabIds;
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
    const threshold = containerWidth * 0.33 || 80;
    const tabs = visibleTabIds;
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
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
      }
    });
    if (containerRef) {
      observer.observe(containerRef);
    }
    await uiStore.init();
    await Promise.all([configStore.loadConfig(), sysStore.loadStatus()]);
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
            class={`swipe-track ${isDragging() ? "is-dragging" : ""}`}
            ref={swipeTrackRef}
          >
            <For each={routes}>
              {(route) => (
                <div class="swipe-page">
                  <Show when={shouldRenderTab(route.id)}>
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
