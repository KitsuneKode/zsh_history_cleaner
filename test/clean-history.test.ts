import { describe, expect, it } from "bun:test";
import { cleanHistoryContent } from "../src/app/clean-history.ts";
import type { CleanerConfig } from "../src/types/index.ts";

const config: CleanerConfig = {
  ignore_list: [],
  allow_list: [
    {
      pattern: "^clear$",
      match_type: "regex",
      case_sensitive: false,
    },
  ],
};

describe("cleanHistoryContent", () => {
  it("keeps newest duplicate and removes malformed commands", () => {
    const history = [
      "orphan content",
      ": 1741507000:0;echo hello",
      ": 1741507001:0;echo hello",
      ": 1741507002:0;prime-run chrome --enable-features=Vaapi\\",
      ": 1741507003:0;clear",
      ": 1741507004:0;echo world",
      "",
    ].join("\n");

    const result = cleanHistoryContent({
      content: history,
      config,
      maxLength: 500,
      dryRun: true,
      verbose: false,
    });

    expect(result.stats.finalEntries).toBe(2);
    expect(result.stats.duplicatesRemoved).toBe(1);
    expect(result.stats.removedByAllowRules).toBe(1);
    expect(result.stats.malformedRemoved).toBe(1);
    expect(result.stats.orphanLinesRemoved).toBe(1);

    expect(result.cleanedContent).toContain(": 1741507001:0;echo hello");
    expect(result.cleanedContent).not.toContain(": 1741507000:0;echo hello");
    expect(result.cleanedContent).toContain(": 1741507004:0;echo world");
  });

  it("keeps ignore list entries even if duplicated", () => {
    const keepConfig: CleanerConfig = {
      ignore_list: [
        {
          pattern: "git commit",
          match_type: "starts_with",
          case_sensitive: false,
        },
      ],
      allow_list: [],
    };

    const history = [
      ": 1:0;git commit -m \"first\"",
      ": 2:0;git commit -m \"first\"",
    ].join("\n");

    const result = cleanHistoryContent({
      content: history,
      config: keepConfig,
      maxLength: 500,
      dryRun: true,
      verbose: false,
    });

    expect(result.stats.finalEntries).toBe(2);
    expect(result.stats.keptByIgnoreRules).toBe(2);
    expect(result.stats.duplicatesRemoved).toBe(0);
  });

  it("drops broken quoted entry and keeps recovered corrupted headers", () => {
    const history = [
      ": 1746520700:0;echo 'broken",
      ";1746520770:0;sudo create_ap --freq-band 5 --mkconfig /etc/create_ap.conf wlan0 enp0s20f0u3",
      ":1746520865:0;iw list",
      ": 1746520895:0;iw list | grep Band",
      ": 1746521065:0;sudo iw reg set US",
    ].join("\n");

    const result = cleanHistoryContent({
      content: history,
      config,
      maxLength: 500,
      dryRun: true,
      verbose: false,
    });

    expect(result.stats.malformedRemoved).toBe(1);
    expect(result.cleanedContent).not.toContain("echo 'broken");
    expect(result.cleanedContent).toContain(": 1746520770:0;sudo create_ap");
    expect(result.cleanedContent).toContain(": 1746520865:0;iw list");
    expect(result.cleanedContent).toContain(": 1746521065:0;sudo iw reg set US");
  });
});
