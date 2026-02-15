#!/usr/bin/env bats
# Test suite for SKILL.md content validation (writing-skills compliance)

load '../helpers/bats_helper'

setup() {
  export SKILL_MD="${BATS_TEST_DIRNAME}/../../skills/create-pr/SKILL.md"

  if [[ ! -f "$SKILL_MD" ]]; then
    skip "SKILL.md not found"
  fi
}

@test "SKILL.md exists" {
  [ -f "$SKILL_MD" ]
}

@test "SKILL.md has required sections" {
  grep -q "^## Overview" "$SKILL_MD"
  grep -q "^## When to Use" "$SKILL_MD"
  grep -q "^## Red Flags" "$SKILL_MD"
}

@test "SKILL.md has Iron Law principle" {
  grep -qi "violating.*letter.*violating.*spirit" "$SKILL_MD"
}
