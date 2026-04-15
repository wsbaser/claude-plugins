---
name: wsbaser:selector-generation
description: Generates, validates, and fixes XCSS selectors for web components and pages. Reads the target markup, applies XCSS selector priority rules, and returns a named list of selectors. Use when writing new element selectors, validating that existing selectors are still correct and optimal, or migrating selectors to a higher-priority type (e.g., aria attributes were added to the markup).
context: fork
argument-hint: "[markup source path(s)] [elements to select OR component file to validate]"
allowed-tools: Glob Grep Read Skill
---

# Selector Generation

Generate, validate, or fix XCSS selectors for web components and pages.

## Your Task

$ARGUMENTS

---

## Step 1: Read the markup

Read the component markup source file(s) — `.razor`, `.tsx`, `.vue`, `.html`, or whichever format the project uses. If no path is provided, use Glob and Grep to locate the relevant source by feature or component name.

---

## Step 2: Get the element list

**Generate mode** — arguments describe elements to select: list every element that needs a selector (interactions: click, fill, select, upload; assertions: visible, hidden, text, value, state).

**Validate/Fix mode** — arguments include an existing component or test file: read its selector definitions and treat each as the element to evaluate.

Consult `references/selector-strategy.md` for priority order and anti-patterns.

---

## Step 3: Run xcss-selectors

Invoke the `wsbaser:xcss-selectors` skill via the Skill tool. Provide the relevant DOM/template excerpt and the element list with purpose notes.

- In **Generate mode**: pass all elements.
- In **Validate/Fix mode**: first check each existing selector for correct XCSS syntax, optimal priority, and uniqueness against the current markup. Pass only the failing ones to xcss-selectors for a corrected selector.

---

## Step 4: Return results

**Generate mode** — one line per element:
```
ElementName: xcss-selector
```
Flag elements where a higher-priority selector becomes available once aria attributes are added.

**Validate/Fix mode** — a table:

| Element | Current selector | Status | Fixed selector |
|---------|-----------------|--------|----------------|
| SubmitButton | `.submit-btn` | ⚠ aria-label available | `[aria-label='Submit']` |
| EmailInput | `#username` | ✓ optimal | — |

Status: **✓ optimal**, **⚠ better selector available**, **✗ invalid syntax**, **✗ not unique**. If all selectors pass, say so.
