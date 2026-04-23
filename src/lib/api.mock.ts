import { APP_VERSION } from "./constants_gen";
import { DEFAULT_CONFIG } from "./constants";
import type { AppAPI } from "./api";
import type {
  AppConfig,
  DeviceInfo,
  Module,
  StorageStatus,
  SystemInfo,
  ModuleRules,
  HymofsStatus,
  HymofsRuleEntry,
  HymofsLkmStatus,
  HymofsUnameConfig,
  KernelUnameValues,
} from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HYMOFS_LKM_DIR = "/data/adb/modules/hybrid_mount/hymofs_lkm";
const HYMOFS_CURRENT_KMI = "android15-6.6";
const HYMOFS_LKM_FILE =
  "/data/adb/modules/hybrid_mount/hymofs_lkm/android15-6.6_arm64_hymofs_lkm.ko";

function createMockState() {
  return {
    hymofs: {
      enabled: true,
      lkmLoaded: true,
      lkmAutoload: true,
      kmiOverride: "",
      mirrorPath: "/dev/hymo_mirror",
      stealth: true,
      hideXattr: false,
      kernelDebug: false,
      mapsSpoof: true,
      cmdline: "androidboot.verifiedbootstate=green",
      uname: {
        sysname: "",
        nodename: "",
        release: "6.6.30-android15-gki",
        version: "#1 SMP PREEMPT",
        machine: "",
        domainname: "",
      },
      originalKernel: {
        release: "6.6.30-android15-gki",
        version: "#1 SMP PREEMPT Mon Apr 7 18:20:00 CST 2026",
      },
      hideUids: [1000],
      mapsRules: [
        {
          target_ino: 12345,
          target_dev: 2049,
          spoofed_ino: 54321,
          spoofed_dev: 2050,
          spoofed_pathname: "/system/bin/app_process64",
        },
      ],
      mountHide: {
        enabled: false,
        pathPattern: "",
      },
      statfsSpoof: {
        enabled: false,
        path: "",
        fType: 0,
      },
      userHideRules: ["/data/adb/magisk"],
    },
  };
}

const mockState = createMockState();

function buildMockLkmStatus(): HymofsLkmStatus {
  const { hymofs } = mockState;
  return {
    loaded: hymofs.lkmLoaded,
    module_name: "hymofs_lkm",
    autoload: hymofs.lkmAutoload,
    kmi_override: hymofs.kmiOverride,
    current_kmi: HYMOFS_CURRENT_KMI,
    search_dir: HYMOFS_LKM_DIR,
    module_file: hymofs.lkmLoaded ? HYMOFS_LKM_FILE : "",
    last_error: null,
  };
}

function buildMockHymofsConfig(enabled: boolean): HymofsStatus["config"] {
  const { hymofs } = mockState;
  return {
    enabled,
    lkm_autoload: hymofs.lkmAutoload,
    lkm_dir: HYMOFS_LKM_DIR,
    lkm_kmi_override: hymofs.kmiOverride,
    mirror_path: hymofs.mirrorPath,
    enable_kernel_debug: hymofs.kernelDebug,
    enable_stealth: hymofs.stealth,
    enable_hidexattr: hymofs.hideXattr,
    enable_mount_hide: hymofs.mountHide.enabled,
    enable_maps_spoof: hymofs.mapsSpoof,
    enable_statfs_spoof: hymofs.statfsSpoof.enabled,
    mount_hide: {
      enabled: hymofs.mountHide.enabled,
      path_pattern: hymofs.mountHide.pathPattern,
    },
    statfs_spoof: {
      enabled: hymofs.statfsSpoof.enabled,
      path: hymofs.statfsSpoof.path,
      spoof_f_type: hymofs.statfsSpoof.fType,
    },
    hide_uids: [...hymofs.hideUids],
    uname: { ...hymofs.uname },
    uname_release: hymofs.uname.release,
    uname_version: hymofs.uname.version,
    cmdline_value: hymofs.cmdline,
    kstat_rules: [],
    maps_rules: hymofs.mapsRules.map((rule) => ({ ...rule })),
  };
}

function buildMockHymofsStatus(): HymofsStatus {
  const { hymofs } = mockState;
  const lkm = buildMockLkmStatus();

  if (!hymofs.enabled) {
    return {
      status: "disabled",
      available: false,
      protocol_version: null,
      feature_bits: null,
      feature_names: [],
      hooks: [],
      rule_count: 0,
      user_hide_rule_count: hymofs.userHideRules.length,
      mirror_path: hymofs.mirrorPath,
      lkm,
      config: buildMockHymofsConfig(false),
      runtime: {
        snapshot: {
          status: "disabled",
        },
        hymofs_modules: [],
      },
    };
  }

  const available = hymofs.lkmLoaded;
  return {
    status: available ? "available" : "unavailable",
    available,
    protocol_version: available ? 14 : null,
    feature_bits: available ? 487 : null,
    feature_names: available
      ? [
          "kstat_spoof",
          "uname_spoof",
          "cmdline_spoof",
          "merge_dir",
          "mount_hide",
          "maps_spoof",
          "statfs_spoof",
        ]
      : [],
    hooks: available ? ["d_path", "iterate_dir", "vfs_getattr"] : [],
    rule_count: available ? 3 : 0,
    user_hide_rule_count: hymofs.userHideRules.length,
    mirror_path: hymofs.mirrorPath,
    lkm,
    config: buildMockHymofsConfig(true),
    runtime: {
      snapshot: {
        status: available ? "enabled" : "unavailable",
      },
      hymofs_modules: available ? ["playintegrityfix"] : [],
    },
  };
}

export const MockAPI: AppAPI = {
  async loadConfig(): Promise<AppConfig> {
    await delay(300);
    return { ...DEFAULT_CONFIG };
  },
  async saveConfig(config: AppConfig): Promise<void> {
    await delay(500);
    console.log("[Mock] Config saved:", config);
  },
  async resetConfig(): Promise<void> {
    await delay(500);
    console.log("[Mock] Config reset to defaults");
  },
  async scanModules(_dir?: string): Promise<Module[]> {
    await delay(600);
    return [
      {
        id: "magisk_module_1",
        name: "Example Module",
        version: "1.0.0",
        author: "Developer",
        description: "This is a mock module for testing.",
        mode: "magic",
        is_mounted: true,
        rules: {
          default_mode: "magic",
          paths: { "system/fonts": "overlay" },
        },
      },
      {
        id: "overlay_module_2",
        name: "System UI Overlay",
        version: "2.5",
        author: "Google",
        description: "Changes system colors.",
        mode: "overlay",
        is_mounted: true,
        rules: {
          default_mode: "overlay",
          paths: {},
        },
      },
      {
        id: "playintegrityfix",
        name: "Play Integrity Fix",
        version: "14.2",
        author: "tester",
        description: "Mirror-backed HymoFS module.",
        mode: "hymofs",
        is_mounted: true,
        rules: {
          default_mode: "hymofs",
          paths: {},
        },
      },
      {
        id: "disabled_module",
        name: "Umount Module",
        version: "0.1",
        author: "Tester",
        description: "This module is not mounted.",
        mode: "ignore",
        is_mounted: false,
        rules: {
          default_mode: "ignore",
          paths: {},
        },
      },
    ];
  },
  async saveModules(modules: Module[]): Promise<void> {
    await delay(400);
    console.log("[Mock] Modules saved:", modules);
  },
  async saveModuleRules(moduleId: string, rules: ModuleRules): Promise<void> {
    await delay(400);
    console.log(`[Mock] Rules saved for ${moduleId}:`, rules);
  },
  async getDeviceStatus(): Promise<DeviceInfo> {
    await delay(300);
    return {
      model: "Pixel 8 Pro (Mock)",
      android: "14 (API 34)",
      kernel: "5.15.110-android14-11",
      selinux: "Enforcing",
    };
  },
  async getVersion(): Promise<string> {
    await delay(100);
    return APP_VERSION;
  },
  async getStorageUsage(): Promise<StorageStatus> {
    await delay(300);
    return {
      type: "ext4",
      supported_modes: ["tmpfs", "ext4"],
    };
  },
  async getSystemInfo(): Promise<SystemInfo> {
    await delay(300);
    return {
      kernel: "Linux localhost 5.15.0 #1 SMP PREEMPT",
      selinux: "Enforcing",
      mountBase: "/data/adb/meta-hybrid/mnt",
      activeMounts: ["system", "product"],
      detectedPartitions: ["system", "product", "system_ext", "mi_ext"],
      zygisksuEnforce: "1",
      tmpfs_xattr_supported: false,
      supported_overlay_modes: ["ext4"],
    };
  },
  async getHymofsStatus(): Promise<HymofsStatus> {
    await delay(300);
    return buildMockHymofsStatus();
  },
  async getHymofsRules(): Promise<HymofsRuleEntry[]> {
    await delay(180);
    return [
      {
        type: "MERGE",
        target: "/system/etc",
        source: "/dev/hymo_mirror/playintegrityfix/system/etc",
      },
      {
        type: "ADD",
        target: "/system/bin/keystore2",
        source: "/dev/hymo_mirror/playintegrityfix/system/bin/keystore2",
        file_type: 8,
      },
      {
        type: "HIDE",
        path: "/data/adb/magisk",
      },
    ];
  },
  async isHymofsLkmLoaded(): Promise<boolean> {
    await delay(30);
    return mockState.hymofs.lkmLoaded;
  },
  async setHymofsEnabled(enabled: boolean): Promise<void> {
    await delay(200);
    mockState.hymofs.enabled = enabled;
  },
  async setHymofsStealth(enabled: boolean): Promise<void> {
    await delay(200);
    mockState.hymofs.stealth = enabled;
  },
  async setHymofsHidexattr(enabled: boolean): Promise<void> {
    await delay(200);
    mockState.hymofs.hideXattr = enabled;
  },
  async setHymofsDebug(enabled: boolean): Promise<void> {
    await delay(200);
    mockState.hymofs.kernelDebug = enabled;
  },
  async getOriginalKernelUname(): Promise<KernelUnameValues> {
    await delay(120);
    return { ...mockState.hymofs.originalKernel };
  },
  async setHymofsUname(uname: Partial<HymofsUnameConfig>): Promise<void> {
    await delay(220);
    mockState.hymofs.uname = {
      ...mockState.hymofs.uname,
      ...uname,
    };
  },
  async clearHymofsUname(): Promise<void> {
    await delay(160);
    mockState.hymofs.uname = {
      sysname: "",
      nodename: "",
      release: "",
      version: "",
      machine: "",
      domainname: "",
    };
  },
  async setHymofsCmdline(value: string): Promise<void> {
    await delay(220);
    mockState.hymofs.cmdline = value;
  },
  async clearHymofsCmdline(): Promise<void> {
    await delay(160);
    mockState.hymofs.cmdline = "";
  },
  async addHymofsMapsRule(rule): Promise<void> {
    await delay(180);
    const nextRule = {
      target_ino: Number(rule.target_ino) || 0,
      target_dev: Number(rule.target_dev) || 0,
      spoofed_ino: Number(rule.spoofed_ino) || 0,
      spoofed_dev: Number(rule.spoofed_dev) || 0,
      spoofed_pathname: rule.spoofed_pathname || "",
    };
    mockState.hymofs.mapsRules = mockState.hymofs.mapsRules.filter(
      (item) =>
        !(
          item.target_ino === nextRule.target_ino &&
          item.target_dev === nextRule.target_dev
        ),
    );
    mockState.hymofs.mapsRules.push(nextRule);
  },
  async clearHymofsMapsRules(): Promise<void> {
    await delay(180);
    mockState.hymofs.mapsRules = [];
  },
  async getUserHideRules(): Promise<string[]> {
    await delay(120);
    return [...mockState.hymofs.userHideRules];
  },
  async addUserHideRule(path: string): Promise<void> {
    await delay(180);
    if (!mockState.hymofs.userHideRules.includes(path)) {
      mockState.hymofs.userHideRules = [
        path,
        ...mockState.hymofs.userHideRules,
      ];
    }
  },
  async removeUserHideRule(path: string): Promise<void> {
    await delay(180);
    mockState.hymofs.userHideRules = mockState.hymofs.userHideRules.filter(
      (value) => value !== path,
    );
  },
  async applyUserHideRules(): Promise<void> {
    await delay(180);
  },
  async loadHymofsLkm(): Promise<void> {
    await delay(260);
    mockState.hymofs.lkmLoaded = true;
  },
  async unloadHymofsLkm(): Promise<void> {
    await delay(260);
    mockState.hymofs.lkmLoaded = false;
  },
  async setHymofsLkmAutoload(enabled: boolean): Promise<void> {
    await delay(160);
    mockState.hymofs.lkmAutoload = enabled;
  },
  async setHymofsLkmKmi(value: string): Promise<void> {
    await delay(160);
    mockState.hymofs.kmiOverride = value;
  },
  async clearHymofsLkmKmi(): Promise<void> {
    await delay(160);
    mockState.hymofs.kmiOverride = "";
  },
  async fixHymofsMounts(): Promise<void> {
    await delay(220);
  },
  async clearHymofsRules(): Promise<void> {
    await delay(220);
  },
  async releaseHymofsConnection(): Promise<void> {
    await delay(120);
  },
  async invalidateHymofsCache(): Promise<void> {
    await delay(120);
  },
  async openLink(url: string): Promise<void> {
    await delay(60);
    window.open(url, "_blank", "noopener,noreferrer");
  },
  async reboot(): Promise<void> {
    await delay(120);
    console.log("[Mock] Reboot requested");
  },
  async readLogs(): Promise<string> {
    await delay(80);
    return [
      "[Mock] hybrid-mount daemon started",
      "[Mock] HymoFS ready",
      "[Mock] Active tabs: status, config, hymofs, modules, info",
    ].join("\n");
  },
};
