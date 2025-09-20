#!/usr/bin/env python3
"""
ZSH History Cleaner
Cleans zsh history by removing duplicates and overly long commands
with configurable ignore and allow lists
"""

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


class FilterRule:
    """Represents a filter rule with different matching types."""

    def __init__(
        self, pattern: str, match_type: str = "contains", case_sensitive: bool = False
    ):
        self.pattern = pattern
        self.match_type = match_type.lower()
        self.case_sensitive = case_sensitive

        # Pre-compile regex for efficiency
        if self.match_type == "regex":
            flags = 0 if case_sensitive else re.IGNORECASE
            try:
                self.compiled_regex = re.compile(pattern, flags)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern '{pattern}': {e}")
        else:
            self.compiled_regex = None

    def matches(self, command: str) -> bool:
        """Check if the command matches this rule."""
        text = command if self.case_sensitive else command.lower()
        pattern = self.pattern if self.case_sensitive else self.pattern.lower()

        if self.match_type == "exact":
            return text == pattern
        elif self.match_type == "contains":
            return pattern in text
        elif self.match_type == "starts_with":
            return text.startswith(pattern)
        elif self.match_type == "ends_with":
            return text.endswith(pattern)
        elif self.match_type == "regex":
            return bool(self.compiled_regex.search(command))
        else:
            raise ValueError(f"Unknown match type: {self.match_type}")


class ZshHistoryCleaner:
    def __init__(
        self,
        history_file: str = None,
        max_command_length: int = 500,
        verbose: bool = False,
        config_file: str = None,
    ):
        """
        Initialize the ZSH history cleaner.

        Args:
            history_file: Path to zsh history file (defaults to ~/.zsh_history)
            max_command_length: Maximum command length to keep
            verbose: Enable verbose output
            config_file: Path to configuration file with ignore/allow lists
        """
        self.verbose = verbose
        self.max_command_length = max_command_length

        # Default to standard zsh history location
        if history_file is None:
            self.history_file = Path.home() / ".zsh_history"
        else:
            self.history_file = Path(history_file)

        # Load configuration
        self.ignore_rules: List[FilterRule] = []
        self.allow_rules: List[FilterRule] = []  # Commands to delete (allow deletion)
        self.load_config(config_file)

        self.backup_file = None
        self.seen_commands: Set[str] = set()
        self.cleaned_entries: List[str] = []

        # Enhanced stats
        self.stats = {
            "total_lines": 0,
            "valid_entries": 0,
            "duplicates_removed": 0,
            "too_long_removed": 0,
            "malformed_removed": 0,
            "ignored_kept": 0,
            "allowed_removed": 0,
            "pattern_removed": 0,
            "final_entries": 0,
        }

    def load_config(self, config_file: str = None) -> None:
        """Load configuration from file or create default config."""

        default_path = (
            Path.home() / "./.default-config.json"
        )  # 👈 default config file name

        default_config = {
            "ignore_list": [
                {
                    "pattern": "git commit",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep all git commits",
                },
                {
                    "pattern": "vim",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep vim commands",
                },
                {
                    "pattern": "cd ",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep directory changes",
                },
                {
                    "pattern": "npm",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep npm commands",
                },
            ],
            "allow_list": [
                {
                    "pattern": "error: failed to commit transaction",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Remove pacman error messages",
                },
                {
                    "pattern": "checking.*keyring.*100%",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove pacman progress messages",
                },
                {
                    "pattern": "exists in filesystem",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Remove filesystem conflict messages",
                },
                {
                    "pattern": "^\\s*$",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove empty commands",
                },
                {
                    "pattern": "Errors occurred, no packages were upgraded",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Remove pacman error summaries",
                },
            ],
        }

        if not config_file:
            config_file = default_path

        if Path(config_file).exists():
            try:
                with open(config_file, "r") as f:
                    config = json.load(f)
                self.log(f"Loaded configuration from: {config_file}")
            except Exception as e:
                self.log(f"Error loading config file, using defaults: {e}")
                config = default_config
        else:
            config = default_config
            if config_file:
                # Create default config file
                try:
                    with open(config_file, "w") as f:
                        json.dump(default_config, f, indent=2)
                    self.log(f"Created default config file: {config_file}")
                except Exception as e:
                    self.log(f"Could not create config file: {e}")

        # Parse ignore list
        for rule_dict in config.get("ignore_list", []):
            try:
                rule = FilterRule(
                    pattern=rule_dict["pattern"],
                    match_type=rule_dict.get("match_type", "contains"),
                    case_sensitive=rule_dict.get("case_sensitive", False),
                )
                self.ignore_rules.append(rule)
                self.log(
                    f"Loaded ignore rule: {rule_dict.get('description', rule_dict['pattern'])}"
                )
            except Exception as e:
                self.log(f"Error loading ignore rule {rule_dict}: {e}")

        # Parse allow list (commands to delete)
        for rule_dict in config.get("allow_list", []):
            try:
                rule = FilterRule(
                    pattern=rule_dict["pattern"],
                    match_type=rule_dict.get("match_type", "contains"),
                    case_sensitive=rule_dict.get("case_sensitive", False),
                )
                self.allow_rules.append(rule)
                self.log(
                    f"Loaded allow rule: {rule_dict.get('description', rule_dict['pattern'])}"
                )
            except Exception as e:
                self.log(f"Error loading allow rule {rule_dict}: {e}")

        self.log(
            f"Loaded {len(self.ignore_rules)} ignore rules and {len(self.allow_rules)} allow rules"
        )

    def log(self, message: str, force: bool = False) -> None:
        """Log message if verbose mode is enabled or force is True."""
        if self.verbose or force:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def check_ignore_rules(self, command: str) -> bool:
        """Check if command should be ignored (kept) based on ignore rules."""
        for rule in self.ignore_rules:
            if rule.matches(command):
                return True
        return False

    def check_allow_rules(self, command: str) -> bool:
        """Check if command should be allowed for deletion based on allow rules."""
        for rule in self.allow_rules:
            if rule.matches(command):
                return True
        return False

    def create_backup(self) -> bool:
        """Create a backup of the original history file."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.backup_file = (
                self.history_file.parent
                / f"{self.history_file.name}.backup_{timestamp}"
            )

            self.log(f"Creating backup: {self.backup_file}")
            shutil.copy2(self.history_file, self.backup_file)

            self.log("Backup created successfully", force=True)
            return True

        except Exception as e:
            print(f"ERROR: Failed to create backup: {e}")
            return False

    def parse_history_entry(self, line: str) -> Optional[Tuple[str, str]]:
        """
        Parse a zsh history entry.

        Returns:
            Tuple of (timestamp_part, command) or None if malformed
        """
        # ZSH history format: : <timestamp>:<elapsed>;<command>
        match = re.match(r"^: (\d+:\d+);(.*)$", line)
        if match:
            timestamp_part = match.group(1)
            command = match.group(2)
            return timestamp_part, command

        return None

    def is_command_worth_keeping(self, command: str) -> Tuple[bool, str]:
        """
        Determine if a command should be kept.

        Returns:
            Tuple of (should_keep, reason_if_not)
        """
        # Remove leading/trailing whitespace
        command = command.strip()

        # Skip empty commands
        if not command:
            return False, "empty"

        # Check allow rules first (commands that should be deleted)
        if self.check_allow_rules(command):
            return False, "allow_rule_match"

        # Check ignore rules (commands that should be kept regardless)
        if self.check_ignore_rules(command):
            return True, "ignore_rule_match"

        # Check if command is too long
        if len(command) > self.max_command_length:
            return False, "too_long"

        # Skip commands that are clearly output/garbage (contain many repetitive characters)
        repetitive_patterns = [
            r"-{20,}",  # Many dashes
            r"={20,}",  # Many equals
            r"\[.*\]{3,}",  # Multiple progress bars
            r"\s{10,}",  # Excessive whitespace
            r"(.)\1{15,}",  # Same character repeated 15+ times
        ]

        for pattern in repetitive_patterns:
            if re.search(pattern, command):
                return False, "repetitive_pattern"

        return True, ""

    def normalize_command(self, command: str) -> str:
        """
        Normalize command for duplicate detection.
        This helps catch similar commands that differ only in whitespace, etc.
        """
        # Remove excessive whitespace
        normalized = re.sub(r"\s+", " ", command.strip())

        # Remove backslash line continuations
        normalized = re.sub(r"\\\s*\n\s*", " ", normalized)
        normalized = re.sub(r"\\\s*$", "", normalized)

        return normalized

    def process_history(self) -> bool:
        """Process the history file and clean it."""
        try:
            self.log(f"Reading history file: {self.history_file}")

            if not self.history_file.exists():
                print(f"ERROR: History file does not exist: {self.history_file}")
                return False

            with open(self.history_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()

            self.stats["total_lines"] = len(lines)
            self.log(f"Total lines in history: {self.stats['total_lines']}")

            # Process each line
            current_entry = ""
            for line_num, line in enumerate(lines, 1):
                line = line.rstrip("\n\r")

                # Check if this is a new history entry or continuation
                if line.startswith(": ") and ":" in line and ";" in line:
                    # Process previous entry if exists
                    if current_entry:
                        self._process_entry(current_entry)

                    # Start new entry
                    current_entry = line
                else:
                    # Continuation of previous entry
                    if current_entry:
                        current_entry += "\n" + line
                    else:
                        self.log(
                            f"Warning: Orphaned line at {line_num}: {line[:50]}..."
                        )
                        self.stats["malformed_removed"] += 1

            # Process the last entry
            if current_entry:
                self._process_entry(current_entry)

            self.stats["final_entries"] = len(self.cleaned_entries)
            return True

        except Exception as e:
            print(f"ERROR: Failed to process history: {e}")
            return False

    def _process_entry(self, entry: str) -> None:
        """Process a single history entry."""
        parsed = self.parse_history_entry(entry)

        if not parsed:
            self.log(f"Malformed entry: {entry[:50]}...")
            self.stats["malformed_removed"] += 1
            return

        timestamp_part, command = parsed
        self.stats["valid_entries"] += 1

        # Check allow rules first (higher priority - these should be deleted)
        if self.check_allow_rules(command):
            self.stats["allowed_removed"] += 1
            self.log(f"Allowed removal (rule match): {command[:50]}...")
            return

        # Check ignore rules (commands to keep regardless)
        if self.check_ignore_rules(command):
            self.stats["ignored_kept"] += 1
            self.log(f"Kept (ignore rule): {command[:50]}...")
            normalized = self.normalize_command(command)
            self.seen_commands.add(normalized)
            self.cleaned_entries.append(f": {timestamp_part};{command}")
            return

        # Check if command is worth keeping (standard filters)
        keep, reason = self.is_command_worth_keeping(command)
        if not keep:
            if reason == "too_long":
                self.stats["too_long_removed"] += 1
                self.log(
                    f"Removed long command ({len(command)} chars): {command[:50]}..."
                )
            else:
                self.stats["pattern_removed"] += 1
                self.log(f"Removed command ({reason}): {command[:50]}...")
            return

        # Check for duplicates
        normalized = self.normalize_command(command)
        if normalized in self.seen_commands:
            self.stats["duplicates_removed"] += 1
            self.log(f"Duplicate removed: {command[:50]}...")
            return

        # Keep this entry
        self.seen_commands.add(normalized)
        self.cleaned_entries.append(f": {timestamp_part};{command}")

    def write_cleaned_history(self) -> bool:
        """Write the cleaned history back to the file."""
        try:
            self.log(f"Writing cleaned history to: {self.history_file}")

            with open(self.history_file, "w", encoding="utf-8") as f:
                for entry in self.cleaned_entries:
                    f.write(entry + "\n")

            self.log("Cleaned history written successfully", force=True)
            return True

        except Exception as e:
            print(f"ERROR: Failed to write cleaned history: {e}")
            return False

    def restore_from_backup(self) -> bool:
        """Restore from backup in case of error."""
        if not self.backup_file or not self.backup_file.exists():
            print("ERROR: No backup file available for restoration")
            return False

        try:
            shutil.copy2(self.backup_file, self.history_file)
            print(f"Successfully restored from backup: {self.backup_file}")
            return True
        except Exception as e:
            print(f"ERROR: Failed to restore from backup: {e}")
            return False

    def print_stats(self) -> None:
        """Print cleaning statistics."""
        print("\n" + "=" * 50)
        print("ZSH HISTORY CLEANING STATISTICS")
        print("=" * 50)
        print(f"Total lines processed:     {self.stats['total_lines']:,}")
        print(f"Valid entries found:       {self.stats['valid_entries']:,}")
        print(f"Kept by ignore rules:      {self.stats['ignored_kept']:,}")
        print(f"Removed by allow rules:    {self.stats['allowed_removed']:,}")
        print(f"Duplicates removed:        {self.stats['duplicates_removed']:,}")
        print(f"Too long commands removed: {self.stats['too_long_removed']:,}")
        print(
            f"Pattern/malformed removed: {self.stats['pattern_removed'] + self.stats['malformed_removed']:,}"
        )
        print(f"Final entries kept:        {self.stats['final_entries']:,}")

        if self.stats["total_lines"] > 0:
            reduction_percent = (
                (self.stats["total_lines"] - self.stats["final_entries"])
                / self.stats["total_lines"]
            ) * 100
            print(f"Size reduction:            {reduction_percent:.1f}%")

        if self.backup_file:
            print(f"\nBackup saved as:           {self.backup_file}")
        print("=" * 50)

    def clean(self) -> bool:
        """Main cleaning method."""
        try:
            # Step 1: Create backup
            if not self.create_backup():
                return False

            # Step 2: Process history
            if not self.process_history():
                print(
                    "ERROR: Failed to process history. Attempting to restore backup..."
                )
                self.restore_from_backup()
                return False

            # Step 3: Write cleaned history
            if not self.write_cleaned_history():
                print(
                    "ERROR: Failed to write cleaned history. Attempting to restore backup..."
                )
                self.restore_from_backup()
                return False

            # Step 4: Print results
            self.print_stats()

            return True

        except Exception as e:
            print(f"UNEXPECTED ERROR: {e}")
            if self.backup_file:
                print("Attempting to restore from backup...")
                self.restore_from_backup()
            return False

    def create_sample_config(self, config_path: str) -> None:
        """Create a sample configuration file with examples."""
        sample_config = {
            "description": "ZSH History Cleaner Configuration",
            "match_types": [
                "exact - Match the entire command exactly",
                "contains - Command contains the pattern anywhere",
                "starts_with - Command starts with the pattern",
                "ends_with - Command ends with the pattern",
                "regex - Use regular expression matching",
            ],
            "ignore_list": [
                {
                    "pattern": "git commit",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep all git commit commands",
                },
                {
                    "pattern": "vim",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep vim/editor commands",
                },
                {
                    "pattern": "cd ",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep directory navigation",
                },
                {
                    "pattern": "npm|yarn|pnpm",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Keep package manager commands",
                },
                {
                    "pattern": "docker",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Keep docker commands",
                },
                {
                    "pattern": "sudo systemctl",
                    "match_type": "starts_with",
                    "case_sensitive": False,
                    "description": "Keep system service commands",
                },
            ],
            "allow_list": [
                {
                    "pattern": "error: failed to commit transaction",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Remove pacman transaction errors",
                },
                {
                    "pattern": "checking.*keyring.*100%",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove pacman progress indicators",
                },
                {
                    "pattern": "exists in filesystem",
                    "match_type": "contains",
                    "case_sensitive": False,
                    "description": "Remove filesystem conflict messages",
                },
                {
                    "pattern": "^\\s*$",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove empty/whitespace-only commands",
                },
                {
                    "pattern": "Errors occurred, no packages were upgraded",
                    "match_type": "exact",
                    "case_sensitive": False,
                    "description": "Remove pacman error summaries",
                },
                {
                    "pattern": "^clear$|^cls$",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove screen clearing commands",
                },
                {
                    "pattern": "^ls$|^ll$|^la$",
                    "match_type": "regex",
                    "case_sensitive": False,
                    "description": "Remove basic listing commands (keep ls with arguments)",
                },
            ],
        }

        with open(config_path, "w") as f:
            json.dump(sample_config, f, indent=2)

        print(f"Sample configuration created at: {config_path}")
        print("Edit this file to customize your ignore and allow rules.")


def main():
    parser = argparse.ArgumentParser(
        description="Clean ZSH history by removing duplicates and long commands with configurable filters",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              # Basic cleaning with defaults
  %(prog)s --config rules.json          # Use custom rules
  %(prog)s --dry-run --verbose          # Preview changes
  %(prog)s --create-config rules.json   # Create sample config file
  %(prog)s --max-length 300             # Limit command length
  
Match Types:
  exact       - Match entire command exactly
  contains    - Command contains pattern anywhere  
  starts_with - Command starts with pattern
  ends_with   - Command ends with pattern
  regex       - Use regular expression matching
        """,
    )

    parser.add_argument(
        "--file", "-f", help="Path to zsh history file (default: ~/.zsh_history)"
    )
    parser.add_argument(
        "--max-length",
        "-l",
        type=int,
        default=500,
        help="Maximum command length to keep (default: 500)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose output"
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--config", "-c", help="Path to configuration file with ignore/allow rules"
    )
    parser.add_argument(
        "--create-config", help="Create a sample configuration file and exit"
    )

    args = parser.parse_args()

    # Handle config creation
    if args.create_config:
        cleaner = ZshHistoryCleaner()
        cleaner.create_sample_config(args.create_config)
        return

    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")

    cleaner = ZshHistoryCleaner(
        history_file=args.file,
        max_command_length=args.max_length,
        verbose=args.verbose,
        config_file=args.config,
    )

    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
        # For dry run, just process and show stats without writing
        if cleaner.process_history():
            cleaner.print_stats()
            print("\nDRY RUN: No changes were made to the history file")
        return

    # Show configuration summary
    print(f"ZSH History Cleaner")
    print(f"History file: {cleaner.history_file}")
    print(f"Max command length: {cleaner.max_command_length}")
    print(f"Ignore rules loaded: {len(cleaner.ignore_rules)}")
    print(f"Allow rules loaded: {len(cleaner.allow_rules)}")

    # Confirm before proceeding
    print("\nThis will clean your ZSH history file.")
    print("A backup will be created automatically.")

    try:
        response = input("Do you want to proceed? [y/N]: ").lower().strip()
        if response not in ["y", "yes"]:
            print("Operation cancelled.")
            return
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        return

    # Perform the cleaning
    success = cleaner.clean()

    if success:
        print("\nZSH history cleaned successfully!")
        print(
            "You may need to restart your shell or run 'fc -R' to reload the history."
        )
    else:
        print("\nCleaning failed. Check the error messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
