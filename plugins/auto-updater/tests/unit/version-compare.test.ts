import { parseSemver, compareVersions, versionLessThan } from '../../src/hooks/lib/version-compare';

describe('parseSemver', () => {
  it('기본 semver를 파싱한다', () => {
    const result = parseSemver('1.2.3');
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: '',
    });
  });

  it('v 접두사가 있는 semver를 파싱한다', () => {
    const result = parseSemver('v1.2.3');
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: '',
    });
  });

  it('prerelease가 있는 semver를 파싱한다', () => {
    const result = parseSemver('1.2.3-alpha.1');
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: 'alpha.1',
    });
  });

  it('잘못된 형식의 semver에 대해 에러를 던진다', () => {
    expect(() => parseSemver('invalid')).toThrow();
    expect(() => parseSemver('1.2')).toThrow();
  });
});

describe('compareVersions', () => {
  it('major 버전을 비교한다', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('minor 버전을 비교한다', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });

  it('patch 버전을 비교한다', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });

  it('prerelease 버전을 비교한다', () => {
    // Prerelease < release
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);

    // Lexicographic prerelease comparison
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBeLessThan(0);
  });
});

describe('versionLessThan', () => {
  it('v1이 v2보다 작은 경우 true를 반환한다', () => {
    expect(versionLessThan('1.0.0', '2.0.0')).toBe(true);
    expect(versionLessThan('1.0.0', '1.1.0')).toBe(true);
    expect(versionLessThan('1.0.0', '1.0.1')).toBe(true);
    expect(versionLessThan('1.0.0-alpha', '1.0.0')).toBe(true);
  });

  it('v1이 v2보다 크거나 같은 경우 false를 반환한다', () => {
    expect(versionLessThan('2.0.0', '1.0.0')).toBe(false);
    expect(versionLessThan('1.1.0', '1.0.0')).toBe(false);
    expect(versionLessThan('1.0.1', '1.0.0')).toBe(false);
    expect(versionLessThan('1.0.0', '1.0.0')).toBe(false);
    expect(versionLessThan('1.0.0', '1.0.0-alpha')).toBe(false);
  });
});
