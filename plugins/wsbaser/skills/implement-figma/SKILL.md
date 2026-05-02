---
name: wsbaser:implement-figma
description: >
  Use this skill to implement, align, or compare frontend components against a Figma design.
  You MUST invoke this skill before doing anything else whenever: the user pastes a figma.com URL,
  mentions a Figma node ID (e.g. "node-id=1425:36733"), says "align with Figma", "match the design",
  "implement from Figma", "compare to Figma", "check against Figma", "Figma shows X", "Figma deviations",
  "make it look like the design", or shares any figma.com link even casually as part of a larger request.
  Do not attempt Figma-related tasks without reading this skill first — it defines the required
  deviation-analysis and user sign-off workflow that must be followed.
---

# Implement from Figma

This skill guides a structured workflow for comparing existing frontend components against a Figma design, producing a deviation plan, getting user sign-off on each change, and implementing only what was accepted.

The goal is precision and intentionality: no accidental changes, no silent deviations, and no surprises — the user decides what gets changed before any code is touched.

## Overview of the Workflow

```
1. Get design context  →  2. Read current code  →  3. List deviations
        ↓
4. User accepts/rejects each deviation
        ↓
5. Write implementation plan  →  6. Implement  →  7. Build & verify
```

---

## Step 1 — Get Figma Design Context

Extract `fileKey` and `nodeId` from the URL:
- `figma.com/design/:fileKey/:name?node-id=:nodeId` → convert `-` to `:` in nodeId

Call `get_design_context` with both parameters. This returns:
- A screenshot of the node
- CSS / layout hints
- Code Connect component mappings (if configured)

If you need to inspect a specific sub-element closely, call `get_screenshot` on its child nodeId.

---

## Step 2 — Read the Current Implementation

Read the relevant component files:
- `.razor` — markup
- `.razor.cs` — code-behind
- `.razor.scss` — styles

Focus on the styles first, since most Figma alignment work lives there. Also read any shared component styles that the current component consumes (e.g., `StatCardComponent.razor.scss` when it's used in the footer).

---

## Step 3 — Systematic Deviation Analysis

Compare Figma against the current implementation and produce a **complete** numbered deviation list. Cover every element inside the target Figma node — nothing is silently skipped.

**The exhaustiveness rule**: If a CSS property exists in Figma but is absent or different in code, it is a deviation. If you choose not to list something because it "probably doesn't matter" or "is out of scope," you are making a decision that belongs to the user, not you. List it and let the user decide.

For each deviation, describe:
- **What Figma shows** (with specific values where possible)
- **What the current code does** (or "not set" if absent)
- **Which file/selector is affected**

### Categories to check — every property, for every element

| Category | What to look for |
|----------|-----------------|
| **Typography** | `font-size`, `font-weight`, `font-style`, `font-family`, `letter-spacing`, `line-height`, `text-align`, `text-decoration`, `text-transform` |
| **Spacing** | `gap`, `padding`, `margin` — check both the container and each individual child |
| **Colors** | Foreground (`color`), background (`background-color`), border color — map Figma tokens to app tokens where possible |
| **Layout** | `display`, `flex-direction`, `align-items`, `justify-content`, `flex-wrap` |
| **Sizing** | Fixed widths/heights, `min-/max-` constraints |
| **Borders** | `border-width`, `border-radius`, `border-color`, `border-style` |
| **Effects** | `box-shadow`, `opacity`, `filter` |
| **Component structure** | Are the right sub-components being used? Missing elements? Extra elements? Incorrect nesting? |

### Handling "out of scope" items

Do **not** silently decide something is out of scope. If a property exists in Figma but you judge it unlikely to apply (e.g., `font-family: SF Pro Display` when the app uses a different font system), still list it as a deviation and mark it with a note like *(likely intentional deviation — app uses different font system)*. The user explicitly signs off or dismisses it.

### Deviation format

```
### D1 — [Short Name]
**Figma**: [value / description]
**Current**: [value / description]
**File**: `path/to/file.scss`, selector `.__element-name`
```

---

## Step 4 — User Sign-Off

Present **every** deviation and ask the user to accept or reject each one **before writing any implementation plan**. Use `AskUserQuestion` calls — never free-form text prompts. There are no exceptions — every item on the list must receive an explicit response.

### Batching rules

Group deviations by category and present each group in one `AskUserQuestion` call (max 4 per call). Categories:
- **Typography** — `font-size`, `font-weight`, `letter-spacing`, `line-height`, `text-align`, `font-family`, `font-style`
- **Spacing** — `padding`, `margin`, `gap`
- **Colors** — foreground, background, border
- **Layout & sizing** — `display`, `flex`, alignment, `width`, `height`, `box-shadow`
- **Component structure** — icons, labels, sub-components, nesting

If a category has more than 4 deviations, split into two consecutive calls.

**Flagged deviations** (marked *likely intentional*, *blast radius*, or *requires backend/contract change*) are always presented in a **separate final call** after all standard deviations are answered. Their question text must lead with the flag so the user understands the risk.

### Question format — standard deviation

```json
{
  "question": "D3 — Footer Padding: Figma shows 8px vertical / 24px horizontal, current has none. Apply this change?",
  "header": "D3 Padding",
  "multiSelect": false,
  "options": [
    { "label": "Apply this change", "description": "Add the Figma-specified values" },
    { "label": "Keep as-is", "description": "Skip — treat as intentional deviation" },
    { "label": "Apply with scope", "description": "Apply only to this component, not shared components" }
  ]
}
```

### Question format — flagged deviation

```json
{
  "question": "D7 — Font Family (⚠️ likely intentional): Figma uses 'SF Pro Display', app uses its own font system. Apply or keep as-is?",
  "header": "D7 Font",
  "multiSelect": false,
  "options": [
    { "label": "Apply this change", "description": "Override font-family to match Figma" },
    { "label": "Keep as-is", "description": "Confirmed intentional — app uses different font system" },
    { "label": "Investigate further", "description": "Discuss before deciding" }
  ]
}
```

After all `AskUserQuestion` calls are complete, compile the full accept/reject map and proceed to Step 5.

**Do not proceed to implementation planning until you have an explicit accept/reject for every item — including the ones you flagged as likely-intentional.**

---

## Step 5 — Write the Implementation Plan

After the user has accepted/rejected all deviations, write a structured plan:

```markdown
## Accepted Changes

### ✅ D1 — [Name]
[What to change, which file, which selector, exact CSS values]

### ✅ D2 — [Name]
...

## Rejected Changes

### ❌ D3 — [Name]
[Brief reason: "Intentional deviation", or whatever the user said]

## Files to Modify

### 1. `path/to/file.scss`
- Change A
- Change B

### 2. `path/to/other-file.scss`
- Change C
```

Put the plan in plan mode (use `EnterPlanMode`) and present it to the user for confirmation before implementing.

---

## Step 6 — Implement

Apply only the accepted changes. Read each file before editing it (required for Edit tool). Make changes atomically — edit all items for a given file in one pass rather than file-by-file context-switching.

### 7c SCSS rules to follow

- `$root: &;` as the first line inside every block
- No hardcoded hex colors — always `themed()` inside `@include Themeify()`
- State modifiers: `--is-` prefix, lowercase
- Enum modifiers: PascalCase values
- Never repeat the block class name — use `&` and `$root`
- BEM single-definition rule: each element class appears once

### Letter-spacing values from Figma

Figma reports letter-spacing in percent or pixels. Common Figma values and their CSS equivalents:
- `-1%` of 15px font → `-0.15px`
- `-1%` of 14px font → `-0.1504px` (Figma rounds, use the Figma-reported value)

---

## Step 7 — Build and Verify

After implementing, run the SASS build:

```bash
npm run pb web:ci
```

A clean exit (exit code 0) with no error output confirms no SCSS compilation errors.

For visual verification, open the app and compare the affected component against the Figma screenshot you retrieved in Step 1.

---

## Tips & Common Pitfalls

**Never decide "this is out of scope" unilaterally.** The user decides scope, not you. If a property exists in Figma — even something like `font-family`, `text-align`, or `font-style` that seems obviously fine as-is — list it anyway. Mark it *(likely intentional)* if it probably won't be changed, but still present it. Silent omissions have caused real bugs.

**Don't invent deviations.** If you're unsure whether a difference is real or a rendering artifact, mark it as *(uncertain)* and ask rather than guessing.

**Shared components affect multiple places.** When a shared component like `StatCardComponent` is used across several pages, changing its styles is a wider-impact change. Flag this when presenting the deviation so the user can weigh the blast radius.

**Typography properties that are commonly missed:**
- `letter-spacing` and `line-height` — often omitted from code but specified in Figma
- `text-align` — easy to overlook since it doesn't affect element size
- `font-style` (normal vs italic) — usually fine but should be confirmed
- `font-family` — almost always an intentional deviation in the app's design system, but still list it

**Don't change rejected items.** Even if they look "clearly wrong," the user's rejection is intentional.

**Padding deviations can be intentional.** Container padding is often tuned per-context. When in doubt, list it and let the user decide.
