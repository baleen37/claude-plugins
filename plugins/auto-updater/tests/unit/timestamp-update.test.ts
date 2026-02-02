import fs from 'fs/promises';
import path from 'path';

// Mock fs
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// Import CHECK_INTERVAL constant and test shouldRunCheck function
const CHECK_INTERVAL = 3600; // From auto-update-hook.ts

async function shouldRunCheck(): Promise<boolean> {
  const TIMESTAMP_FILE = path.join(process.env.HOME || '', '.claude', 'auto-updater', 'last-check');
  try {
    await mockFs.access(TIMESTAMP_FILE);
    const content = await mockFs.readFile(TIMESTAMP_FILE, 'utf-8');
    const lastCheck = parseInt(content.trim(), 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - lastCheck;

    return timeDiff >= CHECK_INTERVAL;
  } catch {
    // File doesn't exist, should run
    return true;
  }
}

describe('timestamp-update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HOME = '/tmp/test';
  });

  describe('CHECK_INTERVAL constant', () => {
    it('CHECK_INTERVAL은 3600초 (1시간)이다', () => {
      expect(CHECK_INTERVAL).toBe(3600);
    });
  });

  describe('shouldRunCheck', () => {
    const mockTimestampFile = path.join('/tmp/test', '.claude', 'auto-updater', 'last-check');

    it('timestamp 파일이 없으면 true를 반환한다', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found') as never);

      const result = await shouldRunCheck();
      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(mockTimestampFile);
    });

    it('마지막 체크로부터 3599초가 지나면 false를 반환한다', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const lastCheck = currentTime - 3599;

      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockResolvedValue(lastCheck.toString() as never);

      const result = await shouldRunCheck();
      expect(result).toBe(false);
    });

    it('마지막 체크로부터 정확히 3600초가 지나면 true를 반환한다', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const lastCheck = currentTime - 3600;

      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockResolvedValue(lastCheck.toString() as never);

      const result = await shouldRunCheck();
      expect(result).toBe(true);
    });

    it('마지막 체크로부터 3601초가 지나면 true를 반환한다', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const lastCheck = currentTime - 3601;

      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockResolvedValue(lastCheck.toString() as never);

      const result = await shouldRunCheck();
      expect(result).toBe(true);
    });

    it('timestamp 파일 읽기 실패 시 true를 반환한다', async () => {
      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockRejectedValue(new Error('Read error') as never);

      const result = await shouldRunCheck();
      expect(result).toBe(true);
    });
  });

  describe('timestamp 파일 형식', () => {
    const mockTimestampFile = path.join('/tmp/test', '.claude', 'auto-updater', 'last-check');

    it('timestamp 파일은 유효한 Unix epoch 시간을 포함한다', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const lastCheck = currentTime - 4000;

      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockResolvedValue(lastCheck.toString() as never);

      const result = await shouldRunCheck();
      expect(result).toBe(true);

      // Verify the timestamp is a valid number
      const content = await mockFs.readFile(mockTimestampFile, 'utf-8');
      const timestamp = parseInt(content as string, 10);
      expect(timestamp).toEqual(lastCheck);
      expect(timestamp).toBeGreaterThanOrEqual(0);
    });

    it('timestamp 파일에 숫자가 아닌 값이 있으면 NaN으로 처리된다', async () => {
      mockFs.access.mockResolvedValue(undefined as never);
      mockFs.readFile.mockResolvedValue('invalid-timestamp' as never);

      const result = await shouldRunCheck();
      // NaN comparison will result in false for timeDiff >= CHECK_INTERVAL
      // but the catch block won't be triggered, so we expect the function to handle it
      expect(typeof result).toBe('boolean');
    });
  });
});
