import type { CleanerConfig, CleanResult, ParsedEntry, RemovalReason } from "../types/index.ts";
import { REPETITIVE_PATTERNS } from "../utils/constants.ts";
import { compileRules, matchesAnyRule } from "../filters/rules.ts";
import { detectMalformedCommand } from "../filters/malformed-detector.ts";
import { normalizeCommand } from "../history/normalize.ts";
import { parseZshHistory } from "../history/zsh-parser.ts";

interface CleanHistoryInput {
  content: string;
  maxLength: number;
  config: CleanerConfig;
  dryRun: boolean;
  verbose: boolean;
}

function buildReasonCounter(): Record<RemovalReason, number> {
  return {
    allow_rule: 0,
    duplicate: 0,
    too_long: 0,
    malformed: 0,
    pattern: 0,
    empty: 0,
    orphan: 0,
  };
}

function isPatternGarbage(command: string): boolean {
  return REPETITIVE_PATTERNS.some((pattern) => pattern.test(command));
}

function serializeEntries(entries: ParsedEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const serialized = entries.map((entry) => `: ${entry.timestamp}:${entry.duration};${entry.command}`);
  return `${serialized.join("\n")}\n`;
}

function countLines(content: string): number {
  if (!content) {
    return 0;
  }

  const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\r?\n/).length;
}

export function cleanHistoryContent(input: CleanHistoryInput): CleanResult {
  const started = Date.now();
  const parsed = parseZshHistory(input.content);

  const removedReasons = buildReasonCounter();
  removedReasons.orphan = parsed.orphanLines;

  const allowRules = compileRules(input.config.allow_list ?? []);
  const ignoreRules = compileRules(input.config.ignore_list ?? []);

  const seen = new Set<string>();
  const keptReverse: ParsedEntry[] = [];

  for (let index = parsed.entries.length - 1; index >= 0; index -= 1) {
    const entry = parsed.entries[index];
    const command = entry.command.trim();

    if (!command) {
      removedReasons.empty += 1;
      continue;
    }

    if (matchesAnyRule(command, allowRules)) {
      removedReasons.allow_rule += 1;
      continue;
    }

    const malformed = detectMalformedCommand(command);
    if (malformed.malformed) {
      removedReasons.malformed += 1;
      if (input.verbose) {
        console.log(
          `[malformed] dropped entry from line ${entry.sourceLine}: ${malformed.reasons.join(", ")}`,
        );
      }
      continue;
    }

    if (matchesAnyRule(command, ignoreRules)) {
      keptReverse.push(entry);
      continue;
    }

    if (command.length > input.maxLength) {
      removedReasons.too_long += 1;
      continue;
    }

    if (isPatternGarbage(command)) {
      removedReasons.pattern += 1;
      continue;
    }

    const normalized = normalizeCommand(command);
    if (seen.has(normalized)) {
      removedReasons.duplicate += 1;
      continue;
    }

    seen.add(normalized);
    keptReverse.push(entry);
  }

  const keptEntries = keptReverse.reverse();
  const cleanedContent = serializeEntries(keptEntries);

  const beforeBytes = Buffer.byteLength(input.content, "utf8");
  const afterBytes = Buffer.byteLength(cleanedContent, "utf8");
  const finalLines = countLines(cleanedContent);
  const bytesSaved = Math.max(0, beforeBytes - afterBytes);
  const linesSaved = Math.max(0, parsed.totalLines - finalLines);

  const elapsedMs = Date.now() - started;

  return {
    cleanedContent,
    removedReasons,
    stats: {
      totalLines: parsed.totalLines,
      totalEntries: parsed.entries.length,
      finalEntries: keptEntries.length,
      keptByIgnoreRules: keptEntries.filter((entry) => matchesAnyRule(entry.command.trim(), ignoreRules)).length,
      removedByAllowRules: removedReasons.allow_rule,
      duplicatesRemoved: removedReasons.duplicate,
      tooLongRemoved: removedReasons.too_long,
      malformedRemoved: removedReasons.malformed,
      patternRemoved: removedReasons.pattern,
      emptyRemoved: removedReasons.empty,
      orphanLinesRemoved: removedReasons.orphan,
      beforeBytes,
      afterBytes,
      bytesSaved,
      linesSaved,
      elapsedMs,
      dryRun: input.dryRun,
    },
  };
}
