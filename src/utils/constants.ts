export const APP_NAME = "hzclean";
export const APP_VERSION = "1.0.0";

export const DEFAULT_MAX_LENGTH = 500;
export const DEFAULT_BACKUP_RETENTION = 10;

export const DEFAULT_CONFIG_DIR = ".config/hzclean";
export const DEFAULT_CONFIG_FILE = "config.json";
export const TRUST_FILE = "trust.json";

export const HISTORY_ENTRY_REGEX = /^: (\d+):(\d+);(.*)$/;

export const REPETITIVE_PATTERNS: RegExp[] = [
  /-{20,}/,
  /={20,}/,
  /\[.*\]{3,}/,
  /\s{10,}/,
  /(.)\1{15,}/,
];
