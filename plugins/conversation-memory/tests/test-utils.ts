/**
 * Test utilities for conversation-memory plugin tests.
 *
 * Provides common helpers for temp directories, mock databases,
 * test data factories, mock embeddings, and temp file creation.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as sqliteVec from 'sqlite-vec';
import type { ConversationExchange, ToolCall } from '../src/core/types.js';

// ============================================================================
// Temp Directory Helpers
// ============================================================================

/**
 * Creates a temporary directory for testing.
 *
 * @returns The absolute path to the created temp directory.
 *
 * @example
 * ```ts
 * const tempDir = createTempDir();
 * try {
 *   // Use tempDir for testing
 * } finally {
 *   cleanupTempDir(tempDir);
 * }
 * ```
 */
export function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-mem-test-'));
  return tempDir;
}

/**
 * Cleans up a temporary directory by removing it and all contents.
 *
 * @param dirPath - The absolute path to the temp directory to clean up.
 *
 * @example
 * ```ts
 * const tempDir = createTempDir();
 * // ... tests ...
 * cleanupTempDir(tempDir);
 * ```
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ============================================================================
// Mock Database Setup
// ============================================================================

/**
 * Creates an in-memory SQLite database for testing.
 *
 * The database is initialized with the same schema as the production database,
 * including the exchanges table, tool_calls table, and vec_exchanges virtual table.
 *
 * @returns A better-sqlite3 Database instance configured with test schema.
 *
 * @example
 * ```ts
 * const db = createMockDb();
 * try {
 *   // Use db for testing
 * } finally {
 *   db.close();
 * }
 * ```
 */
export function createMockDb(): Database.Database {
  const db = new Database(':memory:');

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Enable WAL mode for better concurrency (same as production)
  db.pragma('journal_mode = WAL');

  // Set up test schema
  setupTestSchema(db);

  return db;
}

/**
 * Sets up the test schema in a database instance.
 *
 * Creates the exchanges, tool_calls, and vec_exchanges tables with
 * the same structure as the production database.
 *
 * @param db - The database instance to set up.
 *
 * @example
 * ```ts
 * const db = new Database(':memory:');
 * setupTestSchema(db);
 * ```
 */
export function setupTestSchema(db: Database.Database): void {
  // Create exchanges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_message TEXT NOT NULL,
      assistant_message TEXT NOT NULL,
      archive_path TEXT NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      embedding BLOB,
      last_indexed INTEGER,
      parent_uuid TEXT,
      is_sidechain BOOLEAN DEFAULT 0,
      session_id TEXT,
      cwd TEXT,
      git_branch TEXT,
      claude_version TEXT,
      thinking_level TEXT,
      thinking_disabled BOOLEAN,
      thinking_triggers TEXT
    )
  `);

  // Create tool_calls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      exchange_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input TEXT,
      tool_result TEXT,
      is_error BOOLEAN DEFAULT 0,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
    )
  `);

  // Create vector search index
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timestamp ON exchanges(timestamp DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_id ON exchanges(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project ON exchanges(project)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sidechain ON exchanges(is_sidechain)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_git_branch ON exchanges(git_branch)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_calls(tool_name)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tool_exchange ON tool_calls(exchange_id)
  `);
}

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Default values for test exchanges.
 */
const DEFAULT_EXCHANGE = {
  id: 'test-exchange-1',
  project: 'test-project',
  timestamp: '2025-01-15T10:30:00.000Z',
  userMessage: 'How do I implement a feature?',
  assistantMessage: 'Here is how you implement it...',
  archivePath: '/test/path/conversation.jsonl',
  lineStart: 1,
  lineEnd: 10,
};

/**
 * Creates a test conversation exchange object.
 *
 * @param overrides - Optional properties to override the default values.
 * @returns A ConversationExchange object for testing.
 *
 * @example
 * ```ts
 * const exchange = createExchange({
 *   userMessage: 'Custom question',
 *   project: 'my-project'
 * });
 * ```
 */
export function createExchange(
  overrides: Partial<ConversationExchange> = {}
): ConversationExchange {
  return {
    ...DEFAULT_EXCHANGE,
    ...overrides,
  };
}

/**
 * Creates a batch of test conversation exchanges.
 *
 * @param count - The number of exchanges to create.
 * @param baseOverrides - Optional properties to apply to all exchanges.
 * @param perItemOverrides - Optional function to provide overrides per exchange.
 * @returns An array of ConversationExchange objects.
 *
 * @example
 * ```ts
 * const exchanges = createExchanges(5, {
 *   project: 'my-project'
 * }, (index) => ({
 *   id: `exchange-${index}`,
 *   userMessage: `Question ${index}`
 * }));
 * ```
 */
export function createExchanges(
  count: number,
  baseOverrides: Partial<ConversationExchange> = {},
  perItemOverrides?: (index: number) => Partial<ConversationExchange>
): ConversationExchange[] {
  const exchanges: ConversationExchange[] = [];
  for (let i = 0; i < count; i++) {
    const overrides = perItemOverrides ? perItemOverrides(i) : {};
    exchanges.push(createExchange({
      ...baseOverrides,
      ...overrides,
      id: overrides.id || `test-exchange-${i}`,
    }));
  }
  return exchanges;
}

/**
 * Creates a test conversation (array of exchanges).
 *
 * @param overrides - Optional properties to override default values.
 * @returns An array of ConversationExchange objects representing a conversation.
 *
 * @example
 * ```ts
 * const conversation = createConversation({
 *   project: 'my-project',
 *   timestamp: '2025-01-15T10:00:00.000Z'
 * });
 * ```
 */
export function createConversation(
  overrides: Partial<ConversationExchange> = {}
): ConversationExchange[] {
  return [createExchange(overrides)];
}

/**
 * Creates a mock message object as it appears in conversation JSONL files.
 *
 * @param role - The message role ('user' or 'assistant').
 * @param content - The message content (string or array of content blocks).
 * @param overrides - Optional properties to override.
 * @returns A mock JSONL message object.
 *
 * @example
 * ```ts
 * const userMsg = createMessage('user', 'Hello');
 * const assistantMsg = createMessage('assistant', 'Hi there!', {
 *   timestamp: '2025-01-15T10:30:00.000Z'
 * });
 * ```
 */
export function createMessage(
  role: 'user' | 'assistant',
  content: string | Array<{ type: string; text?: string; name?: string; input?: any }>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: role,
    message: { role, content },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Mock Embeddings
// ============================================================================

/**
 * The dimension of embedding vectors used by this plugin.
 */
export const EMBEDDING_DIM = 768;

/**
 * Generates a consistent mock embedding vector.
 *
 * Returns a 768-dimensional vector with deterministic values based on the input text.
 * This allows for reproducible tests without requiring the actual embedding model.
 *
 * @param text - The input text to generate a mock embedding for.
 * @returns A 768-dimensional number array.
 *
 * @example
 * ```ts
 * const embedding = mockGenerateEmbedding('test query');
 * expect(embedding).toHaveLength(768);
 * expect(embedding[0]).toBeGreaterThan(0);
 * ```
 */
export function mockGenerateEmbedding(text: string): number[] {
  // Generate a deterministic pseudo-random embedding based on the input text
  const seed = hashString(text);
  const random = mulberry32(seed);

  const embedding = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Generate values in range [-1, 1] and normalize
    embedding[i] = (random() * 2 - 1);
  }

  // Normalize the embedding to unit length (L2 normalization)
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  return embedding.map(val => val / magnitude);
}

/**
 * Simple hash function for strings (djb2 algorithm).
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Mulberry32 seeded random number generator.
 */
function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates mock embeddings for an exchange (user + assistant messages).
 *
 * Combines the user and assistant messages into a single embedding.
 *
 * @param userMessage - The user's message.
 * @param assistantMessage - The assistant's response.
 * @param toolNames - Optional array of tool names used.
 * @returns A 768-dimensional number array.
 *
 * @example
 * ```ts
 * const embedding = mockGenerateExchangeEmbedding(
 *   'How do I implement X?',
 *   'Here is how...',
 *   ['Bash', 'Read']
 * );
 * ```
 */
export function mockGenerateExchangeEmbedding(
  userMessage: string,
  assistantMessage: string,
  toolNames?: string[]
): number[] {
  let combined = `User: ${userMessage}\n\nAssistant: ${assistantMessage}`;

  if (toolNames && toolNames.length > 0) {
    combined += `\n\nTools: ${toolNames.join(', ')}`;
  }

  return mockGenerateEmbedding(combined);
}

// ============================================================================
// Temp File Helpers
// ============================================================================

/**
 * Creates a temporary conversation JSONL file for testing.
 *
 * @param content - The content to write to the file (JSONL format).
 * @param filename - Optional custom filename. Defaults to a timestamp-based name.
 * @returns The absolute path to the created file.
 *
 * @example
 * ```ts
 * const content = JSON.stringify(createMessage('user', 'Hello')) + '\n' +
 *                 JSON.stringify(createMessage('assistant', 'Hi!')) + '\n';
 * const filePath = createTempConversationFile(content);
 * try {
 *   // Test with the file
 * } finally {
 *   fs.unlinkSync(filePath);
 * }
 * ```
 */
export function createTempConversationFile(
  content: string,
  filename?: string
): string {
  const tempDir = createTempDir();
  const actualFilename = filename || `test-${Date.now()}.jsonl`;
  const filePath = path.join(tempDir, actualFilename);

  fs.writeFileSync(filePath, content, 'utf-8');

  return filePath;
}

/**
 * Creates a temporary conversation file from message objects.
 *
 * @param messages - Array of message objects (from createMessage or similar).
 * @param filename - Optional custom filename.
 * @returns The absolute path to the created file.
 *
 * @example
 * ```ts
 * const filePath = createTempConversationFromMessages([
 *   createMessage('user', 'Hello'),
 *   createMessage('assistant', 'Hi there!')
 * ]);
 * ```
 */
export function createTempConversationFromMessages(
  messages: Record<string, unknown>[],
  filename?: string
): string {
  const content = messages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
  return createTempConversationFile(content, filename);
}

/**
 * Creates a mock JSONL conversation with multiple exchanges.
 *
 * @param exchanges - Array of {userMessage, assistantMessage} pairs.
 * @param filename - Optional custom filename.
 * @returns The absolute path to the created file.
 *
 * @example
 * ```ts
 * const filePath = createMockJsonlConversation([
 *   { userMessage: 'Q1', assistantMessage: 'A1' },
 *   { userMessage: 'Q2', assistantMessage: 'A2' }
 * ]);
 * ```
 */
export function createMockJsonlConversation(
  exchanges: Array<{ userMessage: string; assistantMessage: string }>,
  filename?: string
): string {
  const messages: Record<string, unknown>[] = [];

  for (const exchange of exchanges) {
    messages.push(createMessage('user', exchange.userMessage));
    messages.push(createMessage('assistant', exchange.assistantMessage));
  }

  return createTempConversationFromMessages(messages, filename);
}

// ============================================================================
// Tool Call Helpers
// ============================================================================

/**
 * Creates a mock tool call object.
 *
 * @param overrides - Optional properties to override default values.
 * @returns A ToolCall object for testing.
 *
 * @example
 * ```ts
 * const toolCall = createToolCall({
 *   toolName: 'Bash',
 *   toolInput: { command: 'ls' }
 * });
 * ```
 */
export function createToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: 'test-tool-call-1',
    exchangeId: 'test-exchange-1',
    toolName: 'TestTool',
    toolInput: {},
    isError: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates multiple mock tool calls.
 *
 * @param count - Number of tool calls to create.
 * @param baseOverrides - Optional properties to apply to all tool calls.
 * @returns An array of ToolCall objects.
 *
 * @example
 * ```ts
 * const toolCalls = createToolCalls(3, {
 *   exchangeId: 'my-exchange',
 *   toolName: 'Bash'
 * });
 * ```
 */
export function createToolCalls(
  count: number,
  baseOverrides: Partial<ToolCall> = {}
): ToolCall[] {
  const calls: ToolCall[] = [];
  for (let i = 0; i < count; i++) {
    calls.push(createToolCall({
      ...baseOverrides,
      id: `test-tool-call-${i}`,
      exchangeId: baseOverrides.exchangeId || 'test-exchange-1',
    }));
  }
  return calls;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that an embedding vector is valid.
 *
 * Checks that the vector has the correct dimension and is normalized.
 *
 * @param embedding - The embedding vector to validate.
 * @param dim - Expected dimension (default: 768).
 *
 * @example
 * ```ts
 * const embedding = mockGenerateEmbedding('test');
 * assertValidEmbedding(embedding);
 * ```
 */
export function assertValidEmbedding(
  embedding: number[],
  dim: number = EMBEDDING_DIM
): void {
  if (embedding.length !== dim) {
    throw new Error(`Expected embedding dimension ${dim}, got ${embedding.length}`);
  }

  // Check if normalized (magnitude should be close to 1)
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (Math.abs(magnitude - 1) > 0.001) {
    throw new Error(`Expected normalized embedding (magnitude ~1), got ${magnitude}`);
  }
}

/**
 * Asserts that an exchange object has all required fields.
 *
 * @param exchange - The exchange to validate.
 *
 * @example
 * ```ts
 * const exchange = createExchange();
 * assertValidExchange(exchange);
 * ```
 */
export function assertValidExchange(exchange: ConversationExchange): void {
  const requiredFields: Array<keyof ConversationExchange> = [
    'id',
    'project',
    'timestamp',
    'userMessage',
    'assistantMessage',
    'archivePath',
    'lineStart',
    'lineEnd',
  ];

  for (const field of requiredFields) {
    if (exchange[field] === undefined || exchange[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate timestamp format
  const timestamp = new Date(exchange.timestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Invalid timestamp format: ${exchange.timestamp}`);
  }

  // Validate line numbers
  if (exchange.lineStart < 0 || exchange.lineEnd < exchange.lineStart) {
    throw new Error(`Invalid line range: ${exchange.lineStart}-${exchange.lineEnd}`);
  }
}
