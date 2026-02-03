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
  parseConversationFile: () => parseConversationFile
});
import fs from "fs";
import readline from "readline";
import crypto from "crypto";
async function parseConversation(filePath, projectName, archivePath) {
  const exchanges = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  let currentExchange = null;
  const finalizeExchange = () => {
    if (currentExchange && currentExchange.assistantMessages.length > 0) {
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
      if (!text.trim() && toolCalls.length === 0) {
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
        if (parsed.sessionId)
          currentExchange.sessionId = parsed.sessionId;
        if (parsed.cwd)
          currentExchange.cwd = parsed.cwd;
        if (parsed.gitBranch)
          currentExchange.gitBranch = parsed.gitBranch;
        if (parsed.version)
          currentExchange.claudeVersion = parsed.version;
      }
    } catch (error) {
      continue;
    }
  }
  finalizeExchange();
  return exchanges;
}
async function parseConversationFile(filePath) {
  const pathParts = filePath.split("/");
  let project = "unknown";
  if (pathParts.length >= 2) {
    project = pathParts[pathParts.length - 2];
  }
  const exchanges = await parseConversation(filePath, project, filePath);
  return {
    project,
    exchanges
  };
}
var init_parser = __esm({
  "src/core/parser.ts"() {
    "use strict";
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
    dir = path.join(os.homedir(), ".claude", "conversation-memory");
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
  initDatabase: () => initDatabase,
  insertExchange: () => insertExchange,
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
    { name: "thinking_triggers", sql: "ALTER TABLE exchanges ADD COLUMN thinking_triggers TEXT" }
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
      thinking_triggers TEXT
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
      embedding FLOAT[384]
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
  return db;
}
function insertExchange(db, exchange, embedding, toolNames) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO exchanges
    (id, project, timestamp, user_message, assistant_message, archive_path, line_start, line_end, last_indexed,
     parent_uuid, is_sidechain, session_id, cwd, git_branch, claude_version,
     thinking_level, thinking_disabled, thinking_triggers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    exchange.parentUuid || null,
    exchange.isSidechain ? 1 : 0,
    exchange.sessionId || null,
    exchange.cwd || null,
    exchange.gitBranch || null,
    exchange.claudeVersion || null,
    exchange.thinkingLevel || null,
    exchange.thinkingDisabled ? 1 : 0,
    exchange.thinkingTriggers || null
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
import { pipeline } from "@xenova/transformers";
async function initEmbeddings() {
  if (!embeddingPipeline) {
    console.log("Loading embedding model (first run may take time)...");
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("Embedding model loaded");
  }
}
async function generateEmbedding(text) {
  if (!embeddingPipeline) {
    await initEmbeddings();
  }
  const truncated = text.substring(0, 2e3);
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

// src/core/summarizer.ts
var summarizer_exports = {};
__export(summarizer_exports, {
  formatConversationText: () => formatConversationText,
  summarizeConversation: () => summarizeConversation
});
import { query } from "@anthropic-ai/claude-agent-sdk";
function getApiEnv() {
  const baseUrl = process.env.EPISODIC_MEMORY_API_BASE_URL;
  const token = process.env.EPISODIC_MEMORY_API_TOKEN;
  const timeoutMs = process.env.EPISODIC_MEMORY_API_TIMEOUT_MS;
  if (!baseUrl && !token && !timeoutMs) {
    return void 0;
  }
  return {
    ...process.env,
    ...baseUrl && { ANTHROPIC_BASE_URL: baseUrl },
    ...token && { ANTHROPIC_AUTH_TOKEN: token },
    ...timeoutMs && { API_TIMEOUT_MS: timeoutMs }
  };
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
async function callClaude(prompt, sessionId, useFallback = false) {
  const primaryModel = process.env.EPISODIC_MEMORY_API_MODEL || "haiku";
  const fallbackModel = process.env.EPISODIC_MEMORY_API_MODEL_FALLBACK || "sonnet";
  const model = useFallback ? fallbackModel : primaryModel;
  for await (const message of query({
    prompt,
    options: {
      model,
      max_tokens: 4096,
      env: getApiEnv(),
      resume: sessionId,
      // Don't override systemPrompt when resuming - it uses the original session's prompt
      // Instead, the prompt itself should provide clear instructions
      ...sessionId ? {} : {
        systemPrompt: 'Write concise, factual summaries. Output ONLY the summary - no preamble, no "Here is", no "I will". Your output will be indexed directly.'
      }
    }
  })) {
    if (message && typeof message === "object" && "type" in message && message.type === "result") {
      const result = message.result;
      if (typeof result === "string" && result.includes("API Error") && result.includes("thinking.budget_tokens")) {
        if (!useFallback) {
          console.log(`    ${primaryModel} hit thinking budget error, retrying with ${fallbackModel}`);
          return await callClaude(prompt, sessionId, true);
        }
        return result;
      }
      return result;
    }
  }
  return "";
}
function chunkExchanges(exchanges, chunkSize) {
  const chunks = [];
  for (let i = 0; i < exchanges.length; i += chunkSize) {
    chunks.push(exchanges.slice(i, i + chunkSize));
  }
  return chunks;
}
async function summarizeConversation(exchanges, sessionId) {
  if (exchanges.length === 0) {
    return "Trivial conversation with no substantive content.";
  }
  if (exchanges.length === 1) {
    const text = formatConversationText(exchanges);
    if (text.length < 100 || exchanges[0].userMessage.trim() === "/exit") {
      return "Trivial conversation with no substantive content.";
    }
  }
  if (exchanges.length <= 15) {
    const conversationText = sessionId ? "" : formatConversationText(exchanges);
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
    const result = await callClaude(prompt, sessionId);
    return extractSummary(result);
  }
  console.log(`  Long conversation (${exchanges.length} exchanges) - using hierarchical summarization`);
  const chunks = chunkExchanges(exchanges, 8);
  console.log(`  Split into ${chunks.length} chunks`);
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = formatConversationText(chunks[i]);
    const prompt = `${SUMMARIZER_CONTEXT_MARKER}.

Please write a concise summary of this part of a conversation in 2-3 sentences. What happened, what was built/discussed. Use <summary></summary> tags.

${chunkText}

Example: <summary>Implemented HID keyboard functionality for ESP32. Hit Bluetooth controller initialization error, fixed by adjusting memory allocation.</summary>`;
    try {
      const summary = await callClaude(prompt);
      const extracted = extractSummary(summary);
      chunkSummaries.push(extracted);
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${extracted.split(/\s+/).length} words`);
    } catch (error) {
      console.log(`  Chunk ${i + 1} failed, skipping`);
    }
  }
  if (chunkSummaries.length === 0) {
    return "Error: Unable to summarize conversation.";
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
    const result = await callClaude(synthesisPrompt);
    return extractSummary(result);
  } catch (error) {
    console.log(`  Synthesis failed, using chunk summaries`);
    return chunkSummaries.join(" ");
  }
}
var init_summarizer = __esm({
  "src/core/summarizer.ts"() {
    "use strict";
    init_constants();
  }
});

// src/core/verify.ts
init_parser();
init_db();
init_paths();
import fs4 from "fs";
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
  if (!fs4.existsSync(archiveDir)) {
    return result;
  }
  const db = initDatabase();
  const projects = fs4.readdirSync(archiveDir);
  const excludedProjects = getExcludedProjects();
  let totalChecked = 0;
  for (const project of projects) {
    if (excludedProjects.includes(project)) {
      console.log("\nSkipping excluded project: " + project);
      continue;
    }
    const projectPath = path3.join(archiveDir, project);
    const stat = fs4.statSync(projectPath);
    if (!stat.isDirectory())
      continue;
    const files = fs4.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      totalChecked++;
      if (totalChecked % 100 === 0) {
        console.log(`  Checked ${totalChecked} conversations...`);
      }
      const conversationPath = path3.join(projectPath, file);
      foundFiles.add(conversationPath);
      const summaryPath = conversationPath.replace(".jsonl", "-summary.txt");
      if (!fs4.existsSync(summaryPath)) {
        result.missing.push({ path: conversationPath, reason: "No summary file" });
        continue;
      }
      const lastIndexed = getFileLastIndexed(db, conversationPath);
      if (lastIndexed !== null) {
        const fileStat = fs4.statSync(conversationPath);
        if (fileStat.mtimeMs > lastIndexed) {
          result.outdated.push({
            path: conversationPath,
            fileTime: fileStat.mtimeMs,
            dbTime: lastIndexed
          });
        }
      }
      try {
        await parseConversation(conversationPath, project, conversationPath);
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
  const { parseConversation: parseConversation2 } = await Promise.resolve().then(() => (init_parser(), parser_exports));
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
      const exchanges = await parseConversation2(conversationPath, project, conversationPath);
      if (exchanges.length === 0) {
        console.log(`  Skipped (no exchanges)`);
        continue;
      }
      const summaryPath = conversationPath.replace(".jsonl", "-summary.txt");
      const summary = await summarizeConversation2(exchanges);
      fs4.writeFileSync(summaryPath, summary, "utf-8");
      console.log(`  Created summary: ${summary.split(/\s+/).length} words`);
      for (const exchange of exchanges) {
        const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
        const embedding = await generateExchangeEmbedding2(
          exchange.userMessage,
          exchange.assistantMessage,
          toolNames
        );
        insertExchange2(db, exchange, embedding, toolNames);
      }
      console.log(`  Indexed ${exchanges.length} exchanges`);
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
import fs5 from "fs";
import path4 from "path";
import os2 from "os";
import { EventEmitter } from "events";
process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = "20000";
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
  const projects = fs5.readdirSync(PROJECTS_DIR);
  let totalExchanges = 0;
  let conversationsProcessed = 0;
  const excludedProjects = getExcludedProjects();
  for (const project of projects) {
    if (excludedProjects.includes(project)) {
      console.log(`
Skipping excluded project: ${project}`);
      continue;
    }
    if (limitToProject && project !== limitToProject)
      continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    const stat = fs5.statSync(projectPath);
    if (!stat.isDirectory())
      continue;
    const files = fs5.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
    if (files.length === 0)
      continue;
    console.log(`
Processing project: ${project} (${files.length} conversations)`);
    if (concurrency2 > 1)
      console.log(`  Concurrency: ${concurrency2}`);
    const projectArchive = path4.join(ARCHIVE_DIR, project);
    fs5.mkdirSync(projectArchive, { recursive: true });
    const toProcess = [];
    for (const file of files) {
      const sourcePath = path4.join(projectPath, file);
      const archivePath = path4.join(projectArchive, file);
      if (!fs5.existsSync(archivePath)) {
        fs5.copyFileSync(sourcePath, archivePath);
        console.log(`  Archived: ${file}`);
      }
      const exchanges = await parseConversation(sourcePath, project, archivePath);
      if (exchanges.length === 0) {
        console.log(`  Skipped ${file} (no exchanges)`);
        continue;
      }
      toProcess.push({
        file,
        sourcePath,
        archivePath,
        summaryPath: archivePath.replace(".jsonl", "-summary.txt"),
        exchanges
      });
    }
    if (!noSummaries2) {
      const needsSummary = toProcess.filter((c) => !fs5.existsSync(c.summaryPath));
      if (needsSummary.length > 0) {
        console.log(`  Generating ${needsSummary.length} summaries (concurrency: ${concurrency2})...`);
        await processBatch(needsSummary, async (conv) => {
          try {
            const summary = await summarizeConversation(conv.exchanges);
            fs5.writeFileSync(conv.summaryPath, summary, "utf-8");
            const wordCount = summary.split(/\s+/).length;
            console.log(`  \u2713 ${conv.file}: ${wordCount} words`);
            return summary;
          } catch (error) {
            console.log(`  \u2717 ${conv.file}: ${error}`);
            return null;
          }
        }, concurrency2);
      }
    } else {
      console.log(`  Skipping ${toProcess.length} summaries (--no-summaries mode)`);
    }
    for (const conv of toProcess) {
      for (const exchange of conv.exchanges) {
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
  const projects = fs5.readdirSync(PROJECTS_DIR);
  const excludedProjects = getExcludedProjects();
  let found = false;
  for (const project of projects) {
    if (excludedProjects.includes(project))
      continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    if (!fs5.statSync(projectPath).isDirectory())
      continue;
    const files = fs5.readdirSync(projectPath).filter((f) => f.includes(sessionId) && f.endsWith(".jsonl"));
    if (files.length > 0) {
      found = true;
      const file = files[0];
      const sourcePath = path4.join(projectPath, file);
      const db = initDatabase();
      await initEmbeddings();
      const projectArchive = path4.join(ARCHIVE_DIR, project);
      fs5.mkdirSync(projectArchive, { recursive: true });
      const archivePath = path4.join(projectArchive, file);
      if (!fs5.existsSync(archivePath)) {
        fs5.copyFileSync(sourcePath, archivePath);
      }
      const exchanges = await parseConversation(sourcePath, project, archivePath);
      if (exchanges.length > 0) {
        const summaryPath = archivePath.replace(".jsonl", "-summary.txt");
        if (!noSummaries2 && !fs5.existsSync(summaryPath)) {
          const summary = await summarizeConversation(exchanges);
          fs5.writeFileSync(summaryPath, summary, "utf-8");
          console.log(`Summary: ${summary.split(/\s+/).length} words`);
        }
        for (const exchange of exchanges) {
          const toolNames = exchange.toolCalls?.map((tc) => tc.toolName);
          const embedding = await generateExchangeEmbedding(
            exchange.userMessage,
            exchange.assistantMessage,
            toolNames
          );
          insertExchange(db, exchange, embedding, toolNames);
        }
        console.log(`\u2705 Indexed session ${sessionId}: ${exchanges.length} exchanges`);
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
  if (concurrency2 > 1)
    console.log(`Concurrency: ${concurrency2}`);
  if (noSummaries2)
    console.log("\u26A0\uFE0F  Running in no-summaries mode (skipping AI summaries)");
  const db = initDatabase();
  await initEmbeddings();
  const PROJECTS_DIR = getProjectsDir();
  const ARCHIVE_DIR = getArchiveDir();
  const projects = fs5.readdirSync(PROJECTS_DIR);
  const excludedProjects = getExcludedProjects();
  const unprocessed = [];
  for (const project of projects) {
    if (excludedProjects.includes(project))
      continue;
    const projectPath = path4.join(PROJECTS_DIR, project);
    if (!fs5.statSync(projectPath).isDirectory())
      continue;
    const files = fs5.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const sourcePath = path4.join(projectPath, file);
      const projectArchive = path4.join(ARCHIVE_DIR, project);
      const archivePath = path4.join(projectArchive, file);
      const summaryPath = archivePath.replace(".jsonl", "-summary.txt");
      const alreadyIndexed = db.prepare("SELECT COUNT(*) as count FROM exchanges WHERE archive_path = ?").get(archivePath);
      if (alreadyIndexed.count > 0)
        continue;
      fs5.mkdirSync(projectArchive, { recursive: true });
      if (!fs5.existsSync(archivePath)) {
        fs5.copyFileSync(sourcePath, archivePath);
      }
      const exchanges = await parseConversation(sourcePath, project, archivePath);
      if (exchanges.length === 0)
        continue;
      unprocessed.push({ project, file, sourcePath, archivePath, summaryPath, exchanges });
    }
  }
  if (unprocessed.length === 0) {
    console.log("\u2705 All conversations are already processed!");
    db.close();
    return;
  }
  console.log(`Found ${unprocessed.length} unprocessed conversations`);
  if (!noSummaries2) {
    const needsSummary = unprocessed.filter((c) => !fs5.existsSync(c.summaryPath));
    if (needsSummary.length > 0) {
      console.log(`Generating ${needsSummary.length} summaries (concurrency: ${concurrency2})...
`);
      await processBatch(needsSummary, async (conv) => {
        try {
          const summary = await summarizeConversation(conv.exchanges);
          fs5.writeFileSync(conv.summaryPath, summary, "utf-8");
          const wordCount = summary.split(/\s+/).length;
          console.log(`  \u2713 ${conv.project}/${conv.file}: ${wordCount} words`);
          return summary;
        } catch (error) {
          console.log(`  \u2717 ${conv.project}/${conv.file}: ${error}`);
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

// src/cli/index-cli.ts
init_paths();
import fs6 from "fs";
import path5 from "path";
var command = process.argv[2];
function getConcurrency() {
  const concurrencyIndex = process.argv.findIndex((arg) => arg === "--concurrency" || arg === "-c");
  if (concurrencyIndex !== -1 && process.argv[concurrencyIndex + 1]) {
    const value = parseInt(process.argv[concurrencyIndex + 1], 10);
    if (value >= 1 && value <= 16)
      return value;
  }
  return 1;
}
function getNoSummaries() {
  return process.argv.includes("--no-summaries");
}
var concurrency = getConcurrency();
var noSummaries = getNoSummaries();
async function main() {
  try {
    switch (command) {
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
        if (fs6.existsSync(dbPath)) {
          fs6.unlinkSync(dbPath);
          console.log("Deleted existing database");
        }
        const archiveDir = getArchiveDir();
        if (fs6.existsSync(archiveDir)) {
          const projects = fs6.readdirSync(archiveDir);
          for (const project of projects) {
            const projectPath = path5.join(archiveDir, project);
            if (!fs6.statSync(projectPath).isDirectory())
              continue;
            const summaries = fs6.readdirSync(projectPath).filter((f) => f.endsWith("-summary.txt"));
            for (const summary of summaries) {
              fs6.unlinkSync(path5.join(projectPath, summary));
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
main();
