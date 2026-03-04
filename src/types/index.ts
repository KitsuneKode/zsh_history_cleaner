export type MatchType = "exact" | "contains" | "starts_with" | "ends_with" | "regex";

export interface RuleConfig {
  pattern: string;
  match_type?: MatchType;
  case_sensitive?: boolean;
  description?: string;
}

export interface CleanerConfig {
  description?: string;
  defaults?: {
    max_length?: number;
    backup_retention?: number;
    verbose?: boolean;
  };
  ignore_list: RuleConfig[];
  allow_list: RuleConfig[];
}

export interface ParsedEntry {
  timestamp: number;
  duration: number;
  command: string;
  sourceLine: number;
}

export type RemovalReason =
  | "allow_rule"
  | "duplicate"
  | "too_long"
  | "malformed"
  | "pattern"
  | "empty"
  | "orphan";

export interface CleanerStats {
  totalLines: number;
  totalEntries: number;
  finalEntries: number;
  keptByIgnoreRules: number;
  removedByAllowRules: number;
  duplicatesRemoved: number;
  tooLongRemoved: number;
  malformedRemoved: number;
  patternRemoved: number;
  emptyRemoved: number;
  orphanLinesRemoved: number;
  beforeBytes: number;
  afterBytes: number;
  bytesSaved: number;
  linesSaved: number;
  elapsedMs: number;
  dryRun: boolean;
}

export interface CleanResult {
  cleanedContent: string;
  stats: CleanerStats;
  removedReasons: Record<RemovalReason, number>;
}

export interface RuntimeOptions {
  historyFileArg?: string;
  fileOption?: string;
  configPath?: string;
  maxLength?: number;
  backupRetention?: number;
  verbose: boolean;
  dryRun: boolean;
  yes: boolean;
  reportJsonPath?: string;
  forgetTrust: boolean;
  printDefaultConfig: boolean;
}

export interface ResolvedRuntimeOptions {
  historyFilePath: string;
  configPath: string;
  maxLength: number;
  backupRetention: number;
  verbose: boolean;
  dryRun: boolean;
  yes: boolean;
  reportJsonPath?: string;
}

export interface MalformedCheckResult {
  malformed: boolean;
  reasons: string[];
}

export interface ParseResult {
  entries: ParsedEntry[];
  totalLines: number;
  orphanLines: number;
}

export interface TrustEntry {
  uid: number;
  username: string;
  fileRealPath: string;
  addedAt: string;
}

export interface TrustStoreFile {
  version: 1;
  entries: TrustEntry[];
}
