# Ralph Wiggum Plugin

Implementation of the Ralph Wiggum technique for iterative, self-referential AI development loops in Claude Code.

## What is Ralph?

Ralph is a development methodology based on continuous AI agent loops. As Geoffrey
Huntley describes it: **"Ralph is a Bash loop"** - a simple `while true` that repeatedly
feeds an AI agent a prompt file, allowing it to iteratively improve its work until
completion.

The technique is named after Ralph Wiggum from The Simpsons, embodying the philosophy of persistent iteration despite setbacks.

### Core Concept

This plugin implements Ralph using a **bash loop + fresh instances** approach:

```bash
# You run ONCE:
/ralph-init "Your task description"

# Then:
/ralph-loop

# Behind the scenes, a bash loop runs:
while true; do
  claude --print PROMPT.md
done
```

Each iteration spawns a **fresh Claude instance** that receives the SAME prompt. The "self-referential" aspect comes from Claude seeing its own previous work in the files and git history, not from feeding output back as input.

This creates a **self-referential feedback loop** where:

- The prompt never changes between iterations
- Claude's previous work persists in files
- Each iteration sees modified files and git history
- Claude autonomously improves by reading its own past work in files
- Fresh instances provide clean state each iteration (no session pollution)

## Quick Start

```bash
# 1. Initialize a PRD with user stories
/ralph-init "Build a REST API for todos. Requirements: CRUD operations, input validation, tests."

# 2. Start the loop (default 10 iterations)
/ralph-loop

# Or specify max iterations
/ralph-loop 50

# 3. Monitor progress in another terminal
tail -f .ralph/progress.txt

# 4. Cancel if needed
/cancel-ralph
```

Claude will:

- Implement one user story per iteration
- Run tests and quality checks
- Commit work if tests pass
- Continue until all stories pass or max iterations reached

## Architecture

### The .ralph Directory

Ralph uses a `.ralph/` directory for state management:

```
.ralph/
├── prd.json         # Product Requirements Document with user stories
├── progress.txt     # Progress log with learnings from each iteration
└── ralph.pid        # Process ID of active loop (exists only while running)
```

### PRD Format

The `prd.json` file contains your task broken into user stories:

```json
{
  "project": "my-project",
  "branchName": "ralph/add-todo-api",
  "description": "Build a REST API for todos",
  "userStories": [
    {
      "id": "US-001",
      "title": "Create todo model",
      "description": "As a developer, I want a todo data model so that I can store todos.",
      "acceptanceCriteria": [
        "Todo model with id, title, completed fields",
        "Tests pass",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false
    }
  ]
}
```

### Iteration Workflow

Each iteration follows this pattern:

1. Fresh Claude instance starts
2. Reads `.ralph/prd.json` to find user stories
3. Reads `.ralph/progress.txt` for previous learnings
4. Finds the highest-priority story where `passes` is `false`
5. Implements ONLY that one story
6. Runs tests and quality checks (typecheck, lint, test)
7. If checks pass:
   - Commits with message: `feat: [STORY_ID] - Story Title`
   - Updates `.ralph/prd.json`: sets `passes: true` for this story
   - Appends learnings to `.ralph/progress.txt`
8. If checks fail:
   - Appends what went wrong to `.ralph/progress.txt`
   - Does NOT mark the story as passing
9. Checks if ALL stories have `passes: true`:
   - If yes: outputs `<promise>COMPLETE</promise>` (loop exits)
   - If no: stops (next iteration picks up the next story)

### Prompt Template

The `scripts/prompt.md` template is used for each iteration:

```markdown
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
```

## Commands

### /ralph-init "description"

Initialize a PRD (Product Requirements Document) from a task description.

**Usage:**

```bash
/ralph-init "Build a REST API for todos with CRUD operations, input validation, and tests."
```

**What it does:**

- Analyzes the task description
- Breaks it into user stories (completable in one iteration)
- Creates `.ralph/prd.json` with stories and acceptance criteria
- Creates `.ralph/progress.txt` for tracking
- Reports the story breakdown

**Story guidelines:**

- **Right-sized**: Each story should be completable in one focused session
- **Verifiable**: Include "Tests pass" and "Typecheck passes" in acceptance criteria
- **Independent**: Minimize dependencies between stories
- **Priority order**: Foundational work (DB, types, models) before features, features before UI

### /ralph-loop [max-iterations]

Start the Ralph loop with a bash script.

**Usage:**

```bash
# Default: 10 iterations
/ralph-loop

# Custom max iterations
/ralph-loop 20
```

**What it does:**

- Reads `.ralph/prd.json` for user stories
- Spawns fresh `claude --print` instances in a bash loop
- Each instance implements one story, runs tests, commits if passing
- Loop exits when all stories pass or max iterations reached
- Progress tracked in `.ralph/progress.txt`

**Monitoring progress:**

```bash
tail -f .ralph/progress.txt
```

### /cancel-ralph

Cancel an active Ralph loop.

**Usage:**

```bash
/cancel-ralph
```

**What it does:**

- Checks for `.ralph/ralph.pid` (loop process ID)
- Kills the bash loop process
- Removes PID file
- Reports cancellation

## Prompt Writing Best Practices

### 1. Clear Task Description

❌ Bad: "Build a todo API and make it good."

✅ Good:

```bash
/ralph-init "Build a REST API for todos. Requirements:
- CRUD operations (create, read, update, delete)
- Input validation (title required, max 100 chars)
- Unit tests for all endpoints
- Integration tests
- API documentation
- Type safety with TypeScript
```

### 2. Right-Sized Stories

When `/ralph-init` creates stories, it should break the task into manageable pieces:

❌ Too big: "Build the entire e-commerce platform"

✅ Right-sized:
- US-001: Setup project structure and dependencies
- US-002: Create product data model
- US-003: Implement product list endpoint
- US-004: Add product creation with validation
- US-005: Write tests for product endpoints

### 3. Include Testing Stories

Make testing explicit:

✅ Good breakdown:
- US-001: Create user model
- US-002: Write unit tests for user model
- US-003: Implement user service
- US-004: Write integration tests for user service
- US-005: Create user API endpoints
- US-006: Write API tests for endpoints

### 4. Set Reasonable Iteration Limits

Always use max-iterations as a safety net:

```bash
# Recommended: Estimate based on story count
# 5 stories × 2-3 iterations per story = 10-15 iterations
/ralph-loop 15

# For larger tasks: 10 stories × 3 iterations = 30 iterations
/ralph-loop 30
```

### 5. Verifiable Acceptance Criteria

Each story should have clear pass/fail criteria:

✅ Good acceptance criteria:
- "Todo model with id, title, completed fields defined"
- "POST /todos creates a todo and returns 201"
- "GET /todos returns array of todos"
- "Tests pass (npm test)"
- "Typecheck passes (npm run typecheck)"

## Philosophy

Ralph embodies several key principles:

### 1. Iteration > Perfection

Don't aim for perfect on first try. Let the loop refine the work. Each iteration builds on the previous one, incrementally improving toward the goal.

### 2. Failures Are Data

"Deterministically bad" means failures are predictable and informative. Use them to tune prompts. The `progress.txt` file captures learnings from each failure, informing subsequent iterations.

### 3. Operator Skill Matters

Success depends on writing good task descriptions and story breakdowns, not just having a good model. The quality of your `/ralph-init` prompt determines the quality of the results.

### 4. Persistence Wins

Keep trying until success. The loop handles retry logic automatically. If a story fails tests, the next iteration sees the failure in `progress.txt` and can fix it.

### 5. Fresh State Benefits

The new architecture uses fresh Claude instances for each iteration:

- **Clean state**: No session context accumulation
- **Natural exit**: Each iteration completes independently
- **Better error isolation**: Failures don't pollute subsequent iterations
- **Easier debugging**: Each iteration is a discrete unit of work

## When to Use Ralph

**Good for:**

- Well-defined tasks with clear success criteria
- Tasks requiring iteration and refinement (e.g., getting tests to pass)
- Test-driven development workflows
- Greenfield projects where you can walk away
- Features that can be broken into small stories
- Tasks with automatic verification (tests, linters, typecheck)

**Not good for:**

- Tasks requiring human judgment or design decisions
- One-shot operations
- Tasks with unclear success criteria
- Production debugging (use targeted debugging instead)
- Tasks that need conversation/clarification

## Real-World Results

- Successfully generated 6 repositories overnight in Y Combinator hackathon testing
- One $50k contract completed for $297 in API costs
- Created entire programming language ("cursed") over 3 months using this approach

## Completion Detection

The loop completes when:

1. **All stories pass**: Every user story in `prd.json` has `passes: true`
2. **Completion promise**: Claude outputs `<promise>COMPLETE</promise>`
3. **Max iterations**: The loop reaches the iteration limit (exits with error)

The loop script checks for the completion promise in Claude's output after each iteration. When found, it exits cleanly. If max iterations is reached without completion, the script exits with an error.

## Learn More

- Original technique: <https://ghuntley.com/ralph/>
- Inspiration: <https://github.com/snarktank/ralph>
- Ralph Orchestrator: <https://github.com/mikeyobrien/ralph-orchestrator>

## For Help

Run `/help` in Claude Code for detailed command reference and examples.
