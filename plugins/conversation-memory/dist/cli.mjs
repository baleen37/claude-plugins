#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/parser.ts
var parser_exports = {};
__export(parser_exports, {
  parseConversation: () => parseConversation,
  parseConversationFile: () => parseConversationFile,
  parseConversationWithResult: () => parseConversationWithResult
});
import fs from "fs";
import readline from "readline";
import crypto from "crypto";
async function parseConversation(filePath, projectName, archivePath) {
  const result = await parseConversationWithResult(filePath, projectName, archivePath);
  return result.exchanges;
}
async function parseConversationWithResult(filePath, projectName, archivePath) {
  const exchanges = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  let currentExchange = null;
  const finalizeExchange = () => {
    if (currentExchange && (currentExchange.assistantMessages.length > 0 || currentExchange.toolCalls.length > 0)) {
      const exchangeId = crypto.createHash("md5").update(`${archivePath}:${currentExchange.userLine}-${currentExchange.lastAssistantLine}`).digest("hex");
      const toolCalls = currentExchange.toolCalls.map((tc) => ({
        ...tc,
        exchangeId
      }));
      const exchange = {
        id: exchangeId,
        project: projectName,
        timestamp: currentExchange.timestamp,
        userMessage: currentExchange.userMessage,
        assistantMessage: currentExchange.assistantMessages.join("\n\n"),
        archivePath,
        lineStart: currentExchange.userLine,
        lineEnd: currentExchange.lastAssistantLine,
        parentUuid: currentExchange.parentUuid,
        isSidechain: currentExchange.isSidechain,
        sessionId: currentExchange.sessionId,
        cwd: currentExchange.cwd,
        gitBranch: currentExchange.gitBranch,
        claudeVersion: currentExchange.claudeVersion,
        thinkingLevel: currentExchange.thinkingLevel,
        thinkingDisabled: currentExchange.thinkingDisabled,
        thinkingTriggers: currentExchange.thinkingTriggers,
        toolCalls: toolCalls.length > 0 ? toolCalls : void 0
      };
      exchanges.push(exchange);
    }
  };
  for await (const line of rl) {
    lineNumber++;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type !== "user" && parsed.type !== "assistant") {
        continue;
      }
      if (!parsed.message) {
        continue;
      }
      let text = "";
      const toolCalls = [];
      if (typeof parsed.message.content === "string") {
        text = parsed.message.content;
      } else if (Array.isArray(parsed.message.content)) {
        const textBlocks = parsed.message.content.filter((block) => block.type === "text" && block.text).map((block) => block.text);
        text = textBlocks.join("\n");
        if (parsed.message.role === "assistant") {
          for (const block of parsed.message.content) {
            if (block.type === "tool_use") {
              const toolCallId = crypto.randomUUID();
              toolCalls.push({
                id: toolCallId,
                exchangeId: "",
                // Will be set when we know the exchange ID
                toolName: block.name || "unknown",
                toolInput: block.input,
                isError: false,
                timestamp: parsed.timestamp || (/* @__PURE__ */ new Date()).toISOString()
              });
            }
          }
        }
        if (parsed.message.role === "user") {
          for (const block of parsed.message.content) {
            if (block.type === "tool_result") {
            }
          }
        }
      }
      const hasToolResults = Array.isArray(parsed.message.content) && parsed.message.content.some((block) => block.type === "tool_result");
      if (!text.trim() && toolCalls.length === 0 && !hasToolResults) {
        continue;
      }
      if (parsed.message.role === "user") {
        finalizeExchange();
        currentExchange = {
          userMessage: text || "(tool results only)",
          userLine: lineNumber,
          assistantMessages: [],
          lastAssistantLine: lineNumber,
          timestamp: parsed.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          parentUuid: parsed.parentUuid,
          isSidechain: parsed.isSidechain,
          sessionId: parsed.sessionId,
          cwd: parsed.cwd,
          gitBranch: parsed.gitBranch,
          claudeVersion: parsed.version,
          thinkingLevel: parsed.thinkingMetadata?.level,
          thinkingDisabled: parsed.thinkingMetadata?.disabled,
          thinkingTriggers: parsed.thinkingMetadata?.triggers ? JSON.stringify(parsed.thinkingMetadata.triggers) : void 0,
          toolCalls: []
        };
      } else if (parsed.message.role === "assistant" && currentExchange) {
        if (text.trim()) {
          currentExchange.assistantMessages.push(text);
        }
        currentExchange.lastAssistantLine = lineNumber;
        if (toolCalls.length > 0) {
          currentExchange.toolCalls.push(...toolCalls);
        }
        if (parsed.timestamp) {
          currentExchange.timestamp = parsed.timestamp;
        }
        if (parsed.sessionId) currentExchange.sessionId = parsed.sessionId;
        if (parsed.cwd) currentExchange.cwd = parsed.cwd;
        if (parsed.gitBranch) currentExchange.gitBranch = parsed.gitBranch;
        if (parsed.version) currentExchange.claudeVersion = parsed.version;
      }
    } catch (error) {
      continue;
    }
  }
  finalizeExchange();
  const allContent = exchanges.map((e) => `${e.userMessage} ${e.assistantMessage}`).join("\n");
  const excludedMarker = EXCLUSION_MARKERS.find((marker) => allContent.toUpperCase().includes(marker.toUpperCase()));
  if (excludedMarker) {
    return {
      exchanges: [],
      isExcluded: true,
      exclusionReason: `Found exclusion marker: "${excludedMarker}"`
    };
  }
  return {
    exchanges,
    isExcluded: false
  };
}
async function parseConversationFile(filePath) {
  const pathParts = filePath.split("/");
  let project = "unknown";
  if (pathParts.length >= 2) {
    project = pathParts[pathParts.length - 2];
  }
  const result = await parseConversationWithResult(filePath, project, filePath);
  return {
    project,
    exchanges: result.exchanges,
    isExcluded: result.isExcluded,
    exclusionReason: result.exclusionReason
  };
}
var EXCLUSION_MARKERS;
var init_parser = __esm({
  "src/core/parser.ts"() {
    "use strict";
    EXCLUSION_MARKERS = [
      "DO NOT INDEX THIS CHAT",
      "DO NOT INDEX THIS CONVERSATION",
      "\uC774 \uB300\uD654\uB294 \uC778\uB371\uC2F1\uD558\uC9C0 \uB9C8\uC138\uC694",
      // Korean: "Don't index this conversation"
      "\uC774 \uB300\uD654\uB294 \uAC80\uC0C9\uC5D0\uC11C \uC81C\uC678\uD558\uC138\uC694"
      // Korean: "Exclude this conversation from search"
    ];
  }
});

// src/core/paths.ts
import os from "os";
import path from "path";
import fs2 from "fs";
function ensureDir(dir) {
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function getSuperpowersDir() {
  let dir;
  if (process.env.CONVERSATION_MEMORY_CONFIG_DIR) {
    dir = process.env.CONVERSATION_MEMORY_CONFIG_DIR;
  } else {
    dir = path.join(os.homedir(), ".config", "conversation-memory");
  }
  return ensureDir(dir);
}
function getArchiveDir() {
  if (process.env.TEST_ARCHIVE_DIR) {
    return ensureDir(process.env.TEST_ARCHIVE_DIR);
  }
  return ensureDir(path.join(getSuperpowersDir(), "conversation-archive"));
}
function getIndexDir() {
  return ensureDir(path.join(getSuperpowersDir(), "conversation-index"));
}
function getDbPath() {
  if (process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH) {
    return process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH;
  }
  return path.join(getIndexDir(), "conversations.db");
}
function getExcludeConfigPath() {
  return path.join(getIndexDir(), "exclude.txt");
}
function getExcludedProjects() {
  if (process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS) {
    return process.env.CONVERSATION_SEARCH_EXCLUDE_PROJECTS.split(",").map((p) => p.trim());
  }
  const configPath = getExcludeConfigPath();
  if (fs2.existsSync(configPath)) {
    const content = fs2.readFileSync(configPath, "utf-8");
    return content.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  }
  return [];
}
function getLogDir() {
  return ensureDir(path.join(getSuperpowersDir(), "logs"));
}
function getLogFilePath() {
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return path.join(getLogDir(), `${date}.log`);
}
function getObserverPidPath() {
  return path.join(getSuperpowersDir(), "observer.pid");
}
var init_paths = __esm({
  "src/core/paths.ts"() {
    "use strict";
  }
});

// src/core/db.ts
var db_exports = {};
__export(db_exports, {
  deleteExchange: () => deleteExchange,
  getAllExchanges: () => getAllExchanges,
  getFileLastIndexed: () => getFileLastIndexed,
  getLastPromptNumber: () => getLastPromptNumber,
  getPendingEvents: () => getPendingEvents,
  getSessionSummary: () => getSessionSummary,
  initDatabase: () => initDatabase,
  insertExchange: () => insertExchange,
  insertObservation: () => insertObservation,
  insertPendingEvent: () => insertPendingEvent,
  insertSessionSummary: () => insertSessionSummary,
  markEventProcessed: () => markEventProcessed,
  migrateSchema: () => migrateSchema
});
import Database from "better-sqlite3";
import path2 from "path";
import fs3 from "fs";
import * as sqliteVec from "sqlite-vec";
function migrateSchema(db) {
  const columns = db.prepare(`SELECT name FROM pragma_table_info('exchanges')`).all();
  const columnNames = new Set(columns.map((c) => c.name));
  const migrations = [
    { name: "last_indexed", sql: "ALTER TABLE exchanges ADD COLUMN last_indexed INTEGER" },
    { name: "parent_uuid", sql: "ALTER TABLE exchanges ADD COLUMN parent_uuid TEXT" },
    { name: "is_sidechain", sql: "ALTER TABLE exchanges ADD COLUMN is_sidechain BOOLEAN DEFAULT 0" },
    { name: "session_id", sql: "ALTER TABLE exchanges ADD COLUMN session_id TEXT" },
    { name: "cwd", sql: "ALTER TABLE exchanges ADD COLUMN cwd TEXT" },
    { name: "git_branch", sql: "ALTER TABLE exchanges ADD COLUMN git_branch TEXT" },
    { name: "claude_version", sql: "ALTER TABLE exchanges ADD COLUMN claude_version TEXT" },
    { name: "thinking_level", sql: "ALTER TABLE exchanges ADD COLUMN thinking_level TEXT" },
    { name: "thinking_disabled", sql: "ALTER TABLE exchanges ADD COLUMN thinking_disabled BOOLEAN" },
    { name: "thinking_triggers", sql: "ALTER TABLE exchanges ADD COLUMN thinking_triggers TEXT" },
    { name: "compressed_tool_summary", sql: "ALTER TABLE exchanges ADD COLUMN compressed_tool_summary TEXT" },
    { name: "project_pending_events", sql: "ALTER TABLE pending_events ADD COLUMN project TEXT" }
  ];
  let migrated = false;
  for (const migration of migrations) {
    if (!columnNames.has(migration.name)) {
      console.log(`Migrating schema: adding ${migration.name} column...`);
      db.prepare(migration.sql).run();
      migrated = true;
    }
  }
  if (migrated) {
    console.log("Migration complete.");
  }
}
function initDatabase() {
  const dbPath = getDbPath();
  const dbDir = path2.dirname(dbPath);
  if (!fs3.existsSync(dbDir)) {
    fs3.mkdirSync(dbDir, { recursive: true });
  }
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
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
      thinking_triggers TEXT,
      compressed_tool_summary TEXT
    )
  `);
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
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      prompt_number INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      narrative TEXT NOT NULL,
      facts TEXT NOT NULL,
      concepts TEXT NOT NULL,
      files_read TEXT NOT NULL,
      files_modified TEXT NOT NULL,
      tool_name TEXT,
      correlation_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_summaries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      request TEXT NOT NULL,
      investigated TEXT NOT NULL,
      learned TEXT NOT NULL,
      completed TEXT NOT NULL,
      next_steps TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      tool_response TEXT,
      cwd TEXT,
      project TEXT,
      timestamp INTEGER NOT NULL,
      processed BOOLEAN DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_observations USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);
  migrateSchema(db);
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
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_project ON observations(project)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_obs_timestamp ON observations(timestamp DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_session ON pending_events(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_processed ON pending_events(processed)
  `);
  return db;
}
function insertExchange(db, exchange, embedding, toolNames) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO exchanges
    (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end, last_indexed,
     parent_uuid, is_sidechain, session_id, cwd, git_branch, claude_version,
     thinking_level, thinking_disabled, thinking_triggers, compressed_tool_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    exchange.id,
    exchange.project,
    exchange.timestamp,
    exchange.userMessage,
    exchange.assistantMessage,
    exchange.archivePath,
    exchange.lineStart,
    exchange.lineEnd,
    now,
    exchange.parentUuid ?? null,
    exchange.isSidechain ? 1 : 0,
    exchange.sessionId ?? null,
    exchange.cwd ?? null,
    exchange.gitBranch ?? null,
    exchange.claudeVersion ?? null,
    exchange.thinkingLevel ?? null,
    exchange.thinkingDisabled ? 1 : 0,
    exchange.thinkingTriggers ?? null,
    exchange.compressedToolSummary ?? null
  );
  const delStmt = db.prepare(`DELETE FROM vec_exchanges WHERE id = ?`);
  delStmt.run(exchange.id);
  const vecStmt = db.prepare(`
    INSERT INTO vec_exchanges (id, embedding)
    VALUES (?, ?)
  `);
  vecStmt.run(exchange.id, Buffer.from(new Float32Array(embedding).buffer));
  if (exchange.toolCalls && exchange.toolCalls.length > 0) {
    const toolStmt = db.prepare(`
      INSERT OR REPLACE INTO tool_calls
      (id, exchange_id, tool_name, tool_input, tool_result, is_error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const toolCall of exchange.toolCalls) {
      toolStmt.run(
        toolCall.id,
        toolCall.exchangeId,
        toolCall.toolName,
        toolCall.toolInput ? JSON.stringify(toolCall.toolInput) : null,
        toolCall.toolResult || null,
        toolCall.isError ? 1 : 0,
        toolCall.timestamp
      );
    }
  }
}
function getAllExchanges(db) {
  const stmt = db.prepare(`SELECT id, archive_path as archivePath FROM exchanges`);
  return stmt.all();
}
function getFileLastIndexed(db, archivePath) {
  const stmt = db.prepare(`
    SELECT MAX(last_indexed) as lastIndexed
    FROM exchanges
    WHERE archive_path = ?
  `);
  const row = stmt.get(archivePath);
  return row.lastIndexed;
}
function deleteExchange(db, id) {
  db.prepare(`DELETE FROM vec_exchanges WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM exchanges WHERE id = ?`).run(id);
}
function insertObservation(db, observation, embedding) {
  const stmt = db.prepare(`
    INSERT INTO observations
    (id, session_id, project, prompt_number, timestamp, type, title, subtitle, narrative,
     facts, concepts, files_read, files_modified, tool_name, correlation_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    observation.id,
    observation.sessionId,
    observation.project,
    observation.promptNumber,
    observation.timestamp,
    observation.type,
    observation.title,
    observation.subtitle,
    observation.narrative,
    JSON.stringify(observation.facts),
    JSON.stringify(observation.concepts),
    JSON.stringify(observation.filesRead),
    JSON.stringify(observation.filesModified),
    observation.toolName ?? null,
    observation.correlationId ?? null,
    observation.createdAt
  );
  if (embedding) {
    const delStmt = db.prepare(`DELETE FROM vec_observations WHERE id = ?`);
    delStmt.run(observation.id);
    const vecStmt = db.prepare(`
      INSERT INTO vec_observations (id, embedding)
      VALUES (?, ?)
    `);
    vecStmt.run(observation.id, Buffer.from(new Float32Array(embedding).buffer));
  }
}
function insertPendingEvent(db, event) {
  const stmt = db.prepare(`
    INSERT INTO pending_events
    (id, session_id, event_type, tool_name, tool_input, tool_response, cwd, project, timestamp, processed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    event.id,
    event.sessionId,
    event.eventType,
    event.toolName ?? null,
    event.toolInput ? JSON.stringify(event.toolInput) : null,
    event.toolResponse ?? null,
    event.cwd ?? null,
    event.project ?? null,
    event.timestamp,
    event.processed ? 1 : 0,
    event.createdAt
  );
}
function getPendingEvents(db, sessionId, limit = 10) {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, event_type as eventType, tool_name as toolName,
           tool_input as toolInput, tool_response as toolResponse, cwd, project, timestamp,
           processed, created_at as createdAt
    FROM pending_events
    WHERE session_id = ? AND processed = 0
    ORDER BY created_at ASC
    LIMIT ?
  `);
  const rows = stmt.all(sessionId, limit);
  return rows.map((row) => ({
    ...row,
    toolInput: row.toolInput ? JSON.parse(row.toolInput) : void 0,
    processed: row.processed === 1
  }));
}
function markEventProcessed(db, eventId) {
  const stmt = db.prepare(`UPDATE pending_events SET processed = 1 WHERE id = ?`);
  stmt.run(eventId);
}
function insertSessionSummary(db, summary) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_summaries
    (id, session_id, project, request, investigated, learned, completed, next_steps, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    summary.id,
    summary.sessionId,
    summary.project,
    summary.request,
    JSON.stringify(summary.investigated),
    JSON.stringify(summary.learned),
    JSON.stringify(summary.completed),
    JSON.stringify(summary.nextSteps),
    summary.notes,
    summary.createdAt
  );
}
function getSessionSummary(db, sessionId) {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, request, investigated, learned,
           completed, next_steps as nextSteps, notes, created_at as createdAt
    FROM session_summaries
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = stmt.get(sessionId);
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    sessionId: row.sessionId,
    project: row.project,
    request: row.request,
    investigated: JSON.parse(row.investigated),
    learned: JSON.parse(row.learned),
    completed: JSON.parse(row.completed),
    nextSteps: JSON.parse(row.nextSteps),
    notes: row.notes,
    createdAt: row.createdAt
  };
}
function getLastPromptNumber(db, sessionId) {
  const stmt = db.prepare(`
    SELECT MAX(prompt_number) as maxPrompt
    FROM observations
    WHERE session_id = ?
  `);
  const row = stmt.get(sessionId);
  return row.maxPrompt ?? 0;
}
var init_db = __esm({
  "src/core/db.ts"() {
    "use strict";
    init_paths();
  }
});

// src/core/embeddings.ts
var embeddings_exports = {};
__export(embeddings_exports, {
  generateEmbedding: () => generateEmbedding,
  generateExchangeEmbedding: () => generateExchangeEmbedding,
  initEmbeddings: () => initEmbeddings
});
import { pipeline, env } from "@huggingface/transformers";
async function initEmbeddings() {
  if (!embeddingPipeline) {
    console.log("Loading embedding model (first run may take time)...");
    env.cacheDir = "./.cache";
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "onnx-community/embeddinggemma-300m-ONNX",
      { dtype: "q4" }
    );
    console.log("Embedding model loaded");
  }
}
async function generateEmbedding(text) {
  if (!embeddingPipeline) {
    await initEmbeddings();
  }
  const prefixedText = `title: none | text: ${text}`;
  const truncated = prefixedText.substring(0, 8e3);
  const output = await embeddingPipeline(truncated, {
    pooling: "mean",
    normalize: true
  });
  return Array.from(output.data);
}
async function generateExchangeEmbedding(userMessage, assistantMessage, toolNames) {
  let combined = `User: ${userMessage}

Assistant: ${assistantMessage}`;
  if (toolNames && toolNames.length > 0) {
    combined += `

Tools: ${toolNames.join(", ")}`;
  }
  return generateEmbedding(combined);
}
var embeddingPipeline;
var init_embeddings = __esm({
  "src/core/embeddings.ts"() {
    "use strict";
    embeddingPipeline = null;
  }
});

// src/core/constants.ts
var SUMMARIZER_CONTEXT_MARKER;
var init_constants = __esm({
  "src/core/constants.ts"() {
    "use strict";
    SUMMARIZER_CONTEXT_MARKER = "Context: This summary will be shown in a list to help users and Claude choose which conversations are relevant";
  }
});

// src/core/logger.ts
import fs4 from "fs";
function formatLogEntry(entry) {
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `[${entry.timestamp}] [${entry.level}] ${entry.message}${dataStr}`;
}
function writeLog(entry) {
  const logPath = getLogFilePath();
  const line = formatLogEntry(entry) + "\n";
  fs4.appendFileSync(logPath, line, "utf-8");
}
function logInfo(message, data) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "INFO" /* INFO */,
    message,
    data
  };
  writeLog(entry);
  console.log(`[INFO] ${message}`);
}
function logWarn(message, data) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "WARN" /* WARN */,
    message,
    data
  };
  writeLog(entry);
  console.warn(`[WARN] ${message}`);
}
function logError(message, error, data) {
  const errorData = error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack
  } : error;
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "ERROR" /* ERROR */,
    message,
    data: data ? { ...data, error: errorData } : { error: errorData }
  };
  writeLog(entry);
}
var init_logger = __esm({
  "src/core/logger.ts"() {
    "use strict";
    init_paths();
  }
});

// node_modules/@google/generative-ai/dist/index.mjs
function getClientHeaders(requestOptions) {
  const clientHeaders = [];
  if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.apiClient) {
    clientHeaders.push(requestOptions.apiClient);
  }
  clientHeaders.push(`${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`);
  return clientHeaders.join(" ");
}
async function getHeaders(url) {
  var _a;
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("x-goog-api-client", getClientHeaders(url.requestOptions));
  headers.append("x-goog-api-key", url.apiKey);
  let customHeaders = (_a = url.requestOptions) === null || _a === void 0 ? void 0 : _a.customHeaders;
  if (customHeaders) {
    if (!(customHeaders instanceof Headers)) {
      try {
        customHeaders = new Headers(customHeaders);
      } catch (e) {
        throw new GoogleGenerativeAIRequestInputError(`unable to convert customHeaders value ${JSON.stringify(customHeaders)} to Headers: ${e.message}`);
      }
    }
    for (const [headerName, headerValue] of customHeaders.entries()) {
      if (headerName === "x-goog-api-key") {
        throw new GoogleGenerativeAIRequestInputError(`Cannot set reserved header name ${headerName}`);
      } else if (headerName === "x-goog-api-client") {
        throw new GoogleGenerativeAIRequestInputError(`Header name ${headerName} can only be set using the apiClient field`);
      }
      headers.append(headerName, headerValue);
    }
  }
  return headers;
}
async function constructModelRequest(model, task, apiKey, stream, body, requestOptions) {
  const url = new RequestUrl(model, task, apiKey, stream, requestOptions);
  return {
    url: url.toString(),
    fetchOptions: Object.assign(Object.assign({}, buildFetchOptions(requestOptions)), { method: "POST", headers: await getHeaders(url), body })
  };
}
async function makeModelRequest(model, task, apiKey, stream, body, requestOptions = {}, fetchFn = fetch) {
  const { url, fetchOptions } = await constructModelRequest(model, task, apiKey, stream, body, requestOptions);
  return makeRequest(url, fetchOptions, fetchFn);
}
async function makeRequest(url, fetchOptions, fetchFn = fetch) {
  let response;
  try {
    response = await fetchFn(url, fetchOptions);
  } catch (e) {
    handleResponseError(e, url);
  }
  if (!response.ok) {
    await handleResponseNotOk(response, url);
  }
  return response;
}
function handleResponseError(e, url) {
  let err = e;
  if (err.name === "AbortError") {
    err = new GoogleGenerativeAIAbortError(`Request aborted when fetching ${url.toString()}: ${e.message}`);
    err.stack = e.stack;
  } else if (!(e instanceof GoogleGenerativeAIFetchError || e instanceof GoogleGenerativeAIRequestInputError)) {
    err = new GoogleGenerativeAIError(`Error fetching from ${url.toString()}: ${e.message}`);
    err.stack = e.stack;
  }
  throw err;
}
async function handleResponseNotOk(response, url) {
  let message = "";
  let errorDetails;
  try {
    const json = await response.json();
    message = json.error.message;
    if (json.error.details) {
      message += ` ${JSON.stringify(json.error.details)}`;
      errorDetails = json.error.details;
    }
  } catch (e) {
  }
  throw new GoogleGenerativeAIFetchError(`Error fetching from ${url.toString()}: [${response.status} ${response.statusText}] ${message}`, response.status, response.statusText, errorDetails);
}
function buildFetchOptions(requestOptions) {
  const fetchOptions = {};
  if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) !== void 0 || (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
    const controller = new AbortController();
    if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
      setTimeout(() => controller.abort(), requestOptions.timeout);
    }
    if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) {
      requestOptions.signal.addEventListener("abort", () => {
        controller.abort();
      });
    }
    fetchOptions.signal = controller.signal;
  }
  return fetchOptions;
}
function addHelpers(response) {
  response.text = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      return getText(response);
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Text not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return "";
  };
  response.functionCall = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      console.warn(`response.functionCall() is deprecated. Use response.functionCalls() instead.`);
      return getFunctionCalls(response)[0];
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return void 0;
  };
  response.functionCalls = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      return getFunctionCalls(response);
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return void 0;
  };
  return response;
}
function getText(response) {
  var _a, _b, _c, _d;
  const textStrings = [];
  if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
    for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
      if (part.text) {
        textStrings.push(part.text);
      }
      if (part.executableCode) {
        textStrings.push("\n```" + part.executableCode.language + "\n" + part.executableCode.code + "\n```\n");
      }
      if (part.codeExecutionResult) {
        textStrings.push("\n```\n" + part.codeExecutionResult.output + "\n```\n");
      }
    }
  }
  if (textStrings.length > 0) {
    return textStrings.join("");
  } else {
    return "";
  }
}
function getFunctionCalls(response) {
  var _a, _b, _c, _d;
  const functionCalls = [];
  if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
    for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
      if (part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }
  }
  if (functionCalls.length > 0) {
    return functionCalls;
  } else {
    return void 0;
  }
}
function hadBadFinishReason(candidate) {
  return !!candidate.finishReason && badFinishReasons.includes(candidate.finishReason);
}
function formatBlockErrorMessage(response) {
  var _a, _b, _c;
  let message = "";
  if ((!response.candidates || response.candidates.length === 0) && response.promptFeedback) {
    message += "Response was blocked";
    if ((_a = response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason) {
      message += ` due to ${response.promptFeedback.blockReason}`;
    }
    if ((_b = response.promptFeedback) === null || _b === void 0 ? void 0 : _b.blockReasonMessage) {
      message += `: ${response.promptFeedback.blockReasonMessage}`;
    }
  } else if ((_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) {
    const firstCandidate = response.candidates[0];
    if (hadBadFinishReason(firstCandidate)) {
      message += `Candidate was blocked due to ${firstCandidate.finishReason}`;
      if (firstCandidate.finishMessage) {
        message += `: ${firstCandidate.finishMessage}`;
      }
    }
  }
  return message;
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function verb(n) {
    if (g[n]) i[n] = function(v) {
      return new Promise(function(a, b) {
        q.push([n, v, a, b]) > 1 || resume(n, v);
      });
    };
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function processStream(response) {
  const inputStream = response.body.pipeThrough(new TextDecoderStream("utf8", { fatal: true }));
  const responseStream = getResponseStream(inputStream);
  const [stream1, stream2] = responseStream.tee();
  return {
    stream: generateResponseSequence(stream1),
    response: getResponsePromise(stream2)
  };
}
async function getResponsePromise(stream) {
  const allResponses = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return addHelpers(aggregateResponses(allResponses));
    }
    allResponses.push(value);
  }
}
function generateResponseSequence(stream) {
  return __asyncGenerator(this, arguments, function* generateResponseSequence_1() {
    const reader = stream.getReader();
    while (true) {
      const { value, done } = yield __await(reader.read());
      if (done) {
        break;
      }
      yield yield __await(addHelpers(value));
    }
  });
}
function getResponseStream(inputStream) {
  const reader = inputStream.getReader();
  const stream = new ReadableStream({
    start(controller) {
      let currentText = "";
      return pump();
      function pump() {
        return reader.read().then(({ value, done }) => {
          if (done) {
            if (currentText.trim()) {
              controller.error(new GoogleGenerativeAIError("Failed to parse stream"));
              return;
            }
            controller.close();
            return;
          }
          currentText += value;
          let match = currentText.match(responseLineRE);
          let parsedResponse;
          while (match) {
            try {
              parsedResponse = JSON.parse(match[1]);
            } catch (e) {
              controller.error(new GoogleGenerativeAIError(`Error parsing JSON response: "${match[1]}"`));
              return;
            }
            controller.enqueue(parsedResponse);
            currentText = currentText.substring(match[0].length);
            match = currentText.match(responseLineRE);
          }
          return pump();
        }).catch((e) => {
          let err = e;
          err.stack = e.stack;
          if (err.name === "AbortError") {
            err = new GoogleGenerativeAIAbortError("Request aborted when reading from the stream");
          } else {
            err = new GoogleGenerativeAIError("Error reading from the stream");
          }
          throw err;
        });
      }
    }
  });
  return stream;
}
function aggregateResponses(responses) {
  const lastResponse = responses[responses.length - 1];
  const aggregatedResponse = {
    promptFeedback: lastResponse === null || lastResponse === void 0 ? void 0 : lastResponse.promptFeedback
  };
  for (const response of responses) {
    if (response.candidates) {
      let candidateIndex = 0;
      for (const candidate of response.candidates) {
        if (!aggregatedResponse.candidates) {
          aggregatedResponse.candidates = [];
        }
        if (!aggregatedResponse.candidates[candidateIndex]) {
          aggregatedResponse.candidates[candidateIndex] = {
            index: candidateIndex
          };
        }
        aggregatedResponse.candidates[candidateIndex].citationMetadata = candidate.citationMetadata;
        aggregatedResponse.candidates[candidateIndex].groundingMetadata = candidate.groundingMetadata;
        aggregatedResponse.candidates[candidateIndex].finishReason = candidate.finishReason;
        aggregatedResponse.candidates[candidateIndex].finishMessage = candidate.finishMessage;
        aggregatedResponse.candidates[candidateIndex].safetyRatings = candidate.safetyRatings;
        if (candidate.content && candidate.content.parts) {
          if (!aggregatedResponse.candidates[candidateIndex].content) {
            aggregatedResponse.candidates[candidateIndex].content = {
              role: candidate.content.role || "user",
              parts: []
            };
          }
          const newPart = {};
          for (const part of candidate.content.parts) {
            if (part.text) {
              newPart.text = part.text;
            }
            if (part.functionCall) {
              newPart.functionCall = part.functionCall;
            }
            if (part.executableCode) {
              newPart.executableCode = part.executableCode;
            }
            if (part.codeExecutionResult) {
              newPart.codeExecutionResult = part.codeExecutionResult;
            }
            if (Object.keys(newPart).length === 0) {
              newPart.text = "";
            }
            aggregatedResponse.candidates[candidateIndex].content.parts.push(newPart);
          }
        }
      }
      candidateIndex++;
    }
    if (response.usageMetadata) {
      aggregatedResponse.usageMetadata = response.usageMetadata;
    }
  }
  return aggregatedResponse;
}
async function generateContentStream(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(
    model,
    Task.STREAM_GENERATE_CONTENT,
    apiKey,
    /* stream */
    true,
    JSON.stringify(params),
    requestOptions
  );
  return processStream(response);
}
async function generateContent(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(
    model,
    Task.GENERATE_CONTENT,
    apiKey,
    /* stream */
    false,
    JSON.stringify(params),
    requestOptions
  );
  const responseJson = await response.json();
  const enhancedResponse = addHelpers(responseJson);
  return {
    response: enhancedResponse
  };
}
function formatSystemInstruction(input) {
  if (input == null) {
    return void 0;
  } else if (typeof input === "string") {
    return { role: "system", parts: [{ text: input }] };
  } else if (input.text) {
    return { role: "system", parts: [input] };
  } else if (input.parts) {
    if (!input.role) {
      return { role: "system", parts: input.parts };
    } else {
      return input;
    }
  }
}
function formatNewContent(request) {
  let newParts = [];
  if (typeof request === "string") {
    newParts = [{ text: request }];
  } else {
    for (const partOrString of request) {
      if (typeof partOrString === "string") {
        newParts.push({ text: partOrString });
      } else {
        newParts.push(partOrString);
      }
    }
  }
  return assignRoleToPartsAndValidateSendMessageRequest(newParts);
}
function assignRoleToPartsAndValidateSendMessageRequest(parts) {
  const userContent = { role: "user", parts: [] };
  const functionContent = { role: "function", parts: [] };
  let hasUserContent = false;
  let hasFunctionContent = false;
  for (const part of parts) {
    if ("functionResponse" in part) {
      functionContent.parts.push(part);
      hasFunctionContent = true;
    } else {
      userContent.parts.push(part);
      hasUserContent = true;
    }
  }
  if (hasUserContent && hasFunctionContent) {
    throw new GoogleGenerativeAIError("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
  }
  if (!hasUserContent && !hasFunctionContent) {
    throw new GoogleGenerativeAIError("No content is provided for sending chat message.");
  }
  if (hasUserContent) {
    return userContent;
  }
  return functionContent;
}
function formatCountTokensInput(params, modelParams) {
  var _a;
  let formattedGenerateContentRequest = {
    model: modelParams === null || modelParams === void 0 ? void 0 : modelParams.model,
    generationConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.generationConfig,
    safetySettings: modelParams === null || modelParams === void 0 ? void 0 : modelParams.safetySettings,
    tools: modelParams === null || modelParams === void 0 ? void 0 : modelParams.tools,
    toolConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.toolConfig,
    systemInstruction: modelParams === null || modelParams === void 0 ? void 0 : modelParams.systemInstruction,
    cachedContent: (_a = modelParams === null || modelParams === void 0 ? void 0 : modelParams.cachedContent) === null || _a === void 0 ? void 0 : _a.name,
    contents: []
  };
  const containsGenerateContentRequest = params.generateContentRequest != null;
  if (params.contents) {
    if (containsGenerateContentRequest) {
      throw new GoogleGenerativeAIRequestInputError("CountTokensRequest must have one of contents or generateContentRequest, not both.");
    }
    formattedGenerateContentRequest.contents = params.contents;
  } else if (containsGenerateContentRequest) {
    formattedGenerateContentRequest = Object.assign(Object.assign({}, formattedGenerateContentRequest), params.generateContentRequest);
  } else {
    const content = formatNewContent(params);
    formattedGenerateContentRequest.contents = [content];
  }
  return { generateContentRequest: formattedGenerateContentRequest };
}
function formatGenerateContentInput(params) {
  let formattedRequest;
  if (params.contents) {
    formattedRequest = params;
  } else {
    const content = formatNewContent(params);
    formattedRequest = { contents: [content] };
  }
  if (params.systemInstruction) {
    formattedRequest.systemInstruction = formatSystemInstruction(params.systemInstruction);
  }
  return formattedRequest;
}
function formatEmbedContentInput(params) {
  if (typeof params === "string" || Array.isArray(params)) {
    const content = formatNewContent(params);
    return { content };
  }
  return params;
}
function validateChatHistory(history) {
  let prevContent = false;
  for (const currContent of history) {
    const { role, parts } = currContent;
    if (!prevContent && role !== "user") {
      throw new GoogleGenerativeAIError(`First content should be with role 'user', got ${role}`);
    }
    if (!POSSIBLE_ROLES.includes(role)) {
      throw new GoogleGenerativeAIError(`Each item should include role field. Got ${role} but valid roles are: ${JSON.stringify(POSSIBLE_ROLES)}`);
    }
    if (!Array.isArray(parts)) {
      throw new GoogleGenerativeAIError("Content should have 'parts' property with an array of Parts");
    }
    if (parts.length === 0) {
      throw new GoogleGenerativeAIError("Each Content should have at least one part");
    }
    const countFields = {
      text: 0,
      inlineData: 0,
      functionCall: 0,
      functionResponse: 0,
      fileData: 0,
      executableCode: 0,
      codeExecutionResult: 0
    };
    for (const part of parts) {
      for (const key of VALID_PART_FIELDS) {
        if (key in part) {
          countFields[key] += 1;
        }
      }
    }
    const validParts = VALID_PARTS_PER_ROLE[role];
    for (const key of VALID_PART_FIELDS) {
      if (!validParts.includes(key) && countFields[key] > 0) {
        throw new GoogleGenerativeAIError(`Content with role '${role}' can't contain '${key}' part`);
      }
    }
    prevContent = true;
  }
}
function isValidResponse(response) {
  var _a;
  if (response.candidates === void 0 || response.candidates.length === 0) {
    return false;
  }
  const content = (_a = response.candidates[0]) === null || _a === void 0 ? void 0 : _a.content;
  if (content === void 0) {
    return false;
  }
  if (content.parts === void 0 || content.parts.length === 0) {
    return false;
  }
  for (const part of content.parts) {
    if (part === void 0 || Object.keys(part).length === 0) {
      return false;
    }
    if (part.text !== void 0 && part.text === "") {
      return false;
    }
  }
  return true;
}
async function countTokens(apiKey, model, params, singleRequestOptions) {
  const response = await makeModelRequest(model, Task.COUNT_TOKENS, apiKey, false, JSON.stringify(params), singleRequestOptions);
  return response.json();
}
async function embedContent(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(model, Task.EMBED_CONTENT, apiKey, false, JSON.stringify(params), requestOptions);
  return response.json();
}
async function batchEmbedContents(apiKey, model, params, requestOptions) {
  const requestsWithModel = params.requests.map((request) => {
    return Object.assign(Object.assign({}, request), { model });
  });
  const response = await makeModelRequest(model, Task.BATCH_EMBED_CONTENTS, apiKey, false, JSON.stringify({ requests: requestsWithModel }), requestOptions);
  return response.json();
}
var SchemaType, ExecutableCodeLanguage, Outcome, POSSIBLE_ROLES, HarmCategory, HarmBlockThreshold, HarmProbability, BlockReason, FinishReason, TaskType, FunctionCallingMode, DynamicRetrievalMode, GoogleGenerativeAIError, GoogleGenerativeAIResponseError, GoogleGenerativeAIFetchError, GoogleGenerativeAIRequestInputError, GoogleGenerativeAIAbortError, DEFAULT_BASE_URL, DEFAULT_API_VERSION, PACKAGE_VERSION, PACKAGE_LOG_HEADER, Task, RequestUrl, badFinishReasons, responseLineRE, VALID_PART_FIELDS, VALID_PARTS_PER_ROLE, SILENT_ERROR, ChatSession, GenerativeModel, GoogleGenerativeAI;
var init_dist = __esm({
  "node_modules/@google/generative-ai/dist/index.mjs"() {
    (function(SchemaType2) {
      SchemaType2["STRING"] = "string";
      SchemaType2["NUMBER"] = "number";
      SchemaType2["INTEGER"] = "integer";
      SchemaType2["BOOLEAN"] = "boolean";
      SchemaType2["ARRAY"] = "array";
      SchemaType2["OBJECT"] = "object";
    })(SchemaType || (SchemaType = {}));
    (function(ExecutableCodeLanguage2) {
      ExecutableCodeLanguage2["LANGUAGE_UNSPECIFIED"] = "language_unspecified";
      ExecutableCodeLanguage2["PYTHON"] = "python";
    })(ExecutableCodeLanguage || (ExecutableCodeLanguage = {}));
    (function(Outcome2) {
      Outcome2["OUTCOME_UNSPECIFIED"] = "outcome_unspecified";
      Outcome2["OUTCOME_OK"] = "outcome_ok";
      Outcome2["OUTCOME_FAILED"] = "outcome_failed";
      Outcome2["OUTCOME_DEADLINE_EXCEEDED"] = "outcome_deadline_exceeded";
    })(Outcome || (Outcome = {}));
    POSSIBLE_ROLES = ["user", "model", "function", "system"];
    (function(HarmCategory2) {
      HarmCategory2["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
      HarmCategory2["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
      HarmCategory2["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
      HarmCategory2["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
      HarmCategory2["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
      HarmCategory2["HARM_CATEGORY_CIVIC_INTEGRITY"] = "HARM_CATEGORY_CIVIC_INTEGRITY";
    })(HarmCategory || (HarmCategory = {}));
    (function(HarmBlockThreshold2) {
      HarmBlockThreshold2["HARM_BLOCK_THRESHOLD_UNSPECIFIED"] = "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
      HarmBlockThreshold2["BLOCK_LOW_AND_ABOVE"] = "BLOCK_LOW_AND_ABOVE";
      HarmBlockThreshold2["BLOCK_MEDIUM_AND_ABOVE"] = "BLOCK_MEDIUM_AND_ABOVE";
      HarmBlockThreshold2["BLOCK_ONLY_HIGH"] = "BLOCK_ONLY_HIGH";
      HarmBlockThreshold2["BLOCK_NONE"] = "BLOCK_NONE";
    })(HarmBlockThreshold || (HarmBlockThreshold = {}));
    (function(HarmProbability2) {
      HarmProbability2["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
      HarmProbability2["NEGLIGIBLE"] = "NEGLIGIBLE";
      HarmProbability2["LOW"] = "LOW";
      HarmProbability2["MEDIUM"] = "MEDIUM";
      HarmProbability2["HIGH"] = "HIGH";
    })(HarmProbability || (HarmProbability = {}));
    (function(BlockReason2) {
      BlockReason2["BLOCKED_REASON_UNSPECIFIED"] = "BLOCKED_REASON_UNSPECIFIED";
      BlockReason2["SAFETY"] = "SAFETY";
      BlockReason2["OTHER"] = "OTHER";
    })(BlockReason || (BlockReason = {}));
    (function(FinishReason2) {
      FinishReason2["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
      FinishReason2["STOP"] = "STOP";
      FinishReason2["MAX_TOKENS"] = "MAX_TOKENS";
      FinishReason2["SAFETY"] = "SAFETY";
      FinishReason2["RECITATION"] = "RECITATION";
      FinishReason2["LANGUAGE"] = "LANGUAGE";
      FinishReason2["BLOCKLIST"] = "BLOCKLIST";
      FinishReason2["PROHIBITED_CONTENT"] = "PROHIBITED_CONTENT";
      FinishReason2["SPII"] = "SPII";
      FinishReason2["MALFORMED_FUNCTION_CALL"] = "MALFORMED_FUNCTION_CALL";
      FinishReason2["OTHER"] = "OTHER";
    })(FinishReason || (FinishReason = {}));
    (function(TaskType2) {
      TaskType2["TASK_TYPE_UNSPECIFIED"] = "TASK_TYPE_UNSPECIFIED";
      TaskType2["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY";
      TaskType2["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT";
      TaskType2["SEMANTIC_SIMILARITY"] = "SEMANTIC_SIMILARITY";
      TaskType2["CLASSIFICATION"] = "CLASSIFICATION";
      TaskType2["CLUSTERING"] = "CLUSTERING";
    })(TaskType || (TaskType = {}));
    (function(FunctionCallingMode2) {
      FunctionCallingMode2["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
      FunctionCallingMode2["AUTO"] = "AUTO";
      FunctionCallingMode2["ANY"] = "ANY";
      FunctionCallingMode2["NONE"] = "NONE";
    })(FunctionCallingMode || (FunctionCallingMode = {}));
    (function(DynamicRetrievalMode2) {
      DynamicRetrievalMode2["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
      DynamicRetrievalMode2["MODE_DYNAMIC"] = "MODE_DYNAMIC";
    })(DynamicRetrievalMode || (DynamicRetrievalMode = {}));
    GoogleGenerativeAIError = class extends Error {
      constructor(message) {
        super(`[GoogleGenerativeAI Error]: ${message}`);
      }
    };
    GoogleGenerativeAIResponseError = class extends GoogleGenerativeAIError {
      constructor(message, response) {
        super(message);
        this.response = response;
      }
    };
    GoogleGenerativeAIFetchError = class extends GoogleGenerativeAIError {
      constructor(message, status, statusText, errorDetails) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.errorDetails = errorDetails;
      }
    };
    GoogleGenerativeAIRequestInputError = class extends GoogleGenerativeAIError {
    };
    GoogleGenerativeAIAbortError = class extends GoogleGenerativeAIError {
    };
    DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
    DEFAULT_API_VERSION = "v1beta";
    PACKAGE_VERSION = "0.24.1";
    PACKAGE_LOG_HEADER = "genai-js";
    (function(Task2) {
      Task2["GENERATE_CONTENT"] = "generateContent";
      Task2["STREAM_GENERATE_CONTENT"] = "streamGenerateContent";
      Task2["COUNT_TOKENS"] = "countTokens";
      Task2["EMBED_CONTENT"] = "embedContent";
      Task2["BATCH_EMBED_CONTENTS"] = "batchEmbedContents";
    })(Task || (Task = {}));
    RequestUrl = class {
      constructor(model, task, apiKey, stream, requestOptions) {
        this.model = model;
        this.task = task;
        this.apiKey = apiKey;
        this.stream = stream;
        this.requestOptions = requestOptions;
      }
      toString() {
        var _a, _b;
        const apiVersion = ((_a = this.requestOptions) === null || _a === void 0 ? void 0 : _a.apiVersion) || DEFAULT_API_VERSION;
        const baseUrl = ((_b = this.requestOptions) === null || _b === void 0 ? void 0 : _b.baseUrl) || DEFAULT_BASE_URL;
        let url = `${baseUrl}/${apiVersion}/${this.model}:${this.task}`;
        if (this.stream) {
          url += "?alt=sse";
        }
        return url;
      }
    };
    badFinishReasons = [
      FinishReason.RECITATION,
      FinishReason.SAFETY,
      FinishReason.LANGUAGE
    ];
    responseLineRE = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
    VALID_PART_FIELDS = [
      "text",
      "inlineData",
      "functionCall",
      "functionResponse",
      "executableCode",
      "codeExecutionResult"
    ];
    VALID_PARTS_PER_ROLE = {
      user: ["text", "inlineData"],
      function: ["functionResponse"],
      model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
      // System instructions shouldn't be in history anyway.
      system: ["text"]
    };
    SILENT_ERROR = "SILENT_ERROR";
    ChatSession = class {
      constructor(apiKey, model, params, _requestOptions = {}) {
        this.model = model;
        this.params = params;
        this._requestOptions = _requestOptions;
        this._history = [];
        this._sendPromise = Promise.resolve();
        this._apiKey = apiKey;
        if (params === null || params === void 0 ? void 0 : params.history) {
          validateChatHistory(params.history);
          this._history = params.history;
        }
      }
      /**
       * Gets the chat history so far. Blocked prompts are not added to history.
       * Blocked candidates are not added to history, nor are the prompts that
       * generated them.
       */
      async getHistory() {
        await this._sendPromise;
        return this._history;
      }
      /**
       * Sends a chat message and receives a non-streaming
       * {@link GenerateContentResult}.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async sendMessage(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
          safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
          generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
          tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
          toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
          systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
          cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
          contents: [...this._history, newContent]
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        let finalResult;
        this._sendPromise = this._sendPromise.then(() => generateContent(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions)).then((result) => {
          var _a2;
          if (isValidResponse(result.response)) {
            this._history.push(newContent);
            const responseContent = Object.assign({
              parts: [],
              // Response seems to come back without a role set.
              role: "model"
            }, (_a2 = result.response.candidates) === null || _a2 === void 0 ? void 0 : _a2[0].content);
            this._history.push(responseContent);
          } else {
            const blockErrorMessage = formatBlockErrorMessage(result.response);
            if (blockErrorMessage) {
              console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
            }
          }
          finalResult = result;
        }).catch((e) => {
          this._sendPromise = Promise.resolve();
          throw e;
        });
        await this._sendPromise;
        return finalResult;
      }
      /**
       * Sends a chat message and receives the response as a
       * {@link GenerateContentStreamResult} containing an iterable stream
       * and a response promise.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async sendMessageStream(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
          safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
          generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
          tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
          toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
          systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
          cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
          contents: [...this._history, newContent]
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions);
        this._sendPromise = this._sendPromise.then(() => streamPromise).catch((_ignored) => {
          throw new Error(SILENT_ERROR);
        }).then((streamResult) => streamResult.response).then((response) => {
          if (isValidResponse(response)) {
            this._history.push(newContent);
            const responseContent = Object.assign({}, response.candidates[0].content);
            if (!responseContent.role) {
              responseContent.role = "model";
            }
            this._history.push(responseContent);
          } else {
            const blockErrorMessage = formatBlockErrorMessage(response);
            if (blockErrorMessage) {
              console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
            }
          }
        }).catch((e) => {
          if (e.message !== SILENT_ERROR) {
            console.error(e);
          }
        });
        return streamPromise;
      }
    };
    GenerativeModel = class {
      constructor(apiKey, modelParams, _requestOptions = {}) {
        this.apiKey = apiKey;
        this._requestOptions = _requestOptions;
        if (modelParams.model.includes("/")) {
          this.model = modelParams.model;
        } else {
          this.model = `models/${modelParams.model}`;
        }
        this.generationConfig = modelParams.generationConfig || {};
        this.safetySettings = modelParams.safetySettings || [];
        this.tools = modelParams.tools;
        this.toolConfig = modelParams.toolConfig;
        this.systemInstruction = formatSystemInstruction(modelParams.systemInstruction);
        this.cachedContent = modelParams.cachedContent;
      }
      /**
       * Makes a single non-streaming call to the model
       * and returns an object containing a single {@link GenerateContentResponse}.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async generateContent(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContent(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
      }
      /**
       * Makes a single streaming call to the model and returns an object
       * containing an iterable stream that iterates over all chunks in the
       * streaming response as well as a promise that returns the final
       * aggregated response.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async generateContentStream(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContentStream(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
      }
      /**
       * Gets a new {@link ChatSession} instance which can be used for
       * multi-turn chats.
       */
      startChat(startChatParams) {
        var _a;
        return new ChatSession(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, startChatParams), this._requestOptions);
      }
      /**
       * Counts the tokens in the provided request.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async countTokens(request, requestOptions = {}) {
        const formattedParams = formatCountTokensInput(request, {
          model: this.model,
          generationConfig: this.generationConfig,
          safetySettings: this.safetySettings,
          tools: this.tools,
          toolConfig: this.toolConfig,
          systemInstruction: this.systemInstruction,
          cachedContent: this.cachedContent
        });
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return countTokens(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
      }
      /**
       * Embeds the provided content.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async embedContent(request, requestOptions = {}) {
        const formattedParams = formatEmbedContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return embedContent(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
      }
      /**
       * Embeds an array of {@link EmbedContentRequest}s.
       *
       * Fields set in the optional {@link SingleRequestOptions} parameter will
       * take precedence over the {@link RequestOptions} values provided to
       * {@link GoogleGenerativeAI.getGenerativeModel }.
       */
      async batchEmbedContents(batchEmbedContentRequest, requestOptions = {}) {
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest, generativeModelRequestOptions);
      }
    };
    GoogleGenerativeAI = class {
      constructor(apiKey) {
        this.apiKey = apiKey;
      }
      /**
       * Gets a {@link GenerativeModel} instance for the provided model name.
       */
      getGenerativeModel(modelParams, requestOptions) {
        if (!modelParams.model) {
          throw new GoogleGenerativeAIError(`Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })`);
        }
        return new GenerativeModel(this.apiKey, modelParams, requestOptions);
      }
      /**
       * Creates a {@link GenerativeModel} instance from provided content cache.
       */
      getGenerativeModelFromCachedContent(cachedContent, modelParams, requestOptions) {
        if (!cachedContent.name) {
          throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `name` field.");
        }
        if (!cachedContent.model) {
          throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `model` field.");
        }
        const disallowedDuplicates = ["model", "systemInstruction"];
        for (const key of disallowedDuplicates) {
          if ((modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) && cachedContent[key] && (modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) !== cachedContent[key]) {
            if (key === "model") {
              const modelParamsComp = modelParams.model.startsWith("models/") ? modelParams.model.replace("models/", "") : modelParams.model;
              const cachedContentComp = cachedContent.model.startsWith("models/") ? cachedContent.model.replace("models/", "") : cachedContent.model;
              if (modelParamsComp === cachedContentComp) {
                continue;
              }
            }
            throw new GoogleGenerativeAIRequestInputError(`Different value for "${key}" specified in modelParams (${modelParams[key]}) and cachedContent (${cachedContent[key]})`);
          }
        }
        const modelParamsFromCache = Object.assign(Object.assign({}, modelParams), { model: cachedContent.model, tools: cachedContent.tools, toolConfig: cachedContent.toolConfig, systemInstruction: cachedContent.systemInstruction, cachedContent });
        return new GenerativeModel(this.apiKey, modelParamsFromCache, requestOptions);
      }
    };
  }
});

// src/core/llm/gemini-provider.ts
var DEFAULT_MODEL, GeminiProvider;
var init_gemini_provider = __esm({
  "src/core/llm/gemini-provider.ts"() {
    "use strict";
    init_dist();
    DEFAULT_MODEL = "gemini-2.0-flash";
    GeminiProvider = class {
      client;
      model;
      /**
       * Creates a new GeminiProvider instance.
       *
       * @param apiKey - Google API key for authentication
       * @param model - Model name to use (default: gemini-2.0-flash)
       * @throws {Error} If API key is not provided
       */
      constructor(apiKey, model = DEFAULT_MODEL) {
        if (!apiKey) {
          throw new Error("GeminiProvider requires an API key");
        }
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = model;
      }
      /**
       * Completes a prompt using the Gemini API.
       *
       * @param prompt - The user prompt to complete
       * @param options - Optional configuration for the completion
       * @returns Promise resolving to the completion result with token usage
       * @throws {Error} If the API call fails
       */
      async complete(prompt, options) {
        try {
          const generationConfig = {};
          if (options?.maxTokens) {
            generationConfig.maxOutputTokens = options.maxTokens;
          }
          const modelParams = { model: this.model };
          if (options?.systemPrompt) {
            modelParams.systemInstruction = options.systemPrompt;
          }
          if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
          }
          const generativeModel = this.client.getGenerativeModel(modelParams);
          const result = await generativeModel.generateContent(prompt);
          return this.parseResult(result);
        } catch (error) {
          throw new Error(
            `Gemini API call failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      /**
       * Parses a Gemini API response into an LLMResult.
       *
       * @param result - The raw API response from Gemini
       * @returns Parsed LLM result with text and token usage
       */
      parseResult(result) {
        const response = result.response;
        const text = response.text() ?? "";
        const usage = this.extractUsage(response);
        return { text, usage };
      }
      /**
       * Extracts token usage information from a Gemini API response.
       *
       * Note: Gemini API may not return cache-related token usage fields.
       * These fields will be undefined in the returned TokenUsage object.
       *
       * @param response - The response object from Gemini
       * @returns Token usage information
       */
      extractUsage(response) {
        const usageMetadata = response.usageMetadata;
        return {
          input_tokens: usageMetadata?.promptTokenCount ?? 0,
          output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
          // Gemini doesn't provide cache-related token usage
          cache_read_input_tokens: void 0,
          cache_creation_input_tokens: void 0
        };
      }
    };
  }
});

// src/core/llm/round-robin-provider.ts
var RoundRobinProvider;
var init_round_robin_provider = __esm({
  "src/core/llm/round-robin-provider.ts"() {
    "use strict";
    RoundRobinProvider = class {
      /**
       * Creates a new RoundRobinProvider instance.
       *
       * @param providers - Array of LLM providers to distribute requests across
       */
      constructor(providers) {
        this.providers = providers;
      }
      index = 0;
      /**
       * Completes a prompt using the next provider in the round-robin cycle.
       *
       * Providers are selected using modulo arithmetic: `index % providers.length`
       * The index increments after each call, ensuring even distribution.
       *
       * @param prompt - The user prompt to complete
       * @param options - Optional configuration for the completion
       * @returns Promise resolving to the completion result with token usage
       * @throws {Error} If no providers are configured
       * @throws {Error} If the selected provider fails (no retry/failover)
       */
      async complete(prompt, options) {
        if (this.providers.length === 0) {
          throw new Error("No providers configured");
        }
        const provider = this.providers[this.index % this.providers.length];
        this.index++;
        return provider.complete(prompt, options);
      }
    };
  }
});

// src/core/llm/config.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
function loadConfig() {
  const configDir = join(process.env.HOME ?? "", ".config", "conversation-memory");
  const configPath = join(configDir, "config.json");
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);
    if (!config.provider) {
      console.warn("Invalid config: missing provider field");
      return null;
    }
    return config;
  } catch (error) {
    console.warn(
      `Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
function createProvider(config) {
  switch (config.provider) {
    case "gemini": {
      const geminiConfig = config.gemini;
      if (!geminiConfig) {
        throw new Error("Gemini provider requires gemini configuration");
      }
      const { apiKeys, model = DEFAULT_MODEL2 } = geminiConfig;
      if (apiKeys.length === 0) {
        throw new Error("Gemini provider requires at least one API key");
      }
      const providers = apiKeys.map((apiKey) => new GeminiProvider(apiKey, model));
      return new RoundRobinProvider(providers);
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
var DEFAULT_MODEL2;
var init_config = __esm({
  "src/core/llm/config.ts"() {
    "use strict";
    init_gemini_provider();
    init_round_robin_provider();
    DEFAULT_MODEL2 = "gemini-2.0-flash";
  }
});

// src/core/summarizer.ts
var summarizer_exports = {};
__export(summarizer_exports, {
  formatConversationText: () => formatConversationText,
  getCurrentRunTokenUsage: () => getCurrentRunTokenUsage,
  startTokenTracking: () => startTokenTracking,
  summarizeConversation: () => summarizeConversation,
  trackTokenUsage: () => trackTokenUsage
});
function startTokenTracking() {
  currentRunTokenUsages = [];
}
function getCurrentRunTokenUsage() {
  return sumTokenUsage(currentRunTokenUsages);
}
function trackTokenUsage(usage) {
  currentRunTokenUsages.push(usage);
}
function formatConversationText(exchanges) {
  return exchanges.map((ex) => {
    return `User: ${ex.userMessage}

Agent: ${ex.assistantMessage}`;
  }).join("\n\n---\n\n");
}
function extractSummary(text) {
  const match = text.match(/<summary>(.*?)<\/summary>/s);
  if (match) {
    return match[1].trim();
  }
  return text.trim();
}
function extractSummaryFromResult(result) {
  return extractSummary(result.summary);
}
function sumTokenUsage(usages) {
  return usages.reduce((acc, usage) => ({
    input_tokens: acc.input_tokens + (usage.input_tokens || 0),
    output_tokens: acc.output_tokens + (usage.output_tokens || 0),
    cache_read_input_tokens: (acc.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
  }), { input_tokens: 0, output_tokens: 0 });
}
function formatTokenUsage(usage) {
  const parts = [];
  parts.push(`in: ${usage.input_tokens.toLocaleString()}`);
  parts.push(`out: ${usage.output_tokens.toLocaleString()}`);
  if (usage.cache_read_input_tokens) {
    parts.push(`cache read: ${usage.cache_read_input_tokens.toLocaleString()}`);
  }
  if (usage.cache_creation_input_tokens) {
    parts.push(`cache create: ${usage.cache_creation_input_tokens.toLocaleString()}`);
  }
  return parts.join(" | ");
}
async function callLLM(prompt, sessionId) {
  const config = loadConfig();
  if (!config) {
    logWarn("No config.json found, skipping summarization");
    console.log("[CONVERSATION_MEMORY] No config found at ~/.config/conversation-memory/config.json");
    return {
      summary: "",
      tokens: { input_tokens: 0, output_tokens: 0 }
    };
  }
  const provider = createProvider(config);
  logInfo("LLM call started", { provider: config.provider, sessionId });
  console.log(`[CONVERSATION_MEMORY] Using provider: ${config.provider}`);
  try {
    const result = await provider.complete(prompt, {
      maxTokens: 4096,
      systemPrompt: 'Write concise, factual summaries. Output ONLY the summary - no preamble, no "Here is", no "I will". Your output will be indexed directly.'
    });
    trackTokenUsage(result.usage);
    logInfo("LLM call completed", {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      cacheReadTokens: result.usage.cache_read_input_tokens,
      cacheCreationTokens: result.usage.cache_creation_input_tokens
    });
    return {
      summary: result.text,
      tokens: result.usage
    };
  } catch (error) {
    logError("LLM call failed", error);
    console.log(`[CONVERSATION_MEMORY] API call failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      summary: "",
      tokens: { input_tokens: 0, output_tokens: 0 }
    };
  }
}
function chunkExchanges(exchanges, chunkSize) {
  const chunks = [];
  for (let i = 0; i < exchanges.length; i += chunkSize) {
    chunks.push(exchanges.slice(i, i + chunkSize));
  }
  return chunks;
}
function isTrivialConversation(exchanges) {
  if (exchanges.length === 0) {
    return true;
  }
  if (exchanges.length === 1) {
    const userMsg = exchanges[0].userMessage.trim();
    const assistantMsg = exchanges[0].assistantMessage.trim();
    if (userMsg === "/exit") {
      return true;
    }
    const wordCount = (userMsg + " " + assistantMsg).split(/[\s\u3000-\u303F\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]+/).filter((word) => word.length > 0).length;
    if (wordCount < 15) {
      return true;
    }
  }
  return false;
}
async function summarizeConversation(exchanges, sessionId, filename) {
  if (isTrivialConversation(exchanges)) {
    logInfo("Skipped trivial conversation", { filename, sessionId });
    return "Trivial conversation with no substantive content.";
  }
  logInfo("Summarization started", { exchangeCount: exchanges.length, filename, sessionId });
  const allTokenUsages = [];
  if (exchanges.length <= 15) {
    const conversationText = formatConversationText(exchanges);
    const prompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise, factual summary of this conversation. Output ONLY the summary - no preamble. Claude will see this summary when searching previous conversations for useful memories and information.

Summarize what happened in 2-4 sentences. Be factual and specific. Output in <summary></summary> tags.

Include:
- What was built/changed/discussed (be specific)
- Key technical decisions or approaches
- Problems solved or current state

Exclude:
- Apologies, meta-commentary, or your questions
- Raw logs or debug output
- Generic descriptions - focus on what makes THIS conversation unique

Good:
<summary>Built JWT authentication for React app with refresh tokens and protected routes. Fixed token expiration bug by implementing refresh-during-request logic.</summary>

Bad:
<summary>I apologize. The conversation discussed authentication and various approaches were considered...</summary>

${conversationText}`;
    const result = await callLLM(prompt, sessionId);
    if (result.summary === "") {
      logWarn("Summarization skipped due to missing config", { filename });
      return "[Not summarized - no LLM config found]";
    }
    allTokenUsages.push(result.tokens);
    const summary = extractSummaryFromResult(result);
    const wordCount = summary.split(/\s+/).length;
    console.log(`  Tokens: ${formatTokenUsage(result.tokens)}`);
    logInfo("Summarization completed (direct)", {
      filename,
      wordCount,
      inputTokens: result.tokens.input_tokens,
      outputTokens: result.tokens.output_tokens
    });
    return summary;
  }
  console.log(`  Long conversation (${exchanges.length} exchanges) - using hierarchical summarization`);
  const chunks = chunkExchanges(exchanges, 32);
  console.log(`  Split into ${chunks.length} chunks`);
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = formatConversationText(chunks[i]);
    const prompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise summary of this part of a conversation in 2-3 sentences. What happened, what was built/discussed. Use <summary></summary> tags.

${chunkText}

Example: <summary>Implemented HID keyboard functionality for ESP32. Hit Bluetooth controller initialization error, fixed by adjusting memory allocation.</summary>`;
    try {
      const result = await callLLM(prompt);
      if (result.summary === "") {
        console.log(`  Chunk ${i + 1} skipped (no LLM config or API failed)`);
        continue;
      }
      allTokenUsages.push(result.tokens);
      const extracted = extractSummaryFromResult(result);
      chunkSummaries.push(extracted);
      const wordCount = extracted.split(/\s+/).length;
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${wordCount} words (${formatTokenUsage(result.tokens)})`);
    } catch (error) {
      console.log(`  Chunk ${i + 1} failed, skipping`);
      logError(`Chunk ${i + 1}/${chunks.length} failed`, error, { filename });
    }
  }
  if (chunkSummaries.length === 0) {
    logWarn("All chunks failed to summarize", { filename, chunkCount: chunks.length });
    return "[Not summarized - LLM config missing or all API calls failed]";
  }
  const synthesisPrompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise, factual summary that synthesizes these part-summaries into one cohesive paragraph. Focus on what was accomplished and any notable technical decisions or challenges. Output in <summary></summary> tags. Claude will see this summary when searching previous conversations for useful memories and information.

Part summaries:
${chunkSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Good:
<summary>Built conversation search system with JavaScript, sqlite-vec, and local embeddings. Implemented hierarchical summarization for long conversations. System archives conversations permanently and provides semantic search via CLI.</summary>

Bad:
<summary>This conversation synthesizes several topics discussed across multiple parts...</summary>

Your summary (max 200 words):`;
  console.log(`  Synthesizing final summary...`);
  try {
    const result = await callLLM(synthesisPrompt);
    if (result.summary === "") {
      console.log(`  Synthesis failed, using chunk summaries directly`);
      logWarn("Synthesis failed, using chunk summaries as fallback", { filename });
      return chunkSummaries.join(" ");
    }
    allTokenUsages.push(result.tokens);
    const totalUsage = sumTokenUsage(allTokenUsages);
    console.log(`  Total tokens: ${formatTokenUsage(totalUsage)}`);
    const summary = extractSummaryFromResult(result);
    const wordCount = summary.split(/\s+/).length;
    logInfo("Summarization completed (hierarchical)", {
      filename,
      exchangeCount: exchanges.length,
      chunkCount: chunks.length,
      wordCount,
      totalInputTokens: totalUsage.input_tokens,
      totalOutputTokens: totalUsage.output_tokens
    });
    return summary;
  } catch (error) {
    console.log(`  Synthesis failed, using chunk summaries`);
    logError("Synthesis failed, using chunk summaries as fallback", error, { filename });
    return chunkSummaries.join(" ");
  }
}
var currentRunTokenUsages;
var init_summarizer = __esm({
  "src/core/summarizer.ts"() {
    "use strict";
    init_constants();
    init_logger();
    init_config();
    currentRunTokenUsages = [];
  }
});

// src/core/inject.ts
function getObservationsForInjection(db, options = {}) {
  const { days = 7, limit = 30 } = options;
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1e3;
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, timestamp, type, title, subtitle,
           facts, concepts, files_read as filesRead, files_modified as filesModified
    FROM observations
    WHERE timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  const rows = stmt.all(cutoffTime, limit);
  const observationsByDate = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const date = new Date(row.timestamp).toLocaleDateString("en-CA", {
      // YYYY-MM-DD format
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).replace(/\//g, "-");
    const time = new Date(row.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    if (!observationsByDate.has(date)) {
      observationsByDate.set(date, []);
    }
    observationsByDate.get(date).push({
      id: row.id,
      sessionId: row.sessionId,
      project: row.project,
      timestamp: row.timestamp,
      type: row.type,
      title: row.title,
      subtitle: row.subtitle,
      facts: JSON.parse(row.facts),
      concepts: JSON.parse(row.concepts),
      filesRead: JSON.parse(row.filesRead),
      filesModified: JSON.parse(row.filesModified),
      time
    });
  }
  return Array.from(observationsByDate.entries()).map(([date, observations]) => ({ date, observations })).sort((a, b) => b.date.localeCompare(a.date));
}
function formatInjectContext(grouped, projectName) {
  if (grouped.length === 0) {
    return `# [${projectName}] recent context (conversation-memory)

No recent observations found. Use \`search()\` to find past work.
`;
  }
  const totalObs = grouped.reduce((sum, g) => sum + g.observations.length, 0);
  const estimatedTokens = totalObs * 30;
  let output = `# [${projectName}] recent context (conversation-memory)

**Tools**: \`search(query)\` find past work | \`get_observations(ids)\` details | \`read(path)\` full conversation
**Stats**: ${totalObs} observations | ~${estimatedTokens}t index | ~${Math.round(estimatedTokens * 15)}t of past work
`;
  for (const group of grouped) {
    output += `
### ${group.date}

`;
    output += `| # | Time | Type | Title | Files |
`;
    output += `|---|------|------|-------|-------|
`;
    for (let i = 0; i < group.observations.length; i++) {
      const obs = group.observations[i];
      const files = obs.filesModified.join(", ") || "-";
      output += `| ${i + 1} | ${obs.time} | ${obs.type} | ${obs.title} | ${files} |
`;
    }
  }
  const exampleIds = grouped[0]?.observations.slice(0, 2).map((o) => o.id).join('", "') || "";
  if (exampleIds) {
    output += `
---
Access full details: \`get_observations(["${exampleIds}"])\`
`;
  }
  return output;
}
function getInjectContext(projectName, options) {
  const db = initDatabase();
  try {
    const grouped = getObservationsForInjection(db, options);
    return formatInjectContext(grouped, projectName);
  } finally {
    db.close();
  }
}
var init_inject = __esm({
  "src/core/inject.ts"() {
    "use strict";
    init_db();
  }
});

// src/core/observations.ts
async function createObservation(db, observation) {
  const embeddingText = `${observation.title}
${observation.subtitle}
${observation.narrative}`;
  const embedding = await generateEmbedding(embeddingText);
  insertObservation(db, observation, embedding);
}
function getObservationsBySession(db, sessionId) {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, prompt_number as promptNumber,
           timestamp, type, title, subtitle, narrative, facts, concepts,
           files_read as filesRead, files_modified as filesModified,
           tool_name as toolName, correlation_id as correlationId, created_at as createdAt
    FROM observations
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);
  const rows = stmt.all(sessionId);
  return rows.map((row) => ({
    ...row,
    facts: JSON.parse(row.facts),
    concepts: JSON.parse(row.concepts),
    filesRead: JSON.parse(row.filesRead),
    filesModified: JSON.parse(row.filesModified)
  }));
}
var init_observations = __esm({
  "src/core/observations.ts"() {
    "use strict";
    init_db();
    init_embeddings();
  }
});

// src/core/observation-prompt.ts
function buildInitPrompt() {
  return `You are an Observer AI that watches Claude Code sessions and extracts structured observations.

Your role:
1. Watch tool executions and identify meaningful observations
2. Extract facts, concepts, and technical insights
3. Track files read and modified
4. Generate session summaries when requested

Observation types:
- "decision": Architectural or technical decisions made
- "learning": New information learned or discovered
- "bugfix": Bugs identified or fixed
- "refactor": Code restructuring or improvements
- "feature": New features implemented
- "debug": Debugging activities and findings
- "test": Testing activities and results
- "config": Configuration changes or setup

Observation format:
When a tool event occurs, respond with XML in one of these formats:

1. For meaningful observations:
<observation>
  <type>decision|learning|bugfix|refactor|feature|debug|test|config</type>
  <title>Brief descriptive title</title>
  <subtitle>Additional context or detail (optional)</subtitle>
  <narrative>Detailed explanation of what happened</narrative>
  <facts><item>Concrete fact 1</item><item>Concrete fact 2</item></facts>
  <concepts><item>Technical concept 1</item><item>Technical concept 2</item></concepts>
  <files_read><item>path/to/file1</item><item>path/to/file2</item></files_read>
  <files_modified><item>path/to/file1</item></files_modified>
  <correlation_id>optional-id-to-correlate-related-observations</correlation_id>
</observation>

2. For unimportant events (respond with <skip> or empty response):
<skip><reason>Low value - reason here</reason></skip>

WHEN TO SKIP (respond with <skip> or empty response):
- Empty status checks or trivial git operations
- Simple file listings with no notable findings
- Repetitive operations already covered
- Package installations with no errors
- Tool calls that produced empty or trivially short output
- Read operations on well-known config files unless they reveal something unexpected

Always respond with valid XML only. No markdown, no explanations outside XML tags.`;
}
function buildObservationPrompt(toolName, toolInput, toolResponse, cwd, project) {
  return `<tool_event>
  <tool_name>${toolName}</tool_name>
  <cwd>${cwd}</cwd>
  <project>${project}</project>
  <tool_input>${JSON.stringify(toolInput, null, 2)}</tool_input>
  <tool_response>${escapeXml(toolResponse)}</tool_response>
</tool_event>`;
}
function buildSummaryPrompt(sessionContext, project) {
  return `<session_context>
${sessionContext}
</session_context>

<project>${project}</project>

Generate a comprehensive session summary with:
- request: What the user was trying to accomplish
- investigated: Topics or issues investigated
- learned: New knowledge or insights gained
- completed: Tasks or features completed
- next_steps: Outstanding work or follow-ups needed
- notes: Additional observations or context

Respond with valid <session_summary> XML only.`;
}
function parseObservationResponse(response) {
  const observationMatch = response.match(/<observation>([\s\S]*?)<\/observation>/);
  if (observationMatch) {
    try {
      const parsed = parseObservationXML(observationMatch[1]);
      return { type: "observation", data: parsed };
    } catch (error) {
      console.warn("Failed to parse observation XML:", error);
    }
  }
  const skipMatch = response.match(/<skip>([\s\S]*?)<\/skip>/);
  if (skipMatch) {
    const reasonMatch = skipMatch[1].match(/<reason>(.*?)<\/reason>/);
    return {
      type: "skip",
      reason: reasonMatch ? reasonMatch[1].trim() : "Unspecified reason"
    };
  }
  return { type: "skip", reason: "Failed to parse response" };
}
function parseSummaryResponse(response, sessionId, project) {
  const match = response.match(/<session_summary>([\s\S]*?)<\/session_summary>/);
  if (!match) {
    return null;
  }
  try {
    return parseSessionSummaryXML(match[1], sessionId, project);
  } catch (error) {
    console.warn("Failed to parse session summary XML:", error);
    return null;
  }
}
function parseObservationXML(xml) {
  const type = extractXmlTag(xml, "type") || "general";
  const title = extractXmlTag(xml, "title") || "Untitled";
  const subtitle = extractXmlTag(xml, "subtitle") || "";
  const narrative = extractXmlTag(xml, "narrative") || "";
  const facts = parseXmlArray(extractXmlTag(xml, "facts") || "");
  const concepts = parseXmlArray(extractXmlTag(xml, "concepts") || "");
  const filesRead = parseXmlArray(extractXmlTag(xml, "files_read") || "");
  const filesModified = parseXmlArray(extractXmlTag(xml, "files_modified") || "");
  const correlationId = extractXmlTag(xml, "correlation_id") || void 0;
  return {
    id: generateId(),
    sessionId: "",
    // Will be set by caller
    project: "",
    // Will be set by caller
    promptNumber: 0,
    // Will be set by caller
    timestamp: Date.now(),
    type,
    title,
    subtitle,
    narrative,
    facts,
    concepts,
    filesRead,
    filesModified,
    toolName: void 0,
    correlationId,
    createdAt: Date.now()
  };
}
function parseSessionSummaryXML(xml, sessionId, project) {
  const request = extractXmlTag(xml, "request") || "";
  const investigated = parseXmlArray(extractXmlTag(xml, "investigated") || "");
  const learned = parseXmlArray(extractXmlTag(xml, "learned") || "");
  const completed = parseXmlArray(extractXmlTag(xml, "completed") || "");
  const nextSteps = parseXmlArray(extractXmlTag(xml, "next_steps") || "");
  const notes = extractXmlTag(xml, "notes") || "";
  return {
    id: generateId(),
    sessionId,
    project,
    request,
    investigated,
    learned,
    completed,
    nextSteps,
    notes,
    createdAt: Date.now()
  };
}
function extractXmlTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}
function parseXmlArray(xml) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1].trim());
  }
  return items;
}
function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
function isLowValueTool(toolName) {
  return skipTools.has(toolName);
}
function configureSkipTools(tools) {
  skipTools = new Set(tools);
}
var DEFAULT_SKIP_TOOLS, skipTools;
var init_observation_prompt = __esm({
  "src/core/observation-prompt.ts"() {
    "use strict";
    DEFAULT_SKIP_TOOLS = [
      "TodoWrite",
      "TodoRead",
      "TaskCreate",
      "TaskUpdate",
      "TaskList",
      "TaskGet",
      "Glob",
      "LSP"
    ];
    skipTools = new Set(DEFAULT_SKIP_TOOLS);
  }
});

// src/core/session-summary.ts
function saveSessionSummary(db, summary) {
  insertSessionSummary(db, summary);
}
function processSessionSummary(db, llmResponse, sessionId, project) {
  const summary = parseSummaryResponse(llmResponse, sessionId, project);
  if (summary) {
    saveSessionSummary(db, summary);
  }
  return summary;
}
var init_session_summary = __esm({
  "src/core/session-summary.ts"() {
    "use strict";
    init_db();
    init_observation_prompt();
  }
});

// src/core/observer.ts
var observer_exports = {};
__export(observer_exports, {
  generateProjectName: () => generateProjectName,
  generateSessionId: () => generateSessionId,
  getCurrentProject: () => getCurrentProject,
  getCurrentSessionId: () => getCurrentSessionId,
  observerStatus: () => observerStatus,
  startObserver: () => startObserver,
  stopObserver: () => stopObserver
});
import fs8 from "fs";
import path6 from "path";
import crypto2 from "crypto";
function generateSessionId(cwd) {
  return crypto2.createHash("sha256").update(cwd).digest("hex").substring(0, 16);
}
function generateProjectName(cwd) {
  return path6.basename(cwd);
}
function getCurrentSessionId() {
  const envSessionId = process.env.CLAUDE_SESSION_ID;
  if (envSessionId) {
    return envSessionId;
  }
  const cwd = process.cwd();
  return generateSessionId(cwd);
}
function getCurrentProject() {
  const cwd = process.cwd();
  return generateProjectName(cwd);
}
async function startObserver() {
  const pidPath = getObserverPidPath();
  if (fs8.existsSync(pidPath)) {
    const existingPid = parseInt(fs8.readFileSync(pidPath, "utf-8"), 10);
    try {
      process.kill(existingPid, 0);
      console.error(`Observer already running with PID ${existingPid}`);
      process.exit(1);
    } catch (error) {
      fs8.unlinkSync(pidPath);
    }
  }
  fs8.writeFileSync(pidPath, process.pid.toString());
  const db = initDatabase();
  const config = loadConfig();
  if (!config) {
    console.error("No LLM config found. Please create ~/.config/conversation-memory/config.json");
    process.exit(1);
  }
  if (config.skipTools) {
    configureSkipTools(config.skipTools);
    console.log(`Configured skipTools: ${config.skipTools.join(", ")}`);
  }
  const llmProvider = createProvider(config);
  const sessionId = getCurrentSessionId();
  const project = getCurrentProject();
  console.log(`Observer started for session ${sessionId} (${project})`);
  const sessionContexts = /* @__PURE__ */ new Map();
  sessionContexts.set(sessionId, {
    sessionId,
    lastActivity: Date.now(),
    promptCount: getLastPromptNumber(db, sessionId)
  });
  const pollInterval = setInterval(async () => {
    try {
      const shouldShutdown = await pollPendingEvents(db, llmProvider, sessionContexts, pollInterval, pidPath);
      if (shouldShutdown) {
        console.log("Shutting down observer after session summary");
      }
    } catch (error) {
      console.error("Error polling events:", error);
    }
  }, POLL_INTERVAL_MS);
  process.on("SIGINT", () => shutdownObserver(pollInterval, pidPath, db));
  process.on("SIGTERM", () => shutdownObserver(pollInterval, pidPath, db));
  process.stdin.resume();
}
async function pollPendingEvents(db, llmProvider, sessionContexts, pollInterval, pidPath) {
  const now = Date.now();
  for (const [sessionId, context] of sessionContexts.entries()) {
    if (now - context.lastActivity > IDLE_TIMEOUT_MS) {
      console.log(`Session ${sessionId} idle timeout, removing context`);
      sessionContexts.delete(sessionId);
    }
  }
  for (const [sessionId, context] of sessionContexts.entries()) {
    const events = getPendingEvents(db, sessionId, 10);
    if (events.length === 0) {
      continue;
    }
    context.lastActivity = now;
    for (const event of events) {
      try {
        const shouldShutdown = await processEvent(db, llmProvider, event, context, pollInterval, pidPath);
        markEventProcessed(db, event.id);
        if (shouldShutdown) {
          return true;
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
      }
    }
  }
  return false;
}
async function processEvent(db, llmProvider, event, context, pollInterval, pidPath) {
  if (event.eventType === "tool_use" && event.toolName && isLowValueTool(event.toolName)) {
    return false;
  }
  const promptNumber = context.promptCount + 1;
  if (event.eventType === "tool_use") {
    await processToolUseEvent(db, llmProvider, event, context, promptNumber);
    context.promptCount = promptNumber;
    return false;
  } else if (event.eventType === "summarize") {
    await processSummarizeEvent(db, llmProvider, event, context, pollInterval, pidPath);
    return true;
  }
  context.promptCount = promptNumber;
  return false;
}
async function processToolUseEvent(db, llmProvider, event, context, promptNumber) {
  const systemPrompt = buildInitPrompt();
  const prompt = buildObservationPrompt(
    event.toolName,
    event.toolInput,
    event.toolResponse || "",
    event.cwd || process.cwd(),
    event.project || ""
  );
  const response = await llmProvider.complete(prompt, { systemPrompt });
  const result = parseObservationResponse(response.text);
  if (result.type === "observation" && result.data) {
    const observation = {
      ...result.data,
      sessionId: context.sessionId,
      project: event.project || "",
      promptNumber,
      toolName: event.toolName
    };
    createObservation(db, observation);
    console.log(`Created observation: ${observation.title}`);
  }
}
async function processSummarizeEvent(db, llmProvider, event, context, pollInterval, pidPath) {
  const systemPrompt = buildInitPrompt();
  const previousObservations = getObservationsBySession(db, context.sessionId);
  const sessionContext = previousObservations.map((obs) => `- [${obs.type}] ${obs.title}: ${obs.narrative}`).join("\n");
  const prompt = buildSummaryPrompt(sessionContext, event.project || "");
  const response = await llmProvider.complete(prompt, { systemPrompt });
  const summary = processSessionSummary(
    db,
    response.text,
    context.sessionId,
    event.project || ""
  );
  if (summary) {
    console.log(`Created session summary for ${context.sessionId}`);
  }
  shutdownObserver(pollInterval, pidPath, db);
}
function shutdownObserver(pollInterval, pidPath, db) {
  clearInterval(pollInterval);
  db.close();
  if (fs8.existsSync(pidPath)) {
    fs8.unlinkSync(pidPath);
  }
  console.log("Observer stopped");
  process.exit(0);
}
function stopObserver() {
  const pidPath = getObserverPidPath();
  if (!fs8.existsSync(pidPath)) {
    console.error("Observer is not running");
    process.exit(1);
  }
  const pid = parseInt(fs8.readFileSync(pidPath, "utf-8"), 10);
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to observer process (PID ${pid})`);
  } catch (error) {
    console.error(`Failed to stop observer: ${error}`);
    process.exit(1);
  }
}
function observerStatus() {
  const pidPath = getObserverPidPath();
  if (!fs8.existsSync(pidPath)) {
    console.log("Observer is not running");
    process.exit(0);
  }
  const pid = parseInt(fs8.readFileSync(pidPath, "utf-8"), 10);
  try {
    process.kill(pid, 0);
    console.log(`Observer is running (PID ${pid})`);
    process.exit(0);
  } catch (error) {
    console.log("Observer PID file exists but process is not running");
    process.exit(1);
  }
}
var POLL_INTERVAL_MS, IDLE_TIMEOUT_MS;
var init_observer = __esm({
  "src/core/observer.ts"() {
    "use strict";
    init_db();
    init_paths();
    init_observations();
    init_session_summary();
    init_observation_prompt();
    init_config();
    POLL_INTERVAL_MS = 1e3;
    IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
  }
});

// src/cli/inject-cli.ts
var inject_cli_exports = {};
async function main() {
  try {
    const project = getCurrentProject();
    const context = getInjectContext(project);
    console.log(context);
  } catch (error) {
    console.error("[conversation-memory] Inject error:", error);
    process.exit(0);
  }
}
var init_inject_cli = __esm({
  "src/cli/inject-cli.ts"() {
    "use strict";
    init_inject();
    init_observer();
    main();
  }
});

// src/cli/observer-cli.ts
var observer_cli_exports = {};
import { spawn } from "child_process";
import path7 from "path";
async function startObserver2() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
  const cliPath = path7.join(pluginRoot, "dist", "cli.mjs");
  const observer = spawn("node", [cliPath, "observer-run"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot
    }
  });
  observer.unref();
  console.log("Observer process started");
}
async function stopObserver2() {
  const { stopObserver: stop } = await Promise.resolve().then(() => (init_observer(), observer_exports));
  stop();
}
async function checkStatus() {
  const { observerStatus: observerStatus2 } = await Promise.resolve().then(() => (init_observer(), observer_exports));
  observerStatus2();
}
async function main2() {
  try {
    switch (command) {
      case "start":
        await startObserver2();
        break;
      case "stop":
        await stopObserver2();
        break;
      case "status":
        await checkStatus();
        break;
      case "observer-run":
        const { startObserver: run } = await Promise.resolve().then(() => (init_observer(), observer_exports));
        await run();
        break;
      default:
        console.error(`
Observer CLI - Control the observer background process

Usage:
  observer <command>

Commands:
  start    Start the observer process in the background
  stop     Stop the observer process
  status   Check if the observer is running

Examples:
  conversation-memory observer start
  conversation-memory observer status
  conversation-memory observer stop
`);
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
var subcommandIndex, command;
var init_observer_cli = __esm({
  "src/cli/observer-cli.ts"() {
    "use strict";
    subcommandIndex = process.argv[2] === "observer" || process.argv[2] === "observer-run" ? 3 : 2;
    command = process.argv[subcommandIndex] || "status";
    main2();
  }
});

// src/core/verify.ts
init_parser();
init_db();
init_paths();
import fs5 from "fs";
import path3 from "path";
async function verifyIndex() {
  const result = {
    missing: [],
    orphaned: [],
    outdated: [],
    corrupted: []
  };
  const archiveDir = getArchiveDir();
  const foundFiles = /* @__PURE__ */ new Set();
  if (!fs5.existsSync(archiveDir)) {
    return result;
  }
  const db = initDatabase();
  const projects = fs5.readdirSync(archiveDir);
  const excludedProjects = getExcludedProjects();
  let totalChecked = 0;
  for (const project of projects) {
    if (excludedProjects.includes(project)) {
      console.log("\nSkipping excluded project: " + project);
      continue;
    }
    const projectPath = path3.join(archiveDir, project);
    const stat = fs5.statSync(projectPath);
    if (!stat.isDirectory()) continue;
    const files = fs5.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      totalChecked++;
      if (totalChecked % 100 === 0) {
        console.log(`  Checked ${totalChecked} conversations...`);
      }
      const conversationPath = path3.join(projectPath, file);
      foundFiles.add(conversationPath);
      const summaryPath = conversationPath.replace(".jsonl", "-summary.txt");
      if (!fs5.existsSync(summaryPath)) {
        result.missing.push({ path: conversationPath, reason: "No summary file" });
        continue;
      }
      const lastIndexed = getFileLastIndexed(db, conversationPath);
      if (lastIndexed !== null) {
        const fileStat = fs5.statSync(conversationPath);
        if (fileStat.mtimeMs > lastIndexed) {
          result.outdated.push({
            path: conversationPath,
            fileTime: fileStat.mtimeMs,
            dbTime: lastIndexed
          });
        }
      }
      try {
        const parseResult = await parseConversationWithResult(conversationPath, project, conversationPath);
        if (parseResult.isExcluded) {
          continue;
        }
      } catch (error) {
        result.corrupted.push({
          path: conversationPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  console.log(`Verified ${totalChecked} conversations.`);
  const dbExchanges = getAllExchanges(db);
  db.close();
  for (const exchange of dbExchanges) {
    if (!foundFiles.has(exchange.archivePath)) {
      result.orphaned.push({
        uuid: exchange.id,
        path: exchange.archivePath
      });
    }
  }
  return result;
}
async function repairIndex(issues) {
  console.log("Repairing index...");
  const { initDatabase: initDatabase2, insertExchange: insertExchange2, deleteExchange: deleteExchange2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const { parseConversationWithResult: parseConversationWithResult2 } = await Promise.resolve().then(() => (init_parser(), parser_exports));
  const { initEmbeddings: initEmbeddings2, generateExchangeEmbedding: generateExchangeEmbedding2 } = await Promise.resolve().then(() => (init_embeddings(), embeddings_exports));
  const { summarizeConversation: summarizeConversation2 } = await Promise.resolve().then(() => (init_summarizer(), summarizer_exports));
  const db = initDatabase2();
  await initEmbeddings2();
  for (const orphan of issues.orphaned) {
    console.log(`Removing orphaned entry: ${orphan.uuid}`);
    deleteExchange2(db, orphan.uuid);
  }
  const toReindex = [
    ...issues.missing.map((m) => m.path),
    ...issues.outdated.map((o) => o.path)
  ];
  for (const conversationPath of toReindex) {
    console.log(`Re-indexing: ${conversationPath}`);
    try {
      const archiveDir = getArchiveDir();
      const relativePath = conversationPath.replace(archiveDir + path3.sep, "");
      const project = relativePath.split(path3.sep)[0];
      const parseResult = await parseConversationWithResult2(conversationPath, project, conversationPath);
      if (parseResult.isExcluded) {
        console.log(`  Skipped (excluded: ${parseResult.exclusionReason})`);
        continue;
      }
      if (parseResult.exchanges.length === 0) {
        console.log(`  Skipped (no exchanges)`);
        continue;
      }
      const summaryPath = conversationPath.replace(".jsonl", "-summary.txt");
      const summary = await summarizeConversation2(parseResult.exchanges);
      fs5.writeFileSync(summaryPath, summary, "utf-8");
      console.log(`  Created summary: ${summary.split(/\s+/).length} words`);
      for (const exchange of parseResult.exchanges) {
        const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
        const embedding = await generateExchangeEmbedding2(
          exchange.userMessage,
          exchange.assistantMessage,
          toolNames
        );
        insertExchange2(db, exchange, embedding, toolNames);
      }
      console.log(`  Indexed ${parseResult.exchanges.length} exchanges`);
    } catch (error) {
      console.error(`Failed to re-index ${conversationPath}:`, error);
    }
  }
  db.close();
  if (issues.corrupted.length > 0) {
    console.log("\n\u26A0\uFE0F  Corrupted files (manual review needed):");
    issues.corrupted.forEach((c) => console.log(`  ${c.path}: ${c.error}`));
  }
  console.log("\u2705 Repair complete.");
}

// src/core/indexer.ts
init_db();
init_parser();
init_embeddings();
init_summarizer();
init_paths();
init_logger();
import fs6 from "fs";
import path4 from "path";
import os2 from "os";

// src/core/tool-compress.ts
function normalizeToolName(toolName) {
  const lastUnderscoreIndex = toolName.lastIndexOf("__");
  if (lastUnderscoreIndex !== -1 && toolName.startsWith("mcp__plugin")) {
    return toolName.substring(lastUnderscoreIndex + 2);
  }
  return toolName;
}
function extractFirstLine(text, truncateLength = 50) {
  if (!text) return "";
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= truncateLength) {
    return firstLine;
  }
  return firstLine.substring(0, truncateLength - 3) + "...";
}
function truncateCommand(command3, maxLength = 80) {
  if (command3.length <= maxLength) {
    return command3;
  }
  return command3.substring(0, maxLength - 3) + "...";
}
function formatUnknownTool(toolName, toolInput) {
  if (toolInput === null || toolInput === void 0) {
    return toolName;
  }
  if (typeof toolInput === "string") {
    return `${toolName}("${toolInput}")`;
  }
  if (typeof toolInput === "number" || typeof toolInput === "boolean") {
    return `${toolName}(${String(toolInput)})`;
  }
  if (typeof toolInput === "object") {
    const input = toolInput;
    const entries = Object.entries(input).slice(0, 2);
    if (entries.length === 0) {
      return toolName;
    }
    const pairs = entries.map(([k, v]) => `${k}=${v === null ? "null" : String(v)}`);
    return `${toolName}(${pairs.join(", ")})`;
  }
  return toolName;
}
var TOOL_FORMATS = {
  Read: (input) => {
    const file = input?.file_path;
    return file || "";
  },
  Write: (input) => {
    const file = input?.file_path;
    return file || "";
  },
  Edit: (input) => {
    const editInput = input;
    const file = editInput.file_path || "";
    const oldString = editInput.old_string ? extractFirstLine(editInput.old_string, 50) : "";
    if (!file) return "";
    if (oldString) {
      return `${file} (match: "${oldString}")`;
    }
    return file;
  },
  Bash: (input) => {
    const command3 = input?.command || "";
    return `\`${truncateCommand(command3, 80)}\``;
  },
  Grep: (input) => {
    const grepInput = input;
    const pattern = grepInput.pattern || "";
    const path9 = grepInput.path;
    return path9 ? `${pattern} in ${path9}` : pattern;
  },
  Glob: (input) => {
    const globInput = input;
    const pattern = globInput.pattern || "";
    const path9 = globInput.path;
    return path9 ? `${pattern} in ${path9}` : pattern;
  },
  Task: (input) => {
    const description = input?.description || "";
    return description;
  },
  TaskCreate: (input) => {
    const subject = input?.subject || "";
    return subject;
  },
  TaskUpdate: (input) => {
    const updateInput = input;
    const taskId = updateInput.taskId || "";
    const status = updateInput.status;
    return status ? `${taskId} \u2192 ${status}` : taskId;
  },
  LSP: (input) => {
    const lspInput = input;
    const operation = lspInput.operation || "";
    const filePath = lspInput.filePath || "";
    return filePath ? `${operation} on ${filePath}` : operation;
  },
  WebSearch: (input) => {
    const query = input?.query || "";
    return `"${query}"`;
  },
  WebFetch: (input) => {
    const url = input?.url || "";
    return url;
  }
};
function formatToolInput(toolName, toolInput) {
  const normalized = normalizeToolName(toolName);
  const formatFn = TOOL_FORMATS[normalized];
  if (formatFn) {
    return formatFn(toolInput);
  }
  return formatUnknownTool(normalized, toolInput);
}
function formatToolSummary(toolCalls) {
  if (toolCalls.length === 0) {
    return "";
  }
  const groups = /* @__PURE__ */ new Map();
  for (const call of toolCalls) {
    const normalized = normalizeToolName(call.toolName);
    const existing = groups.get(normalized) || [];
    existing.push(call.toolInput);
    groups.set(normalized, existing);
  }
  const seen = /* @__PURE__ */ new Set();
  const parts = [];
  for (const call of toolCalls) {
    const normalized = normalizeToolName(call.toolName);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const inputs = groups.get(normalized) || [];
    const results = inputs.map((input) => formatToolInput(normalized, input));
    const isKnownTool = TOOL_FORMATS.hasOwnProperty(normalized);
    if (isKnownTool) {
      const nonEmptyResults = results.filter((r) => r);
      if (nonEmptyResults.length === 0) {
        parts.push(normalized);
      } else if (nonEmptyResults.length === 1) {
        parts.push(`${normalized}: ${nonEmptyResults[0]}`);
      } else {
        parts.push(`${normalized}: ${nonEmptyResults.join(", ")}`);
      }
    } else {
      const nonEmptyResults = results.filter((r) => r);
      if (nonEmptyResults.length === 0) {
        parts.push(normalized);
      } else if (nonEmptyResults.length === 1) {
        parts.push(nonEmptyResults[0]);
      } else {
        parts.push(nonEmptyResults.join(", "));
      }
    }
  }
  return parts.join(" | ");
}

// src/core/indexer.ts
import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 20;
function getProjectsDir() {
  return process.env.TEST_PROJECTS_DIR || path4.join(os2.homedir(), ".claude", "projects");
}
async function processBatch(items, processor, concurrency2) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency2) {
    const batch = items.slice(i, i + concurrency2);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}
async function indexConversations(limitToProject, maxConversations, concurrency2 = 1, noSummaries2 = false) {
  console.log("Initializing database...");
  const db = initDatabase();
  console.log("Loading embedding model...");
  await initEmbeddings();
  if (noSummaries2) {
    console.log("\u26A0\uFE0F  Running in no-summaries mode (skipping AI summaries)");
  }
  console.log("Scanning for conversation files...");
  const PROJECTS_DIR = getProjectsDir();
  const ARCHIVE_DIR = getArchiveDir();
  const projects = fs6.readdirSync(PROJECTS_DIR);
  let totalExchanges = 0;
  let conversationsProcessed = 0;
  const excludedProjects = getExcludedProjects();
  for (const project of projects) {
    if (excludedProjects.includes(project)) {
      console.log(`
Skipping excluded project: ${project}`);
      continue;
    }
    if (limitToProject && project !== limitToProject) continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    const stat = fs6.statSync(projectPath);
    if (!stat.isDirectory()) continue;
    const files = fs6.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
    if (files.length === 0) continue;
    console.log(`
Processing project: ${project} (${files.length} conversations)`);
    if (concurrency2 > 1) console.log(`  Concurrency: ${concurrency2}`);
    const projectArchive = path4.join(ARCHIVE_DIR, project);
    fs6.mkdirSync(projectArchive, { recursive: true });
    const toProcess = [];
    for (const file of files) {
      const sourcePath = path4.join(projectPath, file);
      const archivePath = path4.join(projectArchive, file);
      if (!fs6.existsSync(archivePath)) {
        fs6.copyFileSync(sourcePath, archivePath);
        console.log(`  Archived: ${file}`);
      }
      const parseResult = await parseConversationWithResult(sourcePath, project, archivePath);
      if (parseResult.isExcluded) {
        console.log(`  Skipped ${file} (excluded: ${parseResult.exclusionReason})`);
        continue;
      }
      if (parseResult.exchanges.length === 0) {
        console.log(`  Skipped ${file} (no exchanges)`);
        continue;
      }
      toProcess.push({
        file,
        sourcePath,
        archivePath,
        summaryPath: archivePath.replace(".jsonl", "-summary.txt"),
        exchanges: parseResult.exchanges
      });
    }
    if (!noSummaries2) {
      const needsSummary = toProcess.filter((c) => !fs6.existsSync(c.summaryPath));
      if (needsSummary.length > 0) {
        console.log(`  Generating ${needsSummary.length} summaries (concurrency: ${concurrency2})...`);
        await processBatch(needsSummary, async (conv) => {
          try {
            const summary = await summarizeConversation(conv.exchanges, void 0, conv.file);
            fs6.writeFileSync(conv.summaryPath, summary, "utf-8");
            const wordCount = summary.split(/\s+/).length;
            console.log(`  \u2713 ${conv.file}: ${wordCount} words`);
            return summary;
          } catch (error) {
            console.log(`  \u2717 ${conv.file}: ${error}`);
            logError(`Summary failed for ${conv.file}`, error);
            return null;
          }
        }, concurrency2);
      }
    } else {
      console.log(`  Skipping ${toProcess.length} summaries (--no-summaries mode)`);
    }
    for (const conv of toProcess) {
      for (const exchange of conv.exchanges) {
        if (exchange.toolCalls?.length) {
          exchange.compressedToolSummary = formatToolSummary(exchange.toolCalls);
        }
        const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
        const embedding = await generateExchangeEmbedding(
          exchange.userMessage,
          exchange.assistantMessage,
          toolNames
        );
        insertExchange(db, exchange, embedding, toolNames);
      }
      totalExchanges += conv.exchanges.length;
      conversationsProcessed++;
      if (maxConversations && conversationsProcessed >= maxConversations) {
        console.log(`
Reached limit of ${maxConversations} conversations`);
        db.close();
        console.log(`\u2705 Indexing complete! Conversations: ${conversationsProcessed}, Exchanges: ${totalExchanges}`);
        return;
      }
    }
  }
  db.close();
  console.log(`
\u2705 Indexing complete! Conversations: ${conversationsProcessed}, Exchanges: ${totalExchanges}`);
}
async function indexSession(sessionId, concurrency2 = 1, noSummaries2 = false) {
  console.log(`Indexing session: ${sessionId}`);
  const PROJECTS_DIR = getProjectsDir();
  const ARCHIVE_DIR = getArchiveDir();
  const projects = fs6.readdirSync(PROJECTS_DIR);
  const excludedProjects = getExcludedProjects();
  let found = false;
  for (const project of projects) {
    if (excludedProjects.includes(project)) continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    if (!fs6.statSync(projectPath).isDirectory()) continue;
    const files = fs6.readdirSync(projectPath).filter((f) => f.includes(sessionId) && f.endsWith(".jsonl") && !f.startsWith("agent-"));
    if (files.length > 0) {
      found = true;
      const file = files[0];
      const sourcePath = path4.join(projectPath, file);
      const db = initDatabase();
      await initEmbeddings();
      const projectArchive = path4.join(ARCHIVE_DIR, project);
      fs6.mkdirSync(projectArchive, { recursive: true });
      const archivePath = path4.join(projectArchive, file);
      if (!fs6.existsSync(archivePath)) {
        fs6.copyFileSync(sourcePath, archivePath);
      }
      const parseResult = await parseConversationWithResult(sourcePath, project, archivePath);
      if (parseResult.isExcluded) {
        console.log(`Skipped (excluded: ${parseResult.exclusionReason})`);
        db.close();
        return;
      }
      if (parseResult.exchanges.length > 0) {
        const summaryPath = archivePath.replace(".jsonl", "-summary.txt");
        if (!noSummaries2 && !fs6.existsSync(summaryPath)) {
          const summary = await summarizeConversation(parseResult.exchanges, void 0, file);
          fs6.writeFileSync(summaryPath, summary, "utf-8");
          console.log(`Summary: ${summary.split(/\s+/).length} words`);
        }
        for (const exchange of parseResult.exchanges) {
          if (exchange.toolCalls?.length) {
            exchange.compressedToolSummary = formatToolSummary(exchange.toolCalls);
          }
          const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
          const embedding = await generateExchangeEmbedding(
            exchange.userMessage,
            exchange.assistantMessage,
            toolNames
          );
          insertExchange(db, exchange, embedding, toolNames);
        }
        console.log(`\u2705 Indexed session ${sessionId}: ${parseResult.exchanges.length} exchanges`);
      }
      db.close();
      break;
    }
  }
  if (!found) {
    console.log(`Session ${sessionId} not found`);
  }
}
async function indexUnprocessed(concurrency2 = 1, noSummaries2 = false) {
  console.log("Finding unprocessed conversations...");
  if (concurrency2 > 1) console.log(`Concurrency: ${concurrency2}`);
  if (noSummaries2) console.log("\u26A0\uFE0F  Running in no-summaries mode (skipping AI summaries)");
  const db = initDatabase();
  await initEmbeddings();
  const PROJECTS_DIR = getProjectsDir();
  const ARCHIVE_DIR = getArchiveDir();
  const projects = fs6.readdirSync(PROJECTS_DIR);
  const excludedProjects = getExcludedProjects();
  const unprocessed = [];
  for (const project of projects) {
    if (excludedProjects.includes(project)) continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    if (!fs6.statSync(projectPath).isDirectory()) continue;
    const files = fs6.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
    for (const file of files) {
      const sourcePath = path4.join(projectPath, file);
      const projectArchive = path4.join(ARCHIVE_DIR, project);
      const archivePath = path4.join(projectArchive, file);
      const summaryPath = archivePath.replace(".jsonl", "-summary.txt");
      const alreadyIndexed = db.prepare("SELECT COUNT(*) as count FROM exchanges WHERE archive_path = ?").get(archivePath);
      if (alreadyIndexed.count > 0) continue;
      fs6.mkdirSync(projectArchive, { recursive: true });
      if (!fs6.existsSync(archivePath)) {
        fs6.copyFileSync(sourcePath, archivePath);
      }
      const parseResult = await parseConversationWithResult(sourcePath, project, archivePath);
      if (parseResult.isExcluded) {
        console.log(`Excluding ${project}/${file}: ${parseResult.exclusionReason}`);
        continue;
      }
      if (parseResult.exchanges.length === 0) continue;
      unprocessed.push({ project, file, sourcePath, archivePath, summaryPath, exchanges: parseResult.exchanges });
    }
  }
  if (unprocessed.length === 0) {
    console.log("\u2705 All conversations are already processed!");
    db.close();
    return;
  }
  console.log(`Found ${unprocessed.length} unprocessed conversations`);
  if (!noSummaries2) {
    const needsSummary = unprocessed.filter((c) => !fs6.existsSync(c.summaryPath));
    if (needsSummary.length > 0) {
      console.log(`Generating ${needsSummary.length} summaries (concurrency: ${concurrency2})...
`);
      await processBatch(needsSummary, async (conv) => {
        try {
          const summary = await summarizeConversation(conv.exchanges, void 0, `${conv.project}/${conv.file}`);
          fs6.writeFileSync(conv.summaryPath, summary, "utf-8");
          const wordCount = summary.split(/\s+/).length;
          console.log(`  \u2713 ${conv.project}/${conv.file}: ${wordCount} words`);
          return summary;
        } catch (error) {
          console.log(`  \u2717 ${conv.project}/${conv.file}: ${error}`);
          logError(`Summary failed for ${conv.project}/${conv.file}`, error);
          return null;
        }
      }, concurrency2);
    }
  } else {
    console.log(`Skipping summaries for ${unprocessed.length} conversations (--no-summaries mode)
`);
  }
  console.log(`
Indexing embeddings...`);
  for (const conv of unprocessed) {
    for (const exchange of conv.exchanges) {
      if (exchange.toolCalls?.length) {
        exchange.compressedToolSummary = formatToolSummary(exchange.toolCalls);
      }
      const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
      const embedding = await generateExchangeEmbedding(
        exchange.userMessage,
        exchange.assistantMessage,
        toolNames
      );
      insertExchange(db, exchange, embedding, toolNames);
    }
  }
  db.close();
  console.log(`
\u2705 Processed ${unprocessed.length} conversations`);
}
async function recomputeToolSummaries(db) {
  const exchangeIdsStmt = db.prepare(`
    SELECT DISTINCT exchange_id
    FROM tool_calls
    ORDER BY exchange_id
  `);
  const exchangeIds = exchangeIdsStmt.all();
  let processedCount = 0;
  const updateStmt = db.prepare(`
    UPDATE exchanges
    SET compressed_tool_summary = ?
    WHERE id = ?
  `);
  for (const { exchange_id } of exchangeIds) {
    const toolCallsStmt = db.prepare(`
      SELECT tool_name, tool_input
      FROM tool_calls
      WHERE exchange_id = ?
      ORDER BY id
    `);
    const toolCalls = toolCallsStmt.all(exchange_id);
    if (toolCalls.length === 0) {
      continue;
    }
    const formattedCalls = toolCalls.map((tc) => {
      let toolInput = null;
      try {
        toolInput = tc.tool_input ? JSON.parse(tc.tool_input) : null;
      } catch {
      }
      return {
        toolName: tc.tool_name,
        toolInput
      };
    });
    const summary = formatToolSummary(formattedCalls);
    updateStmt.run(summary, exchange_id);
    processedCount++;
  }
  return processedCount;
}

// src/core/sync.ts
init_constants();
init_paths();
import fs7 from "fs";
import path5 from "path";
var EXCLUSION_MARKERS2 = [
  "<INSTRUCTIONS-TO-EPISODIC-MEMORY>DO NOT INDEX THIS CHAT</INSTRUCTIONS-TO-EPISODIC-MEMORY>",
  "Only use NO_INSIGHTS_FOUND",
  SUMMARIZER_CONTEXT_MARKER
];
function shouldSkipConversation(filePath) {
  try {
    const content = fs7.readFileSync(filePath, "utf-8");
    return EXCLUSION_MARKERS2.some((marker) => content.includes(marker));
  } catch (error) {
    return false;
  }
}
function copyIfNewer(src, dest) {
  const destDir = path5.dirname(dest);
  if (!fs7.existsSync(destDir)) {
    fs7.mkdirSync(destDir, { recursive: true });
  }
  if (fs7.existsSync(dest)) {
    const srcStat = fs7.statSync(src);
    const destStat = fs7.statSync(dest);
    if (destStat.mtimeMs >= srcStat.mtimeMs) {
      return false;
    }
  }
  const tempDest = dest + ".tmp." + process.pid;
  fs7.copyFileSync(src, tempDest);
  fs7.renameSync(tempDest, dest);
  return true;
}
function extractSessionIdFromPath(filePath) {
  const basename = path5.basename(filePath, ".jsonl");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(basename)) {
    return basename;
  }
  return null;
}
async function syncConversations(sourceDir, destDir, options = {}) {
  const result = {
    copied: 0,
    skipped: 0,
    indexed: 0,
    summarized: 0,
    errors: []
  };
  const { startTokenTracking: startTokenTracking2, getCurrentRunTokenUsage: getCurrentRunTokenUsage2 } = await Promise.resolve().then(() => (init_summarizer(), summarizer_exports));
  startTokenTracking2();
  if (!fs7.existsSync(sourceDir)) {
    return result;
  }
  const filesToIndex = [];
  const filesToSummarize = [];
  const projects = fs7.readdirSync(sourceDir);
  const excludedProjects = getExcludedProjects();
  for (const project of projects) {
    if (excludedProjects.includes(project)) {
      console.log("\nSkipping excluded project: " + project);
      continue;
    }
    const projectPath = path5.join(sourceDir, project);
    const stat = fs7.statSync(projectPath);
    if (!stat.isDirectory()) continue;
    const files = fs7.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
    for (const file of files) {
      const srcFile = path5.join(projectPath, file);
      const destFile = path5.join(destDir, project, file);
      try {
        const wasCopied = copyIfNewer(srcFile, destFile);
        if (wasCopied) {
          result.copied++;
          filesToIndex.push(destFile);
        } else {
          result.skipped++;
        }
        if (!options.skipSummaries) {
          const summaryPath = destFile.replace(".jsonl", "-summary.txt");
          if (!fs7.existsSync(summaryPath) && !shouldSkipConversation(destFile)) {
            const sessionId = extractSessionIdFromPath(destFile);
            if (sessionId) {
              filesToSummarize.push({ path: destFile, sessionId });
            }
          }
        }
      } catch (error) {
        result.errors.push({
          file: srcFile,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  if (!options.skipIndex && filesToIndex.length > 0) {
    const { initDatabase: initDatabase2, insertExchange: insertExchange2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { initEmbeddings: initEmbeddings2, generateExchangeEmbedding: generateExchangeEmbedding2 } = await Promise.resolve().then(() => (init_embeddings(), embeddings_exports));
    const { parseConversation: parseConversation3 } = await Promise.resolve().then(() => (init_parser(), parser_exports));
    const db = initDatabase2();
    await initEmbeddings2();
    for (const file of filesToIndex) {
      try {
        if (shouldSkipConversation(file)) {
          continue;
        }
        const project = path5.basename(path5.dirname(file));
        const exchanges = await parseConversation3(file, project, file);
        for (const exchange of exchanges) {
          if (exchange.toolCalls?.length) {
            exchange.compressedToolSummary = formatToolSummary(exchange.toolCalls);
          }
          const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
          const embedding = await generateExchangeEmbedding2(
            exchange.userMessage,
            exchange.assistantMessage,
            toolNames
          );
          insertExchange2(db, exchange, embedding, toolNames);
        }
        result.indexed++;
      } catch (error) {
        result.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    db.close();
  }
  if (!options.skipSummaries && filesToSummarize.length > 0) {
    const { parseConversation: parseConversation3 } = await Promise.resolve().then(() => (init_parser(), parser_exports));
    const { summarizeConversation: summarizeConversation2 } = await Promise.resolve().then(() => (init_summarizer(), summarizer_exports));
    const summaryLimit = options.summaryLimit ?? 10;
    const toSummarize = filesToSummarize.slice(0, summaryLimit);
    const remaining = filesToSummarize.length - toSummarize.length;
    console.log(`Generating summaries for ${toSummarize.length} conversation(s)...`);
    if (remaining > 0) {
      console.log(`  (${remaining} more need summaries - will process on next sync)`);
    }
    for (const { path: filePath, sessionId } of toSummarize) {
      try {
        const project = path5.basename(path5.dirname(filePath));
        const exchanges = await parseConversation3(filePath, project, filePath);
        if (exchanges.length === 0) {
          continue;
        }
        console.log(`  Summarizing ${path5.basename(filePath)} (${exchanges.length} exchanges)...`);
        const summary = await summarizeConversation2(exchanges, sessionId);
        const summaryPath = filePath.replace(".jsonl", "-summary.txt");
        fs7.writeFileSync(summaryPath, summary, "utf-8");
        result.summarized++;
      } catch (error) {
        result.errors.push({
          file: filePath,
          error: `Summary generation failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }
  result.tokenUsage = getCurrentRunTokenUsage2();
  return result;
}

// src/cli/index-cli.ts
init_paths();
import fs9 from "fs";
import path8 from "path";
import os3 from "os";
import { execSync } from "child_process";
var command2 = process.argv[2];
if (!command2 || command2 === "--help" || command2 === "-h") {
  console.log(`
Conversation Memory CLI - Persistent semantic search for Claude Code sessions

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  sync                Copy new conversations from ~/.claude/projects to archive
  index-all           Re-index all conversations (slow, use with caution)
  index-session <id>  Index a specific session by ID
  index-cleanup       Index only unprocessed conversations
  recompute-summaries Recompute compressed tool summaries for existing indexed data
  verify              Check index health for issues
  repair              Fix detected issues from verify
  rebuild             Delete database and re-index everything
  inject              Inject recent context into session (for SessionStart hook)
  observe             Handle PostToolUse hook (internal)
  observer            Control observer background process

OPTIONS:
  --concurrency, -c N  Parallelism for summaries/embeddings (1-16, default: 1)
  --no-summaries       Skip AI summarization
  --summarize          Request session summary (for Stop hook)

EXAMPLES:
  # Sync new conversations
  conversation-memory sync

  # Sync with parallel summarization
  conversation-memory sync --concurrency 4

  # Index a specific session
  conversation-memory index-session 2025-02-06-123456

  # Verify index health
  conversation-memory verify

  # Repair issues
  conversation-memory repair --repair

  # Recompute tool summaries for existing data
  conversation-memory recompute-summaries

  # Rebuild entire index
  conversation-memory rebuild --concurrency 8

  # Observer control
  conversation-memory observer start
  conversation-memory observer status
  conversation-memory observer stop

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path
  CONVERSATION_SEARCH_EXCLUDE_PROJECTS  Comma-separated projects to exclude

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}
async function ensureDependencies() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
  const nodeModulesPath = path8.join(pluginRoot, "node_modules");
  if (!fs9.existsSync(nodeModulesPath)) {
    console.error("[conversation-memory] Installing dependencies...");
    try {
      execSync("npm install --silent", {
        cwd: pluginRoot,
        stdio: "inherit"
      });
      console.error("[conversation-memory] Dependencies installed.");
    } catch (error) {
      console.error("[conversation-memory] Failed to install dependencies:", error);
      throw error;
    }
  }
}
function getConcurrency() {
  const concurrencyIndex = process.argv.findIndex((arg) => arg === "--concurrency" || arg === "-c");
  if (concurrencyIndex !== -1 && process.argv[concurrencyIndex + 1]) {
    const value = parseInt(process.argv[concurrencyIndex + 1], 10);
    if (value >= 1 && value <= 16) return value;
  }
  return 1;
}
function getNoSummaries() {
  return process.argv.includes("--no-summaries");
}
var concurrency = getConcurrency();
var noSummaries = getNoSummaries();
async function main3() {
  try {
    await ensureDependencies();
    switch (command2) {
      case "inject":
        await Promise.resolve().then(() => (init_inject_cli(), inject_cli_exports));
        break;
      case "observe":
      case "observer":
      case "observer-run":
        await Promise.resolve().then(() => (init_observer_cli(), observer_cli_exports));
        break;
      case "index-session":
        const sessionId = process.argv[3];
        if (!sessionId) {
          console.error("Usage: index-cli index-session <session-id>");
          process.exit(1);
        }
        await indexSession(sessionId, concurrency, noSummaries);
        break;
      case "index-cleanup":
        await indexUnprocessed(concurrency, noSummaries);
        break;
      case "recompute-summaries": {
        const db = await Promise.resolve().then(() => (init_db(), db_exports)).then((m) => m.initDatabase());
        try {
          const count = await recomputeToolSummaries(db);
          console.log(`Recomputed summaries for ${count} exchanges`);
        } finally {
          db.close();
        }
        break;
      }
      case "sync":
        const syncSourceDir = path8.join(os3.homedir(), ".claude", "projects");
        const syncDestDir = getArchiveDir();
        console.log("Syncing conversations...");
        const syncResult = await syncConversations(syncSourceDir, syncDestDir, { skipSummaries: noSummaries });
        console.log(`
Sync complete!`);
        console.log(`  Copied: ${syncResult.copied}`);
        console.log(`  Skipped: ${syncResult.skipped}`);
        console.log(`  Indexed: ${syncResult.indexed}`);
        console.log(`  Summarized: ${syncResult.summarized}`);
        if (syncResult.errors.length > 0) {
          console.log(`
Errors: ${syncResult.errors.length}`);
          syncResult.errors.forEach((err) => console.log(`  ${err.file}: ${err.error}`));
        }
        break;
      case "verify":
        console.log("Verifying conversation index...");
        const issues = await verifyIndex();
        console.log("\n=== Verification Results ===");
        console.log(`Missing summaries: ${issues.missing.length}`);
        console.log(`Orphaned entries: ${issues.orphaned.length}`);
        console.log(`Outdated files: ${issues.outdated.length}`);
        console.log(`Corrupted files: ${issues.corrupted.length}`);
        if (issues.missing.length > 0) {
          console.log("\nMissing summaries:");
          issues.missing.forEach((m) => console.log(`  ${m.path}`));
        }
        if (issues.missing.length + issues.orphaned.length + issues.outdated.length + issues.corrupted.length > 0) {
          console.log("\nRun with --repair to fix these issues.");
          process.exit(1);
        } else {
          console.log("\n\u2705 Index is healthy!");
        }
        break;
      case "repair":
        console.log("Verifying conversation index...");
        const repairIssues = await verifyIndex();
        if (repairIssues.missing.length + repairIssues.orphaned.length + repairIssues.outdated.length > 0) {
          await repairIndex(repairIssues);
        } else {
          console.log("\u2705 No issues to repair!");
        }
        break;
      case "rebuild":
        console.log("Rebuilding entire index...");
        const dbPath = getDbPath();
        if (fs9.existsSync(dbPath)) {
          fs9.unlinkSync(dbPath);
          console.log("Deleted existing database");
        }
        const archiveDir = getArchiveDir();
        if (fs9.existsSync(archiveDir)) {
          const projects = fs9.readdirSync(archiveDir);
          for (const project of projects) {
            const projectPath = path8.join(archiveDir, project);
            if (!fs9.statSync(projectPath).isDirectory()) continue;
            const summaries = fs9.readdirSync(projectPath).filter((f) => f.endsWith("-summary.txt"));
            for (const summary of summaries) {
              fs9.unlinkSync(path8.join(projectPath, summary));
            }
          }
          console.log("Deleted all summary files");
        }
        console.log("Re-indexing all conversations...");
        await indexConversations(void 0, void 0, concurrency, noSummaries);
        break;
      case "index-all":
      default:
        await indexConversations(void 0, void 0, concurrency, noSummaries);
        break;
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
main3();
/*! Bundled license information:

@google/generative-ai/dist/index.mjs:
  (**
   * @license
   * Copyright 2024 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
