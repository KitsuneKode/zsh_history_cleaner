export function normalizeCommand(command: string): string {
  return command
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\\\s*\n\s*/g, " ")
    .replace(/\\\s*$/g, "");
}
