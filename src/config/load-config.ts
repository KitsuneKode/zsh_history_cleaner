import { copyFile, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CleanerConfig } from "../types/index.ts";
import {
  APP_NAME,
  DEFAULT_BACKUP_RETENTION,
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_FILE,
  DEFAULT_MAX_LENGTH,
} from "../utils/constants.ts";
import { ensureDirForFile, expandHome, resolvePath } from "../utils/paths.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const bundledConfigPath = resolve(moduleDir, "../../config/default.config.json");

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRuleList(value: unknown): CleanerConfig["ignore_list"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((rule): rule is Record<string, unknown> => isObject(rule) && typeof rule.pattern === "string")
    .map((rule) => ({
      pattern: rule.pattern as string,
      match_type:
        typeof rule.match_type === "string"
          ? (rule.match_type as CleanerConfig["ignore_list"][number]["match_type"])
          : undefined,
      case_sensitive: typeof rule.case_sensitive === "boolean" ? rule.case_sensitive : undefined,
      description: typeof rule.description === "string" ? rule.description : undefined,
    }));
}

export function getDefaultConfigPath(): string {
  return join(expandHome("~"), DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
}

export function getBundledDefaultConfigPath(): string {
  return bundledConfigPath;
}

export async function readBundledDefaultConfigText(): Promise<string> {
  return await readFile(bundledConfigPath, "utf8");
}

async function ensureDefaultUserConfig(targetPath: string): Promise<void> {
  try {
    await stat(targetPath);
  } catch {
    await ensureDirForFile(targetPath);
    await copyFile(bundledConfigPath, targetPath);
  }
}

function normalizeRules(value: unknown): CleanerConfig {
  if (!isObject(value)) {
    throw new Error("Config root must be an object");
  }

  const ignoreList = normalizeRuleList(value.ignore_list);
  const allowList = normalizeRuleList(value.allow_list);

  return {
    description: typeof value.description === "string" ? value.description : undefined,
    defaults: isObject(value.defaults)
      ? {
          max_length:
            typeof value.defaults.max_length === "number" ? value.defaults.max_length : undefined,
          backup_retention:
            typeof value.defaults.backup_retention === "number"
              ? value.defaults.backup_retention
              : undefined,
          verbose: typeof value.defaults.verbose === "boolean" ? value.defaults.verbose : undefined,
        }
      : undefined,
    ignore_list: ignoreList,
    allow_list: allowList,
  };
}

export async function loadConfig(requestedPath?: string): Promise<{
  configPath: string;
  config: CleanerConfig;
  defaults: { maxLength: number; backupRetention: number; verbose: boolean };
}> {
  const isDefaultPath = !requestedPath;
  const configPath = resolvePath(requestedPath ?? getDefaultConfigPath());

  if (isDefaultPath) {
    await ensureDefaultUserConfig(configPath);
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = normalizeRules(JSON.parse(raw) as unknown);

  const maxLength = parsed.defaults?.max_length ?? DEFAULT_MAX_LENGTH;
  const backupRetention = parsed.defaults?.backup_retention ?? DEFAULT_BACKUP_RETENTION;
  const verbose = parsed.defaults?.verbose ?? false;

  if (maxLength <= 0) {
    throw new Error("Invalid config: defaults.max_length must be positive");
  }

  if (backupRetention <= 0) {
    throw new Error("Invalid config: defaults.backup_retention must be positive");
  }

  return {
    configPath,
    config: parsed,
    defaults: {
      maxLength,
      backupRetention,
      verbose,
    },
  };
}

export function buildConfigHint(): string {
  return `Run \`${APP_NAME} --print-default-config\` to inspect bundled defaults.`;
}
