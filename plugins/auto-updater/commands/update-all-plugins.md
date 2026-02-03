---
name: update-all-plugins
description: Manually install or update all plugins from marketplace
disable-model-invocation: true
allowed-tools: Bash(*)
---

Run the update script to check for plugin updates:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/update.sh"
```

Report the results to the user.
