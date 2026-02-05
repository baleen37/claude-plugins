---
name: handoff
description: Save current session context to a handoff file for later restoration
argument-hint: ""
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh)"]
---

# Save Handoff

Analyze the conversation and extract:

- A brief summary (2-3 sentences) of what was being worked on
- Next steps (JSON array of actionable items)
- Key decisions made (JSON array of decisions)

Then execute the handoff script with the generated information:

```!
SUMMARY="..." \
NEXT_STEPS='[...]' \
DECISIONS='[...]' \
"${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh" "$SUMMARY" "$NEXT_STEPS" "$DECISIONS"
```
