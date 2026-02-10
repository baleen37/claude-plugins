# Databricks CLI Authentication Methods

## Overview

The Databricks CLI supports multiple authentication methods for different use cases and security requirements.

## Personal Access Token (PAT)

### Generate a PAT

1. Navigate to your Databricks workspace
2. Click your username → Settings
3. Go to Developer
4. Click "Generate new token"
5. Enter token name and lifetime (optional)
6. Copy the token (starts with `dapi`)

### Configure PAT

**Option 1: Configuration file**

```ini
[default]
host = https://your-workspace.cloud.databricks.com
token = dapi123456789abcdef
```

**Option 2: Environment variables**

```bash
export DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi123456789abcdef"
```

### Token Security

- Treat PATs like passwords
- Never commit tokens to version control
- Use short-lived tokens for CI/CD
- Rotate tokens regularly
- Delete unused tokens

## OAuth U2M (User-to-Machine)

### OAuth Flow

OAuth U2M provides interactive authentication with browser-based consent.

```bash
databricks auth login --profile my-profile
```

This will:
1. Open a browser window
2. Prompt for workspace login
3. Request OAuth consent
4. Store credentials securely

### OAuth Benefits

- No PAT management
- Automatic token refresh
- SSO integration
- MFA support
- Session expiration

### Configure OAuth

After `databricks auth login`, credentials are stored automatically:

```bash
# Use the profile
databricks --profile my-profile workspace list /
```

## OAuth M2M (Machine-to-Machine)

### Service Principal Authentication

For automated workloads, use OAuth M2M with service principals.

**Prerequisites:**
- Azure AD service principal (Azure)
- OAuth app with client secret (AWS)
- Account-level OAuth app (GCP)

### Configure M2M

```ini
[m2m-profile]
host = https://your-workspace.cloud.databricks.com
client_id = your-client-id
client_secret = your-client-secret
```

## Authentication Priority

The CLI checks authentication sources in this order:

1. `--profile` flag
2. `DATABRICKS_PROFILE` environment variable
3. `DATABRICKS_HOST` and `DATABRICKS_TOKEN` environment variables
4. `~/.databrickscfg` default profile
5. OAuth credentials in secure storage

## Troubleshooting

### "Invalid token" Error

**Cause:** Token expired or invalid

**Solution:**
```bash
# Verify token format (should start with dapi)
# Generate new token from workspace UI
# Update ~/.databrickscfg
```

### "Authentication failed" Error

**Cause:** Incorrect credentials or workspace URL

**Solution:**
```bash
# Verify host URL
databricks --profile my-profile workspace list /

# Test with environment variables
export DATABRICKS_HOST="https://workspace.cloud.databricks.com"
export DATABRICKS_TOKEN="your-token"
databricks workspace list /
```

### OAuth Not Working

**Cause:** Browser issues or firewall

**Solution:**
```bash
# Use device code flow (no browser)
databricks auth login --profile my-profile --no-browser

# Manual token entry
databricks auth login --profile my-profile --token
```

## Best Practices

### Development

- Use PATs for local development
- Create separate tokens per project
- Use descriptive token names
- Set token expiration dates

### CI/CD

- Use OAuth M2M with service principals
- Store credentials in secret managers
- Rotate credentials regularly
- Use minimal required permissions

### Production

- Enable OAuth U2M for interactive users
- Use OAuth M2M for automated workloads
- Implement token rotation policies
- Monitor authentication logs

## Security Checklist

- [ ] Never commit tokens to Git
- [ ] Use environment variables for CI/CD
- [ ] Enable token expiration
- [ ] Rotate tokens quarterly
- [ ] Delete unused tokens
- [ ] Use separate profiles for environments
- [ ] Enable OAuth for production workloads
- [ ] Monitor authentication activity
