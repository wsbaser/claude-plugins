---
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality. Focuses on recently modified code unless instructed otherwise.
---

# Parallel Code Simplification

You are an orchestrator that detects modified components, launches parallel code-simplifier agents to analyze them, and then applies approved changes.

## Phase 1: Detect Modified Components

1. Run `git diff --name-only HEAD` to get all modified files (staged + unstaged)
2. Filter to component files matching these extensions: `.razor`, `.razor.cs`, `.razor.scss`, `.razor.js`, `.razor.ts`
3. Group files by component: files sharing the same base path up to `.razor` in the same directory form one component. For example, `Foo.razor`, `Foo.razor.cs`, and `Foo.razor.scss` are all part of the "Foo" component.
4. Display detected components:

   ```
   ==============================================================
    CODE SIMPLIFICATION: {N} components detected
   ==============================================================
    1. ComponentA (.razor, .razor.cs, .razor.scss)
    2. ComponentB (.razor.cs)
    ...
   ==============================================================
   ```

5. If 0 components found, report "No modified component files found." and stop.

## Phase 2: Launch Parallel Agents

1. Launch one `wsbaser:code-simplifier` agent per component using the Task tool with `subagent_type: "wsbaser:code-simplifier"`
2. **CRITICAL**: All agents MUST be launched in a SINGLE message with MULTIPLE Task tool calls so they run in parallel
3. Each agent's prompt must include:
   - The full paths of all files belonging to that component
   - Instruction: "Read each file listed below and analyze for simplification opportunities. Output a structured markdown report. Do NOT apply any changes."
4. Wait for all agents to complete

## Phase 3: Collect & Present Reports

1. Collect the report from each agent
2. For each component that has findings (skip components with no findings):
   - Present the agent's report to the user
   - Use AskUserQuestion to ask: "Apply simplifications to {ComponentName}?" with options:
     - "Apply" (description: "Apply all proposed simplifications to this component")
     - "Skip" (description: "Skip this component, no changes will be made")
3. If ALL components have no findings, display:
   ```
   All components follow project standards. No simplifications needed.
   ```
   and stop.

## Phase 4: Apply Approved Changes

1. For each approved component, apply the changes from the report using Edit tool calls
2. After all changes are applied, run build verification:
   - `dotnet build` for projects containing modified .cs or .razor files
   - SCSS compilation check if .scss files were changed
3. If the build fails, report the error and attempt to fix it
4. Present final summary:

   ```
   ==============================================================
    CODE SIMPLIFICATION COMPLETE
   ==============================================================
    Components reviewed:  {N}
    Components approved:  {M}
    Components skipped:   {K}
    Build status:         SUCCESS/FAILED
   ==============================================================
   ```
