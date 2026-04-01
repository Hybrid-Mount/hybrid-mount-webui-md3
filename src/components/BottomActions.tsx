/**
 * Copyright 2025 Meta-Hybrid Mount Authors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ParentProps } from "solid-js";

export default function BottomActions(props: ParentProps) {
  return (
    <div class="bottom-actions-root">
      {props.children}
      <style>
        {`
        .bottom-actions-root {
          position: fixed;
          bottom: calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px));
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
  );
}
