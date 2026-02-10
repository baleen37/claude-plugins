---
name: databricks-cli
description: |
  This skill should be used when the user asks to "install databricks cli",
  "configure databricks", "set up databricks authentication", "databricks cli
  not working", or needs guidance on Databricks CLI installation,
  authentication, environment variables, or profile configuration.
version: 1.0.0
---

# Databricks CLI Fundamentals

## Overview

The Databricks CLI provides a command-line interface for interacting with Databricks workspaces. This skill covers installation, authentication, configuration, and fundamental CLI usage patterns.

## Installation

### Verify Existing Installation

Check if Databricks CLI is already installed:

```bash
databricks --version
```

If the command returns a version number, the CLI is already installed.

### Installation Methods

**Homebrew (macOS/Linux):**

```bash
brew install databricks
```

**pip (Python):**

```bash
pip install databricks-cli
```

**Download Binary:**

Download from GitHub releases: https://github.com/databricks/cli/releases

### Post-Installation Verification

After installation, verify:

```bash
databricks --version
databricks --help
```

## Authentication

### Authentication Methods

Databricks CLI supports two authentication methods:

1. **Personal Access Token (PAT)** - Recommended for individual users
2. **OAuth** - For enterprise SSO integration

### Personal Access Token Setup

**Generate a Personal Access Token:**

1. Navigate to your Databricks workspace
2. Click Settings → User Settings
3. Go to Developer → Generate new token
4. Copy the token (starts with `dapi`)

### Configuration File

The Databricks CLI reads configuration from `~/.databrickscfg`.

**Configuration Format:**

```ini
[default]
host = https://your-workspace.cloud.databricks.com
token = dapi123456789abcdef

[profile-name]
host = https://other-workspace.cloud.databricks.com
token = dapi987654321fedcba
```

**Create or Edit Configuration:**

```bash
# Edit configuration file
nano ~/.databrickscfg
```

### Environment Variables

For CI/CD or temporary sessions, use environment variables:

```bash
export DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi123456789abcdef"
```

**Environment Variable Priority:**
1. Command-line `--profile` flag
2. `DATABRICKS_PROFILE` environment variable
3. `DATABRICKS_HOST` and `DATABRICKS_TOKEN` environment variables
4. `~/.databrickscfg` default profile

## Profile Management

### Using Profiles

Specify a profile with commands:

```bash
databricks --profile prod workspace list /
```

**Set default profile via environment:**

```bash
export DATABRICKS_PROFILE=prod
databricks workspace list /
```

### Profile Best Practices

- Use separate profiles for each workspace/environment
- Name profiles descriptively: `dev`, `staging`, `prod`
- Never commit `~/.databrickscfg` to version control
- Use environment variables for CI/CD pipelines

## Common CLI Patterns

### Basic Command Structure

```bash
databricks [GLOBAL FLAGS] [COMMAND] [COMMAND FLAGS] [ARGUMENTS]
```

**Global Flags:**
- `--profile <name>` - Use specific profile
- `--debug` - Enable debug logging
- `-h, --help` - Show help

### Useful Commands

**Verify authentication:**

```bash
databricks workflows list
```

**List workspace items:**

```bash
databricks workspace list /
```

**Get current user info:**

```bash
databricks current-user me
```

## Troubleshooting

### Common Issues

**"databricks: command not found"**

- Verify installation: `which databricks`
- Check PATH includes installation directory
- Reinstall using appropriate method

**"Error: Invalid token"**

- Verify token is valid and not expired
- Check token format (should start with `dapi`)
- Regenerate token if needed

**"Error: Authentication failed"**

- Verify `~/.databrickscfg` format
- Check host URL is correct
- Ensure workspace is accessible

**Permission denied errors**

- Verify token has required permissions
- Check workspace access controls
- Contact workspace admin if needed

### Debug Mode

Enable debug logging for troubleshooting:

```bash
databricks --debug workspace list /
```

## Testing Connection

After configuration, test the connection:

```bash
# Test with a simple command
databricks workspace list /

# Or verify with current user
databricks current-user me
```

## Additional Resources

### Reference Files

- **`references/authentication.md`** - Detailed authentication methods
- **`references/commands.md`** - Complete CLI command reference

### Example Files

- **`examples/databrickscfg`** - Sample configuration file

### Scripts

- **`scripts/test-auth.sh`** - Authentication test script
