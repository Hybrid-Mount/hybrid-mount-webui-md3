/**
 * Copyright 2025 Meta-Hybrid Mount Authors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ParentProps } from "solid-js";
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";

export default function BottomActions(props: ParentProps) {
  const [isActivePage, setIsActivePage] = createSignal(true);
  const [keyboardInset, setKeyboardInset] = createSignal(0);
  let anchorRef: HTMLDivElement | undefined;

  onMount(() => {
    const pageEl = anchorRef?.closest(".swipe-page");
    const rootEl = anchorRef?.closest(".main-content");
    if (!pageEl || !rootEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActivePage(entry.isIntersecting && entry.intersectionRatio >= 0.6);
      },
      {
        root: rootEl,
        threshold: [0.4, 0.6, 0.8],
      },
    );

    observer.observe(pageEl);
    onCleanup(() => observer.disconnect());
  });

  onMount(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardInset = () => {
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      setKeyboardInset(inset);
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);

    onCleanup(() => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("orientationchange", updateKeyboardInset);
    });
  });

  const bottomOffset = createMemo(() =>
    keyboardInset() > 0
      ? `${keyboardInset() + 16}px`
      : "calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px))",
  );

  return (
    <>
      <div class="bottom-actions-anchor" ref={anchorRef} aria-hidden="true" />
      <Show when={isActivePage()}>
        <Portal>
          <div class="bottom-actions-root" style={{ bottom: bottomOffset() }}>
            {props.children}
            <style>
              {`
        .bottom-actions-root {
          position: fixed;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
          z-index: 90;
          pointer-events: none;
        }
        .bottom-actions-root > * {
          pointer-events: auto;
        }
        .bottom-actions-root > .spacer {
          flex: 1;
          pointer-events: none;
          box-shadow: none;
        }
        `}
            </style>
          </div>
        </Portal>
      </Show>
    </>
  );
}
