import type { MalformedCheckResult } from "../types/index.ts";

function endsWithUnescapedBackslash(input: string): boolean {
  const trimmed = input.replace(/[ \t]+$/g, "");
  if (!trimmed.endsWith("\\")) {
    return false;
  }

  let backslashCount = 0;
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    if (trimmed[i] !== "\\") {
      break;
    }
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
}

export function detectMalformedCommand(command: string): MalformedCheckResult {
  const reasons: string[] = [];

  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escapeNext = false;

  let commandSubDepth = 0;
  let parameterDepth = 0;

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i] ?? "";
    const next = command[i + 1] ?? "";

    const code = ch.charCodeAt(0);
    if (code < 32 && ch !== "\n" && ch !== "\t" && ch !== "\r") {
      reasons.push("control_characters");
      break;
    }

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        escapeNext = true;
        continue;
      }

      if (ch === '"') {
        inDouble = false;
      }

      continue;
    }

    if (inBacktick) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        escapeNext = true;
        continue;
      }

      if (ch === "`") {
        inBacktick = false;
      }

      continue;
    }

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === "`") {
      inBacktick = true;
      continue;
    }

    if (ch === "$" && next === "(") {
      commandSubDepth += 1;
      i += 1;
      continue;
    }

    if (ch === ")" && commandSubDepth > 0) {
      commandSubDepth -= 1;
      continue;
    }

    if (ch === "$" && next === "{") {
      parameterDepth += 1;
      i += 1;
      continue;
    }

    if (ch === "}" && parameterDepth > 0) {
      parameterDepth -= 1;
      continue;
    }
  }

  if (inSingle) {
    reasons.push("unclosed_single_quote");
  }

  if (inDouble) {
    reasons.push("unclosed_double_quote");
  }

  if (inBacktick) {
    reasons.push("unclosed_backtick");
  }

  if (commandSubDepth > 0) {
    reasons.push("unclosed_command_substitution");
  }

  if (parameterDepth > 0) {
    reasons.push("unclosed_parameter_expansion");
  }

  if (endsWithUnescapedBackslash(command)) {
    reasons.push("trailing_line_continuation");
  }

  return {
    malformed: reasons.length > 0,
    reasons,
  };
}
