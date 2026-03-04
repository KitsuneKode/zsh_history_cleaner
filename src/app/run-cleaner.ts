import { readFile, stat } from "node:fs/promises";
import type { CleanerConfig, CleanResult } from "../types/index.ts";
import { createBackup, pruneBackups, restoreBackup, writeAtomic } from "../safety/backup.ts";
import { cleanHistoryContent } from "./clean-history.ts";

export interface RunCleanerInput {
  historyFilePath: string;
  config: CleanerConfig;
  maxLength: number;
  backupRetention: number;
  dryRun: boolean;
  verbose: boolean;
}

export interface RunCleanerResult {
  result: CleanResult;
  backupPath?: string;
}

export async function runCleaner(input: RunCleanerInput): Promise<RunCleanerResult> {
  await stat(input.historyFilePath);
  const content = await readFile(input.historyFilePath, "utf8");

  const result = cleanHistoryContent({
    content,
    maxLength: input.maxLength,
    config: input.config,
    dryRun: input.dryRun,
    verbose: input.verbose,
  });

  if (input.dryRun) {
    return { result };
  }

  let backupPath: string | undefined;
  try {
    backupPath = await createBackup(input.historyFilePath);
    await writeAtomic(input.historyFilePath, result.cleanedContent);
    await pruneBackups(input.historyFilePath, input.backupRetention);
    return { result, backupPath };
  } catch (error) {
    if (backupPath) {
      await restoreBackup(backupPath, input.historyFilePath);
    }

    throw error;
  }
}
