---
name: configure
description: This skill provides configuration guidance for the conversation-memory plugin. Invoke explicitly when user requests to configure plugin settings.
version: 1.0.0
---

# Configure Conversation Memory

This skill provides guidance for configuring the conversation-memory plugin,
including LLM settings for summarization, API key configuration, project
exclusions, and environment variables.

## Config File Location

The conversation-memory plugin uses a configuration file at:

```text
~/.config/conversation-memory/config.json
```

Create this directory and file if it doesn't exist:

```bash
mkdir -p ~/.config/conversation-memory
```

## LLM Provider Configuration

Conversation summarization requires an LLM provider. Without configuration,
conversations will be indexed but not summarized (you'll see
`[Not summarized - no LLM config found]` placeholders).

### Supported Providers

1. **Gemini** (Google AI) - `gemini-2.0-flash` (default)
2. **Zhipu AI** (GLM models) - `glm-4.7` (default)

### Gemini Configuration

```json
{
  "provider": "gemini",
  "apiKey": "your-gemini-api-key",
  "model": "gemini-2.0-flash"
}
```

**Getting a Gemini API key:**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your config.json

### Zhipu AI Configuration

```json
{
  "provider": "zhipu-ai",
  "apiKey": "your-zhipu-ai-api-key",
  "model": "glm-4.7"
}
```

**Getting a Zhipu AI API key:**

1. Visit the [Zhipu AI Open Platform](https://docs.bigmodel.cn/cn/guide/start/quick-start)
2. Create an account and complete verification
3. Generate an API key from the dashboard
4. Add it to your config.json

See [docs/zhipu-ai-setup.md](../../../docs/zhipu-ai-setup.md) for detailed
Zhipu AI setup instructions.

### Configuration Options

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | Yes | - | `gemini` or `zhipu-ai` |
| `apiKey` | string | Yes | - | API key for the provider |
| `model` | string | No | Provider-specific | Model name (see below) |

**Default models:**

- Gemini: `gemini-2.0-flash`
- Zhipu AI: `glm-4.7`

## Project Exclusions

Exclude specific projects from indexing using one of these methods:

### Method 1: Environment Variable

```bash
export CONVERSATION_SEARCH_EXCLUDE_PROJECTS="project-a,project-b,project-c"
```

### Method 2: Exclude Config File

Create a file at `~/.config/conversation-memory/conversation-index/exclude.txt`:

```text
# Comments start with #
project-a
project-b
project-c
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CONVERSATION_MEMORY_CONFIG_DIR` | Override config directory location |
| `CONVERSATION_MEMORY_DB_PATH` | Override database path |
| `CONVERSATION_SEARCH_EXCLUDE_PROJECTS` | Comma-separated list of projects to exclude |
| `CONVERSATION_MEMORY_DEBUG` | Set to `true` for debug logging |
| `TEST_ARCHIVE_DIR` | Override archive directory (testing only) |
| `TEST_DB_PATH` | Test database path (testing only) |

## Verify Configuration

Test your configuration:

```bash
# Sync conversations with summarization
conversation-memory sync

# Enable debug logging
CONVERSATION_MEMORY_DEBUG=true conversation-memory sync

# Verify index health
conversation-memory verify

# Check logs
tail -f ~/.config/conversation-memory/logs/$(date +%Y-%m-%d).log
```

## Troubleshooting

### Invalid API Key

**Symptoms:** Authentication failed, invalid API key errors

**Solution:**

- Verify API key is correct in config.json
- Check API key hasn't expired
- Ensure API key has sufficient balance

### Network Errors

**Symptoms:** Timeout, connection errors

**Solution:**

- Check internet connection
- Configure proxy if behind corporate firewall
- Verify provider service status

### Model Not Found

**Symptoms:** "model not found" or "invalid model"

**Solution:**

- Verify model name spelling
- Check provider documentation for available models
- Use default model (omit `model` field)

### No Summaries Generated

**Symptoms:** Conversations indexed but `[Not summarized - no LLM config found]`
appears

**Solution:**

- Verify config.json exists at `~/.config/conversation-memory/config.json`
- Check config.json has valid JSON syntax
- Ensure `provider` and `apiKey` fields are present

## Example Configurations

See [examples/](./examples/) directory for complete working examples:

- `examples/gemini-config.json` - Gemini configuration
- `examples/zhipu-ai-config.json` - Zhipu AI configuration
- `examples/exclude.txt` - Project exclusion file

## Further Reading

- [README.md](../../../README.md) - Main plugin documentation
- [docs/zhipu-ai-setup.md](../../../docs/zhipu-ai-setup.md) - Detailed Zhipu AI setup guide
- [skills/remembering-conversations/SKILL.md](../remembering-conversations/SKILL.md) - Using conversation search
