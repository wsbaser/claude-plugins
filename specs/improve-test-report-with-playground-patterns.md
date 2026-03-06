# Improve test-in-browser HTML Report with Playground Patterns

**Date**: 2026-03-07
**Status**: Draft

---

## Overview

The test-in-browser command's HTML report generation (Phase 6) currently delegates to the generic `frontend-design` skill, producing inconsistent results across runs. This spec defines how to augment the frontend-design delegation with specific, prescriptive patterns borrowed from the `playground` skill — particularly its state management, filtering, interactive controls, and structured rendering — to produce a rich, interactive, and consistent test report.

---

## Requirements

### Functional Requirements

1. The report MUST keep the `frontend-design` skill invocation but augment it with detailed constraints and code patterns (not replace it)
2. The report MUST use a single state object pattern where all filters write to state and all renders read from it, with an `updateAll()` function triggered on every change
3. The report MUST provide filter tabs with live counts: filter by **status** (pass/fail/issue), **severity** (high/medium/low), **source** (browser test / code analysis / DB validation), and **journey name**
4. The report MUST include a live search bar that filters across step descriptions, issue text, file paths, and journey names
5. The report MUST provide 4 stakeholder presets that snap all filters to predefined combinations:
   - **Executive Summary**: dashboard + high-severity issues only
   - **Developer View**: all issues with file paths, line numbers, and code references
   - **QA View**: all steps with inline screenshots, pass/fail status per step
   - **Full Report**: everything shown, no filters applied (default)
6. Each issue card MUST have a "Copy fix prompt" button that generates a self-contained prompt for Claude/AI to fix the bug, including: issue description, file path and line number, screenshot context (described, not embedded), steps to reproduce, and relevant code snippet or error message
7. The "Copy fix prompt" button MUST show brief "Copied!" toast feedback (matching playground's copy pattern)
8. Screenshots MUST be displayed as a thumbnail grid per journey, with click-to-expand into a full-screen lightbox overlay with prev/next navigation between screenshots
9. The report MUST use a light theme by default (white background, dark text) suitable for stakeholder viewing and printing
10. The report MUST remain a single self-contained HTML file with all CSS and JS inline, no external dependencies
11. All screenshots MUST be embedded as base64 data URIs (existing requirement, unchanged)
12. The report MUST update all visible elements instantly on every filter/preset change — no "Apply" button

### Non-Functional Requirements

1. The state object shape and updateAll() pattern MUST be prescribed in the instructions (not left to frontend-design's discretion)
2. The filter and preset logic MUST follow specific code patterns embedded in the instructions
3. The report should load and render smoothly even with 50+ screenshots and 100+ steps

---

## Design Decisions

### Augment frontend-design rather than replace it

**Decision:** Keep the frontend-design skill invocation but provide it with detailed, prescriptive constraints and JS code patterns borrowed from the playground skill.

**Rationale:** Frontend-design handles visual polish and creative layout well. The problem is inconsistency in interactive behavior and architecture, which is solved by prescribing the JS patterns while leaving visual design flexible.

**Alternatives rejected:**
- Replace entirely with inline template — loses frontend-design's visual quality and would bloat test-in-browser.md significantly
- Create a separate reusable report template — over-engineering for a single use case right now

### Prescriptive JS patterns (playground-style)

**Decision:** Embed specific JS architecture patterns in the instructions: state object structure, updateAll() function, render functions for each panel, filter logic code snippets.

**Rationale:** The playground skill achieves consistency across different playgrounds precisely because it prescribes the JS backbone. The same approach will make test reports consistent across runs while still allowing frontend-design to handle CSS and layout creativity.

**Alternatives rejected:**
- Requirements-only (specify what, not how) — led to the current inconsistency problem
- Hybrid approach — half-prescribing creates ambiguity about which parts are flexible

### Per-issue fix prompt (not batch)

**Decision:** Each issue card gets its own "Copy fix prompt" button generating a self-contained prompt to fix that specific bug.

**Rationale:** Users want to fix bugs one at a time in focused Claude sessions. A per-issue prompt provides better context and is more actionable than a batch dump of all issues. The prompt should be a natural-language instruction (matching playground's prompt output philosophy) — not a raw data dump.

**Alternatives rejected:**
- Batch fix prompt — too much context for a single session, issues blur together
- Both per-issue and batch — unnecessary complexity; per-issue covers the use case

### Light theme default

**Decision:** Use a light theme (white background, dark text) as the default.

**Rationale:** Test reports are often shared with stakeholders who expect traditional document styling. Light themes are also better for printing and PDF export.

**Alternatives rejected:**
- Dark theme (playground default) — better for developers but worse for stakeholder sharing
- Auto (system preference) — adds CSS complexity for marginal benefit

### Stakeholder presets

**Decision:** Provide 4 named presets (Executive Summary, Developer View, QA View, Full Report) that snap all filters to predefined combinations.

**Rationale:** Borrowed directly from the playground skill's preset concept. Different people reading the report care about different things — a QA engineer wants every screenshot, an executive wants the severity dashboard, a developer wants file paths and fix prompts.

**Alternatives rejected:**
- Issue-focused presets only — too narrow, misses the stakeholder diversity use case
- No presets — the filter tabs alone require too many clicks to reach common views

### Thumbnail grid + lightbox for screenshots

**Decision:** Display screenshots as small thumbnails in a grid per journey step. Clicking opens a full-screen lightbox overlay with prev/next navigation.

**Rationale:** Reports can have 50+ screenshots. Inline full-size images make the page unwieldy. Thumbnails keep the report scannable while the lightbox provides detail on demand.

**Alternatives rejected:**
- Inline medium-sized screenshots — page becomes very long, hard to scan
- Thumbnail + lightbox + compare mode — side-by-side comparison adds significant complexity without clear benefit (no "expected" screenshots to compare against)

---

## Acceptance Criteria

- [ ] Phase 6 of test-in-browser.md includes prescriptive JS patterns: state object shape, updateAll() function, render functions
- [ ] The state object structure is explicitly defined in the instructions with fields for filters (status, severity, source, journey), search query, and active preset
- [ ] Filter tabs with live counts are specified with code snippets showing the filtering logic
- [ ] 4 stakeholder presets are defined with their exact filter configurations
- [ ] Per-issue "Copy fix prompt" button is specified with the prompt template showing what content to include
- [ ] Screenshot thumbnail grid + lightbox behavior is described with enough detail for consistent implementation
- [ ] The frontend-design skill invocation is preserved but wrapped with the new prescriptive constraints
- [ ] Light theme CSS patterns are specified (can reference playground's CSS structure but with light colors)
- [ ] Live search implementation pattern is included
- [ ] The "Copied!" toast feedback pattern from playground is included

---

## Resolved Questions

- **Fix prompt screenshots**: Embed the full base64 screenshot image data in the fix prompt so Claude can see the visual evidence directly.
- **URL hash presets**: Activating a preset updates `window.location.hash` (e.g., `#preset=developer`). Loading the report with a hash auto-activates that preset, enabling shareable links.
