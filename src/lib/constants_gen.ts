export const APP_VERSION = "3.5.1";
export const IS_RELEASE = false;
export const RUST_PATHS = {
  CONFIG: "/data/adb/hybrid-mount/config.toml",
  MODE_CONFIG: "/data/adb/hybrid-mount/module_mode.conf",
  IMAGE_MNT: "/data/adb/hybrid-mount/mnt",
  DAEMON_STATE: "/data/adb/hybrid-mount/run/daemon_state.json",
  DAEMON_LOG: "/data/adb/hybrid-mount/daemon.log",
} as const;
