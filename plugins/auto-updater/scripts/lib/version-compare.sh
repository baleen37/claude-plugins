#!/usr/bin/env bash

set -euo pipefail

parse_semver() {
  local version="$1"

  # Remove 'v' prefix if present
  version="${version#v}"

  # Extract major.minor.patch and prerelease
  local base_version prerelease
  if [[ "$version" =~ ^([0-9]+\.[0-9]+\.[0-9]+)(-(.+))?$ ]]; then
    base_version="${BASH_REMATCH[1]}"
    prerelease="${BASH_REMATCH[3]:-}"
  else
    echo "Invalid semver format: $version" >&2
    return 1
  fi

  # Parse major.minor.patch
  IFS='.' read -r major minor patch <<< "$base_version"

  # Output: major minor patch prerelease
  echo "$major $minor $patch $prerelease"
}

compare_prerelease() {
  local pre1="$1"
  local pre2="$2"

  # No prerelease (release) > prerelease
  if [ -z "$pre1" ] && [ -n "$pre2" ]; then
    return 1  # v1 > v2
  elif [ -n "$pre1" ] && [ -z "$pre2" ]; then
    return 0  # v1 < v2
  elif [ -z "$pre1" ] && [ -z "$pre2" ]; then
    return 1  # Equal (not less than)
  fi

  # Both have prerelease: compare lexicographically
  if [[ "$pre1" < "$pre2" ]]; then
    return 0  # v1 < v2
  else
    return 1  # v1 >= v2
  fi
}

version_lt() {
  local v1="$1"
  local v2="$2"

  # Parse both versions
  local v1_parts v2_parts
  v1_parts=$(parse_semver "$v1") || return 1
  v2_parts=$(parse_semver "$v2") || return 1

  read -r v1_major v1_minor v1_patch v1_pre <<< "$v1_parts"
  read -r v2_major v2_minor v2_patch v2_pre <<< "$v2_parts"

  # Compare major version
  if [ "$v1_major" -lt "$v2_major" ]; then
    return 0
  elif [ "$v1_major" -gt "$v2_major" ]; then
    return 1
  fi

  # Compare minor version
  if [ "$v1_minor" -lt "$v2_minor" ]; then
    return 0
  elif [ "$v1_minor" -gt "$v2_minor" ]; then
    return 1
  fi

  # Compare patch version
  if [ "$v1_patch" -lt "$v2_patch" ]; then
    return 0
  elif [ "$v1_patch" -gt "$v2_patch" ]; then
    return 1
  fi

  # Compare prerelease
  compare_prerelease "$v1_pre" "$v2_pre"
}
