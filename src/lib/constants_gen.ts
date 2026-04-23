export const APP_VERSION = "3.5.1";
export const IS_RELEASE = false;
export const RUST_PATHS = {
  CONFIG: "/data/adb/hybrid-mount/config.toml",
  MODE_CONFIG: "/data/adb/hybrid-mount/module_mode.conf",
  IMAGE_MNT: "/data/adb/hybrid-mount/mnt",
  DAEMON_STATE: "/data/adb/hybrid-mount/run/daemon_state.json",
  DAEMON_LOG: "/data/adb/hybrid-mount/daemon.log",
} as const;
export const BUILTIN_PARTITIONS = [
  "system",
  "vendor",
  "product",
  "system_ext",
  "odm",
  "oem",
  "apex",
  "mi_ext",
  "my_bigball",
  "my_carrier",
  "my_company",
  "my_engineering",
  "my_heytap",
  "my_manifest",
  "my_preload",
  "my_product",
  "my_region",
  "my_reserve",
  "my_stock",
  "optics",
  "prism",
] as const;
