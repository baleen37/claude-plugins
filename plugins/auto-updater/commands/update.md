---
name: update
description: Manually check and update all plugins from marketplace
invocableByUser: true
---

You are about to run a manual plugin update check.

Execute the update checker script and report the results to the user.

**Steps:**

1. Run the update checker script:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/update-checker.sh"
   ```

2. The script will:
   - Download the latest marketplace.json from GitHub
   - Compare installed plugin versions with marketplace versions
   - Apply updates based on the configured policy (patch/minor/major)
   - Update the timestamp file

3. Report to the user:
   - Which plugins were updated (if any)
   - Which plugins have updates available but were blocked by policy
   - Any errors that occurred

4. Show the current update policy:
   ```bash
   cat ~/.claude/auto-updater/config.json
   ```

Note: This command ignores the 6-hour interval check and runs immediately.
