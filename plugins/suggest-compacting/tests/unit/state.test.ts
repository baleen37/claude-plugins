import fs from 'fs/promises';
import path from 'path';
import { isValidSessionId, readState, writeState, incrementState } from '../../src/hooks/lib/state';

const TEST_STATE_DIR = path.join(process.env.HOME || '', '.claude', 'suggest-compacting');

describe('isValidSessionId', () => {
  it('유효한 세션 ID를 허용한다', () => {
    expect(isValidSessionId('abc123')).toBe(true);
    expect(isValidSessionId('session-id_123')).toBe(true);
  });

  it('유효하지 않은 세션 ID를 거부한다', () => {
    expect(isValidSessionId('session id')).toBe(false);
    expect(isValidSessionId('session/id')).toBe(false);
    expect(isValidSessionId('../etc')).toBe(false);
  });
});

describe('상태 관리', () => {
  const testSessionId = 'test-session-123';

  beforeEach(async () => {
    try {
      await fs.unlink(path.join(TEST_STATE_DIR, `tool-count-${testSessionId}.txt`));
    } catch {}
  });

  it('새 세션의 상태를 null로 반환한다', async () => {
    const state = await readState(testSessionId);
    expect(state).toBeNull();
  });

  it('상태를 저장하고 읽을 수 있다', async () => {
    await writeState({ count: 10, sessionId: testSessionId });
    const state = await readState(testSessionId);
    expect(state).toEqual({ count: 10, sessionId: testSessionId });
  });

  it('상태를 증가시킬 수 있다', async () => {
    const state1 = await incrementState(testSessionId);
    expect(state1.count).toBe(1);

    const state2 = await incrementState(testSessionId);
    expect(state2.count).toBe(2);
  });
});
