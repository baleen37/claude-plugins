import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseV3 } from './db.v3.js';
import {
  create,
  findById,
  findByIds,
  findByProject,
  searchByVector,
  deleteObservation
} from './observations.v3.js';

// Mock embedding generation - create a valid 768-dimensional vector
const createMockEmbedding = (): number[] => Array.from({ length: 768 }, () => Math.random() * 2 - 1);

// Mock generateEmbedding to avoid loading the model in tests
vi.mock('./embeddings.js', () => ({
  generateEmbedding: async () => createMockEmbedding(),
  initEmbeddings: async () => {}
}));

describe('observations.v3', () => {
  let db: Database.Database;
  let testDbPath: string;

  beforeEach(() => {
    // Use in-memory database for tests
    testDbPath = ':memory:';
    process.env.CONVERSATION_MEMORY_DB_PATH = testDbPath;
    db = initDatabaseV3();
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create an observation with embedding and return id', async () => {
      const id = await create(
        db,
        'Test Observation',
        'This is the content of the observation',
        'test-project',
        'session-123',
        Date.now()
      );

      expect(id).toBeGreaterThan(0);

      // Verify the observation was inserted
      const obs = db.prepare('SELECT * FROM observations WHERE id = ?').get(id) as Record<string, unknown>;
      expect(obs).toBeDefined();
      expect(obs.title).toBe('Test Observation');
      expect(obs.content).toBe('This is the content of the observation');
      expect(obs.project).toBe('test-project');
      expect(obs.session_id).toBe('session-123');
    });

    it('should create observation without session_id', async () => {
      const id = await create(
        db,
        'Session-less Observation',
        'Content without session',
        'test-project'
      );

      expect(id).toBeGreaterThan(0);

      const obs = db.prepare('SELECT * FROM observations WHERE id = ?').get(id) as Record<string, unknown>;
      expect(obs).toBeDefined();
      expect(obs.session_id).toBeNull();
    });

    it('should generate and store embedding', async () => {
      const id = await create(
        db,
        'Test',
        'Content',
        'test-project'
      );

      // Check vector table
      const vecStmt = db.prepare('SELECT embedding FROM vec_observations WHERE id = ?');
      const vecResult = vecStmt.get(String(id)) as { embedding: Buffer } | undefined;

      expect(vecResult).toBeDefined();
      expect(Buffer.isBuffer(vecResult!.embedding)).toBe(true);
      expect(vecResult!.embedding.length).toBe(768 * 4); // 768 floats * 4 bytes
    });

    it('should use provided timestamp', async () => {
      const timestamp = 1234567890000;
      const id = await create(
        db,
        'Test',
        'Content',
        'test-project',
        undefined,
        timestamp
      );

      const obs = db.prepare('SELECT timestamp FROM observations WHERE id = ?').get(id) as Record<string, unknown>;
      expect(obs.timestamp).toBe(timestamp);
    });
  });

  describe('findById', () => {
    it('should retrieve observation by id', async () => {
      const id = await create(
        db,
        'Find Me',
        'Find my content',
        'test-project'
      );

      const observation = await findById(db, id);

      expect(observation).toBeDefined();
      expect(observation!.id).toBe(id);
      expect(observation!.title).toBe('Find Me');
      expect(observation!.content).toBe('Find my content');
      expect(observation!.project).toBe('test-project');
    });

    it('should return null for non-existent id', async () => {
      const observation = await findById(db, 99999);
      expect(observation).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should retrieve multiple observations by ids', async () => {
      const now = Date.now();
      const id1 = await create(db, 'Obs 1', 'Content 1', 'test-project', undefined, now - 200);
      await create(db, 'Obs 2', 'Content 2', 'test-project', undefined, now - 100);
      const id3 = await create(db, 'Obs 3', 'Content 3', 'test-project', undefined, now);

      const observations = await findByIds(db, [id1, id3]);

      expect(observations).toHaveLength(2);
      // Results are ordered by timestamp DESC, so id3 (newest timestamp) comes first
      expect(observations[0].title).toBe('Obs 3');
      expect(observations[1].title).toBe('Obs 1');
    });

    it('should return empty array for empty ids', async () => {
      const observations = await findByIds(db, []);
      expect(observations).toHaveLength(0);
    });

    it('should return empty array for non-existent ids', async () => {
      const observations = await findByIds(db, [99998, 99999]);
      expect(observations).toHaveLength(0);
    });
  });

  describe('findByProject', () => {
    it('should retrieve observations by project', async () => {
      await create(db, 'Obs 1', 'Content 1', 'project-a');
      await create(db, 'Obs 2', 'Content 2', 'project-a');
      await create(db, 'Obs 3', 'Content 3', 'project-b');

      const observations = await findByProject(db, 'project-a');

      expect(observations).toHaveLength(2);
      expect(observations[0].project).toBe('project-a');
      expect(observations[1].project).toBe('project-a');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await create(db, `Obs ${i}`, `Content ${i}`, 'project-c');
      }

      const observations = await findByProject(db, 'project-c', 3);

      expect(observations).toHaveLength(3);
    });

    it('should return empty array for non-existent project', async () => {
      const observations = await findByProject(db, 'non-existent');
      expect(observations).toHaveLength(0);
    });

    it('should order by timestamp DESC', async () => {
      const now = Date.now();
      await create(db, 'Old', 'Old content', 'project-d', undefined, now - 1000);
      await create(db, 'New', 'New content', 'project-d', undefined, now);
      await create(db, 'Middle', 'Middle content', 'project-d', undefined, now - 500);

      const observations = await findByProject(db, 'project-d');

      expect(observations[0].title).toBe('New');
      expect(observations[1].title).toBe('Middle');
      expect(observations[2].title).toBe('Old');
    });
  });

  describe('searchByVector', () => {
    it('should perform vector similarity search', async () => {
      // Create observations with similar content
      await create(db, 'TypeScript Best Practices', 'Content about TypeScript patterns', 'test-project');
      await create(db, 'JavaScript Tips', 'Content about JavaScript tricks', 'test-project');
      await create(db, 'Python Tutorial', 'Content about Python basics', 'test-project');

      // Search for TypeScript-related content
      const results = await searchByVector(
        db,
        createMockEmbedding(),
        2,
        'test-project'
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
      // All results should have id, title, content, and similarity
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.title).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should filter by project when specified', async () => {
      await create(db, 'Test 1', 'Content 1', 'project-a');
      await create(db, 'Test 2', 'Content 2', 'project-b');

      const results = await searchByVector(
        db,
        createMockEmbedding(),
        10,
        'project-a'
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.project).toBe('project-a');
      });
    });

    it('should return results from all projects when project not specified', async () => {
      await create(db, 'Test 1', 'Content 1', 'project-a');
      await create(db, 'Test 2', 'Content 2', 'project-b');

      const results = await searchByVector(
        db,
        createMockEmbedding(),
        10
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when no observations exist', async () => {
      const results = await searchByVector(
        db,
        createMockEmbedding(),
        10
      );

      expect(results).toHaveLength(0);
    });

    it('should order by similarity DESC', async () => {
      await create(db, 'Similar 1', 'Similar content here', 'test-project');
      await create(db, 'Similar 2', 'Similar content there', 'test-project');
      await create(db, 'Different', 'Different content', 'test-project');

      const results = await searchByVector(
        db,
        createMockEmbedding(),
        10
      );

      // Results should be ordered by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });
  });

  describe('deleteObservation', () => {
    it('should delete observation by id', async () => {
      const id = await create(db, 'Delete Me', 'Delete my content', 'test-project');

      await deleteObservation(db, id);

      // Check main table
      const obs = db.prepare('SELECT * FROM observations WHERE id = ?').get(id);
      expect(obs).toBeUndefined();

      // Check vector table
      const vec = db.prepare('SELECT * FROM vec_observations WHERE id = ?').get(String(id));
      expect(vec).toBeUndefined();
    });

    it('should handle deleting non-existent id', async () => {
      // Should not throw
      await expect(deleteObservation(db, 99999)).resolves.not.toThrow();
    });
  });
});
