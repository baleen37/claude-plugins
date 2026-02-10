# Zhipu AI Setup Guide

This guide explains how to configure the conversation-memory plugin to use Zhipu AI (GLM models) for conversation summarization.

## What is Zhipu AI?

Zhipu AI (智谱AI) is a Chinese AI company that provides the GLM (General Language Model) series of large language models. The conversation-memory plugin supports Zhipu AI as an LLM provider for generating conversation summaries and observations.

### Supported Models

The plugin supports the following GLM models:

- **glm-4.7** (default) - Latest flagship model with high performance
- **glm-4.6** - Previous generation model with 355B total parameters
- **glm-4.5** - Earlier generation model
- **Other GLM-4.x models** - Compatible with the GLM-4 API

## Getting an API Key

### Step 1: Register/Login

1. Visit the [Zhipu AI Open Platform](https://docs.bigmodel.cn/cn/guide/start/quick-start)
2. Create a new account or log in if you already have one

### Step 2: Complete Verification

- Sign up and complete the verification process
- New users receive **1 million free tokens** upon registration
- After real-name authentication (实名认证), you get an additional **4 million tokens** (valid for a period)

### Step 3: Create API Key

1. Access your account dashboard
2. Navigate to the **API Keys management page** (API Keys 页面)
3. Generate a new API key for your application
4. Copy the API key for configuration

### Step 4: Top Up (if needed)

- Access the Billing Page to add funds if required
- The platform uses HTTP Bearer authentication

## Configuration

### Config File Location

Create or edit the configuration file at:

```
~/.config/conversation-memory/config.json
```

### Configuration Structure

The configuration file uses the following structure:

```json
{
  "provider": "zhipu-ai",
  "apiKey": "your-zhipu-ai-api-key",
  "model": "glm-4.7"
}
```

### Configuration Options

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | Yes | - | Must be `"zhipu-ai"` |
| `apiKey` | string | Yes | - | Your Zhipu AI API key |
| `model` | string | No | `"glm-4.7"` | Model name to use |

### Example Configurations

#### Basic Configuration

```json
{
  "provider": "zhipu-ai",
  "apiKey": "your-zhipu-ai-api-key-here"
}
```

#### Explicit Model Selection

```json
{
  "provider": "zhipu-ai",
  "apiKey": "your-zhipu-ai-api-key-here",
  "model": "glm-4.6"
}
```

#### Multi-Provider Example (for reference)

You can switch between providers by changing the `provider` field:

```json
{
  "provider": "zhipu-ai",
  "apiKey": "your-zhipu-ai-api-key",
  "model": "glm-4.7"
}
```

Switch to Gemini:

```json
{
  "provider": "gemini",
  "apiKey": "your-gemini-api-key",
  "model": "gemini-2.0-flash"
}
```

## Logging and Debugging

### Enable Debug Logging

To enable detailed debug logging for Zhipu AI operations, set the environment variable:

```bash
export CONVERSATION_MEMORY_DEBUG=true
```

When enabled, debug logs will include:

- Request details (model, prompt length)
- Response timing and token usage
- API request/response details

### Log File Location

Logs are written to:

```
~/.config/conversation-memory/conversation-memory.log
```

### Log Levels

The plugin uses the following log levels:

- **INFO**: Normal operations (completion started/completed)
- **DEBUG**: Detailed debugging information (requires `CONVERSATION_MEMORY_DEBUG=true`)
- **ERROR**: API errors and failures

### Example Log Output

```
[INFO] [ZhipuAIProvider] Starting completion {"model":"glm-4.7","promptLength":1234}
[DEBUG] [ZhipuAIProvider] Sending request {"model":"glm-4.7","messagesCount":1}
[INFO] [ZhipuAIProvider] Completion successful {"duration":1234,"inputTokens":500,"outputTokens":200,"responseLength":800}
```

## Troubleshooting

### Common Issues

#### 1. Invalid API Key

**Symptoms**: Error messages containing "authentication failed" or "invalid api key"

**Solution**:
- Verify your API key is correct
- Check that the API key hasn't expired
- Ensure the API key has sufficient balance

#### 2. Network Errors

**Symptoms**: Timeout or connection errors during summarization

**Solution**:
- Check your internet connection
- If behind a corporate firewall, configure appropriate proxy settings
- Verify Zhipu AI service status at [docs.bigmodel.cn](https://docs.bigmodel.cn/)

#### 3. Model Not Found

**Symptoms**: Error message "model not found" or "invalid model"

**Solution**:
- Verify the model name is correct (e.g., `glm-4.7`, `glm-4.6`)
- Check the [Zhipu AI documentation](https://docs.bigmodel.cn/) for available models

#### 4. Rate Limiting

**Symptoms**: Error messages about rate limits or too many requests

**Solution**:
- Wait before retrying requests
- Consider upgrading your account plan
- Use multiple API keys if available (future enhancement)

### Debug Mode

Enable debug mode to see detailed logging:

```bash
export CONVERSATION_MEMORY_DEBUG=true
conversation-memory sync
```

### Verification

Test your configuration:

```bash
# Verify index health
conversation-memory verify

# Check logs
tail -f ~/.config/conversation-memory/conversation-memory.log
```

## API Reference

### ZhipuAIProvider Class

The plugin uses the `ZhipuAIProvider` class from `src/core/llm/zhipu-provider.ts`:

```typescript
import { ZhipuAIProvider } from './src/core/llm/zhipu-provider';

const provider = new ZhipuAIProvider('your-api-key', 'glm-4.7');
const result = await provider.complete('Summarize this conversation');
console.log(result.text);
console.log(result.usage);
```

### Token Usage

The provider returns token usage information:

```typescript
{
  input_tokens: 500,      // Input prompt tokens
  output_tokens: 200,     // Generated response tokens
  cache_read_input_tokens: undefined,
  cache_creation_input_tokens: undefined
}
```

## Additional Resources

- [Zhipu AI Official Platform](https://bigmodel.cn/)
- [Zhipu AI Documentation](https://docs.bigmodel.cn/)
- [GLM-4.6 API Guide](https://hypereal.tech/zh/a/glm-4-6-api)
- [GLM Cookbook (GitHub)](https://github.com/MetaGLM/glm-cookbook)
- [SDK Package](https://www.npmjs.com/package/zhipuai-sdk-nodejs-v4)

## Support

For issues related to:

- **Plugin configuration**: Check this guide and the main [README.md](../README.md)
- **API issues**: Visit [Zhipu AI Documentation](https://docs.bigmodel.cn/)
- **Plugin bugs**: Check the log file at `~/.config/conversation-memory/conversation-memory.log`

## License

This integration uses the [zhipuai-sdk-nodejs-v4](https://www.npmjs.com/package/zhipuai-sdk-nodejs-v4) SDK, which is licensed under the MIT License.
