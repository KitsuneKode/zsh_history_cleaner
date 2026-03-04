import { describe, expect, it } from "bun:test";
import { detectMalformedCommand } from "../src/filters/malformed-detector.ts";

describe("detectMalformedCommand", () => {
  it("flags unclosed quotes", () => {
    const result = detectMalformedCommand(`echo "broken`);
    expect(result.malformed).toBeTrue();
    expect(result.reasons).toContain("unclosed_double_quote");
  });

  it("flags trailing line continuation", () => {
    const result = detectMalformedCommand("prime-run chrome --enable-gpu\\");
    expect(result.malformed).toBeTrue();
    expect(result.reasons).toContain("trailing_line_continuation");
  });

  it("accepts balanced multiline command", () => {
    const result = detectMalformedCommand(`echo "ok" && echo $(date)`);
    expect(result.malformed).toBeFalse();
  });
});
