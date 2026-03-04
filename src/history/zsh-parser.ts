import type { ParseResult, ParsedEntry } from "../types/index.ts";
import { HISTORY_ENTRY_REGEX } from "../utils/constants.ts";

const RELAXED_HISTORY_ENTRY_REGEX = /^[:;]\s*(\d+):(\d+);(.*)$/;

function parseHeader(line: string): { timestamp: number; duration: number; command: string } | null {
  const strict = line.match(HISTORY_ENTRY_REGEX);
  if (strict) {
    return {
      timestamp: Number(strict[1]),
      duration: Number(strict[2]),
      command: strict[3] ?? "",
    };
  }

  // Recover common corruption patterns:
  // - missing space after leading colon
  // - leading semicolon instead of colon
  const relaxed = line.match(RELAXED_HISTORY_ENTRY_REGEX);
  if (relaxed) {
    return {
      timestamp: Number(relaxed[1]),
      duration: Number(relaxed[2]),
      command: relaxed[3] ?? "",
    };
  }

  return null;
}

export function parseZshHistory(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const entries: ParsedEntry[] = [];

  let orphanLines = 0;
  let current: ParsedEntry | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    const header = parseHeader(line);
    if (header) {
      if (current) {
        entries.push(current);
      }

      current = {
        timestamp: header.timestamp,
        duration: header.duration,
        command: header.command,
        sourceLine: index + 1,
      };

      continue;
    }

    if (current) {
      current.command += `\n${line}`;
      continue;
    }

    if (line.trim().length > 0) {
      orphanLines += 1;
    }
  }

  if (current) {
    entries.push(current);
  }

  return {
    entries,
    totalLines: lines.length,
    orphanLines,
  };
}
