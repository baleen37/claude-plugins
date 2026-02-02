import { checkPrecommitInstalled, checkPrecommitConfig } from '../../src/hooks/pre-commit-guard';

describe('pre-commit-guard', () => {
  describe('checkPrecommitInstalled', () => {
    it('should return false when pre-commit is not installed', () => {
      // Mock execSync to throw error
      const originalExecSync = require('child_process').execSync;
      require('child_process').execSync = jest.fn(() => {
        throw new Error('Command not found');
      });

      expect(checkPrecommitInstalled()).toBe(false);

      require('child_process').execSync = originalExecSync;
    });
  });

  describe('checkPrecommitConfig', () => {
    it('should return false when .pre-commit-config.yaml does not exist', () => {
      expect(checkPrecommitConfig()).toBe(false);
    });
  });
});
