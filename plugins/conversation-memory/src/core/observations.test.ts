import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase, insertObservation } from './db.js';
import {
  createObservation,
  getObservationsBySession,
  getObservationsByProject,
  getObservationsByType,
  getObservationsByDateRange,
  getCompactObservations,
  validateObservation,
  parseObservation
} from './observations.js';
import type { Observation } from './types.js';

// Mock embedding generation - create a valid 768-dimensional vector
const createMockEmbedding = (): number[] => Array.from({ length: 768 }, () => Math.random() * 2 - 1);

// Mock generateEmbedding to avoid loading the model in tests
vi.mock('./embeddings.js', () => ({
  generateEmbedding: async () => createMockEmbedding()
}));

describe('observations', () => {
  let db: Database.Database;
  let testDbPath: string;

  beforeEach(() => {
    // Use unique database path for each test to avoid UNIQUE constraint issues
    testDbPath = `/tmp/test-observations-${Date.now()}-${Math.random()}.db`;
    process.env.TEST_DB_PATH = testDbPath;
    db = initDatabase();
  });

  afterEach(() => {
    db.close();
    // Clean up test database
    try {
      const fs = require('fs');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createObservation', () => {
    it('should create an observation with embedding', async () => {
      const observation: Observation = {
        id: 'test-obs-1',
        sessionId: 'session-123',
        project: 'test-project',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'bugfix',
        title: 'Fixed parsing bug',
        subtitle: 'Parser handles edge cases',
        narrative: 'Fixed the parser to handle edge cases properly',
        facts: ['Fact 1', 'Fact 2'],
        concepts: ['parsing', 'regex'],
        filesRead: ['src/parser.ts'],
        filesModified: ['src/parser.ts'],
        toolName: 'Edit',
        correlationId: 'correlation-123',
        createdAt: Date.now()
      };

      await createObservation(db, observation);

      const observations = getObservationsBySession(db, 'session-123');
      expect(observations).toHaveLength(1);
      expect(observations[0].title).toBe('Fixed parsing bug');
    });
  });

  describe('getObservationsBySession', () => {
    it('should retrieve observations by session ID', () => {
      const observation: Observation = {
        id: 'test-obs-2',
        sessionId: 'session-456',
        project: 'test-project',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'learning',
        title: 'Learned about embeddings',
        subtitle: 'Embeddings are cool',
        narrative: 'Learned how embeddings work',
        facts: ['Embeddings represent text as vectors'],
        concepts: ['embeddings', 'vectors'],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      insertObservation(db, observation, createMockEmbedding());

      const observations = getObservationsBySession(db, 'session-456');
      expect(observations).toHaveLength(1);
      expect(observations[0].title).toBe('Learned about embeddings');
    });

    it('should return empty array for non-existent session', () => {
      const observations = getObservationsBySession(db, 'non-existent');
      expect(observations).toHaveLength(0);
    });
  });

  describe('getObservationsByProject', () => {
    it('should retrieve observations by project', () => {
      const obs1: Observation = {
        id: 'test-obs-3',
        sessionId: 'session-1',
        project: 'project-a',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'decision',
        title: 'Decision 1',
        subtitle: '',
        narrative: 'Made a decision',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      const obs2: Observation = {
        id: 'test-obs-4',
        sessionId: 'session-2',
        project: 'project-a',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'decision',
        title: 'Decision 2',
        subtitle: '',
        narrative: 'Made another decision',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      insertObservation(db, obs1, createMockEmbedding());
      insertObservation(db, obs2, createMockEmbedding());

      const observations = getObservationsByProject(db, 'project-a');
      expect(observations).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        const obs: Observation = {
          id: `test-obs-${i}`,
          sessionId: `session-${i}`,
          project: 'project-b',
          promptNumber: 1,
          timestamp: Date.now(),
          type: 'general',
          title: `Obs ${i}`,
          subtitle: '',
          narrative: '',
          facts: [],
          concepts: [],
          filesRead: [],
          filesModified: [],
          createdAt: Date.now()
        };
        insertObservation(db, obs, createMockEmbedding());
      }

      const observations = getObservationsByProject(db, 'project-b', 3);
      expect(observations).toHaveLength(3);
    });
  });

  describe('getObservationsByType', () => {
    it('should retrieve observations by type', () => {
      const obs1: Observation = {
        id: 'test-obs-5',
        sessionId: 'session-1',
        project: 'project-c',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'bugfix',
        title: 'Bug 1',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      const obs2: Observation = {
        id: 'test-obs-6',
        sessionId: 'session-2',
        project: 'project-c',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'feature',
        title: 'Feature 1',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      insertObservation(db, obs1, createMockEmbedding());
      insertObservation(db, obs2, createMockEmbedding());

      const bugfixes = getObservationsByType(db, 'bugfix');
      expect(bugfixes).toHaveLength(1);
      expect(bugfixes[0].type).toBe('bugfix');

      const features = getObservationsByType(db, 'feature');
      expect(features).toHaveLength(1);
      expect(features[0].type).toBe('feature');
    });
  });

  describe('getObservationsByDateRange', () => {
    it('should retrieve observations within date range', () => {
      const now = Date.now();
      const hour = 60 * 60 * 1000;

      const oldObs: Observation = {
        id: 'test-obs-old',
        sessionId: 'session-old',
        project: 'project-d',
        promptNumber: 1,
        timestamp: now - (2 * hour),
        type: 'general',
        title: 'Old observation',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: now - (2 * hour)
      };

      const newObs: Observation = {
        id: 'test-obs-new',
        sessionId: 'session-new',
        project: 'project-d',
        promptNumber: 1,
        timestamp: now,
        type: 'general',
        title: 'New observation',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: now
      };

      insertObservation(db, oldObs, createMockEmbedding());
      insertObservation(db, newObs, createMockEmbedding());

      const observations = getObservationsByDateRange(db, now - hour, now + hour);
      expect(observations).toHaveLength(1);
      expect(observations[0].title).toBe('New observation');
    });
  });

  describe('getCompactObservations', () => {
    it('should retrieve compact observations', () => {
      const obs: Observation = {
        id: 'test-obs-compact',
        sessionId: 'session-compact',
        project: 'project-e',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'general',
        title: 'Test',
        subtitle: 'Subtitle',
        narrative: 'Full narrative that should not be included',
        facts: ['Fact 1'],
        concepts: ['Concept 1'],
        filesRead: ['file1.ts'],
        filesModified: ['file2.ts'],
        createdAt: Date.now()
      };

      insertObservation(db, obs, createMockEmbedding());

      const compact = getCompactObservations(db, 'session-compact', undefined, 10);
      expect(compact).toHaveLength(1);
      expect(compact[0].id).toBe('test-obs-compact');
      expect(compact[0].title).toBe('Test');
      expect(compact[0].subtitle).toBe('Subtitle');
      // Narrative should not be present in compact form
      expect('narrative' in compact[0]).toBe(false);
    });
  });

  describe('validateObservation', () => {
    it('should validate valid observation', () => {
      const obs: Observation = {
        id: 'test-id',
        sessionId: 'session-id',
        project: 'project',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'general',
        title: 'Title',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      expect(validateObservation(obs)).toBe(true);
    });

    it('should reject observation without required fields', () => {
      const invalidObs = {
        id: 'test-id',
        // Missing sessionId
        project: 'project',
        promptNumber: 1,
        timestamp: Date.now(),
        type: 'general',
        title: 'Title',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      } as any;

      expect(validateObservation(invalidObs)).toBe(false);
    });

    it('should reject observation with invalid prompt number', () => {
      const obs: Observation = {
        id: 'test-id',
        sessionId: 'session-id',
        project: 'project',
        promptNumber: -1,
        timestamp: Date.now(),
        type: 'general',
        title: 'Title',
        subtitle: '',
        narrative: '',
        facts: [],
        concepts: [],
        filesRead: [],
        filesModified: [],
        createdAt: Date.now()
      };

      expect(validateObservation(obs)).toBe(false);
    });
  });

  describe('parseObservation', () => {
    it('should parse valid observation data', () => {
      const data = {
        id: 'test-id',
        sessionId: 'session-id',
        project: 'project',
        promptNumber: '1',
        timestamp: '1234567890',
        type: 'general',
        title: 'Title',
        subtitle: 'Subtitle',
        narrative: 'Narrative',
        facts: ['fact1', 'fact2'],
        concepts: ['concept1'],
        filesRead: ['file1.ts'],
        filesModified: ['file2.ts'],
        createdAt: '1234567890'
      };

      const observation = parseObservation(data);

      expect(observation).toBeDefined();
      expect(observation?.id).toBe('test-id');
      expect(observation?.promptNumber).toBe(1);
      expect(observation?.timestamp).toBe(1234567890);
      expect(observation?.facts).toEqual(['fact1', 'fact2']);
    });

    it('should handle arrays in JSON strings', () => {
      const data = {
        id: 'test-id',
        sessionId: 'session-id',
        project: 'project',
        promptNumber: '1',
        timestamp: '1234567890',
        type: 'general',
        title: 'Title',
        subtitle: '',
        narrative: '',
        facts: JSON.stringify(['fact1', 'fact2']),
        concepts: JSON.stringify(['concept1']),
        filesRead: [],
        filesModified: [],
        createdAt: '1234567890'
      };

      const observation = parseObservation(data);

      // Should handle stringified arrays
      expect(observation).toBeDefined();
    });

    it('should return null for invalid data', () => {
      const invalidData = {
        id: 'test-id'
        // Missing required fields
      };

      const observation = parseObservation(invalidData);
      expect(observation).toBeNull();
    });
  });
});
