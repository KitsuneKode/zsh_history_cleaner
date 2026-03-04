# hzclean

Fast, safe ZSH history cleaner built with Bun + TypeScript.

`hzclean` removes duplicates, malformed entries, shell output noise, and unwanted commands using configurable rules while protecting your history with backups, warnings, and dry-run support.

## Why this CLI

- Migrates and extends all major features from the original Python cleaner.
- Uses a modular TypeScript codebase for maintainability and scale.
- Adds stricter malformed command detection (unclosed quotes/backticks, broken continuations, unfinished substitutions).
- Keeps newest duplicates by default (better for real-world workflow history).

## Key features

- Safe writes with timestamped backup + atomic file replace.
- Trust prompt workflow:
  - Warning before modification.
  - "Proceed once" or "trust this file for this user".
  - Trust persisted in `~/.config/hzclean/trust.json`.
- Rule-based filtering with backward-compatible config:
  - `ignore_list` (always keep)
  - `allow_list` (always remove)
  - match types: `exact`, `contains`, `starts_with`, `ends_with`, `regex`
- Dry-run mode with detailed stats.
- Optional JSON report export.
- Backup retention pruning (default: keep 10).
- Linux/macOS-friendly and low dependency footprint.

## Install and use globally (Bun)

```bash
# from this project
bun install
bun link

# verify
hzclean --help
```

## Quick start

```bash
# clean ~/.zsh_history (with warning prompt)
hzclean

# clean a specific file
hzclean /path/to/.zsh_history

# preview only
hzclean --dry-run --verbose

# non-interactive mode
hzclean --yes

# write machine-readable report
hzclean --report-json ./hzclean-report.json
```

## CLI options

```text
Usage:
  hzclean [history_file] [options]

Options:
  -f, --file <path>          Path to zsh history file
  -c, --config <path>        Path to cleaner config file
  -l, --max-length <n>       Maximum command length to keep
      --backup-retention <n> Number of backups to keep
  -n, --dry-run              Preview changes without writing
  -y, --yes                  Skip confirmation prompt for this run
  -v, --verbose              Verbose output
      --report-json <path>   Write JSON report
      --forget-trust         Remove trust entry for this user+file and exit
      --print-default-config Print bundled default config and exit
  -h, --help                 Show help
  -V, --version              Show version
```

## Config behavior

On first run, `hzclean` auto-copies bundled defaults to:

- `~/.config/hzclean/config.json`

Bundled visible default file in the repo/package:

- `config/default.config.json`

### Backward-compatible config schema

```json
{
  "defaults": {
    "max_length": 500,
    "backup_retention": 10,
    "verbose": false
  },
  "ignore_list": [
    {
      "pattern": "git commit",
      "match_type": "starts_with",
      "case_sensitive": false,
      "description": "Keep git commits"
    }
  ],
  "allow_list": [
    {
      "pattern": "^clear$|^ls$",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Drop noisy commands"
    }
  ]
}
```

## Safety model

- Dry-run never writes files.
- Real run always creates backup first.
- If write fails, backup restore is attempted automatically.
- In non-interactive shells (CI), mutation requires `--yes`; otherwise it exits safely.

## Trust model

"I understand" trust is scoped to:

- current user
- exact history file real path

This avoids global unsafe bypasses.

## Development

```bash
bun test
bun run src/cli.ts --help
```

## Legacy Python script

The old Python implementation still exists as:

- `zsh-history-cleaner.py`

The new Bun/TypeScript CLI is the primary implementation.
