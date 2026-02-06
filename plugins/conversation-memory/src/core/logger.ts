import fs from 'fs';
import path from 'path';
import { getLogFilePath } from './paths.js';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
}

/**
 * Format log entry as single line
 */
function formatLogEntry(entry: LogEntry): string {
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `[${entry.timestamp}] [${entry.level}] ${entry.message}${dataStr}`;
}

/**
 * Write log entry to file
 */
function writeLog(entry: LogEntry): void {
  const logPath = getLogFilePath();
  const line = formatLogEntry(entry) + '\n';

  fs.appendFileSync(logPath, line, 'utf-8');
}

/**
 * Log info message
 */
export function logInfo(message: string, data?: Record<string, any>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message,
    data
  };
  writeLog(entry);
  console.log(`[INFO] ${message}`);
}

/**
 * Log warning message
 */
export function logWarn(message: string, data?: Record<string, any>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.WARN,
    message,
    data
  };
  writeLog(entry);
  console.warn(`[WARN] ${message}`);
}

/**
 * Log error message
 *
 * NOTE: Only writes to file, does NOT output to stderr to avoid leaking into LLM context
 */
export function logError(message: string, error?: Error | unknown, data?: Record<string, any>): void {
  const errorData = error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack
  } : error;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    message,
    data: data ? { ...data, error: errorData } : { error: errorData }
  };
  writeLog(entry);
  // NO console.error - errors are logged to file only to avoid leaking into LLM context
}

/**
 * Log debug message (only when CONVERSATION_MEMORY_DEBUG is set)
 */
export function logDebug(message: string, data?: Record<string, any>): void {
  if (process.env.CONVERSATION_MEMORY_DEBUG !== 'true') {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.DEBUG,
    message,
    data
  };
  writeLog(entry);
  console.log(`[DEBUG] ${message}`, data);
}
