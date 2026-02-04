#!/usr/bin/env bash
set -euo pipefail

# Get version from package.json
VERSION=$(jq -r '.version' package.json)

# Update all plugin versions in marketplace.json
jq --arg version "$VERSION" \
  '.plugins = [.plugins[] | .version = $version]' \
  .claude-plugin/marketplace.json > .claude-plugin/marketplace.json.tmp

mv .claude-plugin/marketplace.json.tmp .claude-plugin/marketplace.json

echo "Updated marketplace.json to version $VERSION"
