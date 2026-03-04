import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { userInfo } from "node:os";
import type { TrustEntry, TrustStoreFile } from "../types/index.ts";
import { DEFAULT_CONFIG_DIR, TRUST_FILE } from "../utils/constants.ts";
import { ensureDirForFile, expandHome, safeRealPath } from "../utils/paths.ts";

function getTrustFilePath(): string {
  return join(expandHome("~"), DEFAULT_CONFIG_DIR, TRUST_FILE);
}

function buildEmptyStore(): TrustStoreFile {
  return {
    version: 1,
    entries: [],
  };
}

async function loadStore(): Promise<TrustStoreFile> {
  const trustPath = getTrustFilePath();

  try {
    const content = await readFile(trustPath, "utf8");
    const parsed = JSON.parse(content) as TrustStoreFile;

    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return buildEmptyStore();
    }

    return parsed;
  } catch {
    return buildEmptyStore();
  }
}

async function saveStore(store: TrustStoreFile): Promise<void> {
  const trustPath = getTrustFilePath();
  await ensureDirForFile(trustPath);
  await writeFile(trustPath, JSON.stringify(store, null, 2), "utf8");
}

function getCurrentUid(): number {
  if (typeof process.getuid === "function") {
    return process.getuid();
  }

  return -1;
}

export async function isTrusted(filePath: string): Promise<boolean> {
  const store = await loadStore();
  const currentUid = getCurrentUid();
  const username = userInfo().username;
  const target = await safeRealPath(filePath);

  return store.entries.some(
    (entry) => entry.uid === currentUid && entry.username === username && entry.fileRealPath === target,
  );
}

export async function addTrust(filePath: string): Promise<void> {
  const store = await loadStore();
  const currentUid = getCurrentUid();
  const username = userInfo().username;
  const target = await safeRealPath(filePath);

  const exists = store.entries.some(
    (entry) => entry.uid === currentUid && entry.username === username && entry.fileRealPath === target,
  );

  if (exists) {
    return;
  }

  const entry: TrustEntry = {
    uid: currentUid,
    username,
    fileRealPath: target,
    addedAt: new Date().toISOString(),
  };

  store.entries.push(entry);
  await saveStore(store);
}

export async function removeTrust(filePath: string): Promise<boolean> {
  const store = await loadStore();
  const currentUid = getCurrentUid();
  const username = userInfo().username;
  const target = await safeRealPath(filePath);

  const originalCount = store.entries.length;
  store.entries = store.entries.filter(
    (entry) => !(entry.uid === currentUid && entry.username === username && entry.fileRealPath === target),
  );

  if (store.entries.length === originalCount) {
    return false;
  }

  await saveStore(store);
  return true;
}

export function getTrustStorePath(): string {
  return getTrustFilePath();
}
