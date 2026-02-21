---
description: Extract session learnings to CLAUDE.md files for future Claude sessions
allowed-tools: Read, Edit, Glob, Grep, Write
---

Extract non-obvious learnings from this session to CLAUDE.md files, building codebase understanding for future Claude sessions.

## Step 1: Identify Discoveries

Review the session for learnings that would have helped Claude work more effectively. Focus on **non-obvious** discoveries:

**Practical Learnings**
- Commands that worked (or didn't) for build/test/deploy
- Environment setup quirks or configuration requirements
- Testing approaches and patterns specific to this codebase
- Tool-specific workarounds (linters, formatters, CI)

**Architectural Learnings**
- Hidden interdependencies between modules/files
- Execution paths that diverge from what the code suggests
- Misleading error messages and their actual causes
- Files that require coordinated changes
- Undocumented constraints or architectural decisions

**What to EXCLUDE** (keeps files lean):
- Facts already in documentation
- Standard language/framework behavior
- Obvious patterns (e.g., "run tests with `npm test`" when package.json shows it)
- Session-specific details unlikely to recur
- Duplicate content already in a CLAUDE.md file

## Step 2: Determine Scope for Each Learning

CLAUDE.md files cascade — a file in a parent directory is loaded when working in child directories. Place each learning at the most specific level where it applies:

```
repo/
├── CLAUDE.md                    # Project-wide: build commands, global conventions
├── .claude.local.md             # Personal notes (gitignored)
├── backend/
│   ├── CLAUDE.md                # Backend-specific: API patterns, DB conventions
│   └── auth/
│       └── CLAUDE.md            # Auth module: security constraints, token handling
└── frontend/
    ├── CLAUDE.md                # Frontend-specific: component patterns, state management
    └── tests/
        └── CLAUDE.md            # Testing: E2E patterns, test data setup
```

**Decision flow for each learning:**

1. **Where is this relevant?**
   - Whole project → root `CLAUDE.md`
   - Specific module/package → that directory's `CLAUDE.md`
   - Single feature area → feature directory's `CLAUDE.md`

2. **Team or personal?**
   - Team-shared (useful for anyone) → `CLAUDE.md` (checked into git)
   - Personal/local-only (your env, preferences) → `.claude.local.md` (gitignored)

## Step 3: Find Existing CLAUDE.md Files

```bash
find . -name "CLAUDE.md" -o -name ".claude.local.md" 2>/dev/null | head -30
```

Review existing files at the relevant levels to avoid duplicates and understand current content structure.

## Step 4: Draft Additions

**Keep entries to 1-3 lines max.** CLAUDE.md is part of the prompt — brevity matters.

Good entries are:
- Self-contained (no context needed)
- Actionable or informative
- Specific to this codebase (not generic advice)

Examples:
```markdown
# Good - specific, actionable
`dotnet test --filter "Category=Unit"` - runs only unit tests, excludes slow integration tests

# Good - non-obvious interdependency
Changes to `UserService` require updating both `AuthController` and `SessionMiddleware`

# Good - misleading error explained
"Connection refused" on startup usually means Redis isn't running, not the DB

# Bad - obvious/documented
Run `npm install` to install dependencies

# Bad - standard behavior
Use async/await for asynchronous operations
```

## Step 5: Show Proposed Changes

For each file to update or create:

```
### Update: ./backend/CLAUDE.md

**Why:** [one-line reason this helps future sessions]

```diff
+ [the addition - 1-3 lines max]
```
```

If creating a new file:
```
### Create: ./backend/auth/CLAUDE.md

**Why:** Auth module has unique constraints not documented elsewhere

```markdown
# Auth Module

[initial content]
```
```

## Step 6: Apply with Approval

Ask if the user wants to apply each change. Only edit files they approve.

For new files, ensure the directory exists and use appropriate structure:
- Start with `# [Section Name]` heading if it's a new file
- Add to existing sections if updating
- Keep related items grouped

---

**Remember:** The goal is building institutional knowledge that helps Claude (and developers) navigate the codebase. Every line added is prompt space consumed — make it count.
