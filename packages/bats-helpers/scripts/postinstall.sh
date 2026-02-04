#!/usr/bin/env bash
# Postinstall script to set up BATS library path
# Creates symlinks so BATS can find bats_helper via load @baleen/bats-helpers/bats_helper

set -euo pipefail

# Get the package root directory
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# BATS library location: node_modules/.cache/@baleen/bats-helpers/{name}
BATS_LIB_DIR="${PWD}/node_modules/.cache/@baleen/bats-helpers"

# Create cache directory
mkdir -p "$BATS_LIB_DIR"

# Create symlink directory structure: @baleen/bats-helpers/bats_helper.bash
ln -sf "${PACKAGE_ROOT}/src/bats_helper.bash" "${BATS_LIB_DIR}/bats_helper.bash"

# Also create a bats_helper subdirectory for cleaner load path
mkdir -p "${BATS_LIB_DIR}/bats_helper"
ln -sf "${PACKAGE_ROOT}/src/bats_helper.bash" "${BATS_LIB_DIR}/bats_helper/load.bash"
