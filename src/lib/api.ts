import { DEFAULT_CONFIG, PATHS } from "./constants";
import { APP_VERSION } from "./constants_gen";
import { MockAPI } from "./api.mock";
import type {
  AppConfig,
  Module,
  StorageStatus,
  SystemInfo,
  DeviceInfo,
  ModuleRules,
  HymofsStatus,
  HymofsRuleEntry,
  HymofsUnameConfig,
  KernelUnameValues,
} from "./types";

interface KsuExecResult {
  errno: number;
  stdout: string;
  stderr: string;
}

interface KsuModule {
  exec: (cmd: string, options?: unknown) => Promise<KsuExecResult>;
}

interface PartitionInfo {
  name: string;
}

let ksuExec: KsuModule["exec"] | null = null;

try {
  const ksu = await import("kernelsu").catch(() => null);
  ksuExec = ksu ? ksu.exec : null;
} catch {}

const shouldUseMock = import.meta.env.DEV || !ksuExec;

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
  getStorageUsage: () => Promise<StorageStatus>;
  getSystemInfo: () => Promise<SystemInfo>;
  getDeviceStatus: () => Promise<DeviceInfo>;
  getVersion: () => Promise<string>;
  getHymofsStatus: () => Promise<HymofsStatus>;
  getHymofsRules: () => Promise<HymofsRuleEntry[]>;
  isHymofsLkmLoaded: () => Promise<boolean>;
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
  readLogs: () => Promise<string>;
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

async function runJsonCommand<T>(command: string): Promise<T> {
  const output = await runCommandExpectOk(command);
  return JSON.parse(output) as T;
}

const RealAPI: AppAPI = {
  loadConfig: async (): Promise<AppConfig> => {
    const cmd = `${PATHS.BINARY} show-config`;
    return { ...DEFAULT_CONFIG, ...(await runJsonCommand<AppConfig>(cmd)) };
  },
  saveConfig: async (config: AppConfig): Promise<void> => {
    const hexPayload = stringToHex(JSON.stringify(config));
    const cmd = `${PATHS.BINARY} save-config --payload ${hexPayload}`;
    await runCommandExpectOk(cmd);
  },
  resetConfig: async (): Promise<void> => {
    const cmd = `${PATHS.BINARY} gen-config`;
    await runCommandExpectOk(cmd);
  },
  scanModules: async (): Promise<Module[]> => {
    const cmd = `${PATHS.BINARY} modules`;
    return runJsonCommand<Module[]>(cmd);
  },
  saveModules: async (modules: Module[]): Promise<void> => {
    for (const mod of modules) {
      const hexPayload = stringToHex(JSON.stringify(mod.rules));
      const safeModuleId = shellEscapeDoubleQuoted(mod.id);
      const cmd = `${PATHS.BINARY} save-module-rules --module "${safeModuleId}" --payload ${hexPayload}`;
      await runCommandExpectOk(cmd);
    }
  },
  readLogs: async (): Promise<string> => {
    const logPath = PATHS.DAEMON_LOG || "/data/adb/hybrid-mount/daemon.log";
    return runCommandExpectOk(`cat "${shellEscapeDoubleQuoted(logPath)}"`);
  },
  saveModuleRules: async (
    moduleId: string,
    rules: ModuleRules,
  ): Promise<void> => {
    const hexPayload = stringToHex(JSON.stringify(rules));
    const safeModuleId = shellEscapeDoubleQuoted(moduleId);
    const cmd = `${PATHS.BINARY} save-module-rules --module "${safeModuleId}" --payload ${hexPayload}`;
    await runCommandExpectOk(cmd);
  },
  getStorageUsage: async (): Promise<StorageStatus> => {
    const stateFile =
      (PATHS as Record<string, string>).DAEMON_STATE ||
      "/data/adb/meta-hybrid/run/daemon_state.json";
    const { errno, stdout, stderr } = await runCommand(`cat "${stateFile}"`);
    if (errno !== 0 || !stdout) {
      return {
        type: "unknown",
        error: stderr?.trim() || "Storage status unavailable",
      };
    }

    try {
      return { type: JSON.parse(stdout).storage_mode || "unknown" };
    } catch (error) {
      return {
        type: "unknown",
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse storage status",
      };
    }
  },
  getSystemInfo: async (): Promise<SystemInfo> => {
    const cmdSys = `echo "KERNEL:$(uname -r)"; echo "SELINUX:$(getenforce)"`;
    const { errno: errSys, stdout: outSys } = await runCommand(cmdSys);
    const info: SystemInfo = {
      kernel: "-",
      selinux: "-",
      mountBase: "-",
      activeMounts: [],
    };
    if (errSys === 0 && outSys) {
      outSys.split("\n").forEach((line) => {
        if (line.startsWith("KERNEL:")) info.kernel = line.substring(7).trim();
        else if (line.startsWith("SELINUX:"))
          info.selinux = line.substring(8).trim();
      });
    }
    const stateFile =
      (PATHS as Record<string, string>).DAEMON_STATE ||
      "/data/adb/meta-hybrid/run/daemon_state.json";
    const { errno: errState, stdout: outState } = await runCommand(
      `cat "${stateFile}"`,
    );
    if (errState === 0 && outState) {
      try {
        const state = JSON.parse(outState);
        info.mountBase = state.mount_point || "Unknown";
        info.activeMounts = state.active_mounts || [];
        if (state.zygisksu_enforce !== undefined)
          info.zygisksuEnforce = state.zygisksu_enforce ? "1" : "0";
        if (state.tmpfs_xattr_supported !== undefined)
          info.tmpfs_xattr_supported = state.tmpfs_xattr_supported;
      } catch {}
    }

    try {
      const partitions = await runJsonCommand<PartitionInfo[]>(
        `${PATHS.BINARY} api partitions`,
      );
      info.detectedPartitions = partitions.map((partition) => partition.name);
    } catch {}

    return info;
  },
  getDeviceStatus: async (): Promise<DeviceInfo> => {
    let model = "Device",
      android = "14",
      kernel = "Unknown";
    const p1 = await runCommand("getprop ro.product.model");
    if (p1.errno === 0) model = p1.stdout.trim();
    const p2 = await runCommand("getprop ro.build.version.release");
    const p3 = await runCommand("getprop ro.build.version.sdk");
    if (p2.errno === 0)
      android = `${p2.stdout.trim()} (API ${p3.stdout.trim()})`;
    const p4 = await runCommand("uname -r");
    if (p4.errno === 0) kernel = p4.stdout.trim();
    return { model, android, kernel, selinux: "Enforcing" };
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
    return runJsonCommand<HymofsStatus>(`${PATHS.BINARY} hymofs status`);
  },
  getHymofsRules: async (): Promise<HymofsRuleEntry[]> => {
    return runJsonCommand<HymofsRuleEntry[]>(`${PATHS.BINARY} hymofs list`);
  },
  isHymofsLkmLoaded: async (): Promise<boolean> => {
    const { errno } = await runCommand("grep -q '^hymofs_lkm ' /proc/modules");
    return errno === 0;
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
    return runJsonCommand<string[]>(`${PATHS.BINARY} hide list`);
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
    await runCommand("reboot");
  },
};

export const API: AppAPI = shouldUseMock
  ? (MockAPI as unknown as AppAPI)
  : RealAPI;
