import type { MatchType, RuleConfig } from "../types/index.ts";

export class FilterRule {
  private readonly pattern: string;
  private readonly matchType: MatchType;
  private readonly caseSensitive: boolean;
  private readonly regex: RegExp | null;

  constructor(rule: RuleConfig) {
    this.pattern = rule.pattern;
    this.matchType = rule.match_type ?? "contains";
    this.caseSensitive = rule.case_sensitive ?? false;
    this.regex = this.buildRegex();
  }

  matches(command: string): boolean {
    const text = this.caseSensitive ? command : command.toLowerCase();
    const normalizedPattern = this.caseSensitive ? this.pattern : this.pattern.toLowerCase();

    switch (this.matchType) {
      case "exact":
        return text === normalizedPattern;
      case "contains":
        return text.includes(normalizedPattern);
      case "starts_with":
        return text.startsWith(normalizedPattern);
      case "ends_with":
        return text.endsWith(normalizedPattern);
      case "regex":
        return this.regex ? this.regex.test(command) : false;
      default:
        return false;
    }
  }

  private buildRegex(): RegExp | null {
    if (this.matchType !== "regex") {
      return null;
    }

    const flags = this.caseSensitive ? "" : "i";
    return new RegExp(this.pattern, flags);
  }
}

export function compileRules(rules: RuleConfig[]): FilterRule[] {
  return rules.map((rule) => new FilterRule(rule));
}

export function matchesAnyRule(command: string, rules: FilterRule[]): boolean {
  for (const rule of rules) {
    if (rule.matches(command)) {
      return true;
    }
  }

  return false;
}
