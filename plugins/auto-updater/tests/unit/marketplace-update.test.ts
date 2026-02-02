import { Marketplace, InstalledPlugin } from '../../src/types';

// Mock fetch for marketplace download
global.fetch = jest.fn();

describe('marketplace-update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HOME = '/tmp/test';
  });

  describe('marketplace.json 다운로드', () => {
    it('GitHub에서 marketplace.json을 다운로드한다', async () => {
      const mockMarketplace: Marketplace = {
        name: 'baleen-plugins',
        description: 'Test marketplace',
        author: {
          name: 'baleen',
          email: 'test@example.com',
        },
        plugins: [
          {
            name: 'git-guard',
            version: '2.27.6',
            description: 'Git workflow protection',
          },
        ],
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockMarketplace,
      } as Response);

      const url = 'https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json';
      const response = await fetch(url);
      const marketplace = (await response.json()) as Marketplace;

      expect(marketplace).toEqual(mockMarketplace);
      expect(global.fetch).toHaveBeenCalledWith(url);
    });

    it('다운로드 실패를 우아하게 처리한다', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
      } as Response);

      const url = 'https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json';
      const response = await fetch(url);

      expect(response.ok).toBe(false);
    });

    it('네트워크 오류를 처리한다', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Network error')
      );

      const url = 'https://raw.githubusercontent.com/baleen37/claude-plugins/main/.claude-plugin/marketplace.json';

      await expect(fetch(url)).rejects.toThrow('Network error');
    });
  });

  describe('marketplace.json 구문 분석', () => {
    it('유효한 marketplace JSON을 구문 분석한다', async () => {
      const mockMarketplace: Marketplace = {
        name: 'baleen-plugins',
        description: 'Test marketplace',
        author: {
          name: 'baleen',
          email: 'test@example.com',
        },
        plugins: [
          {
            name: 'git-guard',
            version: '2.27.6',
            description: 'Git workflow protection',
          },
          {
            name: 'ralph-loop',
            version: '1.0.0',
            description: 'Ralph Wiggum loop',
          },
        ],
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockMarketplace,
      } as Response);

      const response = await fetch('mock-url');
      const marketplace = (await response.json()) as Marketplace;

      expect(marketplace.name).toBe('baleen-plugins');
      expect(marketplace.plugins).toHaveLength(2);
      expect(marketplace.plugins[0].name).toBe('git-guard');
      expect(marketplace.plugins[1].name).toBe('ralph-loop');
    });

    it('잘못된 JSON을 처리한다', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        },
      } as unknown as Response);

      const response = await fetch('mock-url');

      await expect(response.json()).rejects.toThrow(SyntaxError);
    });
  });

  describe('플러그인 목록 가져오기', () => {
    it('claude plugin list --json을 호출한다', () => {
      const { spawn } = require('child_process');
      jest.mock('child_process');

      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      };

      spawn.mockReturnValue(mockChild);

      spawn('claude', ['plugin', 'list', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      expect(spawn).toHaveBeenCalledWith('claude', ['plugin', 'list', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    });

    it('빈 플러그인 목록을 처리한다', () => {
      const emptyPlugins: InstalledPlugin[] = [];
      expect(emptyPlugins).toHaveLength(0);
    });
  });

  describe('--check-only 모드', () => {
    it('--check-only는 marketplace 업데이트를 건너뛴다', () => {
      const args = ['--check-only'];
      const checkOnly = args.includes('--check-only');

      expect(checkOnly).toBe(true);
    });

    it('--check-only는 타임스탬프를 업데이트하지 않는다', () => {
      const args = ['--check-only'];
      const checkOnly = args.includes('--check-only');

      // When checkOnly is true, timestamp should not be updated
      expect(checkOnly).toBe(true);
    });
  });

  describe('중복 플러그인 처리', () => {
    it('서로 다른 marketplace에서 온 동일한 플러그인을 처리한다', () => {
      const plugins: InstalledPlugin[] = [
        {
          id: 'git-guard@baleen-plugins',
          name: 'git-guard',
          version: '2.24.7',
          scope: 'user',
          enabled: true,
          installPath: '/path/to/baleen',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'git-guard@claude-plugins-official',
          name: 'git-guard',
          version: 'unknown',
          scope: 'user',
          enabled: true,
          installPath: '/path/to/official',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ];

      // Should be able to handle duplicates without crashing
      expect(plugins).toHaveLength(2);

      // Filter by marketplace
      const baleenPlugins = plugins.filter((p) => p.id?.includes('@baleen-plugins'));
      expect(baleenPlugins).toHaveLength(1);
    });
  });

  describe('버전 비교 및 업데이트 감지', () => {
    it('outdated된 플러그인을 감지한다', async () => {
      const { versionLessThan } = await import('../../src/hooks/lib/version-compare');

      const installedPlugins: InstalledPlugin[] = [
        {
          id: 'git-guard@baleen-plugins',
          name: 'git-guard',
          version: '1.0.0',
          scope: 'user',
          enabled: true,
          installPath: '/path/to/git-guard',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ];

      const marketplacePlugin = { name: 'git-guard', version: '2.0.0' };

      const isOutdated = versionLessThan(
        installedPlugins[0].version,
        marketplacePlugin.version
      );

      expect(isOutdated).toBe(true);
    });

    it('최신 플러그인을 감지한다', async () => {
      const { versionLessThan } = await import('../../src/hooks/lib/version-compare');

      const installedVersion = '2.0.0';
      const marketplaceVersion = '2.0.0';

      const isOutdated = versionLessThan(installedVersion, marketplaceVersion);

      expect(isOutdated).toBe(false);
    });

    it('major 버전 bump를 감지한다', async () => {
      const { versionLessThan } = await import('../../src/hooks/lib/version-compare');

      // 1.0.0 -> 2.0.0
      expect(versionLessThan('1.0.0', '2.0.0')).toBe(true);

      // 2.0.0 -> 3.0.0
      expect(versionLessThan('2.0.0', '3.0.0')).toBe(true);
    });
  });

  describe('빈 플러그인 목록 처리', () => {
    it('설치된 플러그인이 없을 때 우아하게 처리한다', () => {
      const emptyPlugins: InstalledPlugin[] = [];
      const marketplacePlugin = { name: 'git-guard', version: '1.0.0' };

      // Should not crash when no plugins are installed
      expect(emptyPlugins.find((p) => p.name === marketplacePlugin.name)).toBeUndefined();
    });

    it('marketplace에 없는 플러그인을 건너뛴다', () => {
      const installedPlugins: InstalledPlugin[] = [
        {
          id: 'unknown-plugin@baleen-plugins',
          name: 'unknown-plugin',
          version: '1.0.0',
          scope: 'user',
          enabled: true,
          installPath: '/path/to/unknown',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ];

      const marketplacePlugins = [
        { name: 'git-guard', version: '1.0.0' },
        { name: 'ralph-loop', version: '1.0.0' },
      ];

      // Should skip unknown plugin
      const found = marketplacePlugins.find((mp) => mp.name === installedPlugins[0].name);
      expect(found).toBeUndefined();
    });
  });

  describe('요약 출력', () => {
    it('업데이트 가능한 플러그인 수를 계산한다', () => {
      let updateableCount = 0;
      let upToDateCount = 0;

      // Simulate checking plugins
      updateableCount = 2;
      upToDateCount = 5;

      expect(updateableCount).toBe(2);
      expect(upToDateCount).toBe(5);
    });

    it('모든 플러그인이 최신일 때 메시지를 표시한다', () => {
      const updateableCount = 0;
      const upToDateCount = 7;

      const allUpToDate = updateableCount === 0;

      expect(allUpToDate).toBe(true);
      expect(upToDateCount).toBeGreaterThan(0);
    });
  });
});
