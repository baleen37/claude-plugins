import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase } from './db.js';
import {
  getLatestSessionSummary,
  saveSessionSummary,
  processSessionSummary,
  hasSessionSummary,
  getProjectSessionSummaries
} from './session-summary.js';
import type { SessionSummary } from './types.js';

describe('session-summary', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase();
  });

  describe('saveSessionSummary and getLatestSessionSummary', () => {
    it('should save and retrieve session summary', () => {
      const summary: SessionSummary = {
        id: 'summary-1',
        sessionId: 'session-123',
        project: 'test-project',
        request: 'Fix the parser bug',
        investigated: ['Parser code', 'Regex patterns'],
        learned: ['Regex is powerful', 'Parser edge cases'],
        completed: ['Fixed parser', 'Added tests'],
        nextSteps: ['Add more tests', 'Document changes'],
        notes: 'Need to review regex patterns',
        createdAt: Date.now()
      };

      saveSessionSummary(db, summary);

      const retrieved = getLatestSessionSummary(db, 'session-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.request).toBe('Fix the parser bug');
      expect(retrieved?.investigated).toEqual(['Parser code', 'Regex patterns']);
      expect(retrieved?.learned).toEqual(['Regex is powerful', 'Parser edge cases']);
      expect(retrieved?.completed).toEqual(['Fixed parser', 'Added tests']);
      expect(retrieved?.nextSteps).toEqual(['Add more tests', 'Document changes']);
      expect(retrieved?.notes).toBe('Need to review regex patterns');
    });

    it('should return null for non-existent session', () => {
      const summary = getLatestSessionSummary(db, 'non-existent');
      expect(summary).toBeNull();
    });

    it('should replace existing summary for same session', () => {
      const summary1: SessionSummary = {
        id: 'summary-1',
        sessionId: 'session-456',
        project: 'test-project',
        request: 'Initial request',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: 1000
      };

      const summary2: SessionSummary = {
        id: 'summary-2',
        sessionId: 'session-456',
        project: 'test-project',
        request: 'Updated request',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: 2000
      };

      saveSessionSummary(db, summary1);
      saveSessionSummary(db, summary2);

      const retrieved = getLatestSessionSummary(db, 'session-456');
      expect(retrieved?.request).toBe('Updated request');
    });
  });

  describe('processSessionSummary', () => {
    it('should process LLM response and save summary', () => {
      const llmResponse = `
        <session_summary>
          <request>Build feature X</request>
          <investigated><item>Architecture</item><item>Dependencies</item></investigated>
          <learned><item>New framework</item><item>Best practices</item></learned>
          <completed><item>Setup</item><item>Implementation</item></completed>
          <next_steps><item>Testing</item><item>Documentation</item></next_steps>
          <notes>Need to review architecture</notes>
        </session_summary>
      `;

      const summary = processSessionSummary(
        db,
        llmResponse,
        'session-789',
        'myproject'
      );

      expect(summary).toBeDefined();
      expect(summary?.request).toBe('Build feature X');
      expect(summary?.sessionId).toBe('session-789');
      expect(summary?.project).toBe('myproject');
      expect(summary?.investigated).toEqual(['Architecture', 'Dependencies']);
      expect(summary?.learned).toEqual(['New framework', 'Best practices']);
      expect(summary?.completed).toEqual(['Setup', 'Implementation']);
      expect(summary?.nextSteps).toEqual(['Testing', 'Documentation']);
      expect(summary?.notes).toBe('Need to review architecture');

      // Verify it was saved
      const retrieved = getLatestSessionSummary(db, 'session-789');
      expect(retrieved?.request).toBe('Build feature X');
    });

    it('should return null for invalid XML', () => {
      const summary = processSessionSummary(
        db,
        'invalid xml',
        'session-999',
        'myproject'
      );

      expect(summary).toBeNull();
    });
  });

  describe('hasSessionSummary', () => {
    it('should return true when summary exists', () => {
      const summary: SessionSummary = {
        id: 'summary-1',
        sessionId: 'session-with-summary',
        project: 'test-project',
        request: 'Test',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: Date.now()
      };

      saveSessionSummary(db, summary);

      expect(hasSessionSummary(db, 'session-with-summary')).toBe(true);
    });

    it('should return false when summary does not exist', () => {
      expect(hasSessionSummary(db, 'session-without-summary')).toBe(false);
    });
  });

  describe('getProjectSessionSummaries', () => {
    it('should retrieve all summaries for a project', () => {
      const summary1: SessionSummary = {
        id: 'summary-1',
        sessionId: 'session-1',
        project: 'project-a',
        request: 'Request 1',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: 1000
      };

      const summary2: SessionSummary = {
        id: 'summary-2',
        sessionId: 'session-2',
        project: 'project-a',
        request: 'Request 2',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: 2000
      };

      const summary3: SessionSummary = {
        id: 'summary-3',
        sessionId: 'session-3',
        project: 'project-b',
        request: 'Request 3',
        investigated: [],
        learned: [],
        completed: [],
        nextSteps: [],
        notes: '',
        createdAt: 3000
      };

      saveSessionSummary(db, summary1);
      saveSessionSummary(db, summary2);
      saveSessionSummary(db, summary3);

      const projectASummaries = getProjectSessionSummaries(db, 'project-a');
      expect(projectASummaries).toHaveLength(2);
      expect(projectASummaries[0].request).toBe('Request 2'); // Most recent first
      expect(projectASummaries[1].request).toBe('Request 1');

      const projectBSummaries = getProjectSessionSummaries(db, 'project-b');
      expect(projectBSummaries).toHaveLength(1);
      expect(projectBSummaries[0].request).toBe('Request 3');
    });

    it('should return empty array for project with no summaries', () => {
      const summaries = getProjectSessionSummaries(db, 'empty-project');
      expect(summaries).toHaveLength(0);
    });
  });
});
