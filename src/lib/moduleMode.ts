import type { MountMode } from "./types";

export function normalizeModuleMode(
  mode: string | null | undefined,
): MountMode {
  if (mode === "magic") return "magic";
  if (mode === "ignore") return "ignore";
  return "overlay";
}
