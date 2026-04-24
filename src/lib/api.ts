import { DEFAULT_CONFIG, PATHS } from "./constants";
import { APP_VERSION } from "./constants_gen";
import { MockAPI } from "./api.mock";
import type {
  AppConfig,
  Module,
  StorageStatus,
  SystemInfo,
  ModuleRules,
  HymofsStatus,
  HymofsUnameConfig,
  KernelUnameValues,
  OverlayMode,
} from "./types";

interface KsuExecResult {
  errno: number;
  stdout: string;
  stderr: string;
}

interface KsuModule {
  exec: (cmd: string, options?: unknown) => Promise<KsuExecResult>;
}

let ksuExec: KsuModule["exec"] | null = null;

try {
  const ksu = await import("kernelsu").catch(() => null);
  ksuExec = ksu ? ksu.exec : null;
} catch {}

const shouldUseMock = import.meta.env.DEV && !ksuExec;

function shellEscapeDoubleQuoted(value: string): string {
  return value.replace(/(["\\$`])/g, "\\$1");
}

function stringToHex(str: string): string {
  let bytes: Uint8Array;
  if (typeof TextEncoder !== "undefined") {
    const encoder = new TextEncoder();
    bytes = encoder.encode(str);
  } else {
    bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
  }
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    hex += h.length === 1 ? "0" + h : h;
  }
  return hex;
}

class AppError extends Error {
  constructor(
    public message: string,
    public code?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface AppAPI {
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<void>;
  resetConfig: () => Promise<void>;
  scanModules: (path?: string) => Promise<Module[]>;
  saveModules: (modules: Module[]) => Promise<void>;
  saveModuleRules: (moduleId: string, rules: ModuleRules) => Promise<void>;
  saveAllModuleRules: (rules: Record<string, ModuleRules>) => Promise<void>;
  getStorageUsage: () => Promise<StorageStatus>;
  getSystemInfo: () => Promise<SystemInfo>;
  getVersion: () => Promise<string>;
  getHymofsStatus: () => Promise<HymofsStatus>;
  setHymofsEnabled: (enabled: boolean) => Promise<void>;
  setHymofsStealth: (enabled: boolean) => Promise<void>;
  setHymofsHidexattr: (enabled: boolean) => Promise<void>;
  setHymofsDebug: (enabled: boolean) => Promise<void>;
  getOriginalKernelUname: () => Promise<KernelUnameValues>;
  setHymofsUname: (uname: Partial<HymofsUnameConfig>) => Promise<void>;
  clearHymofsUname: () => Promise<void>;
  setHymofsCmdline: (value: string) => Promise<void>;
  clearHymofsCmdline: () => Promise<void>;
  addHymofsMapsRule: (rule: {
    target_ino: number;
    target_dev: number;
    spoofed_ino: number;
    spoofed_dev: number;
    spoofed_pathname: string;
  }) => Promise<void>;
  clearHymofsMapsRules: () => Promise<void>;
  getUserHideRules: () => Promise<string[]>;
  addUserHideRule: (path: string) => Promise<void>;
  removeUserHideRule: (path: string) => Promise<void>;
  applyUserHideRules: () => Promise<void>;
  loadHymofsLkm: () => Promise<void>;
  unloadHymofsLkm: () => Promise<void>;
  setHymofsLkmAutoload: (enabled: boolean) => Promise<void>;
  setHymofsLkmKmi: (value: string) => Promise<void>;
  clearHymofsLkmKmi: () => Promise<void>;
  fixHymofsMounts: () => Promise<void>;
  clearHymofsRules: () => Promise<void>;
  releaseHymofsConnection: () => Promise<void>;
  invalidateHymofsCache: () => Promise<void>;
  openLink: (url: string) => Promise<void>;
  reboot: () => Promise<void>;
}

function requireExec(): KsuModule["exec"] {
  if (!ksuExec) throw new AppError("No KSU environment");
  return ksuExec;
}

async function runCommand(command: string): Promise<KsuExecResult> {
  const exec = requireExec();
  return exec(command);
}

async function runCommandExpectOk(command: string): Promise<string> {
  const { errno, stdout, stderr } = await runCommand(command);
  if (errno === 0) return stdout;
  throw new AppError(stderr || `command failed: ${command}`, errno);
}

type JsonRecord = Record<string, unknown>;

type PayloadGuard<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isModuleRules(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const defaultMode = value.default_mode;
  const paths = value.paths;
  return (
    (defaultMode === "overlay" ||
      defaultMode === "magic" ||
      defaultMode === "hymofs" ||
      defaultMode === "ignore") &&
    isRecord(paths)
  );
}

function isModule(value: unknown): value is Module {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.version) &&
    isString(value.author) &&
    isString(value.description) &&
    (value.mode === "overlay" ||
      value.mode === "magic" ||
      value.mode === "hymofs" ||
      value.mode === "ignore") &&
    isBoolean(value.is_mounted) &&
    isModuleRules(value.rules)
  );
}

function isModuleArray(value: unknown): value is Module[] {
  return Array.isArray(value) && value.every(isModule);
}

function isAppConfigPayload(value: unknown): value is Partial<AppConfig> {
  if (!isRecord(value)) return false;

  if (
    "moduledir" in value &&
    value.moduledir != null &&
    !isString(value.moduledir)
  ) {
    return false;
  }
  if (
    "mountsource" in value &&
    value.mountsource != null &&
    !isString(value.mountsource)
  ) {
    return false;
  }
  if (
    "partitions" in value &&
    value.partitions != null &&
    !isStringArray(value.partitions)
  ) {
    return false;
  }
  if (
    "overlay_mode" in value &&
    value.overlay_mode != null &&
    value.overlay_mode !== "tmpfs" &&
    value.overlay_mode !== "ext4"
  ) {
    return false;
  }
  if (
    "disable_umount" in value &&
    value.disable_umount != null &&
    !isBoolean(value.disable_umount)
  ) {
    return false;
  }
  if (
    "enable_overlay_fallback" in value &&
    value.enable_overlay_fallback != null &&
    !isBoolean(value.enable_overlay_fallback)
  ) {
    return false;
  }
  if (
    "default_mode" in value &&
    value.default_mode != null &&
    value.default_mode !== "overlay" &&
    value.default_mode !== "magic" &&
    value.default_mode !== "hymofs" &&
    value.default_mode !== "ignore"
  ) {
    return false;
  }
  if ("rules" in value && value.rules != null && !isRecord(value.rules)) {
    return false;
  }

  return true;
}

function isStorageStatePayload(value: unknown): value is { storage_mode?: string } {
  if (!isRecord(value)) return false;
  return value.storage_mode === undefined || isString(value.storage_mode);
}

function isSystemInfoPayload(value: unknown): value is {
  kernel: string;
  selinux: string;
  mount_base: string;
  active_mounts: string[];
  tmpfs_xattr_supported: boolean;
} {
  if (!isRecord(value)) return false;
  return (
    isString(value.kernel) &&
    isString(value.selinux) &&
    isString(value.mount_base) &&
    isStringArray(value.active_mounts) &&
    isBoolean(value.tmpfs_xattr_supported)
  );
}

function isHymofsStatusPayload(value: unknown): value is HymofsStatus {
  if (!isRecord(value)) return false;
  return (
    isString(value.status) &&
    isBoolean(value.available) &&
    (value.protocol_version === null || isNumber(value.protocol_version)) &&
    isStringArray(value.feature_names) &&
    isStringArray(value.hooks) &&
    isNumber(value.rule_count) &&
    isNumber(value.user_hide_rule_count) &&
    isString(value.mirror_path) &&
    isRecord(value.lkm) &&
    isRecord(value.config)
  );
}

function isStringListPayload(value: unknown): value is string[] {
  return isStringArray(value);
}

function assertValidPayload<T>(
  value: unknown,
  guard: PayloadGuard<T>,
  endpointName: string,
): T {
  if (!guard(value)) {
    throw new AppError(`Invalid ${endpointName} payload`);
  }
  return value;
}

async function runJsonCommand<T>(
  command: string,
  guard?: PayloadGuard<T>,
  endpointName = command,
): Promise<T> {
  const output = await runCommandExpectOk(command);
  const parsed: unknown = JSON.parse(output);
  if (isRecord(parsed) && parsed.type === "error") {
    const errMessage = isString(parsed.error) ? parsed.error : "Unknown error";
    throw new AppError(errMessage, 0);
  }
  if (guard) {
    return assertValidPayload(parsed, guard, endpointName);
  }
  return parsed as T;
}

const RealAPI: AppAPI = {
  loadConfig: async (): Promise<AppConfig> => {
    const cmd = `${PATHS.BINARY} show-config`;
    return {
      ...DEFAULT_CONFIG,
      ...(await runJsonCommand<Partial<AppConfig>>(
        cmd,
        isAppConfigPayload,
        "show-config",
      )),
    };
  },
  saveConfig: async (config: AppConfig): Promise<void> => {
    const hexPayload = stringToHex(JSON.stringify(config));
    const cmd = `${PATHS.BINARY} save-full-config --payload ${hexPayload}`;
    await runCommandExpectOk(cmd);
  },
  resetConfig: async (): Promise<void> => {
    const cmd = `${PATHS.BINARY} gen-config`;
    await runCommandExpectOk(cmd);
  },
  scanModules: async (): Promise<Module[]> => {
    const cmd = `${PATHS.BINARY} modules`;
    return runJsonCommand<Module[]>(cmd, isModuleArray, "modules");
  },
  saveModules: async (modules: Module[]): Promise<void> => {
    const rulesMap: Record<string, ModuleRules> = {};
    for (const mod of modules) {
      rulesMap[mod.id] = mod.rules;
    }
    return RealAPI.saveAllModuleRules(rulesMap);
  },
  saveModuleRules: async (
    moduleId: string,
    rules: ModuleRules,
  ): Promise<void> => {
    return RealAPI.saveAllModuleRules({ [moduleId]: rules });
  },
  saveAllModuleRules: async (
    rules: Record<string, ModuleRules>,
  ): Promise<void> => {
    const hexPayload = stringToHex(JSON.stringify(rules));
    const cmd = `${PATHS.BINARY} save-all-module-rules --payload ${hexPayload}`;
    await runCommandExpectOk(cmd);
  },
  getStorageUsage: async (): Promise<StorageStatus> => {
    try {
      const state = await runJsonCommand<{ storage_mode?: string }>(
        `${PATHS.BINARY} state`,
        isStorageStatePayload,
        "state",
      );
      return {
        type: (state.storage_mode || "unknown") as StorageStatus["type"],
      };
    } catch (err) {
      return {
        type: "unknown",
        error:
          err instanceof Error ? err.message : "Storage status unavailable",
      };
    }
  },
  getSystemInfo: async (): Promise<SystemInfo> => {
    const payload = await runJsonCommand<{
      kernel: string;
      selinux: string;
      mount_base: string;
      active_mounts: string[];
      tmpfs_xattr_supported: boolean;
    }>(`${PATHS.BINARY} api system`, isSystemInfoPayload, "api system");
    return {
      kernel: payload.kernel,
      selinux: payload.selinux,
      mountBase: payload.mount_base,
      activeMounts: payload.active_mounts,
      tmpfs_xattr_supported: payload.tmpfs_xattr_supported,
      supported_overlay_modes: ["tmpfs", "ext4"] as OverlayMode[],
    };
  },
  getVersion: async (): Promise<string> => {
    const binPath = PATHS.BINARY;
    const moduleDir = binPath.substring(0, binPath.lastIndexOf("/"));
    const { errno, stdout } = await runCommand(
      `grep "^version=" "${moduleDir}/module.prop"`,
    );
    if (errno === 0 && stdout) {
      const match = stdout.match(/^version=(.+)$/m);
      if (match) return match[1].trim();
    }
    return APP_VERSION;
  },
  getHymofsStatus: async (): Promise<HymofsStatus> => {
    return runJsonCommand<HymofsStatus>(
      `${PATHS.BINARY} hymofs status`,
      isHymofsStatusPayload,
      "hymofs status",
    );
  },
  setHymofsEnabled: async (enabled: boolean): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs ${enabled ? "enable" : "disable"}`,
    );
  },
  setHymofsStealth: async (enabled: boolean): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs stealth ${enabled ? "on" : "off"}`,
    );
  },
  setHymofsHidexattr: async (enabled: boolean): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs hidexattr ${enabled ? "on" : "off"}`,
    );
  },
  setHymofsDebug: async (enabled: boolean): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs debug ${enabled ? "on" : "off"}`,
    );
  },
  getOriginalKernelUname: async (): Promise<KernelUnameValues> => {
    const releaseResult = await runCommand(
      "cat /proc/sys/kernel/osrelease 2>/dev/null",
    );
    const versionResult = await runCommand(
      "cat /proc/sys/kernel/version 2>/dev/null",
    );

    let release = releaseResult.errno === 0 ? releaseResult.stdout.trim() : "";
    let version = versionResult.errno === 0 ? versionResult.stdout.trim() : "";

    if (!release || !version) {
      const procVersion = await runCommand("cat /proc/version 2>/dev/null");
      if (procVersion.errno === 0) {
        const raw = procVersion.stdout.trim();
        const releaseMatch = raw.match(/^Linux version\s+(\S+)/);
        const hashIndex = raw.indexOf("#");
        if (!release && releaseMatch?.[1]) {
          release = releaseMatch[1];
        }
        if (!version && hashIndex >= 0) {
          version = raw.slice(hashIndex).trim();
        }
      }
    }

    if (!release && !version) {
      throw new AppError("Failed to read original kernel uname values");
    }

    return { release, version };
  },
  setHymofsUname: async (uname: Partial<HymofsUnameConfig>): Promise<void> => {
    const args: string[] = [];
    const fieldMap: Record<keyof HymofsUnameConfig, string> = {
      sysname: "--sysname",
      nodename: "--nodename",
      release: "--release",
      version: "--version",
      machine: "--machine",
      domainname: "--domainname",
    };
    (Object.keys(fieldMap) as (keyof HymofsUnameConfig)[]).forEach((key) => {
      const value = uname[key];
      if (value) {
        args.push(`${fieldMap[key]} "${shellEscapeDoubleQuoted(value)}"`);
      }
    });
    if (!args.length) {
      throw new AppError("No uname fields provided");
    }
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs uname set ${args.join(" ")}`,
    );
  },
  clearHymofsUname: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs uname clear`);
  },
  setHymofsCmdline: async (value: string): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs cmdline set "${shellEscapeDoubleQuoted(value)}"`,
    );
  },
  clearHymofsCmdline: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs cmdline clear`);
  },
  addHymofsMapsRule: async (rule): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hymofs maps add --target-ino ${rule.target_ino} --target-dev ${rule.target_dev} --spoofed-ino ${rule.spoofed_ino} --spoofed-dev ${rule.spoofed_dev} --path "${shellEscapeDoubleQuoted(rule.spoofed_pathname)}"`,
    );
  },
  clearHymofsMapsRules: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs maps clear`);
  },
  getUserHideRules: async (): Promise<string[]> => {
    return runJsonCommand<string[]>(
      `${PATHS.BINARY} hide list`,
      isStringListPayload,
      "hide list",
    );
  },
  addUserHideRule: async (path: string): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hide add "${shellEscapeDoubleQuoted(path)}"`,
    );
  },
  removeUserHideRule: async (path: string): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} hide remove "${shellEscapeDoubleQuoted(path)}"`,
    );
  },
  applyUserHideRules: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hide apply`);
  },
  loadHymofsLkm: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} lkm load`);
  },
  unloadHymofsLkm: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} lkm unload`);
  },
  setHymofsLkmAutoload: async (enabled: boolean): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} lkm set-autoload ${enabled ? "on" : "off"}`,
    );
  },
  setHymofsLkmKmi: async (value: string): Promise<void> => {
    await runCommandExpectOk(
      `${PATHS.BINARY} lkm set-kmi "${shellEscapeDoubleQuoted(value)}"`,
    );
  },
  clearHymofsLkmKmi: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} lkm clear-kmi`);
  },
  fixHymofsMounts: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs fix-mounts`);
  },
  clearHymofsRules: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs clear`);
  },
  releaseHymofsConnection: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs release-connection`);
  },
  invalidateHymofsCache: async (): Promise<void> => {
    await runCommandExpectOk(`${PATHS.BINARY} hymofs invalidate-cache`);
  },
  openLink: async (url: string): Promise<void> => {
    if (!ksuExec) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const safeUrl = shellEscapeDoubleQuoted(url);
    await runCommandExpectOk(
      `am start -a android.intent.action.VIEW -d "${safeUrl}"`,
    );
  },
  reboot: async (): Promise<void> => {
    await runCommandExpectOk("reboot");
  },
};

export const API: AppAPI = shouldUseMock
  ? (MockAPI as unknown as AppAPI)
  : RealAPI;
