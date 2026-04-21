/**
 * Copyright 2026 Hybrid Mount Developers
 * SPDX-License-Identifier: Apache-2.0
 */

import { createEffect } from "solid-js";
import "./Skeleton.css";

interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
  class?: string;
}

export default function Skeleton(props: Props) {
  let rootRef: HTMLDivElement | undefined;

  createEffect(() => {
    const root = rootRef;
    if (!root) return;

    root.style.setProperty("--skeleton-width", props.width || "100%");
    root.style.setProperty("--skeleton-height", props.height || "20px");
    root.style.setProperty("--skeleton-radius", props.borderRadius || "12px");
  });

  return <div ref={rootRef} class={`skeleton ${props.class || ""}`}></div>;
}
