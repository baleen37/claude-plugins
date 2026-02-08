---
description: "Start Ralph Wiggum loop in current session"
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
hide-from-slash-command-tool: "true"
---

# Ralph Loop Command

<!-- TODO: Update this command to use the new architecture (see Task #7) -->
<!-- The Stop hook mechanism has been removed. This command needs to be rewritten to -->
<!-- use the new bash loop + fresh Claude instance approach. -->

NOTE: This command is currently being refactored. The old Stop hook mechanism has been
removed and will be replaced with a simpler architecture that uses fresh Claude instances
with file-system continuity instead of in-session context accumulation.

Please see the plugin README for current usage instructions.
