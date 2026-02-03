---
name: create-pr
description: This skill should be used when the user asks to "create PR", "commit and push", "push to remote", mentions being "ready to merge", or wants to submit changes for review. Handles complete git workflow with conflict detection, protected branch checks, and merge-ready verification.
---

# Create PR

Complete git workflow: commit → push → PR → verify merge-ready.

**Core principle:** Verify before every transition. Smart defaults, no unnecessary options.

**Announce at start:** "Using the create-pr skill to handle the complete git workflow."

## Red Flags - STOP

Stop if you:
- **On main/master branch** - MUST create feature branch first, NO EXCEPTIONS
- **No changes to commit** - Inform user working tree is clean
- **Don't know which base branch to use** - Detect via `gh repo view`
- Skipped conflict check before push
- Said "push will catch conflicts" or "push will detect it"
- Used `git add` without first running `git status`
- Created PR but didn't check status afterward
- Stopped at PR creation without verifying merge-ready
- Said "GitHub will notify" or "CI will catch it"
- Said "just pushed so base hasn't changed"
- Said "I detected the issue but..." (detection without blocking)
- Said "user requested it" to bypass protected branch check
- Said "time pressure" or "user is urgent/exhausted" to skip verification

**All of these mean: Follow complete workflow.**

## Quick Reference

| Step | Command | Notes |
|------|---------|-------|
| Status | `git status && git log --oneline -5` | Always first |
| Add | `git add path/to/file` | Specific files only |
| Commit | `git commit -m "type: description"` | Conventional commits |
| Base branch | `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` | Never assume |
| Conflict check | `git fetch origin <base> && git merge-tree $(git merge-base HEAD origin/<base>) HEAD origin/<base>` | Exit 0 = clean |
| Push | `git push -u origin HEAD` | After conflict check |
| Create PR | `gh pr create --base <base> --title "..." --body "..."` | Always `--base` |
| PR status | `gh pr view --json mergeable,mergeStateStatus` | CLEAN/BEHIND/DIRTY |
| Update branch | `git merge origin/<base> --no-edit && git push` | When BEHIND |

## Workflow

For detailed step-by-step workflow with all phases (Pre-flight Checks, Commit, Pre-push Verification, Push, Create PR, Verify Merge-Ready), see **`references/workflow.md`**.

Quick workflow overview:
1. **Pre-flight**: Check status, verify changes, protect main/master
2. **Commit**: Stage specific files, create conventional commit
3. **Pre-push**: Detect base branch, check for conflicts
4. **Push**: Push to remote with verification
5. **Create PR**: Generate body/title, create with explicit `--base`
6. **Verify**: Check PR status, handle BEHIND/DIRTY/CLEAN

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "No changes to commit" | Working tree is clean | Wait for user direction - don't proceed |
| "Cannot create PR from main" | On protected branch | `git checkout -b feature/name` |
| "Cannot determine base branch" | No default branch detected | Specify with `gh repo view` |
| "Pre-commit hook failed" | Linting errors | Auto-fix then retry commit |
| "Push failed: no remote" | Missing origin | `git remote add origin <url>` |
| "Conflicts detected" | Changes conflict with base | `git merge origin/<base>` then resolve |
| "PR status: BEHIND" | Base branch updated | Auto-merged and re-pushed |
| "PR status: DIRTY" | Conflicts after PR creation | Manual resolution required |
| "gh: command not found" | GitHub CLI not installed | Install: `brew install gh` |
| "gh: authentication failed" | Not logged in | `gh auth login` |

## Common Mistakes

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| Proceeding with no changes | Wastes user time | Check git status first, inform user |
| Omit `--base` flag | PR goes to wrong branch | Always specify explicitly |
| `git add -A` blindly | Adds unintended files | Run `git status` first |
| Skip conflict check | Breaks remote build | Always check before push |
| Assume base = main | Repos use different names | Verify via `gh repo view` |
| Stop after PR creation | May not be merge-ready | Check status, handle BEHIND |
| Proceed from main | Violates workflow | Block with error |
| Ignore pre-commit failures | Blocks workflow unnecessarily | Auto-fix then retry |

## Rationalizations to Reject

| Rationalization | Reality |
|-----------------|---------|
| "Push will catch conflicts" | Conflicts break remote for entire team. Check takes 5 seconds. |
| "CI will catch it" | PR creation ≠ merge-ready. Always verify status. |
| "GitHub will notify" | You create it, you verify it. No assumptions. |
| "Time pressure = skip verification" | Fast ≠ wrong. Parallel execution = both fast AND correct. Overhead: <10 seconds. Cost of skipping: hours. |
| "I detected the issue" | Detection without blocking = failure. If you see a problem, STOP. |
| "User requested it" (for protected branch) | Protected branch rules exist for a reason. Block anyway. |
| "User is exhausted/urgent" | Fatigue increases mistake risk. Extra vigilance required, not less. |

## Integration

**Called by:**
- User explicitly: `/create-pr` command
- After completing implementation work
- When ready to submit changes for review

**Pairs with:**
- **verification-before-completion** - REQUIRED before starting this workflow
- **finishing-a-development-branch** - REQUIRED for cleanup after PR merged

## Additional Resources

### Reference Files

For detailed step-by-step workflow, consult:
- **`references/workflow.md`** - Complete workflow with all 6 phases

## Notes

- No optional flags except those explicitly documented
- Smart defaults handle 95% of cases
- Clear errors guide remaining 5%
- Every transition has verification
- Main/master protection is non-negotiable
