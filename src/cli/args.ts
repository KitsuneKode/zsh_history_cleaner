import type { RuntimeOptions } from "../types/index.ts";

interface ParseResult {
  options: RuntimeOptions;
  showHelp: boolean;
  showVersion: boolean;
}

const HELP_FLAGS = new Set(["--help", "-h"]);
const VERSION_FLAGS = new Set(["--version", "-V"]);

export function parseArgs(argv: string[]): ParseResult {
  const options: RuntimeOptions = {
    verbose: false,
    dryRun: false,
    yes: false,
    forgetTrust: false,
    printDefaultConfig: false,
  };

  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (HELP_FLAGS.has(arg)) {
      showHelp = true;
      continue;
    }

    if (VERSION_FLAGS.has(arg)) {
      showVersion = true;
      continue;
    }

    if (arg === "--dry-run" || arg === "-n") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }

    if (arg === "--forget-trust") {
      options.forgetTrust = true;
      continue;
    }

    if (arg === "--print-default-config") {
      options.printDefaultConfig = true;
      continue;
    }

    if (arg === "--file" || arg === "-f") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${arg} requires a file path`);
      }
      options.fileOption = value;
      i += 1;
      continue;
    }

    if (arg === "--config" || arg === "-c") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${arg} requires a config path`);
      }
      options.configPath = value;
      i += 1;
      continue;
    }

    if (arg === "--max-length" || arg === "-l") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${arg} requires a numeric value`);
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${arg} must be a positive number`);
      }
      options.maxLength = parsed;
      i += 1;
      continue;
    }

    if (arg === "--backup-retention") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--backup-retention requires a numeric value");
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--backup-retention must be a positive number");
      }
      options.backupRetention = parsed;
      i += 1;
      continue;
    }

    if (arg === "--report-json") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--report-json requires a path");
      }
      options.reportJsonPath = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!options.historyFileArg) {
      options.historyFileArg = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    options,
    showHelp,
    showVersion,
  };
}

export function buildHelpText(): string {
  return `hzclean - fast and safe zsh history cleaner

Usage:
  hzclean [history_file] [options]

Options:
  -f, --file <path>          Path to zsh history file
  -c, --config <path>        Path to cleaner config file
  -l, --max-length <n>       Maximum command length to keep
      --backup-retention <n> Number of backups to keep
  -n, --dry-run              Preview changes without writing
  -y, --yes                  Skip confirmation prompt for this run
  -v, --verbose              Verbose output
      --report-json <path>   Write JSON report to the given path
      --forget-trust         Remove trust entry for this file+user and exit
      --print-default-config Print bundled default config and exit
  -h, --help                 Show help
  -V, --version              Show version

Notes:
  - Default history file is ~/.zsh_history
  - Default config path is ~/.config/hzclean/config.json (auto-created on first run)
  - Run 'bun link' in this project to register hzclean globally
`;
}
