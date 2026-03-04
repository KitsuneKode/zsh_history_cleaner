#!/usr/bin/env bun
import { resolvePath } from "./utils/paths.ts";
import { APP_NAME, APP_VERSION } from "./utils/constants.ts";
import { parseArgs, buildHelpText } from "./cli/args.ts";
import { addTrust, getTrustStorePath, isTrusted, removeTrust } from "./safety/trust-store.ts";
import { askForConfirmation, printWarning } from "./safety/prompt.ts";
import {
  buildConfigHint,
  getDefaultConfigPath,
  loadConfig,
  readBundledDefaultConfigText,
} from "./config/load-config.ts";
import { runCleaner } from "./app/run-cleaner.ts";
import { printSummary, writeJsonReport } from "./report/reporter.ts";

class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function resolveHistoryFile(options: { historyFileArg?: string; fileOption?: string }): string {
  const target = options.fileOption ?? options.historyFileArg ?? "~/.zsh_history";
  return resolvePath(target);
}

async function run(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.showHelp) {
    console.log(buildHelpText());
    return;
  }

  if (parsed.showVersion) {
    console.log(`${APP_NAME} ${APP_VERSION}`);
    return;
  }

  if (parsed.options.printDefaultConfig) {
    const configText = await readBundledDefaultConfigText();
    console.log(configText);
    return;
  }

  const historyFilePath = resolveHistoryFile(parsed.options);

  if (parsed.options.forgetTrust) {
    const removed = await removeTrust(historyFilePath);
    if (removed) {
      console.log(`Trust entry removed for: ${historyFilePath}`);
    } else {
      console.log(`No trust entry found for: ${historyFilePath}`);
    }
    return;
  }

  const { config, configPath, defaults } = await loadConfig(parsed.options.configPath);

  const verbose = parsed.options.verbose || defaults.verbose;
  const maxLength = parsed.options.maxLength ?? defaults.maxLength;
  const backupRetention = parsed.options.backupRetention ?? defaults.backupRetention;

  if (verbose) {
    console.log(`${APP_NAME} ${APP_VERSION}`);
    console.log(`History file: ${historyFilePath}`);
    console.log(`Config file: ${configPath}`);
    console.log(`Trust store: ${getTrustStorePath()}`);
  }

  if (!parsed.options.dryRun) {
    const trusted = await isTrusted(historyFilePath);

    if (!trusted && !parsed.options.yes) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new CliError(
          "Non-interactive mode requires --yes to modify history. Use --dry-run for preview.",
          2,
        );
      }

      printWarning(historyFilePath);
      const decision = await askForConfirmation();

      if (decision === "cancel") {
        throw new CliError("Operation canceled by user.", 2);
      }

      if (decision === "continue_trusted") {
        await addTrust(historyFilePath);
        console.log(`Trust saved for this user+file in ${getTrustStorePath()}`);
      }
    }
  }

  const { result, backupPath } = await runCleaner({
    historyFilePath,
    config,
    maxLength,
    backupRetention,
    dryRun: parsed.options.dryRun,
    verbose,
  });

  printSummary(result, backupPath);

  if (parsed.options.reportJsonPath) {
    const reportPath = resolvePath(parsed.options.reportJsonPath);
    await writeJsonReport(reportPath, result, backupPath);
    console.log(`JSON report written to: ${reportPath}`);
  }

  if (parsed.options.dryRun) {
    console.log("\nDRY RUN: no files were modified.");
  } else {
    console.log("\nHistory cleaning complete.");
    console.log("Reload zsh history with: fc -R");
  }
}

run().catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(`ERROR: ${error.message}`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(`ERROR: ${error.message}`);
    if (error.message.includes("ENOENT") && error.message.includes("config")) {
      console.error(buildConfigHint());
      console.error(`Default config path: ${getDefaultConfigPath()}`);
    }
    process.exit(1);
  }

  console.error("ERROR: Unknown failure");
  process.exit(1);
});
