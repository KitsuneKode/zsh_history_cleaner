import { copyFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

function backupTimestamp(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
    2,
    "0",
  )}${String(now.getSeconds()).padStart(2, "0")}`;
  return `${date}_${time}`;
}

export async function createBackup(historyFilePath: string): Promise<string> {
  const backupPath = `${historyFilePath}.backup_${backupTimestamp()}`;
  await copyFile(historyFilePath, backupPath);
  return backupPath;
}

export async function pruneBackups(historyFilePath: string, maxBackups: number): Promise<void> {
  const dir = dirname(historyFilePath);
  const fileName = basename(historyFilePath);
  const prefix = `${fileName}.backup_`;

  const entries = await readdir(dir, { withFileTypes: true });
  const backups = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => join(dir, entry.name))
    .sort((a, b) => b.localeCompare(a));

  const staleBackups = backups.slice(maxBackups);
  for (const stale of staleBackups) {
    await rm(stale, { force: true });
  }
}

export async function writeAtomic(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tempPath = join(dir, `.${basename(filePath)}.tmp-${process.pid}-${Date.now()}`);

  const currentStat = await stat(filePath);
  await writeFile(tempPath, content, { encoding: "utf8", mode: currentStat.mode });

  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function restoreBackup(backupPath: string, historyFilePath: string): Promise<void> {
  await copyFile(backupPath, historyFilePath);
}
