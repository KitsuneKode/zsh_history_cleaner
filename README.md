# ZSH History Cleaner

A powerful Python tool to intelligently clean your ZSH history by removing duplicates, system output, and unwanted commands while preserving important entries through configurable filtering rules.

## Features

- **Smart Duplicate Detection**: Removes exact duplicates and normalized similar commands
- **Configurable Filtering**: JSON-based ignore/allow lists with multiple match types
- **Safe Operation**: Automatic timestamped backups with error recovery
- **Flexible Matching**: Exact, contains, starts_with, ends_with, and regex patterns
- **Length Control**: Configurable maximum command length filtering
- **Pattern Recognition**: Automatically detects and removes system output and repetitive patterns
- **Dry Run Mode**: Preview changes without modifying files
- **Detailed Statistics**: Comprehensive cleaning reports
- **Error Handling**: Robust error handling with automatic backup restoration

## Installation

1. **Clone the repository:**

```bash
git clone https://github.com/yourusername/zsh-history-cleaner.git
cd zsh-history-cleaner
```

2. **Make it executable:**

```bash
chmod +x zsh_cleaner.py
```

3. **Optional: Add to PATH for global access:**

```bash
sudo ln -s $(pwd)/zsh_cleaner.py /usr/local/bin/zsh-cleaner
```

## Quick Start

### Basic Usage

```bash
# Clean your default ZSH history
python3 zsh_cleaner.py

# Preview changes without modifying files
python3 zsh_cleaner.py --dry-run --verbose
```

### With Custom Configuration

```bash
# Create a sample configuration file
python3 zsh_cleaner.py --create-config my_rules.json

# Use custom rules
python3 zsh_cleaner.py --config my_rules.json
```

## Command Line Options

| Option            | Short | Description                                          |
| ----------------- | ----- | ---------------------------------------------------- |
| `--file`          | `-f`  | Path to ZSH history file (default: `~/.zsh_history`) |
| `--max-length`    | `-l`  | Maximum command length to keep (default: 500)        |
| `--verbose`       | `-v`  | Enable detailed output                               |
| `--dry-run`       | `-n`  | Preview changes without modifying files              |
| `--config`        | `-c`  | Path to configuration file with filter rules         |
| `--create-config` |       | Create a sample configuration file                   |

## Configuration

### Creating Configuration Files

Generate a sample configuration with examples:

```bash
python3 zsh_cleaner.py --create-config config.json
```

### Configuration Structure

The configuration file uses JSON format with two main sections:

#### Ignore List (Commands to Keep)

Commands matching ignore rules are preserved regardless of duplicates or other filters:

```json
{
  "ignore_list": [
    {
      "pattern": "git commit",
      "match_type": "starts_with",
      "case_sensitive": false,
      "description": "Keep all git commit commands"
    },
    {
      "pattern": "npm|yarn|docker",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Keep package manager and container commands"
    }
  ]
}
```

#### Allow List (Commands to Remove)

Commands matching allow rules are always deleted:

```json
{
  "allow_list": [
    {
      "pattern": "^ls$|^clear$",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Remove simple listing and clear commands"
    },
    {
      "pattern": "error: failed to commit",
      "match_type": "contains",
      "case_sensitive": false,
      "description": "Remove pacman error messages"
    }
  ]
}
```

### Match Types

| Type          | Description                         | Example                                                   |
| ------------- | ----------------------------------- | --------------------------------------------------------- |
| `exact`       | Perfect match of entire command     | `ls` matches only `ls`                                    |
| `contains`    | Pattern appears anywhere in command | `git` matches `git status`, `my git command`              |
| `starts_with` | Command begins with pattern         | `sudo` matches `sudo pacman -S`                           |
| `ends_with`   | Command ends with pattern           | `.log` matches `tail error.log`                           |
| `regex`       | Regular expression matching         | `^(npm\|yarn)` matches commands starting with npm or yarn |

## Processing Logic

The cleaner processes commands in this priority order:

1. **Allow Rules** (Highest Priority) → Always delete matching commands
2. **Ignore Rules** → Always keep matching commands (skip duplicate checking)
3. **Standard Filters** → Apply length limits, pattern detection, and duplicate removal

## Examples

### Basic Cleaning

```bash
# Clean with verbose output
python3 zsh_cleaner.py --verbose

# Clean with custom length limit
python3 zsh_cleaner.py --max-length 300
```

### Advanced Usage

```bash
# Create and use custom rules
python3 zsh_cleaner.py --create-config dev_rules.json
# Edit dev_rules.json to customize
python3 zsh_cleaner.py --config dev_rules.json --verbose

# Preview changes for specific file
python3 zsh_cleaner.py --file /path/to/history --dry-run --verbose
```

### Sample Configuration for Developers

```json
{
  "ignore_list": [
    {
      "pattern": "git",
      "match_type": "starts_with",
      "case_sensitive": false,
      "description": "Keep all git commands"
    },
    {
      "pattern": "npm run|yarn|docker|kubectl",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Keep development commands"
    },
    {
      "pattern": "cd ",
      "match_type": "starts_with",
      "case_sensitive": false,
      "description": "Keep directory navigation"
    }
  ],
  "allow_list": [
    {
      "pattern": "^(ls|ll|la|clear|pwd)$",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Remove basic commands without arguments"
    },
    {
      "pattern": "checking.*100%|exists in filesystem",
      "match_type": "regex",
      "case_sensitive": false,
      "description": "Remove system output"
    }
  ]
}
```

## Output Example

```
ZSH HISTORY CLEANING STATISTICS
==================================================
Total lines processed:        15,432
Valid entries found:          12,891
Kept by ignore rules:          2,156
Removed by allow rules:        1,834
Duplicates removed:            4,221
Too long commands removed:       156
Pattern/malformed removed:     1,324
Final entries kept:            5,200
Size reduction:                66.3%

Backup saved as:              /home/user/.zsh_history.backup_20241220_143022
==================================================
```

## Safety Features

- **Automatic Backups**: Creates timestamped backups before any modification
- **Error Recovery**: Automatically restores from backup if errors occur
- **Dry Run Mode**: Preview all changes without modifying files
- **Input Validation**: Validates configuration files and handles malformed entries
- **Graceful Degradation**: Continues processing even with invalid rules

## Requirements

- Python 3.6 or higher
- Standard library only (no external dependencies)
- ZSH history file in standard format

## Troubleshooting

### Common Issues

**Permission Denied**

```bash
chmod +x zsh_cleaner.py
```

**Invalid Configuration**

```bash
# Validate your JSON syntax
python3 -m json.tool your_config.json
```

**History Not Loading**

```bash
# Check your history file location
echo $HISTFILE
# Or use the default location
ls -la ~/.zsh_history
```

### Recovery

If something goes wrong, restore from the automatic backup:

```bash
cp ~/.zsh_history.backup_TIMESTAMP ~/.zsh_history
fc -R  # Reload history in current shell
```

## Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/zsh-history-cleaner.git
   cd zsh-history-cleaner
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Guidelines

- **Code Style**: Follow PEP 8 Python style guidelines
- **Documentation**: Update docstrings and README for new features
- **Testing**: Test your changes with various history file formats
- **Backwards Compatibility**: Ensure changes don't break existing configurations

### Types of Contributions

- **Bug Reports**: Open an issue with reproduction steps
- **Feature Requests**: Suggest new functionality with use cases
- **Code Contributions**: Fix bugs, add features, improve performance
- **Documentation**: Improve README, add examples, fix typos
- **Configuration Templates**: Share useful filter configurations

### Submitting Changes

1. **Test thoroughly** with different history files
2. **Update documentation** if needed
3. **Commit with clear messages**:
   ```bash
   git commit -m "Add regex support for ignore rules"
   ```
4. **Push to your fork** and **create a pull request**

### Code Review Process

1. All submissions require review
2. Maintainers may suggest changes
3. Once approved, changes will be merged
4. Contributors will be credited in releases

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0

- Initial release
- Basic duplicate removal
- Configurable ignore/allow lists
- Multiple match types support
- Automatic backup system
- Dry run mode

---

**Made with ❤️ for developers who want clean, organized command history**
