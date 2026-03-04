import { writeFile } from "node:fs/promises";
import type { CleanResult } from "../types/index.ts";

export function printSummary(result: CleanResult, backupPath?: string): void {
  const { stats } = result;

  console.log("\nZSH HISTORY CLEANING STATISTICS");
  console.log("=".repeat(50));
  console.log(`Total lines processed:      ${stats.totalLines.toLocaleString()}`);
  console.log(`Valid entries found:        ${stats.totalEntries.toLocaleString()}`);
  console.log(`Kept by ignore rules:       ${stats.keptByIgnoreRules.toLocaleString()}`);
  console.log(`Removed by allow rules:     ${stats.removedByAllowRules.toLocaleString()}`);
  console.log(`Duplicates removed:         ${stats.duplicatesRemoved.toLocaleString()}`);
  console.log(`Too long commands removed:  ${stats.tooLongRemoved.toLocaleString()}`);
  console.log(`Malformed removed:          ${stats.malformedRemoved.toLocaleString()}`);
  console.log(`Pattern removed:            ${stats.patternRemoved.toLocaleString()}`);
  console.log(`Empty removed:              ${stats.emptyRemoved.toLocaleString()}`);
  console.log(`Orphan lines removed:       ${stats.orphanLinesRemoved.toLocaleString()}`);
  console.log(`Final entries kept:         ${stats.finalEntries.toLocaleString()}`);
  console.log(`Lines saved:                ${stats.linesSaved.toLocaleString()}`);
  console.log(`Bytes saved:                ${stats.bytesSaved.toLocaleString()}`);
  console.log(`Estimated memory saved:     ${formatBytes(stats.bytesSaved)}`);
  console.log(`Elapsed time:               ${stats.elapsedMs} ms`);

  if (backupPath) {
    console.log(`Backup saved as:            ${backupPath}`);
  }

  console.log("=".repeat(50));
}

function formatBytes(value: number): string {
  const abs = Math.abs(value);

  if (abs < 1024) {
    return `${value} B`;
  }

  if (abs < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KiB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

export async function writeJsonReport(path: string, result: CleanResult, backupPath?: string): Promise<void> {
  const payload = {
    generated_at: new Date().toISOString(),
    backup_path: backupPath ?? null,
    ...result,
  };

  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
}
