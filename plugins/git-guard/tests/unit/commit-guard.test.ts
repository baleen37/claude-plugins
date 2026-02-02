import { validateGitCommand, extractCommandFromJson } from '../../src/hooks/commit-guard';

describe('commit-guard', () => {
  beforeEach(() => {
    // Mock console.error to suppress output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateGitCommand', () => {
    it('should allow non-git commands', () => {
      expect(validateGitCommand('ls -la')).toBe(0);
      expect(validateGitCommand('npm test')).toBe(0);
    });

    it('should allow safe git commands', () => {
      expect(validateGitCommand('git status')).toBe(0);
      expect(validateGitCommand('git log')).toBe(0);
      expect(validateGitCommand('git commit -m "test"')).toBe(0);
      expect(validateGitCommand('git config user.name "Test User"')).toBe(0);
    });

    it('should block git commit with --no-verify', () => {
      expect(validateGitCommand('git commit --no-verify -m "test"')).toBe(2);
    });

    it('should block git commit with --no-verify and --amend', () => {
      expect(validateGitCommand('git commit --amend --no-verify')).toBe(2);
    });

    it('should block commands with skip-hooks pattern', () => {
      expect(validateGitCommand('git commit --skip-hooks')).toBe(2);
    });

    it('should block commands with --no-commit-hook', () => {
      expect(validateGitCommand('git commit --no-commit-hook -m "test"')).toBe(2);
    });

    it('should block commands with --no-.*hook pattern', () => {
      expect(validateGitCommand('git commit --no-hooks')).toBe(2);
    });

    it('should block HUSKY=0 bypass', () => {
      expect(validateGitCommand('HUSKY=0 git commit -m "test"')).toBe(2);
    });

    it('should block SKIP_HOOKS bypass', () => {
      expect(validateGitCommand('SKIP_HOOKS=1 git commit -m "test"')).toBe(2);
    });

    it('should block git update-ref', () => {
      expect(validateGitCommand('git update-ref HEAD')).toBe(2);
      expect(validateGitCommand('git update-ref HEAD <old-sha> <new-sha>')).toBe(2);
    });

    it('should block git filter-branch', () => {
      expect(validateGitCommand('git filter-branch --tree-filter')).toBe(2);
      expect(validateGitCommand('git filter-branch --force --index-filter ...')).toBe(2);
    });

    it('should block core.hooksPath modification', () => {
      expect(validateGitCommand('git config core.hooksPath /dev/null')).toBe(2);
    });
  });

  describe('extractCommandFromJson', () => {
    it('should extract command from valid JSON', () => {
      const input = JSON.stringify({ command: 'git status' });
      expect(extractCommandFromJson(input)).toBe('git status');
    });

    it('should extract command from JSON with escaped quotes', () => {
      const input = '{"tool":"Bash","command":"git commit -m \\"test message\\" --no-verify"}';
      expect(extractCommandFromJson(input)).toBe('git commit -m "test message" --no-verify');
    });

    it('should return empty string for JSON without command', () => {
      const input = JSON.stringify({ tool_name: 'Bash' });
      expect(extractCommandFromJson(input)).toBe('');
    });

    it('should return empty string for invalid JSON', () => {
      expect(extractCommandFromJson('not json')).toBe('');
    });
  });
});
