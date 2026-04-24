export interface ModuleRules {
  default_mode: MountMode;
  paths: Record<string, string>;
}

export type OverlayMode = "tmpfs" | "ext4";

export interface AppConfig {
  moduledir: string;
  mountsource: string;
  partitions: string[];
  overlay_mode: OverlayMode;
  disable_umount: boolean;
  enable_overlay_fallback: boolean;
  default_mode: MountMode;
  hymofs: HymofsConfig;
  rules: Record<string, ModuleRules>;
}

export type MountMode = "overlay" | "magic" | "hymofs" | "ignore";

export interface Module {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  mode: MountMode;
  is_mounted: boolean;
  enabled?: boolean;
  source_path?: string;
  rules: ModuleRules;
}

export interface StorageStatus {
  type: "tmpfs" | "ext4" | "unknown" | null;
  error?: string;
  supported_modes?: OverlayMode[];
}

export interface SystemInfo {
  kernel: string;
  selinux: string;
  mountBase: string;
  activeMounts: string[];
  supported_overlay_modes?: OverlayMode[];
  tmpfs_xattr_supported?: boolean;
}

export interface HymofsFeatureSet {
  bitmask: number;
  names: string[];
}

export interface HymofsLkmStatus {
  loaded: boolean;
  module_name?: string;
  autoload: boolean;
  kmi_override: string;
  current_kmi?: string;
  search_dir?: string;
  module_file?: string;
  last_error?: string | null;
}

export interface HymofsUnameConfig {
  sysname: string;
  nodename: string;
  release: string;
  version: string;
  machine: string;
  domainname: string;
}

export interface KernelUnameValues {
  release: string;
  version: string;
}

export interface HymofsMountHideConfig {
  enabled: boolean;
  path_pattern: string;
}

export interface HymofsStatfsSpoofConfig {
  enabled: boolean;
  path: string;
  spoof_f_type: number;
}

export interface HymofsMapsRuleConfig {
  target_ino: number;
  target_dev: number;
  spoofed_ino: number;
  spoofed_dev: number;
  spoofed_pathname: string;
}

export interface HymofsKstatRuleConfig {
  target_ino: number;
  target_pathname: string;
  spoofed_ino: number;
  spoofed_dev: number;
  spoofed_nlink: number;
  spoofed_size: number;
  spoofed_atime_sec: number;
  spoofed_atime_nsec: number;
  spoofed_mtime_sec: number;
  spoofed_mtime_nsec: number;
  spoofed_ctime_sec: number;
  spoofed_ctime_nsec: number;
  spoofed_blksize: number;
  spoofed_blocks: number;
  is_static: boolean;
}

export interface HymofsConfig {
  enabled: boolean;
  lkm_autoload: boolean;
  lkm_dir: string;
  lkm_kmi_override: string;
  mirror_path: string;
  enable_kernel_debug: boolean;
  enable_stealth: boolean;
  enable_hidexattr: boolean;
  enable_mount_hide: boolean;
  enable_maps_spoof: boolean;
  enable_statfs_spoof: boolean;
  mount_hide: HymofsMountHideConfig;
  statfs_spoof: HymofsStatfsSpoofConfig;
  hide_uids: number[];
  uname: HymofsUnameConfig;
  uname_release: string;
  uname_version: string;
  cmdline_value: string;
  kstat_rules: HymofsKstatRuleConfig[];
  maps_rules: HymofsMapsRuleConfig[];
}

export interface HymofsRuntimeInfo {
  snapshot?: Record<string, unknown>;
  hymofs_modules: string[];
}

export interface HymofsStatus {
  status: string;
  available: boolean;
  protocol_version: number | null;
  feature_bits?: number | null;
  feature_names: string[];
  hooks: string[];
  rule_count: number;
  user_hide_rule_count: number;
  mirror_path: string;
  lkm: HymofsLkmStatus;
  config: HymofsConfig;
  runtime?: HymofsRuntimeInfo;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "error";
  visible: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  display?: string;
}

export interface ModeStats {
  overlay: number;
  magic: number;
  hymofs: number;
}
