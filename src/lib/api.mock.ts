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

let mockHymofsEnabled = false;
let mockHymofsLkmLoaded = false;
let mockHymofsLkmAutoload = true;
let mockHymofsKmiOverride = "";
let mockHymofsMirrorPath = "/dev/hymo_mirror";
let mockHymofsStealth = true;
let mockHymofsHideXattr = false;
let mockHymofsKernelDebug = false;
let mockHymofsIgnoreProtocolMismatch = false;
let mockHymofsMapsSpoof = true;
let mockHymofsCmdline = "androidboot.verifiedbootstate=green";
let mockHymofsUnameRelease = "6.6.30-android15-gki";
let mockHymofsUnameVersion = "#1 SMP PREEMPT";
let mockOriginalKernelRelease = "6.6.30-android15-gki";
let mockOriginalKernelVersion =
  "#1 SMP PREEMPT Mon Apr 7 18:20:00 CST 2026";
let mockHymofsUnameSysname = "";
let mockHymofsUnameNodename = "";
let mockHymofsUnameMachine = "";
let mockHymofsUnameDomainname = "";
let mockHymofsHideUids: number[] = [1000];
let mockHymofsMapsRules = [
  {
    target_ino: 12345,
    target_dev: 2049,
    spoofed_ino: 54321,
    spoofed_dev: 2050,
    spoofed_pathname: "/system/bin/app_process64",
  },
];
let mockHymofsMountHideEnabled = false;
let mockHymofsMountHidePattern = "";
let mockHymofsStatfsSpoofEnabled = false;
let mockHymofsStatfsSpoofPath = "";
let mockHymofsStatfsSpoofFType = 0;
let mockUserHideRules = ["/data/adb/magisk"];

export const MockAPI = {
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
      zygisksuEnforce: "1",
      tmpfs_xattr_supported: false,
      supported_overlay_modes: ["ext4"],
    };
  },
  async getHymofsStatus(): Promise<HymofsStatus> {
    await delay(300);
    if (!mockHymofsEnabled) {
      return {
        status: "disabled",
        available: false,
        protocol_version: null,
        feature_bits: null,
        feature_names: [],
        hooks: [],
        rule_count: 0,
        user_hide_rule_count: mockUserHideRules.length,
        mirror_path: mockHymofsMirrorPath,
        lkm: {
          loaded: mockHymofsLkmLoaded,
          module_name: "hymofs_lkm",
          autoload: mockHymofsLkmAutoload,
          kmi_override: mockHymofsKmiOverride,
          current_kmi: "android15-6.6",
          search_dir: "/data/adb/modules/hybrid_mount/hymofs_lkm",
          module_file: mockHymofsLkmLoaded
            ? "/data/adb/modules/hybrid_mount/hymofs_lkm/android15-6.6_arm64_hymofs_lkm.ko"
            : "",
          last_error: null,
        },
        config: {
          enabled: false,
          ignore_protocol_mismatch: mockHymofsIgnoreProtocolMismatch,
          lkm_autoload: mockHymofsLkmAutoload,
          lkm_dir: "/data/adb/modules/hybrid_mount/hymofs_lkm",
          lkm_kmi_override: mockHymofsKmiOverride,
          mirror_path: mockHymofsMirrorPath,
          enable_kernel_debug: mockHymofsKernelDebug,
          enable_stealth: mockHymofsStealth,
          enable_hidexattr: mockHymofsHideXattr,
          enable_mount_hide: mockHymofsMountHideEnabled,
          enable_maps_spoof: mockHymofsMapsSpoof,
          enable_statfs_spoof: mockHymofsStatfsSpoofEnabled,
          mount_hide: {
            enabled: mockHymofsMountHideEnabled,
            path_pattern: mockHymofsMountHidePattern,
          },
          statfs_spoof: {
            enabled: mockHymofsStatfsSpoofEnabled,
            path: mockHymofsStatfsSpoofPath,
            spoof_f_type: mockHymofsStatfsSpoofFType,
          },
          hide_uids: mockHymofsHideUids,
          uname: {
            sysname: mockHymofsUnameSysname,
            nodename: mockHymofsUnameNodename,
            release: mockHymofsUnameRelease,
            version: mockHymofsUnameVersion,
            machine: mockHymofsUnameMachine,
            domainname: mockHymofsUnameDomainname,
          },
          uname_release: mockHymofsUnameRelease,
          uname_version: mockHymofsUnameVersion,
          cmdline_value: mockHymofsCmdline,
          kstat_rules: [],
          maps_rules: mockHymofsMapsRules,
        },
        runtime: {
          snapshot: {
            status: "disabled",
          },
          hymofs_modules: [],
        },
      };
    }
    const available = mockHymofsLkmLoaded;
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
      user_hide_rule_count: mockUserHideRules.length,
      mirror_path: "/dev/hymo_mirror",
      lkm: {
        loaded: mockHymofsLkmLoaded,
        module_name: "hymofs_lkm",
        autoload: mockHymofsLkmAutoload,
        kmi_override: mockHymofsKmiOverride,
        current_kmi: "android15-6.6",
        search_dir: "/data/adb/modules/hybrid_mount/hymofs_lkm",
        module_file: mockHymofsLkmLoaded
          ? "/data/adb/modules/hybrid_mount/hymofs_lkm/android15-6.6_arm64_hymofs_lkm.ko"
          : "",
        last_error: null,
      },
      config: {
        enabled: true,
        ignore_protocol_mismatch: mockHymofsIgnoreProtocolMismatch,
        lkm_autoload: mockHymofsLkmAutoload,
        lkm_dir: "/data/adb/modules/hybrid_mount/hymofs_lkm",
        lkm_kmi_override: mockHymofsKmiOverride,
        mirror_path: mockHymofsMirrorPath,
        enable_kernel_debug: mockHymofsKernelDebug,
        enable_stealth: mockHymofsStealth,
        enable_hidexattr: mockHymofsHideXattr,
        enable_mount_hide: mockHymofsMountHideEnabled,
        enable_maps_spoof: mockHymofsMapsSpoof,
        enable_statfs_spoof: mockHymofsStatfsSpoofEnabled,
        mount_hide: {
          enabled: mockHymofsMountHideEnabled,
          path_pattern: mockHymofsMountHidePattern,
        },
        statfs_spoof: {
          enabled: mockHymofsStatfsSpoofEnabled,
          path: mockHymofsStatfsSpoofPath,
          spoof_f_type: mockHymofsStatfsSpoofFType,
        },
        hide_uids: mockHymofsHideUids,
        uname: {
          sysname: mockHymofsUnameSysname,
          nodename: mockHymofsUnameNodename,
          release: mockHymofsUnameRelease,
          version: mockHymofsUnameVersion,
          machine: mockHymofsUnameMachine,
          domainname: mockHymofsUnameDomainname,
        },
        uname_release: mockHymofsUnameRelease,
        uname_version: mockHymofsUnameVersion,
        cmdline_value: mockHymofsCmdline,
        kstat_rules: [],
        maps_rules: mockHymofsMapsRules,
      },
      runtime: {
        snapshot: {
          status: available ? "enabled" : "unavailable",
        },
        hymofs_modules: available ? ["playintegrityfix"] : [],
      },
    };
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
  async getLkmStatus(): Promise<HymofsLkmStatus> {
    await delay(120);
    return (await this.getHymofsStatus()).lkm;
  },
  async isHymofsLkmLoaded(): Promise<boolean> {
    await delay(30);
    return (await this.getHymofsStatus()).lkm.loaded;
  },
  async setHymofsEnabled(enabled: boolean): Promise<void> {
    await delay(200);
    mockHymofsEnabled = enabled;
  },
  async setHymofsStealth(enabled: boolean): Promise<void> {
    await delay(200);
    mockHymofsStealth = enabled;
  },
  async setHymofsHidexattr(enabled: boolean): Promise<void> {
    await delay(200);
    mockHymofsHideXattr = enabled;
  },
  async setHymofsIgnoreProtocolMismatch(enabled: boolean): Promise<void> {
    await delay(180);
    mockHymofsIgnoreProtocolMismatch = enabled;
  },
  async setHymofsMapsSpoof(enabled: boolean): Promise<void> {
    await delay(200);
    mockHymofsMapsSpoof = enabled;
  },
  async setHymofsDebug(enabled: boolean): Promise<void> {
    await delay(200);
    mockHymofsKernelDebug = enabled;
  },
  async setHymofsMirror(path: string): Promise<void> {
    await delay(220);
    mockHymofsMirrorPath = path;
  },
  async getOriginalKernelUname(): Promise<KernelUnameValues> {
    await delay(120);
    return {
      release: mockOriginalKernelRelease,
      version: mockOriginalKernelVersion,
    };
  },
  async setHymofsUname(uname: Partial<HymofsUnameConfig>): Promise<void> {
    await delay(220);
    if (uname.sysname !== undefined) mockHymofsUnameSysname = uname.sysname;
    if (uname.nodename !== undefined) mockHymofsUnameNodename = uname.nodename;
    if (uname.release !== undefined) mockHymofsUnameRelease = uname.release;
    if (uname.version !== undefined) mockHymofsUnameVersion = uname.version;
    if (uname.machine !== undefined) mockHymofsUnameMachine = uname.machine;
    if (uname.domainname !== undefined)
      mockHymofsUnameDomainname = uname.domainname;
  },
  async clearHymofsUname(): Promise<void> {
    await delay(160);
    mockHymofsUnameSysname = "";
    mockHymofsUnameNodename = "";
    mockHymofsUnameRelease = "";
    mockHymofsUnameVersion = "";
    mockHymofsUnameMachine = "";
    mockHymofsUnameDomainname = "";
  },
  async setHymofsCmdline(value: string): Promise<void> {
    await delay(220);
    mockHymofsCmdline = value;
  },
  async clearHymofsCmdline(): Promise<void> {
    await delay(160);
    mockHymofsCmdline = "";
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
    const deduped = mockHymofsMapsRules.filter(
      (item) =>
        !(
          item.target_ino === nextRule.target_ino &&
          item.target_dev === nextRule.target_dev
        ),
    );
    deduped.push(nextRule);
    mockHymofsMapsRules = deduped;
  },
  async clearHymofsMapsRules(): Promise<void> {
    await delay(180);
    mockHymofsMapsRules = [];
  },
  async setHymofsHideUids(uids: number[]): Promise<void> {
    await delay(180);
    mockHymofsHideUids = [...uids];
  },
  async clearHymofsHideUids(): Promise<void> {
    await delay(160);
    mockHymofsHideUids = [];
  },
  async setHymofsMountHide(
    enabled: boolean,
    pathPattern?: string,
  ): Promise<void> {
    await delay(220);
    mockHymofsMountHideEnabled = enabled;
    mockHymofsMountHidePattern = enabled ? (pathPattern ?? "") : "";
  },
  async setHymofsStatfsSpoof(
    enabled: boolean,
    path?: string,
    fType?: number,
  ): Promise<void> {
    await delay(220);
    mockHymofsStatfsSpoofEnabled = enabled;
    mockHymofsStatfsSpoofPath = enabled ? (path ?? "") : "";
    mockHymofsStatfsSpoofFType = enabled ? (fType ?? 0) : 0;
  },
  async getUserHideRules(): Promise<string[]> {
    await delay(120);
    return [...mockUserHideRules];
  },
  async addUserHideRule(path: string): Promise<void> {
    await delay(180);
    if (!mockUserHideRules.includes(path)) {
      mockUserHideRules = [path, ...mockUserHideRules];
    }
  },
  async removeUserHideRule(path: string): Promise<void> {
    await delay(180);
    mockUserHideRules = mockUserHideRules.filter((value) => value !== path);
  },
  async applyUserHideRules(): Promise<void> {
    await delay(180);
  },
  async loadHymofsLkm(): Promise<void> {
    await delay(260);
    mockHymofsLkmLoaded = true;
  },
  async unloadHymofsLkm(): Promise<void> {
    await delay(260);
    mockHymofsLkmLoaded = false;
  },
  async setHymofsLkmAutoload(enabled: boolean): Promise<void> {
    await delay(160);
    mockHymofsLkmAutoload = enabled;
  },
  async setHymofsLkmKmi(value: string): Promise<void> {
    await delay(160);
    mockHymofsKmiOverride = value;
  },
  async clearHymofsLkmKmi(): Promise<void> {
    await delay(160);
    mockHymofsKmiOverride = "";
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
};
