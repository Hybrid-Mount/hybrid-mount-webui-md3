/**
 * Copyright 2025 Meta-Hybrid Mount Authors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../module/webroot",
    target: "esnext",
  },
  plugins: [solid()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
