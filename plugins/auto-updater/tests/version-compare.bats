#!/usr/bin/env bats

setup() {
  load '../scripts/lib/version-compare.sh'
}

@test "version_lt: 1.2.3 < 1.2.4" {
  run version_lt "1.2.3" "1.2.4"
  [ "$status" -eq 0 ]
}

@test "version_lt: 1.2.4 < 1.2.3 returns false" {
  run version_lt "1.2.4" "1.2.3"
  [ "$status" -eq 1 ]
}

@test "version_lt: 1.2.3 < 1.3.0" {
  run version_lt "1.2.3" "1.3.0"
  [ "$status" -eq 0 ]
}

@test "version_lt: 1.2.3 < 2.0.0" {
  run version_lt "1.2.3" "2.0.0"
  [ "$status" -eq 0 ]
}

@test "version_lt: 1.2.3 < 1.2.3 returns false (equal)" {
  run version_lt "1.2.3" "1.2.3"
  [ "$status" -eq 1 ]
}

@test "version_lt: handles versions with v prefix" {
  run version_lt "v1.2.3" "v1.2.4"
  [ "$status" -eq 0 ]
}

# Pre-release version tests
@test "parse_semver: parses pre-release version" {
  run parse_semver "1.0.0-alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1 0 0 alpha" ]
}

@test "parse_semver: parses release version" {
  run parse_semver "1.2.3"
  [ "$status" -eq 0 ]
  [ "$output" = "1 2 3 " ]
}

@test "version_lt: pre-release < release" {
  run version_lt "1.0.0-alpha" "1.0.0"
  [ "$status" -eq 0 ]
}

@test "version_lt: release > pre-release" {
  run version_lt "1.0.0" "1.0.0-alpha"
  [ "$status" -eq 1 ]
}

@test "version_lt: alpha < beta" {
  run version_lt "1.0.0-alpha" "1.0.0-beta"
  [ "$status" -eq 0 ]
}

@test "version_lt: beta < rc" {
  run version_lt "1.0.0-beta" "1.0.0-rc"
  [ "$status" -eq 0 ]
}

@test "version_lt: rc < release" {
  run version_lt "1.0.0-rc" "1.0.0"
  [ "$status" -eq 0 ]
}
