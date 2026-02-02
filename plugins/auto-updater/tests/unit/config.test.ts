import { loadConfig, getOrgRepoForMarketplace, getPluginsForMarketplace, getMarketplaceFromOrgRepo } from '../../src/hooks/lib/config';
import { Config } from '../../src/types';
import path from 'path';

const TEST_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

describe('config', () => {
  describe('loadConfig', () => {
    beforeEach(() => {
      process.env.CLAUDE_PLUGIN_ROOT = TEST_FIXTURES_DIR;
    });

    it('config.json이 없으면 기본 config를 반환한다', async () => {
      process.env.CLAUDE_PLUGIN_ROOT = '/non/existent/path';
      const config = await loadConfig();
      expect(config).toEqual({ marketplaces: [{ name: 'baleen-plugins' }] });
    });

    it('config.json을 로드한다', async () => {
      const config = await loadConfig();
      expect(config).toHaveProperty('marketplaces');
    });
  });
  describe('getOrgRepoForMarketplace', () => {
    it('baleen-plugins에 대한 org/repo를 반환한다', () => {
      expect(getOrgRepoForMarketplace('baleen-plugins')).toBe('baleen37/claude-plugins');
    });

    it('알 수 없는 marketplace에 대해 빈 문자열을 반환한다', () => {
      expect(getOrgRepoForMarketplace('unknown-marketplace')).toBe('');
    });
  });

  describe('getPluginsForMarketplace', () => {
    const config: Config = {
      marketplaces: [
        { name: 'baleen-plugins', plugins: ['plugin1', 'plugin2'] },
        { name: 'other-marketplace' },
      ],
    };

    it('marketplace에 대한 plugins 목록을 반환한다', () => {
      const plugins = getPluginsForMarketplace(config, 'baleen-plugins');
      expect(plugins).toEqual(['plugin1', 'plugin2']);
    });

    it('plugins가 지정되지 않은 경우 undefined를 반환한다', () => {
      const plugins = getPluginsForMarketplace(config, 'other-marketplace');
      expect(plugins).toBeUndefined();
    });

    it('존재하지 않는 marketplace에 대해 undefined를 반환한다', () => {
      const plugins = getPluginsForMarketplace(config, 'non-existent');
      expect(plugins).toBeUndefined();
    });
  });

  describe('getMarketplaceFromOrgRepo', () => {
    it('baleen37/claude-plugins에 대한 baleen-plugins를 반환한다', () => {
      expect(getMarketplaceFromOrgRepo('baleen37/claude-plugins')).toBe('baleen-plugins');
    });

    it('알 수 없는 org/repo에 대해 입력값을 그대로 반환한다', () => {
      expect(getMarketplaceFromOrgRepo('unknown/org')).toBe('unknown/org');
    });
  });
});
