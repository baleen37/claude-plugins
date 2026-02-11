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

// src/core/paths.ts
import os from "os";
import path from "path";
import fs from "fs";
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
function getIndexDir() {
  return ensureDir(path.join(getSuperpowersDir(), "conversation-index"));
}
function getDbPath() {
  if (process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH) {
    return process.env.CONVERSATION_MEMORY_DB_PATH || process.env.TEST_DB_PATH;
  }
  return path.join(getIndexDir(), "conversations.db");
}
function getLogDir() {
  return ensureDir(path.join(getSuperpowersDir(), "logs"));
}
function getLogFilePath() {
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return path.join(getLogDir(), `${date}.log`);
}
var init_paths = __esm({
  "src/core/paths.ts"() {
    "use strict";
  }
});

// src/core/db.v3.ts
import Database from "better-sqlite3";
import path2 from "path";
import fs2 from "fs";
import * as sqliteVec from "sqlite-vec";
function openDatabase() {
  return createDatabase(false);
}
function createDatabase(wipe) {
  const dbPath = getDbPath();
  const dbDir = path2.dirname(dbPath);
  if (!fs2.existsSync(dbDir)) {
    fs2.mkdirSync(dbDir, { recursive: true });
  }
  if (wipe && dbPath !== ":memory:" && fs2.existsSync(dbPath)) {
    console.log("Deleting old database file for V3 clean slate...");
    fs2.unlinkSync(dbPath);
  }
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = new Set(tables.map((t) => t.name));
  if (!tableNames.has("pending_events")) {
    db.exec(`
      CREATE TABLE pending_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        compressed TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_pending_session ON pending_events(session_id)`);
    db.exec(`CREATE INDEX idx_pending_project ON pending_events(project)`);
    db.exec(`CREATE INDEX idx_pending_timestamp ON pending_events(timestamp)`);
  }
  if (!tableNames.has("observations")) {
    db.exec(`
      CREATE TABLE observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        project TEXT NOT NULL,
        session_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_observations_project ON observations(project)`);
    db.exec(`CREATE INDEX idx_observations_session ON observations(session_id)`);
    db.exec(`CREATE INDEX idx_observations_timestamp ON observations(timestamp DESC)`);
  }
  if (!tableNames.has("vec_observations")) {
    db.exec(`
      CREATE VIRTUAL TABLE vec_observations USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[768]
      )
    `);
  }
  return db;
}
function insertPendingEventV3(db, event) {
  const stmt = db.prepare(`
    INSERT INTO pending_events (session_id, project, tool_name, compressed, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    event.sessionId,
    event.project,
    event.toolName,
    event.compressed,
    event.timestamp,
    event.createdAt
  );
  return result.lastInsertRowid;
}
function insertObservationV3(db, observation, embedding) {
  const stmt = db.prepare(`
    INSERT INTO observations (title, content, project, session_id, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    observation.title,
    observation.content,
    observation.project,
    observation.sessionId ?? null,
    observation.timestamp,
    observation.createdAt
  );
  const rowid = result.lastInsertRowid;
  if (embedding) {
    const vecStmt = db.prepare(`
      INSERT INTO vec_observations (id, embedding)
      VALUES (?, ?)
    `);
    vecStmt.run(String(rowid), Buffer.from(new Float32Array(embedding).buffer));
  }
  return rowid;
}
function getAllPendingEventsV3(db, sessionId) {
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, project, tool_name as toolName, compressed, timestamp, created_at as createdAt
    FROM pending_events
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);
  return stmt.all(sessionId);
}
function searchObservationsV3(db, options = {}) {
  const { project, sessionId, after, before, limit = 100 } = options;
  const params = [];
  let sql = `
    SELECT id, title, content, project, session_id as sessionId, timestamp, created_at as createdAt
    FROM observations
    WHERE 1=1
  `;
  if (project) {
    sql += " AND project = ?";
    params.push(project);
  }
  if (sessionId) {
    sql += " AND session_id = ?";
    params.push(sessionId);
  }
  if (after) {
    sql += " AND timestamp >= ?";
    params.push(after);
  }
  if (before) {
    sql += " AND timestamp <= ?";
    params.push(before);
  }
  sql += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
var init_db_v3 = __esm({
  "src/core/db.v3.ts"() {
    "use strict";
    init_paths();
  }
});

// src/hooks/session-start.ts
function calculateRecencyCutoff(recencyDays) {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1e3;
  return now - recencyDays * msPerDay;
}
function countTokens(text) {
  return Math.ceil(text.length / 4);
}
function formatObservation(obs) {
  return `- ${obs.title}: ${obs.content}`;
}
async function handleSessionStart(db, project, config) {
  const { maxObservations, maxTokens, recencyDays, projectOnly } = config;
  const cutoffTimestamp = calculateRecencyCutoff(recencyDays);
  const observations = searchObservationsV3(db, {
    project: projectOnly ? project : void 0,
    after: cutoffTimestamp,
    limit: maxObservations
  });
  if (observations.length === 0) {
    return {
      markdown: "",
      includedCount: 0,
      tokenCount: 0
    };
  }
  const header = `# ${project} recent context (conversation-memory)

`;
  const headerTokens = countTokens(header);
  let markdown = header;
  let currentTokens = headerTokens;
  let includedCount = 0;
  for (const obs of observations) {
    const formatted = formatObservation(obs);
    const lineTokens = countTokens(formatted + "\n");
    if (currentTokens + lineTokens > maxTokens) {
      break;
    }
    markdown += formatted + "\n";
    currentTokens += lineTokens;
    includedCount++;
  }
  if (includedCount === 0) {
    return {
      markdown: "",
      includedCount: 0,
      tokenCount: 0
    };
  }
  return {
    markdown,
    includedCount,
    tokenCount: currentTokens
  };
}
var init_session_start = __esm({
  "src/hooks/session-start.ts"() {
    "use strict";
    init_db_v3();
  }
});

// src/cli/inject-cli.ts
var inject_cli_exports = {};
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function getProject(input) {
  if (input.project) {
    return input.project;
  }
  const match = input.transcript_path.match(/\/projects\/([^\/]+)\//);
  if (match && match[1]) {
    return match[1];
  }
  return process.env.CLAUDE_PROJECT || "default";
}
function getConfig() {
  return {
    maxObservations: parseInt(process.env.CONVERSATION_MEMORY_MAX_OBSERVATIONS || "10", 10),
    maxTokens: parseInt(process.env.CONVERSATION_MEMORY_MAX_TOKENS || "1000", 10),
    recencyDays: parseInt(process.env.CONVERSATION_MEMORY_RECENCY_DAYS || "7", 10),
    projectOnly: process.env.CONVERSATION_MEMORY_PROJECT_ONLY === "true"
  };
}
async function main() {
  try {
    const stdinData = await readStdin();
    const input = JSON.parse(stdinData);
    const project = getProject(input);
    const config = getConfig();
    const db = openDatabase();
    try {
      const result = await handleSessionStart(db, project, config);
      if (result.markdown) {
        console.log(result.markdown);
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`[conversation-memory] Error in inject: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
var init_inject_cli = __esm({
  "src/cli/inject-cli.ts"() {
    "use strict";
    init_db_v3();
    init_session_start();
    main();
  }
});

// src/core/compress.ts
function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) {
    return str || "";
  }
  return str.substring(0, maxLength - 3) + "...";
}
function getFirstLine(text) {
  if (!text) return "";
  const firstLine = text.split("\n")[0];
  return firstLine;
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compressRead(data) {
  if (!isObject(data)) {
    return "Read";
  }
  const file_path = data.file_path || "";
  const lines = data.lines;
  let result = "Read";
  if (file_path) {
    result += ` ${file_path}`;
  }
  if (lines !== void 0) {
    result += ` (${lines} lines)`;
  }
  return result;
}
function compressEdit(data) {
  if (!isObject(data)) {
    return "Edited";
  }
  const file_path = data.file_path || "unknown file";
  const old_string = getFirstLine(data.old_string);
  const new_string = getFirstLine(data.new_string);
  const oldTruncated = truncate(old_string, 40);
  const newTruncated = truncate(new_string, 40);
  let result = `Edited ${file_path}:`;
  if (old_string) {
    result += ` ${oldTruncated}`;
  } else {
    result += " (no old string)";
  }
  result += " \u2192";
  if (new_string) {
    result += ` ${newTruncated}`;
  } else {
    result += " (no new string)";
  }
  return result;
}
function compressWrite(data) {
  if (!isObject(data)) {
    return "Created";
  }
  const file_path = data.file_path || "";
  const lines = data.lines;
  let result = "Created";
  if (file_path) {
    result += ` ${file_path}`;
  }
  if (lines !== void 0) {
    result += ` (${lines} lines)`;
  }
  return result;
}
function compressBash(data) {
  if (!isObject(data)) {
    return "Ran";
  }
  const command2 = data.command || "command";
  const exitCode = data.exitCode;
  const stderr = data.stderr;
  let result = `Ran \`${command2}\` \u2192`;
  if (exitCode !== void 0) {
    result += ` exit ${exitCode}`;
  }
  if (exitCode === 1 && stderr) {
    const firstErrorLine = getFirstLine(stderr);
    const errorSummary = truncate(firstErrorLine, 100);
    if (errorSummary) {
      result += `: ${errorSummary}`;
    }
  }
  return result;
}
function compressGrep(data) {
  if (!isObject(data)) {
    return "Searched";
  }
  const pattern = data.pattern || "";
  const path3 = data.path;
  const count = data.count;
  const matches = data.matches;
  const matchCount = count !== void 0 ? count : matches?.length || 0;
  let result = `Searched '${pattern}'`;
  if (path3) {
    result += ` in ${path3}`;
  }
  result += ` \u2192 ${matchCount} matches`;
  return result;
}
function compressWebSearch(data) {
  if (!isObject(data)) {
    return "Searched:";
  }
  const query = data.query || "";
  return `Searched: ${query}`;
}
function compressWebFetch(data) {
  if (!isObject(data)) {
    return "Fetched";
  }
  const url = data.url || "";
  return url ? `Fetched ${url}` : "Fetched";
}
function compressToolData(toolName, toolData) {
  if (SKIPPED_TOOLS.has(toolName)) {
    return null;
  }
  switch (toolName) {
    case "Read":
      return compressRead(toolData);
    case "Edit":
      return compressEdit(toolData);
    case "Write":
      return compressWrite(toolData);
    case "Bash":
      return compressBash(toolData);
    case "Grep":
      return compressGrep(toolData);
    case "WebSearch":
      return compressWebSearch(toolData);
    case "WebFetch":
      return compressWebFetch(toolData);
    default:
      return toolName;
  }
}
var SKIPPED_TOOLS;
var init_compress = __esm({
  "src/core/compress.ts"() {
    "use strict";
    SKIPPED_TOOLS = /* @__PURE__ */ new Set([
      "Glob",
      "LSP",
      "TodoWrite",
      "TaskCreate",
      "TaskUpdate",
      "TaskList",
      "TaskGet",
      "AskUserQuestion",
      "EnterPlanMode",
      "ExitPlanMode",
      "NotebookEdit",
      "Skill"
    ]);
  }
});

// src/hooks/post-tool-use.ts
function handlePostToolUse(db, sessionId, project, toolName, toolData) {
  const compressed = compressToolData(toolName, toolData);
  if (compressed === null) {
    return;
  }
  const now = Date.now();
  const event = {
    sessionId,
    project,
    toolName,
    compressed,
    timestamp: now,
    createdAt: now
  };
  insertPendingEventV3(db, event);
}
var init_post_tool_use = __esm({
  "src/hooks/post-tool-use.ts"() {
    "use strict";
    init_compress();
    init_db_v3();
  }
});

// src/core/logger.ts
import fs3 from "fs";
function formatLogEntry(entry) {
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `[${entry.timestamp}] [${entry.level}] ${entry.message}${dataStr}`;
}
function writeLog(entry) {
  const logPath = getLogFilePath();
  const line = formatLogEntry(entry) + "\n";
  fs3.appendFileSync(logPath, line, "utf-8");
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
function logDebug(message, data) {
  if (process.env.CONVERSATION_MEMORY_DEBUG !== "true") {
    return;
  }
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "DEBUG" /* DEBUG */,
    message,
    data
  };
  writeLog(entry);
  console.log(`[DEBUG] ${message}`, data);
}
var init_logger = __esm({
  "src/core/logger.ts"() {
    "use strict";
    init_paths();
  }
});

// src/core/llm/batch-extract-prompt.ts
function buildBatchExtractPrompt(events, previousObservations) {
  let prompt = "";
  if (previousObservations.length > 0) {
    const lastThree = previousObservations.slice(-3);
    prompt += "<previous_observations>\n";
    for (const obs of lastThree) {
      prompt += `- ${obs.title}: ${obs.content}
`;
    }
    prompt += "</previous_observations>\n\n";
  }
  prompt += "<tool_events>\n";
  for (const event of events) {
    prompt += `[${event.timestamp}] ${event.toolName}: ${event.compressed}
`;
  }
  prompt += "</tool_events>\n\n";
  prompt += `Extract meaningful observations from these tool events.

Remember:
- title (under 50 characters)
- content (under 200 characters)
- Return empty array [] if this batch is low-value
- Avoid duplicating information from previous observations above

Return only a JSON array.`;
  return prompt;
}
function parseBatchExtractResponse(response) {
  try {
    let jsonText = response.trim();
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      let startIndex = 0;
      let endIndex = lines.length;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("```")) {
          startIndex = i + 1;
          break;
        }
      }
      for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].trim().startsWith("```")) {
          endIndex = i;
          break;
        }
      }
      jsonText = lines.slice(startIndex, endIndex).join("\n").trim();
    }
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => {
      return typeof item === "object" && item !== null && typeof item.title === "string" && typeof item.content === "string" && item.title.trim().length > 0 && item.content.trim().length > 0;
    }).map((item) => ({
      title: item.title.trim(),
      content: item.content.trim()
    }));
  } catch (error) {
    return [];
  }
}
async function extractObservationsFromBatch(provider, events, previousObservations) {
  const startTime = Date.now();
  logDebug("extractObservationsFromBatch: starting batch extraction", {
    eventsCount: events.length,
    previousObservationsCount: previousObservations.length
  });
  try {
    const prompt = buildBatchExtractPrompt(events, previousObservations);
    logDebug("extractObservationsFromBatch: built prompt", {
      promptLength: prompt.length
    });
    const result = await provider.complete(prompt, {
      systemPrompt: BATCH_EXTRACT_SYSTEM_PROMPT,
      maxTokens: 2048
    });
    const extracted = parseBatchExtractResponse(result.text);
    const duration = Date.now() - startTime;
    logInfo("extractObservationsFromBatch: successfully extracted observations", {
      extractedCount: extracted.length,
      responseLength: result.text.length,
      duration: `${duration}ms`
    });
    return extracted;
  } catch (error) {
    const duration = Date.now() - startTime;
    const promptLength = events.length > 0 ? JSON.stringify(events).length : 0;
    logError("extractObservationsFromBatch: batch extraction failed", error, {
      eventsCount: events.length,
      promptLength,
      duration: `${duration}ms`
    });
    return [];
  }
}
var BATCH_EXTRACT_SYSTEM_PROMPT;
var init_batch_extract_prompt = __esm({
  "src/core/llm/batch-extract-prompt.ts"() {
    "use strict";
    init_logger();
    BATCH_EXTRACT_SYSTEM_PROMPT = `You are an observation extractor that analyzes Claude Code tool events and identifies meaningful insights.

Your task:
1. Analyze the batch of tool events
2. Extract meaningful observations as {title, content} pairs
3. Avoid duplicating information from previous observations
4. Return an empty JSON array if the batch contains only low-value events

Guidelines:
- Title: Keep under 50 characters, descriptive and concise
- Content: Keep under 200 characters, informative but brief
- Focus on: decisions, learnings, bugfixes, features, refactoring, debugging
- Skip: trivial operations, simple file reads, status checks, repetitive tasks
- Return JSON array only, no markdown, no explanations

Response format:
[
  {"title": "Fixed authentication bug", "content": "Resolved JWT token validation in login flow"},
  {"title": "Added test coverage", "content": "Added unit tests for auth module"}
]`;
  }
});

// src/core/embeddings.ts
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
var embeddingPipeline;
var init_embeddings = __esm({
  "src/core/embeddings.ts"() {
    "use strict";
    embeddingPipeline = null;
  }
});

// src/core/observations.v3.ts
async function create(db, title, content, project, sessionId, timestamp) {
  const now = Date.now();
  const obsTimestamp = timestamp ?? now;
  const observation = {
    title,
    content,
    project,
    sessionId,
    timestamp: obsTimestamp,
    createdAt: now
  };
  await initEmbeddings();
  const embeddingText = `${title}
${content}`;
  const embedding = await generateEmbedding(embeddingText);
  return insertObservationV3(db, observation, embedding);
}
var init_observations_v3 = __esm({
  "src/core/observations.v3.ts"() {
    "use strict";
    init_db_v3();
    init_embeddings();
  }
});

// src/hooks/stop.ts
async function handleStop(db, options) {
  const { provider, sessionId, project, batchSize = DEFAULT_BATCH_SIZE } = options;
  const allEvents = getAllPendingEventsV3(db, sessionId);
  if (allEvents.length < MIN_EVENT_THRESHOLD) {
    return;
  }
  const batches = createBatches(allEvents, batchSize);
  const allExtractedObservations = [];
  for (const batch of batches) {
    try {
      const compressedEvents = batch.map((event) => ({
        toolName: event.toolName,
        compressed: event.compressed,
        timestamp: event.timestamp
      }));
      const extracted = await extractObservationsFromBatch(
        provider,
        compressedEvents,
        allExtractedObservations
        // Pass all previous observations for deduplication
      );
      for (const obs of extracted) {
        try {
          await create(
            db,
            obs.title,
            obs.content,
            project,
            sessionId,
            Date.now()
          );
        } catch (error) {
          console.warn(`Failed to store observation: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      allExtractedObservations.push(...extracted);
    } catch (error) {
      console.warn(`Failed to process batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
function createBatches(events, batchSize) {
  const batches = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  return batches;
}
var DEFAULT_BATCH_SIZE, MIN_EVENT_THRESHOLD;
var init_stop = __esm({
  "src/hooks/stop.ts"() {
    "use strict";
    init_batch_extract_prompt();
    init_observations_v3();
    init_db_v3();
    DEFAULT_BATCH_SIZE = 15;
    MIN_EVENT_THRESHOLD = 3;
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
async function countTokens2(apiKey, model, params, singleRequestOptions) {
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
        return countTokens2(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
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
var gemini_provider_exports = {};
__export(gemini_provider_exports, {
  GeminiProvider: () => GeminiProvider
});
var DEFAULT_MODEL, GeminiProvider;
var init_gemini_provider = __esm({
  "src/core/llm/gemini-provider.ts"() {
    "use strict";
    init_dist();
    init_logger();
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
        const startTime = Date.now();
        logInfo("[GeminiProvider] Starting completion", {
          model: this.model,
          promptLength: prompt.length,
          maxTokens: options?.maxTokens
        });
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
          logDebug("[GeminiProvider] Sending request", {
            model: this.model,
            hasSystemPrompt: !!options?.systemPrompt
          });
          const generativeModel = this.client.getGenerativeModel(modelParams);
          const result = await generativeModel.generateContent(prompt);
          const duration = Date.now() - startTime;
          const parsed = this.parseResult(result);
          logInfo("[GeminiProvider] Completion successful", {
            duration,
            inputTokens: parsed.usage.input_tokens,
            outputTokens: parsed.usage.output_tokens,
            responseLength: parsed.text.length
          });
          return parsed;
        } catch (error) {
          const duration = Date.now() - startTime;
          logError("[GeminiProvider] Completion failed", error, {
            model: this.model,
            duration
          });
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

// src/core/llm/zhipu-provider.ts
var zhipu_provider_exports = {};
__export(zhipu_provider_exports, {
  ZhipuAIProvider: () => ZhipuAIProvider
});
import { ZhipuAI } from "zhipuai-sdk-nodejs-v4";
var DEFAULT_MODEL2, ZhipuAIProvider;
var init_zhipu_provider = __esm({
  "src/core/llm/zhipu-provider.ts"() {
    "use strict";
    init_logger();
    DEFAULT_MODEL2 = "glm-4.7";
    ZhipuAIProvider = class {
      client;
      model;
      /**
       * Creates a new ZhipuAIProvider instance.
       *
       * @param apiKey - Zhipu AI API key for authentication
       * @param model - Model name to use (default: glm-4.7)
       * @throws {Error} If API key is not provided
       */
      constructor(apiKey, model = DEFAULT_MODEL2) {
        if (!apiKey) {
          throw new Error("ZhipuAIProvider requires an API key");
        }
        this.client = new ZhipuAI({
          apiKey,
          cacheToken: true
        });
        this.model = model;
      }
      /**
       * Completes a prompt using the Zhipu AI API.
       *
       * @param prompt - The user prompt to complete
       * @param options - Optional configuration for the completion
       * @returns Promise resolving to the completion result with token usage
       * @throws {Error} If the API call fails
       */
      async complete(prompt, options) {
        const startTime = Date.now();
        logInfo("[ZhipuAIProvider] Starting completion", {
          model: this.model,
          promptLength: prompt.length,
          maxTokens: options?.maxTokens
        });
        try {
          const messages = [
            { role: "user", content: prompt }
          ];
          logDebug("[ZhipuAIProvider] Sending request", {
            model: this.model,
            messagesCount: messages.length
          });
          const response = await this.client.createCompletions({
            model: this.model,
            messages,
            stream: false,
            maxTokens: options?.maxTokens
          });
          const duration = Date.now() - startTime;
          const completionsResponse = response;
          const text = completionsResponse.choices?.[0]?.message?.content ?? "";
          const usage = this.extractUsage(completionsResponse);
          logInfo("[ZhipuAIProvider] Completion successful", {
            duration,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            responseLength: text.length
          });
          return { text, usage };
        } catch (error) {
          const duration = Date.now() - startTime;
          logError("[ZhipuAIProvider] Completion failed", error, {
            model: this.model,
            duration
          });
          throw error;
        }
      }
      /**
       * Extracts token usage information from a Zhipu AI API response.
       *
       * @param response - The response object from Zhipu AI
       * @returns Token usage information
       */
      extractUsage(response) {
        const usage = response.usage;
        return {
          input_tokens: usage?.prompt_tokens ?? 0,
          output_tokens: usage?.completion_tokens ?? 0,
          cache_read_input_tokens: void 0,
          cache_creation_input_tokens: void 0
        };
      }
    };
  }
});

// src/core/llm/zai-provider.ts
var zai_provider_exports = {};
__export(zai_provider_exports, {
  ZAIProvider: () => ZAIProvider
});
var DEFAULT_MODEL3, DEFAULT_BASE_URL2, ZAIProvider;
var init_zai_provider = __esm({
  "src/core/llm/zai-provider.ts"() {
    "use strict";
    init_logger();
    DEFAULT_MODEL3 = "glm-4.7";
    DEFAULT_BASE_URL2 = "https://api.z.ai/api/paas/v4";
    ZAIProvider = class {
      apiKey;
      model;
      baseUrl;
      /**
       * Creates a new ZAIProvider instance.
       *
       * @param apiKey - Z.AI API key for authentication
       * @param model - Model name to use (default: glm-4.7)
       * @param baseUrl - Base URL for API (default: https://api.z.ai/api/paas/v4)
       * @throws {Error} If API key is not provided
       */
      constructor(apiKey, model = DEFAULT_MODEL3, baseUrl = DEFAULT_BASE_URL2) {
        if (!apiKey) {
          throw new Error("ZAIProvider requires an API key");
        }
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
      }
      /**
       * Completes a prompt using the Z.AI API.
       *
       * @param prompt - The user prompt to complete
       * @param options - Optional configuration for the completion
       * @returns Promise resolving to the completion result with token usage
       * @throws {Error} If the API call fails
       */
      async complete(prompt, options) {
        const startTime = Date.now();
        logInfo("[ZAIProvider] Starting completion", {
          model: this.model,
          promptLength: prompt.length,
          maxTokens: options?.maxTokens
        });
        try {
          const messages = [];
          if (options?.systemPrompt) {
            messages.push({ role: "system", content: options.systemPrompt });
          }
          messages.push({ role: "user", content: prompt });
          const requestBody = {
            model: this.model,
            messages,
            temperature: 1,
            max_tokens: options?.maxTokens,
            stream: false
          };
          logDebug("[ZAIProvider] Sending request", {
            model: this.model,
            messagesCount: messages.length,
            hasSystemPrompt: !!options?.systemPrompt
          });
          const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "Accept-Language": "en-US,en"
            },
            body: JSON.stringify(requestBody)
          });
          if (!response.ok) {
            let errorData = {};
            try {
              errorData = await response.json();
            } catch {
            }
            const errorMessage = errorData.error?.message || response.statusText;
            throw new Error(`Z.AI API request failed (${response.status}): ${errorMessage}`);
          }
          const data = await response.json();
          const duration = Date.now() - startTime;
          const text = data.choices?.[0]?.message?.content ?? "";
          const usage = this.extractUsage(data);
          logInfo("[ZAIProvider] Completion successful", {
            duration,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            responseLength: text.length
          });
          return { text, usage };
        } catch (error) {
          const duration = Date.now() - startTime;
          logError("[ZAIProvider] Completion failed", error, {
            model: this.model,
            duration
          });
          throw error;
        }
      }
      /**
       * Extracts token usage information from a Z.AI API response.
       *
       * @param response - The response object from Z.AI
       * @returns Token usage information
       */
      extractUsage(response) {
        const usage = response.usage;
        return {
          input_tokens: usage?.prompt_tokens ?? 0,
          output_tokens: usage?.completion_tokens ?? 0,
          // Z.AI doesn't provide cache-related token usage
          cache_read_input_tokens: void 0,
          cache_creation_input_tokens: void 0
        };
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
    if (!config.provider || !config.apiKey) {
      console.warn("Invalid config: missing provider or apiKey field");
      return null;
    }
    if (config.provider !== "gemini" && config.provider !== "zhipu-ai" && config.provider !== "zai") {
      console.warn(`Invalid config: unknown provider "${config.provider}"`);
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
async function createProvider(config) {
  const { provider, apiKey, model } = config;
  if (!apiKey) {
    throw new Error("Provider requires an apiKey");
  }
  const defaultModel = model ?? DEFAULT_MODELS[provider];
  if (provider === "gemini") {
    const { GeminiProvider: GeminiProvider2 } = await Promise.resolve().then(() => (init_gemini_provider(), gemini_provider_exports));
    return new GeminiProvider2(apiKey, defaultModel);
  } else if (provider === "zhipu-ai") {
    const { ZhipuAIProvider: ZhipuAIProvider2 } = await Promise.resolve().then(() => (init_zhipu_provider(), zhipu_provider_exports));
    return new ZhipuAIProvider2(apiKey, defaultModel);
  } else if (provider === "zai") {
    const { ZAIProvider: ZAIProvider2 } = await Promise.resolve().then(() => (init_zai_provider(), zai_provider_exports));
    return new ZAIProvider2(apiKey, defaultModel);
  }
  throw new Error(`Unknown provider: ${provider}`);
}
var DEFAULT_MODELS;
var init_config = __esm({
  "src/core/llm/config.ts"() {
    "use strict";
    DEFAULT_MODELS = {
      gemini: "gemini-2.0-flash",
      "zhipu-ai": "glm-4.7",
      zai: "glm-4.7"
    };
  }
});

// src/cli/observe-cli.ts
var observe_cli_exports = {};
function readStdin2() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function getSessionId() {
  return process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_SESSION || "unknown";
}
function getProject2() {
  return process.env.CLAUDE_PROJECT || process.env.CLAUDE_PROJECT_NAME || "default";
}
async function handleObserve(toolName, result) {
  const db = openDatabase();
  try {
    const sessionId = getSessionId();
    const project = getProject2();
    handlePostToolUse(db, sessionId, project, toolName, result);
  } finally {
    db.close();
  }
}
async function handleSummarize() {
  const db = openDatabase();
  try {
    const sessionId = getSessionId();
    const project = getProject2();
    const config = loadConfig();
    if (!config) {
      console.error("[conversation-memory] No LLM config found, skipping observation extraction");
      return;
    }
    const provider = await createProvider(config);
    await handleStop(db, {
      provider,
      sessionId,
      project
    });
  } finally {
    db.close();
  }
}
async function main2() {
  try {
    const command2 = process.argv[2];
    const shouldSummarize = command2 === "--summarize" || process.argv.includes("--summarize");
    if (shouldSummarize) {
      await handleSummarize();
    } else {
      const stdinData = await readStdin2();
      if (!stdinData.trim()) {
        return;
      }
      const input = JSON.parse(stdinData);
      await handleObserve(input.tool_name, input.result);
    }
  } catch (error) {
    console.error(`[conversation-memory] Error in observe: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(0);
  }
}
var init_observe_cli = __esm({
  "src/cli/observe-cli.ts"() {
    "use strict";
    init_db_v3();
    init_post_tool_use();
    init_stop();
    init_config();
    main2();
  }
});

// src/cli/index-cli.ts
var command = process.argv[2];
if (!command || command === "--help" || command === "-h") {
  console.log(`
Conversation Memory CLI - V3 Architecture (observation-based semantic search)

USAGE:
  conversation-memory <command> [options]

COMMANDS:
  inject              Inject recent context at session start (for SessionStart hook)
  observe             Handle PostToolUse hook - compress and store tool events
  observe --summarize Handle Stop hook - extract observations from pending events
  search              Search observations (MCP tool, not CLI)
  show                Show observation details (MCP tool, not CLI)
  stats               Show observation statistics (MCP tool, not CLI)
  read                Read conversation file (MCP tool, not CLI)

HOOKS:
  The inject and observe commands are used by the hooks system.
  Most functionality is exposed through MCP tools.

ENVIRONMENT VARIABLES:
  CONVERSATION_MEMORY_CONFIG_DIR   Override config directory
  CONVERSATION_MEMORY_DB_PATH      Override database path
  CLAUDE_SESSION_ID                Session ID (set by hooks system)
  CLAUDE_PROJECT                   Project name (set by hooks system)

For more information, visit: https://github.com/wooto/claude-plugins
`);
  process.exit(0);
}
async function main3() {
  switch (command) {
    case "inject":
      await Promise.resolve().then(() => (init_inject_cli(), inject_cli_exports));
      break;
    case "observe":
    case "observe-run":
      await Promise.resolve().then(() => (init_observe_cli(), observe_cli_exports));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run with --help for usage information.");
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
