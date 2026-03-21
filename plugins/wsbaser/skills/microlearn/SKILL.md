---
name: microlearn
description: Set up micro-learning lessons in Claude Code sessions — appends a short, contextual lesson at the end of responses. Supports any human language (Tagalog, Dutch, Japanese…) or custom topic (music theory, math, history). Use when the user explicitly asks to add recurring lessons to their sessions, mentions /microlearn, or wants to learn a language or topic as a background habit during coding.
disable-model-invocation: true
---

# Microlearn Setup

Configure a micro-learning system that appends a short, contextual lesson at the end of Claude's responses in this project. The lesson should be concise, tied to the current conversation context, and never interrupt the flow of the technical work.

## Step 1: Parse Arguments

Extract from arguments passed to this skill: the topic/subject to teach, and any frequency preference. Leave either unset if absent.

## Step 2: Collect Missing Info

Use `AskUserQuestion` if the **TOPIC** is missing. Ask what the user wants to learn. If the answer is a broad category, follow up to get the specific topic name.

If **FREQUENCY** was not specified in the arguments, don't ask yet — it will be defaulted intelligently in Step 4 after analyzing the topic.

## Step 3: Classify the Topic

Determine the **learning type**:
- **LANGUAGE** — if the topic is a human language
- **CUSTOM** — any other topic

## Step 4: Analyze the Topic and Choose a Delivery Strategy

Before jumping to interview questions, think creatively about how this specific topic is best learned. Different topics have fundamentally different learning dynamics — don't force them all into the same mold.

Output a brief visible summary to the user — 2 sentences max — explaining your recommended approach. Example: "Here's how I'd integrate [TOPIC] into your sessions: [insight 1]. [insight 2]."

### Available delivery strategies

These are tools in your toolkit — pick the one that fits, or combine them:

**Context-tied** — Lessons react to whatever is happening in the current response. Best when the topic has natural bridges to coding concepts (e.g., language vocabulary from variable names, design patterns mirrored in music theory). No state tracking needed — each lesson is self-contained and memorable because the connection is fresh.

**Structured curriculum** — Lessons follow a predefined syllabus stored in memory, progressing through topics in a logical order. Best when the subject has a natural sequence that builds on itself (e.g., history chronologically, math from foundations to advanced). Uses a memory file to track the syllabus and current position so lessons don't repeat or jump around randomly.

**Hybrid** — Follow a curriculum for the core progression, but tie each lesson to the current context when possible. Good when the topic benefits from both structure and relevance.

### How to choose

**Context-tied is the default.** Most topics work well as self-contained lessons that react to the current conversation. Curriculum adds real overhead (memory file, progress tracking, state management) and should only be used when it's genuinely needed.

Choose **curriculum** only when understanding later material truly depends on earlier material — where jumping ahead would confuse or mislead the learner. The test: "Would lesson #15 be meaningless or wrong without lessons #1–14?" If yes, curriculum. If each lesson stands on its own, context-tied.

Examples where curriculum is justified:
- **History** (events cause later events — WW1 explains WW2)
- **Math with prerequisites** (you can't understand eigenvalues without understanding vectors)
- **Sequential skill-building** where each step literally requires the previous one

Examples where context-tied is better despite seeming "structured":
- **Cooking techniques** — each technique is self-contained, you don't need to know sautéing to understand braising
- **Bird watching** — any bird fact is interesting on its own
- **Logical fallacies** — each fallacy stands alone
- **Wine tasting** — any wine concept is independently valuable
- **Design patterns** — each pattern is self-contained
- **Storytelling techniques** — each technique works independently

**Hybrid** is for the rare case where there's genuine prerequisite ordering AND strong coding bridges. Don't use hybrid as a "safe middle ground" — if the topic doesn't need progression, context-tied is strictly better (simpler, no state, no overhead).

**For LANGUAGE topics:** Context-tied is almost always the right default. No predefined plan needed unless the user specifically wants structured grammar progression.

Store the chosen strategy as `DELIVERY_STRATEGY` (one of: `context-tied`, `curriculum`, `hybrid`).

### Default frequency (only if user didn't specify one)

If the user already provided a frequency, keep it. Otherwise, estimate a smart default based on how much material the topic has. The goal: lessons should last weeks at the user's likely usage rate (heavy users send hundreds of requests per day).

Estimate the topic's **lesson pool** — roughly how many distinct, interesting one-sentence lessons exist for this topic:

- **Vast** (thousands+) — human languages, broad history (all of history), encyclopedic topics → default to `every response`
- **Large** (hundreds) — focused history (WW2, Roman history), deep sciences (organic chemistry, linear algebra), broad arts (art history) → default to `every other response`
- **Medium** (50–150) — focused skill domains (chess openings, jazz improvisation, cooking techniques, astronomy) → default to `every 3 responses`
- **Compact** (under 50) — bounded concept sets (logical fallacies, cognitive biases, design patterns, storytelling techniques) → default to `every 5 responses`

This is a rough guide, not a formula. Use your judgment — the point is that a topic with 30 concepts shouldn't fire every response (exhausted in a day), while a language with 10,000+ words can sustain every response for months.

Store the result as `FREQUENCY`.

## Step 5: Focused Interview

### For LANGUAGE topics — one focused question

Ask with `AskUserQuestion`:

```json
{
  "question": "How would you like your {LANGUAGE} lessons to feel?",
  "options": [
    {
      "label": "Context-tied vocabulary",
      "description": "Translates words that appear in the current response — variable names, UI concepts, domain terms. Most memorable because the word is already in your head."
    },
    {
      "label": "Grammar patterns",
      "description": "One grammar rule per lesson with a short example. Systematic — builds structural understanding over time."
    },
    {
      "label": "Mixed rotation",
      "description": "Rotates through vocabulary, grammar, and pronunciation across responses. Broadest coverage, best for general fluency."
    }
  ]
}
```

Store the answer as `LANGUAGE_STYLE`. It will be used in Step 7 to fill `{STYLE_INSTRUCTION}`.

### For CUSTOM topics — short interview (2–3 questions max)

Ask focused questions to understand what kind of lessons the user wants. Use `AskUserQuestion` with 3 options per question.

One of the questions should present your recommended delivery strategy and let the user confirm or adjust. For example, if you chose `curriculum` for "history of computing," explain why chronological progression makes sense and offer alternatives.

## Step 6: Determine Root Directory

If the current directory is inside a git worktree, use the **main repository root** (not the worktree root) so the setup persists across all worktrees. Set `ROOT_DIR` to that path.

## Step 7: Generate Curriculum (only if DELIVERY_STRATEGY is `curriculum` or `hybrid`)

If the chosen strategy involves a structured curriculum:

1. Generate a syllabus — an ordered list of 15–25 **units** (not individual lessons). Each unit is a theme or era that should be explored across many lessons from different angles. The syllabus should reflect what was discussed in the interview (scope, focus areas, difficulty level).

   Units vary in richness — some themes have dozens of fascinating stories, others have just a handful. That's fine. The goal is to keep the user engaged, not to hit a lesson count. Write unit descriptions that capture the scope of the theme so the model can judge how much material is there.

2. Save it as a memory file at `{MEMORY_DIR}/microlearn-{TOPIC_SLUG}.md` with this structure:

```markdown
---
name: microlearn-{TOPIC_SLUG}
description: Micro-learning curriculum and progress for {TOPIC}
type: project
---

## Curriculum: {TOPIC}

### Current Unit
**Unit 1: [Unit title]** — [description of the theme]
Lessons so far: (none)

### Syllabus
1. [Unit title] — [theme description]
2. [Unit title] — [theme description]
...

### Completed Units
(none yet)
```

3. Add the memory file to `MEMORY.md` index.

Store the memory file path as `CURRICULUM_PATH` for use in the template.

## Step 8: Write to CLAUDE.local.md

Read `$ROOT_DIR/CLAUDE.local.md` if it exists. If a `## Micro` lessons section already exists, replace it; otherwise append.

### Template for LANGUAGE

Use this exact template, substituting `{LANGUAGE}`, `{FREQUENCY_TEXT}` (natural language for the chosen frequency), and `{STYLE_INSTRUCTION}`:

`{STYLE_INSTRUCTION}` resolves based on `LANGUAGE_STYLE`:
- **Context-tied vocabulary** → `Focus on vocabulary — translate words, concepts, or terms that appeared in the current response.`
- **Grammar patterns** → `Focus on grammar — one rule or pattern per lesson with a short example sentence.`
- **Mixed rotation** → `Rotate across vocabulary, grammar, and pronunciation across responses.`

```markdown
## {LANGUAGE} Lesson

Append a short one-line language lesson at the end of {FREQUENCY_TEXT}. {STYLE_INSTRUCTION} Occasional cultural notes are fine but should not dominate. Be creative, specific, and tie the lesson to the context of the current response. Keep it to one concise sentence. Format it as: {LANGUAGE} Lesson: ...
```

### Template for CUSTOM — context-tied strategy

Use when `DELIVERY_STRATEGY` is `context-tied`:

```markdown
## Micro Lessons: {TOPIC}

Append a short {TOPIC} lesson at the end of {FREQUENCY_TEXT}. {CUSTOM_INSTRUCTIONS}

Try to draw a connection between the lesson and what's being discussed in the current response — the best lessons feel surprising and relevant at the same time. Keep it to one concise sentence.

Format: **{TOPIC} Lesson:** [lesson content]
```

### Template for CUSTOM — curriculum or hybrid strategy

Use when `DELIVERY_STRATEGY` is `curriculum` or `hybrid`:

```markdown
## Micro Lessons: {TOPIC}

Append a short {TOPIC} lesson at the end of {FREQUENCY_TEXT}. {CUSTOM_INSTRUCTIONS}

Follow the curriculum in `{CURRICULUM_PATH}`. Before each lesson, read the memory file to find the current unit. Deliver a lesson exploring a different angle or detail within that unit — vary perspectives so the theme is explored deeply, not repeated. After each lesson, briefly note what was covered in "Lessons so far" for the current unit. Move to the next unit when you've run out of genuinely interesting material for the current one — some units are rich and deserve many lessons, others are thinner and that's fine. The goal is to keep the user curious, not to pad thin topics or rush past fascinating ones. When the entire syllabus is finished, ask the user if they want to continue with advanced topics.

{CONTEXT_TIE_INSTRUCTION}Keep it to one concise sentence.

Format: **{TOPIC} Lesson:** [lesson content]
```

For `hybrid`, set `{CONTEXT_TIE_INSTRUCTION}` to: `When possible, tie the lesson to what's being discussed in the current response — but always stay on the next syllabus topic.` For `curriculum`, leave it empty.

### Synthesizing CUSTOM_INSTRUCTIONS

`{CUSTOM_INSTRUCTIONS}` is synthesized from the Step 5 interview answers. Examples of what good synthesis looks like:
- Music theory (context-tied): `Focus on short conceptual explanations — intervals, chord functions, rhythm patterns. Prefer examples that relate to structure or patterns visible in the current code.`
- History (curriculum): `Follow a chronological progression through key events and decisions. Each lesson should build on the previous ones.`
- Math (hybrid): `Explain a concept, theorem, or technique from the chosen area. Follow the curriculum order but prefer topics that connect to algorithms, logic, or patterns in the current code.`

## Step 9: Confirm Setup

Print a completion summary showing the topic, lesson type, frequency, and the path written to. Then generate one sample lesson using the format you just configured.
