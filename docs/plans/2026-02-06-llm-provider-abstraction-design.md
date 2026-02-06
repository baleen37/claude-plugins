# LLM Provider Abstraction Design

**Date:** 2026-02-06
**Status:** Approved
**Author:** Bot & Jito

## Overview

Replace Claude SDK dependency in conversation-memory's summarization with a provider-abstracted LLM layer using Gemini API, with round-robin API key rotation.

## Goals

- Remove `@anthropic-ai/claude-agent-sdk` dependency from conversation-memory
- Introduce `LLMProvider` abstraction for summarization
- Implement Gemini provider using `@google/genai` SDK
- Support round-robin across multiple API keys (rate limit distribution)
- Store configuration in `~/.config/conversation-memory/config.json`

## Decisions

### 1. Scope: Summarization Only

- **Chosen:** Only abstract the summarization LLM calls
- **Rationale:** Embedding is local (Transformers.js), search is SQLite. Only summarization depends on an external LLM API.

### 2. SDK: @google/genai

- **Chosen:** Google's official Gemini SDK
- **Rationale:** Type safety, error handling, and auth built-in. Each provider gets its own adapter, so no need for a generic SDK.

### 3. Round-Robin: API Key Rotation

- **Chosen:** Multiple API keys for the same Gemini provider, cycled per request
- **Rationale:** Distributes rate limits. No cross-provider round-robin needed.

### 4. Configuration: JSON File

- **Chosen:** `~/.config/conversation-memory/config.json`
- **Rationale:** Consistent with project conventions. More structured than env vars for multi-key config. Avoids additional parser dependency (vs YAML).

### 5. Existing Claude Code: Complete Removal

- **Chosen:** Remove Claude provider entirely, no backward compatibility
- **Rationale:** Clean break. Reduces maintenance surface. If Claude is needed later, add it as another `LLMProvider` adapter.

### 6. Abstraction Level: Generic LLM

- **Chosen:** `LLMProvider` interface (not summarization-specific)
- **Rationale:** Reusable for future LLM needs (query rewriting, classification, etc.)

## Architecture

### LLMProvider Interface

```typescript
// src/core/llm/types.ts

interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResult>;
}

interface LLMOptions {
  maxTokens?: number;
  systemPrompt?: string;
}

interface LLMResult {
  text: string;
  usage: TokenUsage;
}
```

### GeminiProvider

```typescript
// src/core/llm/gemini-provider.ts

class GeminiProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) {}
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    // @google/genai SDK call → LLMResult
  }
}
```

### RoundRobinProvider

```typescript
// src/core/llm/round-robin-provider.ts

class RoundRobinProvider implements LLMProvider {
  private index = 0;
  constructor(private providers: LLMProvider[]) {}
  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const provider = this.providers[this.index % this.providers.length];
    this.index++;
    return provider.complete(prompt, options);
  }
}
```

### Configuration & Factory

```typescript
// src/core/llm/config.ts

interface LLMConfig {
  provider: string;
  gemini?: {
    apiKeys: string[];
    model?: string;  // default: "gemini-2.0-flash"
  };
}

function createProvider(config: LLMConfig): LLMProvider { ... }
function loadConfig(): LLMConfig | null { ... }
```

Config file: `~/.config/conversation-memory/config.json`

```json
{
  "provider": "gemini",
  "gemini": {
    "apiKeys": ["key1", "key2", "key3"],
    "model": "gemini-2.0-flash"
  }
}
```

## File Changes

### New Files

```
src/core/llm/
├── types.ts                # LLMProvider, LLMOptions, LLMResult
├── gemini-provider.ts      # GeminiProvider implementation
├── round-robin-provider.ts # RoundRobinProvider wrapper
└── config.ts               # LLMConfig, createProvider, loadConfig
```

### Modified Files

- `src/core/summarizer.ts` - Remove `callClaude()`, `getApiEnv()`, use `LLMProvider.complete()`
- `package.json` - Add `@google/genai`, remove `@anthropic-ai/claude-agent-sdk`

### Removed Environment Variables

- `CONVERSATION_MEMORY_API_MODEL`
- `CONVERSATION_MEMORY_API_BASE_URL`
- `CONVERSATION_MEMORY_API_TOKEN`
- `CONVERSATION_MEMORY_API_TIMEOUT_MS`

## Error Handling

- **config.json missing:** Skip summarization with warning log (same as `--no-summaries`)
- **API call failure:** Skip that conversation's summary, continue indexing rest
- **Round-robin failure:** No automatic retry with next key (simple round-robin, not failover)
- **Invalid config:** `createProvider()` throws on empty apiKeys or unknown provider
