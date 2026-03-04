import { mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export function expandHome(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }

  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }

  return pathValue;
}

export function resolvePath(pathValue: string): string {
  const expanded = expandHome(pathValue);
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

export async function ensureDirForFile(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function safeRealPath(pathValue: string): Promise<string> {
  try {
    return await realpath(pathValue);
  } catch {
    return resolvePath(pathValue);
  }
}
