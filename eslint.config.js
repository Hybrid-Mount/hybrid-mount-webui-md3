/**
 * Copyright 2026 Hybrid Mount Developers
 * SPDX-License-Identifier: Apache-2.0
 */

import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
