---
name: wsbaser:design-explorer
description: >
  Generates 10 parallel creative design proposals for any UI element, panel,
  page, or component, then assembles them into an interactive HTML playground for
  comparison and customisation. Use proactively whenever the user wants to
  redesign or improve a UI element, explore design alternatives, brainstorm how
  something could look, needs fresh visual ideas, or asks "what could we do with
  X". Also trigger when the user shares a screenshot or describes an existing UI
  and wants options — even if they don't say "brainstorm" or "playground"
  explicitly. If there is even a 30% chance the user wants design variety for a
  UI element, invoke this skill.
---

# Design Explorer

Generates 10 parallel creative design proposals for a UI element via specialised
subagents, then synthesises the results into a self-contained interactive
playground HTML file.

---

## Phase 1 — Understand the Target

Extract from the user's request:

| Field | What to find |
|---|---|
| **Element** | What UI component (banner, modal, empty-state, 404, onboarding card…) |
| **Trigger context** | When does the user encounter it? What emotional state are they in? |
| **Goal** | What action should follow? (retry, wait, sign up, explore…) |
| **Constraints** | Existing palette, framework (Tailwind / Radix / custom), brand hints |

If any of these is unclear, ask **one** focused question. Do not ask multiple
questions — guess the rest and proceed.

---

## Phase 2 — Brainstorm 10 Themes

Generate 10 distinct creative themes. Use this diversity matrix so the set is
emotionally and aesthetically varied:

| Axis | Spread across the 10 |
|---|---|
| Emotional register | cozy·warm, playful·fun, calm·zen, energetic, melancholy·bittersweet |
| Aesthetic school | minimalist, kawaii, retro/pixel, editorial/serif, organic/illustrated, retrofuturist |
| Character/mascot | robot/AI, animal, nature metaphor, food/object, abstract geometry, human sprite |
| Cultural register | video-game, space/sci-fi, magic/fantasy, ocean/nature, city/urban, domestic/cosy |

**Rule:** no two themes share the same aesthetic AND the same metaphor. If you
feel stuck, invert a constraint (e.g., if 4 themes already use dark backgrounds,
make the 5th light).

Name each theme clearly: `Sleepy Robot`, `Coffee Break`, `Retro Arcade` — the
name becomes the identifier throughout.

---

## Phase 3 — Dispatch 10 Parallel Agents

Spawn all 10 as background `general-purpose` subagents **in a single message**
so they run concurrently. Each agent invokes the `frontend-design` skill.

Template for each agent prompt:

```
Use the `frontend-design` skill to generate a complete design proposal for
[ELEMENT DESCRIPTION].

Target context: [1-sentence description of when/why the user sees this element]
Goal: [what should happen after they see it]

Your assigned creative theme: **[THEME NAME]** — [2-sentence personality +
visual identity description].

Return a structured design proposal with ALL of these sections:

1. SVG Illustration
   - What to draw (key shapes, composition)
   - CSS @keyframes animation names, targets, keyframe values, durations, and
     timing functions (write these out fully — they will be implemented)

2. Color Palette
   - 6–8 hex values with named roles (background, surface, accent, text, muted,
     button-fill, button-text, border)

3. Typography
   - Headline font (name + source)
   - Body font
   - Timer/monospace font
   - Size scale (headline, body, timer label, timer value, button)

4. Copy
   - Headline (≤ 8 words)
   - Body text (1–2 sentences)
   - Timer label (≤ 4 words)
   - CTA button label (≤ 4 words)

5. Layout
   - Horizontal (illustration left, text right) or vertical (illustration top)?
   - Approximate widths / heights

6. Micro-interactions
   - Button hover, active, disabled states
   - Panel entrance animation
   - Any other interactive details

Return ONLY the structured proposal. No code.
```

While agents run, proceed to Phase 4.

---

## Phase 4 — Prepare the Playground Shell (while agents run)

**Invoke the `playground` skill via the Skill tool first** to load its canonical
patterns (state management, prompt output format, control types, dark theme
defaults). Then apply the design-explorer-specific structure below. This keeps
the playground stack composable — improvements to the `playground` skill flow
through automatically.

The playground is a single self-contained HTML file with:

```
+------------------+---------------------------+
| Controls (280px) | iframe srcdoc preview     |
|                  |                           |
| • Theme grid     |  Live banner render       |
| • Layout         |                           |
| • Colors         +---------------------------+
| • Typography     | Prompt output + Copy btn  |
+------------------+---------------------------+
```

### Critical architecture rules

1. **Render inside `<iframe srcdoc="...">`** — never set `innerHTML` with
   user-controlled strings. This avoids XSS security hooks.
2. **Single state object** drives both preview and prompt:
   ```javascript
   const S = { theme: 'first', layout: 'auto', width: 520, accent: null, ... };
   function update() {
     document.getElementById('preview-frame').srcdoc = buildPreviewHTML();
     document.getElementById('prompt-out').textContent  = buildPrompt();
   }
   ```
3. **Every control calls `update()` immediately** — no Apply button.
4. **Color pickers seed from theme defaults** and write to `S.accent`/`S.bg`/
   `S.textColor` (null = use theme default). A Reset button restores nulls.

### Controls to include

| Control | Type |
|---|---|
| Theme | 2-col card grid with emoji + name |
| Layout | Dropdown: Auto / Horizontal / Vertical |
| Width | Range 320–700px |
| Illustration size | Dropdown: Small / Medium / Large / Hidden |
| Accent / Background / Text | Color pickers + Reset button |
| Headline font | Dropdown: Theme default / System sans / Serif / Mono |
| Text scale | Range 80–130% |
| Button shape | Dropdown: Pill / Rounded / Square |
| Button style | Dropdown: Filled / Outline / Ghost |
| Animation speed | Dropdown: Fast / Normal / Slow / Off |
| Show timer | Toggle |
| Show CTA button | Toggle |
| Custom headline | Text input (blank = theme default) |
| Timer display value | Text input (e.g. `02:47:13`) |

### Prompt output pattern

Produce natural language, not a value dump. Only mention non-default settings:

> "Design the [element] using the **[Theme]** theme. Settings: vertical layout,
> 480px wide, outline button. Palette: accent #5CF4E4, bg #090B18. SVG
> animations: astronaut float, satellite charge arc, star twinkle."

---

## Phase 5 — Collect Results & Implement SVG Renderers

As each agent completes, extract:
- Its **SVG shapes + animations** → implement as a JS function
- Its **color palette** → add to THEMES array
- Its **copy + layout preference**

### SVG renderer pattern

```javascript
function drawThemeName(accentColor, animSpeed) {
  const d = n => animSpeed > 0 ? `${n * animSpeed}s` : '9999s';
  return `<svg width="..." viewBox="...">
    <style>
      .el { animation: name ${d(2)} ease-in-out infinite }
      @keyframes name { 0% { ... } 100% { ... } }
    </style>
    <!-- shapes -->
  </svg>`;
}
```

Speed 0 → duration `9999s` (effectively paused). Multiply all durations by
`animSpeed` so the slider works uniformly.

### THEMES array entry per theme

```javascript
{
  id: 'theme-id',
  name: 'Theme Name',
  emoji: '🤖',
  bg: '#hex', surface: '#hex', accent: '#hex',
  text: '#hex', muted: '#hex', btnText: '#hex',
  headline: '...', body: '...', timerLabel: '...', btnLabel: '...',
  fontH: 'FontName, fallback',
  fontB: 'FontName, fallback',
  layout: 'h',   // 'h' or 'v'
  svgKey: 'themeId'
}
```

---

## Phase 6 — Deduplicate

Before writing the file: if two themes feel nearly identical (same aesthetic +
same metaphor), replace the weaker one with a theme that fills the largest gap
in the diversity matrix.

---

## Phase 7 — Write & Open

Write to `specs/[element-slug]-design-playground.html` in the project root.
Open in browser immediately after writing.

Tell the user:
- Click theme cards to switch
- Adjust controls to customise
- **Copy Prompt** button generates an implementation spec ready to paste back

---

## Worked Example (from reference session)

**Input:** "We need a panel shown when the user hits usage limits — friendly,
cute, animated SVG, reset timer, retry button."

**10 themes generated:** Sleepy Robot 🤖, Coffee Break ☕, Space Refuel 🚀,
Retro Arcade 🕹️, Garden Regrowth 🌱, Kawaii ✨, Beach Break 🦀, Magic Cooldown 🧙,
Cat Napping 😺, Minimal Zen ⚡

**Playground controls:** theme grid, layout, width 320–700px, accent/bg/text
color overrides, font, text scale, button shape/style, animation speed,
show/hide timer + button, custom headline, timer value.

**Output:** `specs/quota-banner-design-playground.html` — interactive, opens in
browser, Copy Prompt button generates implementation spec.
