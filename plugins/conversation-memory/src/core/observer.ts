import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initDatabase, getPendingEvents, markEventProcessed, getLastPromptNumber } from './db.js';
import { getObserverPidPath } from './paths.js';
import { createObservation, getObservationsBySession } from './observations.js';
import { processSessionSummary } from './session-summary.js';
import {
  buildInitPrompt,
  buildObservationPrompt,
  buildSummaryPrompt,
  parseObservationResponse,
  isLowValueTool
} from './observation-prompt.js';
import { createProvider, loadConfig } from './llm/config.js';
import type { LLMProvider } from './llm/types.js';
import { Observation } from './types.js';
import crypto from 'crypto';

const POLL_INTERVAL_MS = 1000; // 1 second
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface SessionContext {
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  lastActivity: number;
  promptCount: number;
}

/**
 * Generate a session ID from the current working directory.
 * Uses a hash of the CWD for consistent session identification.
 */
export function generateSessionId(cwd: string): string {
  return crypto.createHash('sha256').update(cwd).digest('hex').substring(0, 16);
}

/**
 * Generate a project name from the current working directory.
 * Uses the directory name as the project identifier.
 */
export function generateProjectName(cwd: string): string {
  return path.basename(cwd);
}

/**
 * Get the current session ID from environment or generate one.
 */
export function getCurrentSessionId(): string {
  // Try to get session ID from environment (set by Claude Code)
  const envSessionId = process.env.CLAUDE_SESSION_ID;
  if (envSessionId) {
    return envSessionId;
  }

  // Fall back to CWD-based session ID
  const cwd = process.cwd();
  return generateSessionId(cwd);
}

/**
 * Get the current project name.
 */
export function getCurrentProject(): string {
  const cwd = process.cwd();
  return generateProjectName(cwd);
}

/**
 * Start the observer process.
 */
export async function startObserver(): Promise<void> {
  const pidPath = getObserverPidPath();

  // Check if observer is already running
  if (fs.existsSync(pidPath)) {
    const existingPid = parseInt(fs.readFileSync(pidPath, 'utf-8'), 10);
    try {
      // Check if process is still running
      process.kill(existingPid, 0);
      console.error(`Observer already running with PID ${existingPid}`);
      process.exit(1);
    } catch (error) {
      // Process is not running, clean up stale PID file
      fs.unlinkSync(pidPath);
    }
  }

  // Write PID file
  fs.writeFileSync(pidPath, process.pid.toString());

  // Initialize database
  const db = initDatabase();

  // Load LLM config
  const config = loadConfig();
  if (!config) {
    console.error('No LLM config found. Please create ~/.config/conversation-memory/config.json');
    process.exit(1);
  }

  const llmProvider = createProvider(config);

  const sessionId = getCurrentSessionId();
  const project = getCurrentProject();

  console.log(`Observer started for session ${sessionId} (${project})`);

  // Track session contexts
  const sessionContexts = new Map<string, SessionContext>();

  // Initialize context for current session
  sessionContexts.set(sessionId, {
    sessionId,
    conversationHistory: [
      { role: 'user', content: buildInitPrompt() }
    ],
    lastActivity: Date.now(),
    promptCount: getLastPromptNumber(db, sessionId)
  });

  // Start polling loop
  const pollInterval = setInterval(async () => {
    try {
      const shouldShutdown = await pollPendingEvents(db, llmProvider, sessionContexts, pollInterval, pidPath);
      if (shouldShutdown) {
        console.log('Shutting down observer after session summary');
      }
    } catch (error) {
      console.error('Error polling events:', error);
    }
  }, POLL_INTERVAL_MS);

  // Cleanup on exit
  process.on('SIGINT', () => shutdownObserver(pollInterval, pidPath, db));
  process.on('SIGTERM', () => shutdownObserver(pollInterval, pidPath, db));

  // Keep process alive
  process.stdin.resume();
}

/**
 * Poll for pending events and process them.
 * Returns true if the observer should shut down (after summarize event).
 */
async function pollPendingEvents(
  db: Database.Database,
  llmProvider: LLMProvider,
  sessionContexts: Map<string, SessionContext>,
  pollInterval: NodeJS.Timeout,
  pidPath: string
): Promise<boolean> {
  const now = Date.now();

  // Check for idle sessions and clean up
  for (const [sessionId, context] of sessionContexts.entries()) {
    if (now - context.lastActivity > IDLE_TIMEOUT_MS) {
      console.log(`Session ${sessionId} idle timeout, removing context`);
      sessionContexts.delete(sessionId);
    }
  }

  // Get pending events for all active sessions
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

/**
 * Process a single pending event.
 * Returns true if the observer should shut down.
 */
async function processEvent(
  db: Database.Database,
  llmProvider: LLMProvider,
  event: any,
  context: SessionContext,
  pollInterval: NodeJS.Timeout,
  pidPath: string
): Promise<boolean> {
  // Skip low-value tools at the code level
  if (event.eventType === 'tool_use' && event.toolName && isLowValueTool(event.toolName)) {
    return false;
  }

  // Get current prompt number
  const promptNumber = context.promptCount + 1;

  if (event.eventType === 'tool_use') {
    await processToolUseEvent(db, llmProvider, event, context, promptNumber);
    context.promptCount = promptNumber;
    return false;
  } else if (event.eventType === 'summarize') {
    await processSummarizeEvent(db, llmProvider, event, context, pollInterval, pidPath);
    return true; // Signal shutdown after summarize
  }

  context.promptCount = promptNumber;
  return false;
}

/**
 * Process a tool use event.
 */
async function processToolUseEvent(
  db: Database.Database,
  llmProvider: LLMProvider,
  event: any,
  context: SessionContext,
  promptNumber: number
): Promise<void> {
  // Build prompt with conversation history
  const previousObservations = getObservationsBySession(db, context.sessionId);
  const previousContext = previousObservations
    .map(obs => `- [${obs.type}] ${obs.title}: ${obs.subtitle}`)
    .join('\n');

  const prompt = buildObservationPrompt(
    event.toolName,
    event.toolInput,
    event.toolResponse || '',
    event.cwd || process.cwd(),
    event.project || '',
    previousContext
  );

  // Add to conversation history
  context.conversationHistory.push({ role: 'user', content: prompt });

  // Call LLM
  const response = await llmProvider.complete(
    context.conversationHistory.map(msg => msg.content).join('\n\n')
  );

  // Add response to history
  context.conversationHistory.push({ role: 'model', content: response.text });

  // Parse response
  const result = parseObservationResponse(response.text);

  if (result.type === 'observation' && result.data) {
    const observation: Observation = {
      ...result.data,
      sessionId: context.sessionId,
      project: event.project || '',
      promptNumber,
      toolName: event.toolName
    };

    createObservation(db, observation);
    console.log(`Created observation: ${observation.title}`);
  }
}

/**
 * Process a summarize event.
 * After generating the summary, the observer should exit.
 */
async function processSummarizeEvent(
  db: Database.Database,
  llmProvider: LLMProvider,
  event: any,
  context: SessionContext,
  pollInterval: NodeJS.Timeout,
  pidPath: string
): Promise<void> {
  // Get previous observations for context
  const previousObservations = getObservationsBySession(db, context.sessionId);
  const sessionContext = previousObservations
    .map(obs => `- [${obs.type}] ${obs.title}: ${obs.narrative}`)
    .join('\n');

  const prompt = buildSummaryPrompt(sessionContext, event.project || '');

  // Call LLM
  const response = await llmProvider.complete(prompt);

  // Process and save summary
  const summary = processSessionSummary(
    db,
    response.text,
    context.sessionId,
    event.project || ''
  );

  if (summary) {
    console.log(`Created session summary for ${context.sessionId}`);
  }

  // Shutdown observer after summary is generated
  shutdownObserver(pollInterval, pidPath, db);
}

/**
 * Shutdown the observer process.
 */
function shutdownObserver(
  pollInterval: NodeJS.Timeout,
  pidPath: string,
  db: Database.Database
): void {
  clearInterval(pollInterval);
  db.close();

  if (fs.existsSync(pidPath)) {
    fs.unlinkSync(pidPath);
  }

  console.log('Observer stopped');
  process.exit(0);
}

/**
 * Stop the observer process.
 */
export function stopObserver(): void {
  const pidPath = getObserverPidPath();

  if (!fs.existsSync(pidPath)) {
    console.error('Observer is not running');
    process.exit(1);
  }

  const pid = parseInt(fs.readFileSync(pidPath, 'utf-8'), 10);

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to observer process (PID ${pid})`);
  } catch (error) {
    console.error(`Failed to stop observer: ${error}`);
    process.exit(1);
  }
}

/**
 * Check observer status.
 */
export function observerStatus(): void {
  const pidPath = getObserverPidPath();

  if (!fs.existsSync(pidPath)) {
    console.log('Observer is not running');
    process.exit(0);
  }

  const pid = parseInt(fs.readFileSync(pidPath, 'utf-8'), 10);

  try {
    process.kill(pid, 0);
    console.log(`Observer is running (PID ${pid})`);
    process.exit(0);
  } catch (error) {
    console.log('Observer PID file exists but process is not running');
    process.exit(1);
  }
}
