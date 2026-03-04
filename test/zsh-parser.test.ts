import { describe, expect, it } from "bun:test";
import { parseZshHistory } from "../src/history/zsh-parser.ts";

describe("parseZshHistory", () => {
  it("parses entries and multiline continuations", () => {
    const raw = [
      ": 100:0;echo start",
      "continuation line",
      ": 101:1;echo done",
      "orphan before next",
      "",
    ].join("\n");

    const parsed = parseZshHistory(raw);

    expect(parsed.entries.length).toBe(2);
    expect(parsed.entries[0]?.command).toBe("echo start\ncontinuation line");
    expect(parsed.entries[1]?.command).toBe("echo done\norphan before next\n");
    expect(parsed.orphanLines).toBe(0);
  });

  it("counts orphan lines before first header", () => {
    const raw = ["orphan", ": 100:0;echo ok"].join("\n");
    const parsed = parseZshHistory(raw);

    expect(parsed.orphanLines).toBe(1);
    expect(parsed.entries.length).toBe(1);
  });

  it("recovers corrupted header prefixes", () => {
    const raw = [
      ": 1746520700:0;echo 'broken",
      ";1746520770:0;sudo create_ap --freq-band 5 --mkconfig /etc/create_ap.conf wlan0 enp0s20f0u3",
      ":1746520865:0;iw list",
    ].join("\n");

    const parsed = parseZshHistory(raw);

    expect(parsed.entries.length).toBe(3);
    expect(parsed.entries[1]?.timestamp).toBe(1746520770);
    expect(parsed.entries[1]?.command).toContain("sudo create_ap");
    expect(parsed.entries[2]?.timestamp).toBe(1746520865);
    expect(parsed.orphanLines).toBe(0);
  });
});
