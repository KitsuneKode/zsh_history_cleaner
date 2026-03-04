import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/cli/args.ts";

describe("parseArgs", () => {
  it("parses positional history file and flags", () => {
    const parsed = parseArgs(["/tmp/history", "--dry-run", "--yes", "--max-length", "300"]);

    expect(parsed.options.historyFileArg).toBe("/tmp/history");
    expect(parsed.options.dryRun).toBeTrue();
    expect(parsed.options.yes).toBeTrue();
    expect(parsed.options.maxLength).toBe(300);
  });

  it("throws on unknown options", () => {
    expect(() => parseArgs(["--wat"])).toThrow();
  });
});
