import { SemVer } from '../../types';

// Parse semver string into components
export function parseSemver(version: string): SemVer {
  // Remove 'v' prefix if present
  let cleanVersion = version;
  if (cleanVersion.startsWith('v')) {
    cleanVersion = cleanVersion.slice(1);
  }

  // Extract major.minor.patch and prerelease
  const semverRegex = /^(\d+\.\d+\.\d+)(?:-(.+))?$/;
  const match = cleanVersion.match(semverRegex);

  if (!match) {
    throw new Error(`Invalid semver format: ${version}`);
  }

  const [, baseVersion, prerelease = ''] = match;
  const [majorStr, minorStr, patchStr] = baseVersion.split('.');

  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
    prerelease,
  };
}

// Compare prerelease versions
// Returns: negative if pre1 < pre2, 0 if equal, positive if pre1 > pre2
function comparePrerelease(pre1: string, pre2: string): number {
  // No prerelease (release) > prerelease
  if (!pre1 && pre2) {
    return 1; // pre1 > pre2
  }
  if (pre1 && !pre2) {
    return -1; // pre1 < pre2
  }
  if (!pre1 && !pre2) {
    return 0; // Equal
  }

  // Both have prerelease: compare lexicographically
  if (pre1 < pre2) {
    return -1;
  }
  if (pre1 > pre2) {
    return 1;
  }
  return 0;
}

// Compare two versions
// Returns: negative if v1 < v2, 0 if equal, positive if v1 > v2
export function compareVersions(v1: string, v2: string): number {
  const semver1 = parseSemver(v1);
  const semver2 = parseSemver(v2);

  // Compare major version
  if (semver1.major !== semver2.major) {
    return semver1.major - semver2.major;
  }

  // Compare minor version
  if (semver1.minor !== semver2.minor) {
    return semver1.minor - semver2.minor;
  }

  // Compare patch version
  if (semver1.patch !== semver2.patch) {
    return semver1.patch - semver2.patch;
  }

  // Compare prerelease
  return comparePrerelease(semver1.prerelease, semver2.prerelease);
}

// Check if v1 is less than v2
export function versionLessThan(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) < 0;
}
