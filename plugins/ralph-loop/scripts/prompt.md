You are executing iteration {{ITERATION}} of {{MAX}} in a Ralph loop.

## Instructions

1. Read `.ralph/prd.json` to find user stories
2. Read `.ralph/progress.txt` for learnings from previous iterations
3. Find the highest-priority story where `passes` is `false`
4. Implement ONLY that one story
5. Run tests and quality checks (typecheck, lint, test)
6. If checks pass:
   - Commit with message: `feat: [STORY_ID] - Story Title`
   - Update `.ralph/prd.json`: set `passes: true` for this story
   - Append what you learned to `.ralph/progress.txt`
7. If checks fail:
   - Append what went wrong to `.ralph/progress.txt`
   - Do NOT mark the story as passing
8. After processing one story, check if ALL stories have `passes: true`
   - If yes: output exactly `<promise>COMPLETE</promise>`
   - If no: stop (next iteration will pick up the next story)

## Rules

- Implement ONE story per iteration. Do not try to do multiple stories.
- Always run tests before marking a story as passing.
- Never mark a story as passing if tests fail.
- Never delete or skip tests.
- Write useful learnings to progress.txt — the next iteration depends on them.
