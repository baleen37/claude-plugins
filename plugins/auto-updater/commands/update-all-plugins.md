---
name: update-all-plugins
description: Manually install or update all plugins from marketplace
invocableByUser: true
---

You are about to run a manual plugin update for all marketplace plugins.

Execute the update-all-plugins script and report the results to the user.

**Steps:**

1. Run the update script:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/update.sh"
   ```

2. The script will:
   - Download the latest marketplace.json from GitHub
   - Get list of all plugins from marketplace (baleen-plugins)
   - Install or update each plugin using `claude plugin install <plugin>@<marketplace>`
   - Report success/failure for each plugin

3. Report to the user:
   - How many plugins were successfully installed/updated
   - Which plugins failed (if any)
   - Any errors that occurred

Note: This command ignores any previous update interval checks and runs immediately.
