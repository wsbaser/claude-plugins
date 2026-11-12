# Review Skill Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four cooperating skills (`wsbaser:review`, `wsbaser:decide`, `wsbaser:explain` rewritten, `wsbaser:report-design`) that turn a topic into researched decisions on one review page and return the owner's decision list to the calling agent, and switch `wsbaser:interview` to use them.

**Architecture:** A fixed core (flow, one JSON issue record per review, ask rule, one page behaviour script) plus three slot folders of small files (`review/intake/`, `decide/kinds/`, `report-design/forms/`) that are discovered by listing, so new power is added by dropping a file. Skills are prose (`SKILL.md` + references); the mechanical parts are three small tested tools: a record validator, a decision-text parser (Python), and the page script (JavaScript).

**Tech Stack:** Claude Code skills (Markdown), Python 3.14 stdlib (`unittest`, `json`, `re`), Node 22 (`node --test`), plain HTML/CSS/JS for the page, Claude Artifact tool for publishing, `skill-creator` for evaluation.

**Spec:** `docs/superpowers/specs/2026-11-12-review-skill-design.md` (read it before any task). Accepted mockup: `docs/superpowers/specs/2026-11-12-review-skill-design/review-page-mockup.html`.

## Global Constraints

- All skills live in `plugins/wsbaser/skills/<skill>/`. Every `SKILL.md` frontmatter has an explicit `name: wsbaser:<skill>` and a `description` that states what it does and when to trigger.
- Skill names are fixed: `wsbaser:review`, `wsbaser:decide`, `wsbaser:explain`, `wsbaser:report-design`.
- Core files (`SKILL.md` of each skill, `review-page.js`, the validator, the parser) never name a specific issue kind, explanation form or source. Those live only in slot files.
- Every slot file is Markdown starting with frontmatter that has a non-empty one-line `when:` key. File names are kebab-case.
- Project overrides: slot folders may also exist at `.claude/review/intake/`, `.claude/review/kinds/`, `.claude/review/forms/` in the project being worked on; a project file with the same name wins.
- No page templates and no build script. The only fixed page code is `report-design/assets/review-page.js` and `report-design/assets/tokens.css`, pasted into each page unchanged.
- Fonts: Inter (text), JetBrains Mono (code, ids), loaded from `fonts.googleapis.com` with system fallbacks. Tokens exactly as in spec section 9 (light and dark).
- Pages are published with the Artifact tool: inline CSS and JS only, light and dark, body never scrolls sideways.
- Page rules (spec 9.1, 8): one column, every issue fully visible, several solutions are a radio group with the recommended one preselected, one solution is buttons, short content is never folded, a fold label states its size, needs-owner and agent-decided issues share one anatomy.
- `review` always publishes and waits; it settles disputes itself by a new round; it returns only settled decisions.
- Commit messages follow the repo style `feat(<scope>): <summary>` and end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Test commands: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v` and `node --test plugins/wsbaser/skills/report-design/tests/`.

## Review Focus

Failure modes the spec implies but does not spell out; each has a test in the task named.

1. **Pasted decision text arrives damaged** (CRLF, trailing spaces, soft-wrapped lines, only half pasted). Expected: every issue the parser cannot read is reported and treated as undecided; nothing is guessed. Task 2.
2. **Issue titles and notes contain awkward characters** (`"`, `<`, ` - `, `[A]`, line breaks in notes). Expected: the copied text stays parseable because issues are matched by id, never by title. Tasks 2 and 3.
3. **Round 2 republish meets stale saved state** (an issue was removed, or its recommendation changed after the owner confirmed). Expected: state for unknown ids is ignored; a confirmed choice is kept and flagged, not silently replaced. Task 3.
4. **Degenerate reviews** (zero issues, one issue, an issue with no recommendation, an issue with a single solution). Expected: the validator accepts the legal ones, the page shows "0 of 0 decided" without errors, nothing is preselected when there is no recommendation. Tasks 1 and 3.
5. **Broken dependencies** (points at a missing issue, at itself, or forms a cycle; map names an option that does not exist). Expected: the validator rejects the record before a page is built. Task 1.

---

## File map

```
plugins/wsbaser/skills/
  review/
    SKILL.md                       flow: intake, frame, decide, explain, publish, collect, settle, return
    references/record.md           the issue record contract (single source for all four skills)
    references/decision-text.md    exact shape of the Copy decisions text
    intake/azure-devops-pr.md      slot: PR comment threads to issues
    intake/task-ticket.md          slot: ticket or task to open questions
    intake/supplied-issues.md      slot: caller already has the issues (interview)
    scripts/check_record.py        validate a review.json at a stage
    scripts/check_slots.py         validate slot folders
    scripts/parse_decisions.py     pasted text to decisions, merged into review.json
    tests/test_check_record.py
    tests/test_check_slots.py
    tests/test_parse_decisions.py
    tests/fixtures/review-round2.json
    tests/fixtures/decisions-round2.txt
    evals/evals.json
  decide/
    SKILL.md                       triage, effort sizing, research, skill consult, pick, ask rule
    references/ask-rule.md         clear winner / costly to reverse (the tuning point)
    kinds/code-design.md           slot
    kinds/ui-ux.md                 slot
    kinds/product.md               slot
    evals/evals.json
  explain/
    SKILL.md                       rewritten: three modes, form choice, disclosure rule
    references/writing-rules.md    answer first, terms, today first, code with file:line, unknowns
    evals/evals.json               existing evals kept, embedded-mode evals added
  report-design/
    SKILL.md                       what to load when writing any report page
    assets/tokens.css              palette, type scale, light and dark
    assets/review-page.js          fixed behaviour script for decision pages
    assets/example-review-page.html  worked example built on the two assets
    references/components.md       component rules in words
    references/decision-page.md    page anatomy and data attributes the script reads
    forms/prose.md  code.md  diff.md  table.md  fold.md        slot: core forms
    forms/flow.md  timeline.md  worked-numbers.md  now-proposed.md  ui-mockup.md   slot
    tests/review-page.test.js
  interview/SKILL.md               Step 3 replaced
```

---

### Task 1: Branch, record contract, validators

**Files:**
- Create: `plugins/wsbaser/skills/review/references/record.md`
- Create: `plugins/wsbaser/skills/review/scripts/check_record.py`, `plugins/wsbaser/skills/review/scripts/check_slots.py`
- Create: `plugins/wsbaser/skills/review/tests/test_check_record.py`, `plugins/wsbaser/skills/review/tests/test_check_slots.py`, `plugins/wsbaser/skills/review/tests/fixtures/review-round2.json`
- Modify: `.gitignore` (add `.superpowers/`)

**Interfaces:**
- Produces: `check_record.validate(record: dict, stage: str) -> list[str]` (stage is `"intake"`, `"decided"` or `"ready"`; empty list means valid). CLI: `python check_record.py <review.json> --stage ready` prints one error per line, exit 1 on errors.
- Produces: `check_slots.check_folder(path: str) -> list[str]`. CLI: `python check_slots.py <folder> [<folder>...]`.
- Produces: the record shape below, used by every later task.

Record shape (this is the contract; `record.md` documents it field by field with the meaning from spec section 6):

```json
{
  "schema": 1,
  "review": { "id": "pr-2317-log-levels", "title": "PR #2317 \"Normalize log levels\"", "round": 2 },
  "issues": [
    {
      "id": "1",
      "title": "One transport failure is logged as Error in two layers",
      "round": 1,
      "kind": "code design",
      "needsOwner": true,
      "needsOwnerReason": "no clear winner",
      "origin": { "quote": "Why Error here? The transport already logs this.", "author": "reviewer", "where": "SyncSession.cs:142", "verdict": "valid", "verdictReason": "both layers log the same exception at Error" },
      "attributes": [ { "label": "Confidence", "value": "Medium" } ],
      "explanation": [ { "form": "prose", "text": "The same failure is logged at Error in two places." } ],
      "mode": "radio",
      "options": [
        { "id": "A", "label": "Error once in SyncSession, transport logs Debug", "attributes": [], "blocks": [] },
        { "id": "B", "label": "Error once in the transport, SyncSession logs Debug", "attributes": [], "blocks": [] },
        { "id": "C", "label": "Keep both, add a correlation id", "attributes": [], "blocks": [] }
      ],
      "recommendation": { "option": "A", "reason": "SyncSession is the layer that can act on the failure.", "confidence": "medium", "sources": [], "unverified": [] },
      "dependsOn": null,
      "decision": { "by": null, "choice": null, "note": "", "status": "undecided" }
    }
  ]
}
```

Field rules not visible in the sample:
- `mode` is `"radio"` (two or more real options) or `"buttons"` (exactly one real option plus dispute options).
- A dispute option has `"dispute": true` (for example `reject`, `discuss`). An option may have `"outcome"`: short text of what choosing it does, used in the copied text.
- `origin` is `null` when the skill found the issue itself. `verdict` is `"valid"`, `"not-valid"` or `"partly"`.
- `recommendation` is `null` only for a pure preference question, and then `needsOwner` must be `true`.
- `dependsOn` is `null` or `{ "issue": "<parent id>", "map": { "<parent option id>": "<own option id>" }, "note": "<what changes>" }`.
- `decision.by` is `"agent"`, `"owner"` or `null`; `decision.status` is `"decided"`, `"undecided"` or `"disputed"`.
- A block is `{ "form": "<form file name without .md>", ... }`. A fold is `{ "form": "fold", "label": "...", "size": "48 lines", "blocks": [ ... ] }`.

Validation rules by stage:
- `intake`: `schema == 1`; `review.id` matches `^[a-z0-9-]+$`; `review.title` non-empty; `review.round >= 1`; issue ids unique and match `^[A-Za-z0-9-]+$`; titles non-empty and single-line; `1 <= issue.round <= review.round`.
- `decided` adds: `options` non-empty with unique ids; `mode` matches the option count as above; `recommendation.option` names an existing non-dispute option; `recommendation.reason` non-empty; `needsOwner` true requires `needsOwnerReason`; null recommendation requires `needsOwner`; `origin` (when present) has `quote`, a legal `verdict` and `verdictReason`; `dependsOn.issue` exists, is not the issue itself, and the dependency graph has no cycle; every `map` key is a parent option id and every value an own option id; `decision.by == "agent"` requires `decision.choice` to be an existing option id.
- `ready` adds: `explanation` non-empty; every block has `form`; every fold has non-empty `label` and `size`, and the text and code inside it total at least 600 characters (short content is never folded).

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/review-skill-family
```
The untracked `docs/superpowers/` files come along; that is intended.

- [ ] **Step 2: Write the fixture `tests/fixtures/review-round2.json`**

Four issues, schema as above, all fields present:
- `1`: as in the sample, `round` 1, `decision` `{ "by": "owner", "choice": "B", "note": "", "status": "decided" }`.
- `2`: title `Client older than the gateway: Warning or Information?`, `round` 2, `needsOwner` true, reason `costly to reverse`, `mode` radio, options `A` `Information`, `B` `Warning`, `C` `Warning for one release, then Information`, recommendation `A`, `dependsOn` `{ "issue": "1", "map": { "A": "A", "B": "C", "C": "A" }, "note": "If the transport owns the Error, skew must stay visible for one release." }`, decision undecided.
- `3`: title `Request logging crashes when the request has no identity`, `round` 1, `needsOwner` false, `mode` buttons, options `accept` (label `Accept`, outcome `apply the null guard`), `reject` (label `Reject`, dispute), `discuss` (label `Discuss`, dispute), recommendation `accept`, decision `{ "by": "agent", "choice": "accept", "note": "", "status": "decided" }`.
- `4`: title `Retry attempts are logged too loud`, `round` 1, `needsOwner` false, `mode` buttons, options `accept` (label `Accept`, outcome `retry attempts go to Debug`), `reject` (dispute), `discuss` (dispute), recommendation `accept`, decision `{ "by": "owner", "choice": "reject", "note": "Ops still wants these at Warning during the migration", "status": "disputed" }`.

Each issue has one prose block of explanation. `review` is `{ "id": "pr-2317-log-levels", "title": "PR #2317 \"Normalize log levels\"", "round": 2 }`.

- [ ] **Step 3: Write the failing tests**

`tests/test_check_record.py`:

```python
import copy, json, pathlib, sys, unittest
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "scripts"))
from check_record import validate

def load():
    return json.loads((HERE / "fixtures" / "review-round2.json").read_text(encoding="utf-8"))

class CheckRecord(unittest.TestCase):
    def test_fixture_is_valid_at_every_stage(self):
        for stage in ("intake", "decided", "ready"):
            self.assertEqual(validate(load(), stage), [], stage)

    def test_zero_issues_is_valid(self):
        r = load(); r["issues"] = []
        self.assertEqual(validate(r, "ready"), [])

    def test_duplicate_issue_id(self):
        r = load(); r["issues"][1]["id"] = "1"
        self.assertTrue(any("duplicate" in e for e in validate(r, "intake")))

    def test_recommendation_must_name_real_option(self):
        r = load(); r["issues"][0]["recommendation"]["option"] = "Z"
        self.assertTrue(any("issue 1" in e and "recommendation" in e for e in validate(r, "decided")))

    def test_recommending_a_dispute_option_is_rejected(self):
        r = load(); r["issues"][2]["recommendation"]["option"] = "reject"
        self.assertTrue(validate(r, "decided"))

    def test_no_recommendation_needs_owner(self):
        r = load(); r["issues"][0]["recommendation"] = None
        self.assertEqual(validate(r, "decided"), [])
        r["issues"][0]["needsOwner"] = False
        self.assertTrue(validate(r, "decided"))

    def test_buttons_mode_needs_exactly_one_real_option(self):
        r = load(); r["issues"][2]["options"][1].pop("dispute")
        self.assertTrue(any("buttons" in e for e in validate(r, "decided")))

    def test_dependency_on_missing_issue(self):
        r = load(); r["issues"][1]["dependsOn"]["issue"] = "9"
        self.assertTrue(any("issue 2" in e and "dependsOn" in e for e in validate(r, "decided")))

    def test_dependency_on_itself(self):
        r = load(); r["issues"][1]["dependsOn"]["issue"] = "2"
        self.assertTrue(validate(r, "decided"))

    def test_dependency_cycle(self):
        r = load()
        r["issues"][0]["dependsOn"] = {"issue": "2", "map": {"A": "A"}, "note": "x"}
        self.assertTrue(any("cycle" in e for e in validate(r, "decided")))

    def test_dependency_map_names_unknown_option(self):
        r = load(); r["issues"][1]["dependsOn"]["map"]["B"] = "Z"
        self.assertTrue(validate(r, "decided"))

    def test_short_fold_is_rejected(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Code", "size": "2 lines", "blocks": [{"form": "code", "text": "a\nb"}]})
        self.assertTrue(any("fold" in e for e in validate(r, "ready")))

    def test_long_fold_is_accepted(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Full diff", "size": "48 lines", "blocks": [{"form": "diff", "text": "x" * 700}]})
        self.assertEqual(validate(r, "ready"), [])

    def test_fold_without_size_label(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Full diff", "size": "", "blocks": [{"form": "diff", "text": "x" * 700}]})
        self.assertTrue(validate(r, "ready"))

    def test_origin_needs_verdict_reason(self):
        r = load(); r["issues"][0]["origin"]["verdictReason"] = ""
        self.assertTrue(validate(r, "decided"))

if __name__ == "__main__":
    unittest.main()
```

`tests/test_check_slots.py`:

```python
import pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "scripts"))
from check_slots import check_folder

class CheckSlots(unittest.TestCase):
    def write(self, d, name, text):
        (pathlib.Path(d) / name).write_text(text, encoding="utf-8")

    def test_good_file(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "ui-mockup.md", "---\nwhen: the option changes what a screen looks like\n---\n\nBody\n")
            self.assertEqual(check_folder(d), [])

    def test_missing_when(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "flow.md", "# Flow\n")
            self.assertTrue(any("flow.md" in e and "when" in e for e in check_folder(d)))

    def test_empty_when(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "flow.md", "---\nwhen:\n---\n")
            self.assertTrue(check_folder(d))

    def test_bad_file_name(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "UI Mockup.md", "---\nwhen: x\n---\n")
            self.assertTrue(any("kebab" in e for e in check_folder(d)))

    def test_empty_folder_is_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(check_folder(d))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v`
Expected: errors, `ModuleNotFoundError: No module named 'check_record'`.

- [ ] **Step 5: Implement `validate(record, stage)` in `check_record.py` and `check_folder(path)` in `check_slots.py`**

Stdlib only. Each error string starts with `issue <id>: ` when it concerns an issue. Cycle detection walks `dependsOn.issue` links. Both files get a `main()` that prints errors and exits 1 when there are any.

- [ ] **Step 6: Run the tests to see them pass**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v`
Expected: all tests `ok`.

- [ ] **Step 7: Write `references/record.md`**

Document every field of the contract above with its meaning (spec section 6), the three stages and who fills what (`review` intake fields; `decide` kind, attributes, options, recommendation, needsOwner, dependsOn, origin verdict, agent decision; `explain` explanation and option blocks), and the two CLI commands. State that the file is named `review.json` and lives in a folder `review-<review.id>/` whose location the caller chooses (default: the session scratchpad).

- [ ] **Step 8: Add `.superpowers/` to `.gitignore` and commit**

```bash
git add .gitignore docs/superpowers plugins/wsbaser/skills/review
git commit -m "feat(review): issue record contract and validators"
```

---

### Task 2: Decision text format and parser

**Files:**
- Create: `plugins/wsbaser/skills/review/references/decision-text.md`
- Create: `plugins/wsbaser/skills/review/scripts/parse_decisions.py`
- Create: `plugins/wsbaser/skills/review/tests/test_parse_decisions.py`, `plugins/wsbaser/skills/review/tests/fixtures/decisions-round2.txt`

**Interfaces:**
- Consumes: record shape from Task 1.
- Produces: `parse_decisions.parse(text: str) -> dict` returning `{"review": str|None, "round": int|None, "issues": {id: {"status": str, "choice": str|None, "note": str, "by": str|None}}, "problems": [str]}`.
- Produces: `parse_decisions.merge(record: dict, parsed: dict) -> dict` returning `{"record": dict, "settled": bool, "undecided": [id], "disputed": [id], "problems": [str]}`.
- Produces: CLI `python parse_decisions.py <review.json> < pasted.txt` that writes the merged record back and prints the summary as JSON.
- Produces: the text format below; Task 3's `buildText` must emit exactly this.

The format (this exact text is `tests/fixtures/decisions-round2.txt`, the state of the Task 1 fixture):

```
Decisions for PR #2317 "Normalize log levels", review round 2
Review: pr-2317-log-levels
2 of 4 decided

1. One transport failure is logged as Error in two layers
   Decision: [B] Error once in the transport, SyncSession logs Debug (owner chose)
2. Client older than the gateway: Warning or Information? [new in round 2]
   UNDECIDED. Agent recommends [C] Warning for one release, then Information.
   Depends on: issue 1 = [B] (confirmed)
3. Request logging crashes when the request has no identity
   Decision: [accept] Accept - apply the null guard (agent decided, owner left it)
4. Retry attempts are logged too loud
   DISPUTED: [reject] Reject (owner chose)
   Note: Ops still wants these at Warning during the migration

Undecided: 2. Do not act on these yet.
Disputed: 4. Re-think these using the notes.
```

Rules: an issue line is `<id>. <title>` with an optional ` [new in round N]`; the lines under it are indented three spaces; the option id is always in square brackets; the label is the option `label`, plus ` - <outcome>` when the option has one; the who-part is `agent decided, owner left it`, `owner confirmed` or `owner chose`; an undecided issue with no recommendation reads `UNDECIDED. No recommendation.`; line breaks inside a note are replaced by ` / `; the two footer lines appear only when their list is non-empty.

- [ ] **Step 1: Write the fixture text file and the failing tests**

```python
import copy, json, pathlib, sys, unittest
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "scripts"))
from parse_decisions import parse, merge

TEXT = (HERE / "fixtures" / "decisions-round2.txt").read_text(encoding="utf-8")
def record():
    r = json.loads((HERE / "fixtures" / "review-round2.json").read_text(encoding="utf-8"))
    for i in r["issues"]:
        i["decision"] = {"by": None, "choice": None, "note": "", "status": "undecided"}
    return r

class Parse(unittest.TestCase):
    def test_header(self):
        p = parse(TEXT)
        self.assertEqual((p["review"], p["round"]), ("pr-2317-log-levels", 2))
        self.assertEqual(p["problems"], [])

    def test_each_status(self):
        i = parse(TEXT)["issues"]
        self.assertEqual(i["1"], {"status": "decided", "choice": "B", "note": "", "by": "owner"})
        self.assertEqual(i["2"]["status"], "undecided")
        self.assertEqual(i["3"], {"status": "decided", "choice": "accept", "note": "", "by": "agent"})
        self.assertEqual(i["4"], {"status": "disputed", "choice": "reject", "note": "Ops still wants these at Warning during the migration", "by": "owner"})

    def test_crlf_and_trailing_spaces(self):
        damaged = "\r\n".join(line + "  " for line in TEXT.splitlines())
        self.assertEqual(parse(damaged)["issues"], parse(TEXT)["issues"])

    def test_soft_wrapped_decision_line(self):
        wrapped = TEXT.replace("Error once in the transport, SyncSession", "Error once in the transport,\nSyncSession")
        self.assertEqual(parse(wrapped)["issues"]["1"]["choice"], "B")

    def test_title_with_brackets_and_dashes_does_not_confuse(self):
        t = TEXT.replace("Retry attempts are logged too loud", 'Retry [A] - "attempts" <loud>')
        self.assertEqual(parse(t)["issues"]["4"]["choice"], "reject")

    def test_half_paste_reports_missing_issues(self):
        half = "\n".join(TEXT.splitlines()[:6])
        m = merge(record(), parse(half))
        self.assertFalse(m["settled"])
        self.assertIn("3", m["undecided"]); self.assertIn("4", m["undecided"])
        self.assertTrue(any("3" in p for p in m["problems"]))

    def test_garbage_is_not_guessed(self):
        p = parse("looks good to me, go ahead")
        self.assertEqual(p["issues"], {})
        self.assertTrue(p["problems"])

class Merge(unittest.TestCase):
    def test_merge_writes_decisions(self):
        m = merge(record(), parse(TEXT))
        d = {i["id"]: i["decision"] for i in m["record"]["issues"]}
        self.assertEqual(d["1"]["choice"], "B"); self.assertEqual(d["4"]["status"], "disputed")
        self.assertEqual((m["settled"], m["undecided"], m["disputed"]), (False, ["2"], ["4"]))

    def test_unknown_choice_is_a_problem_and_stays_undecided(self):
        m = merge(record(), parse(TEXT.replace("[B] Error once", "[Z] Error once")))
        self.assertIn("1", m["undecided"]); self.assertTrue(any("issue 1" in p for p in m["problems"]))

    def test_wrong_review_id_is_refused(self):
        m = merge(record(), parse(TEXT.replace("pr-2317-log-levels", "other-review")))
        self.assertTrue(m["problems"]); self.assertEqual(len(m["undecided"]), 4)

    def test_all_decided_is_settled(self):
        t = TEXT.replace("   UNDECIDED. Agent recommends [C] Warning for one release, then Information.", "   Decision: [C] Warning for one release, then Information (owner confirmed)")
        t = t.replace("   DISPUTED: [reject] Reject (owner chose)", "   Decision: [accept] Accept - retry attempts go to Debug (owner chose)")
        self.assertTrue(merge(record(), parse(t))["settled"])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run to see them fail**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -p "test_parse_decisions.py" -v`
Expected: `ModuleNotFoundError: No module named 'parse_decisions'`.

- [ ] **Step 3: Implement `parse` and `merge` in `parse_decisions.py`**

Issue lines are recognised by `^\s*([A-Za-z0-9-]+)\.\s` at zero indentation; status lines by their leading keyword after joining soft-wrapped continuation lines (a line that starts neither an issue nor a known keyword continues the previous line). The choice id is the first `[...]` after the keyword. `merge` matches by issue id only, refuses a different `Review:` id, marks every issue absent from the paste as undecided with a problem line, and sets `settled` true only when no issue is undecided or disputed and there are no problems.

- [ ] **Step 4: Run to see them pass**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v`
Expected: all `ok`.

- [ ] **Step 5: Write `references/decision-text.md`** with the format, the rules, and the fixture as the example. Commit.

```bash
git add plugins/wsbaser/skills/review
git commit -m "feat(review): decision text format and parser"
```

---

### Task 3: Tokens and the page behaviour script

**Files:**
- Create: `plugins/wsbaser/skills/report-design/assets/tokens.css`
- Create: `plugins/wsbaser/skills/report-design/assets/review-page.js`
- Create: `plugins/wsbaser/skills/report-design/tests/review-page.test.js`

**Interfaces:**
- Consumes: fixtures `plugins/wsbaser/skills/review/tests/fixtures/review-round2.json` and `decisions-round2.txt`; text format from Task 2.
- Produces (exported through `module.exports` when `module` exists; in the browser the same functions drive the DOM):
  - `createState(issues, saved) -> state` where `state[id] = { choice, note, status, by, stale }`
  - `choose(state, issues, id, optionId) -> state`
  - `confirm(state, issues, id) -> state`, `reopen(state, issues, id) -> state`, `restoreAgent(state, issues, id) -> state`, `setNote(state, id, text) -> state`
  - `recommendedFor(issue, state) -> optionId | null`
  - `counts(state, issues) -> { decided, total, undecided: [id], disputed: [id] }`
  - `buildText(review, issues, state) -> string`
  - `issues` here are the record's issue objects reduced to `{ id, title, round, needsOwner, mode, options: [{ id, label, outcome, dispute }], recommended, agentChoice, dependsOn }`.
- Produces: DOM contract read by the script, documented in Task 4: `<script type="application/json" id="review-data">` holding `{ review, issues }` in that reduced shape; `article[data-issue="<id>"]`; `input[type=radio][name="opt-<id>"][value="<optionId>"]`; `button[data-choice="<optionId>"]`; `button[data-act="confirm|reopen|restore|use-recommendation"]`; `textarea[data-note]`; `[data-rec-tag]` inside each option; `[data-stale-notice]`; `[data-progress]`; `button[data-copy]`; `[data-preview]`; `button[data-filter="all|needs|agent|new"]`. Storage key: `review:<review.id>`.

Behaviour to pin:
- Initial state: an agent-decided issue is `decided`, `by: "agent"`, `choice` = `agentChoice`. A needs-owner issue is `undecided` with `choice` = its recommendation (or `null` when there is none).
- `choose`: sets `by: "owner"`; status is `disputed` when the option has `dispute`, else `decided`.
- `confirm`: only on an undecided issue with a non-null choice; sets `decided`, `by: "owner"`.
- Dependency: after any change to a parent, a dependent that is still `undecided` takes `recommendedFor` as its choice; a dependent already decided by the owner keeps its choice and gets `stale: true` when that choice differs from the new recommendation.
- Saved state for ids not in `issues` is ignored; saved state for known ids is restored, then dependency sync runs.
- Who-part in the text: `agent decided, owner left it` when `by` is agent; `owner confirmed` when the owner's choice equals `recommendedFor`; otherwise `owner chose`.

- [ ] **Step 1: Write `tokens.css`**

`:root` light tokens, `@media (prefers-color-scheme: dark)` under `:root:not([data-theme="light"])` and `:root[data-theme="dark"]` dark tokens, exactly the values in spec section 9, plus `--font-body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; --font-mono: "JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace; --fs-xs: 12px; --fs-sm: 13px; --fs-md: 14px; --fs-lg: 16px; --fs-xl: 20px;` and `color-scheme` set in both dark blocks.

- [ ] **Step 2: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../assets/review-page.js');

const fx = path.join(__dirname, '..', '..', 'review', 'tests', 'fixtures');
const record = JSON.parse(fs.readFileSync(path.join(fx, 'review-round2.json'), 'utf8'));
const expected = fs.readFileSync(path.join(fx, 'decisions-round2.txt'), 'utf8').replace(/\r\n/g, '\n').trimEnd();

function reduced() {
  return record.issues.map(i => ({
    id: i.id, title: i.title, round: i.round, needsOwner: i.needsOwner, mode: i.mode,
    options: i.options.map(o => ({ id: o.id, label: o.label, outcome: o.outcome, dispute: !!o.dispute })),
    recommended: i.recommendation ? i.recommendation.option : null,
    agentChoice: i.needsOwner ? null : i.recommendation.option,
    dependsOn: i.dependsOn,
  }));
}

test('initial state', () => {
  const s = R.createState(reduced(), {});
  assert.deepStrictEqual([s['1'].status, s['1'].choice], ['undecided', 'A']);
  assert.deepStrictEqual([s['3'].status, s['3'].by, s['3'].choice], ['decided', 'agent', 'accept']);
  assert.deepStrictEqual(R.counts(s, reduced()), { decided: 2, total: 4, undecided: ['1', '2'], disputed: [] });
});

test('text matches the shared fixture', () => {
  const issues = reduced();
  let s = R.createState(issues, {});
  s = R.choose(s, issues, '1', 'B');
  s = R.choose(s, issues, '4', 'reject');
  s = R.setNote(s, '4', 'Ops still wants these at Warning during the migration');
  assert.strictEqual(R.buildText(record.review, issues, s).trimEnd(), expected);
});

test('undecided dependent follows the parent', () => {
  const issues = reduced();
  let s = R.choose(R.createState(issues, {}), issues, '1', 'B');
  assert.strictEqual(s['2'].choice, 'C');
  assert.strictEqual(s['2'].status, 'undecided');
});

test('confirmed dependent keeps its choice and is flagged', () => {
  const issues = reduced();
  let s = R.confirm(R.createState(issues, {}), issues, '2');
  s = R.choose(s, issues, '1', 'B');
  assert.deepStrictEqual([s['2'].choice, s['2'].status, s['2'].stale], ['A', 'decided', true]);
});

test('confirm counts, reopen undoes, restoreAgent returns the agent choice', () => {
  const issues = reduced();
  let s = R.confirm(R.createState(issues, {}), issues, '1');
  assert.strictEqual(R.counts(s, issues).decided, 3);
  s = R.reopen(s, issues, '1');
  assert.strictEqual(s['1'].status, 'undecided');
  s = R.restoreAgent(R.choose(s, issues, '3', 'discuss'), issues, '3');
  assert.deepStrictEqual([s['3'].choice, s['3'].by, s['3'].status], ['accept', 'agent', 'decided']);
});

test('dispute option is disputed, not decided', () => {
  const issues = reduced();
  const s = R.choose(R.createState(issues, {}), issues, '3', 'discuss');
  assert.deepStrictEqual(R.counts(s, issues).disputed, ['3']);
});

test('stale saved state for unknown ids is ignored', () => {
  const s = R.createState(reduced(), { '99': { choice: 'A', status: 'decided', by: 'owner', note: '' }, '1': { choice: 'C', status: 'decided', by: 'owner', note: 'n' } });
  assert.strictEqual(s['99'], undefined);
  assert.deepStrictEqual([s['1'].choice, s['1'].note], ['C', 'n']);
});

test('saved choice that no longer exists falls back to the recommendation', () => {
  const s = R.createState(reduced(), { '1': { choice: 'Q', status: 'decided', by: 'owner', note: '' } });
  assert.deepStrictEqual([s['1'].choice, s['1'].status], ['A', 'undecided']);
});

test('no recommendation: nothing preselected, text says so', () => {
  const issues = reduced(); issues[0].recommended = null;
  const s = R.createState(issues, {});
  assert.strictEqual(s['1'].choice, null);
  assert.match(R.buildText(record.review, issues, s), /1\. .*\n   UNDECIDED\. No recommendation\./);
});

test('zero issues', () => {
  const s = R.createState([], {});
  assert.deepStrictEqual(R.counts(s, []), { decided: 0, total: 0, undecided: [], disputed: [] });
  assert.match(R.buildText(record.review, [], s), /0 of 0 decided/);
});

test('awkward title and multi-line note stay on their lines', () => {
  const issues = reduced(); issues[3].title = 'Retry [A] - "attempts" <loud>';
  let s = R.setNote(R.choose(R.createState(issues, {}), issues, '4', 'reject'), '4', 'line one\nline two');
  const t = R.buildText(record.review, issues, s);
  assert.match(t, /4\. Retry \[A\] - "attempts" <loud>\n   DISPUTED: \[reject\] Reject \(owner chose\)\n   Note: line one \/ line two/);
});
```

- [ ] **Step 3: Run to see them fail**

Run: `node --test plugins/wsbaser/skills/report-design/tests/`
Expected: `Cannot find module '../assets/review-page.js'`.

- [ ] **Step 4: Implement `review-page.js`**

One IIFE. Pure functions first (no DOM access, state objects are copied, never mutated), exported with `if (typeof module !== 'undefined') module.exports = {...}`. Then a `boot()` that runs only when `document` exists: reads `#review-data`, loads `localStorage['review:' + review.id]` inside try/catch, calls `createState`, wires the DOM contract listed under Interfaces, re-renders after every change (radio checked state, `aria-pressed` on buttons, `[data-rec-tag]` shown only on `recommendedFor`, `[data-stale-notice]` shown when `stale`, progress text `<decided> of <total> decided`, preview text), saves after every change, and on `button[data-copy]` writes `buildText` to the clipboard with a visible fallback that selects the preview text. Use the mockup's script (lines 781 to the end of `docs/superpowers/specs/2026-11-12-review-skill-design/review-page-mockup.html`) as the behaviour reference, replacing everything hardcoded to its sample (`DEP_REC`, `#i1`, `#i2`, `S['2']`).

- [ ] **Step 5: Run to see them pass**

Run: `node --test plugins/wsbaser/skills/report-design/tests/`
Expected: 11 tests pass.

- [ ] **Step 6: Check the parser reads what the script writes**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v`
Expected: all `ok` (both sides share `decisions-round2.txt`).

- [ ] **Step 7: Commit**

```bash
git add plugins/wsbaser/skills/report-design
git commit -m "feat(report-design): tokens and decision page script"
```

---

### Task 4: `report-design` skill, forms slot, worked example

**Files:**
- Create: `plugins/wsbaser/skills/report-design/SKILL.md`
- Create: `plugins/wsbaser/skills/report-design/references/components.md`, `references/decision-page.md`
- Create: `plugins/wsbaser/skills/report-design/forms/` : `prose.md`, `code.md`, `diff.md`, `table.md`, `fold.md`, `flow.md`, `timeline.md`, `worked-numbers.md`, `now-proposed.md`, `ui-mockup.md`
- Create: `plugins/wsbaser/skills/report-design/assets/example-review-page.html`

**Interfaces:**
- Consumes: `tokens.css`, `review-page.js` and its DOM contract (Task 3); `check_slots.py` (Task 1).
- Produces: the guidance `explain` and `review` load; form names (file name without `.md`) are the legal `form` values in record blocks.

- [ ] **Step 1: Write the ten form files**

Each starts with frontmatter `when:` and then has three short parts: when it fits and when it does not; how to build it (what data it needs, inline SVG or HTML/CSS, tokens to use); how it sits on the page (width, caption, whether it may be folded). `when:` lines:

| File | `when:` |
|---|---|
| `prose.md` | plain explanation in sentences; the default when nothing else fits |
| `code.md` | the explanation is about specific lines of code; show them with file and line, highlight the lines the prose names |
| `diff.md` | the proposal changes existing code; short diffs inline, long ones folded with the line count |
| `table.md` | several items compared on the same attributes, or every case of a condition |
| `fold.md` | extra depth of 600 characters or more that most readers will skip; never for short content |
| `flow.md` | a value or request passes through steps or layers and the order matters |
| `timeline.md` | two or more actors and the outcome depends on ordering, including the ordering that fails |
| `worked-numbers.md` | money, rounding, costing or any rule best shown with real figures |
| `now-proposed.md` | a behaviour or structure changes; show today first, then the proposal beside it |
| `ui-mockup.md` | the issue or an option changes what a screen looks like; show the current screen, then each option as a rendered mockup with real values at the same scale |

`ui-mockup.md` must say: mockups are HTML/CSS inside the page, built from the product's real field names and values found in the code; the current screen comes first; each option's mockup sits inside its radio option; the differences from the current screen are marked with numbered pins and a legend (pattern from the owner's Unauthorized Page Decision artifact).

- [ ] **Step 2: Check the slot**

Run: `python plugins/wsbaser/skills/review/scripts/check_slots.py plugins/wsbaser/skills/report-design/forms`
Expected: no output, exit 0.

- [ ] **Step 3: Write `references/components.md`**

Rules in words for: page shell and one reading column (max width about 1040px, 16px side gutter), sticky bar, chips for attributes (free label and value), origin quote with verdict chip, evidence blocks, code with highlighted lines, tables, figures, fold with size in its label, option radios with attribute rows on the option, verdict buttons with `aria-pressed`, note field, filter buttons, focus rings and selection colours from tokens, tabular numerals. Include the bans: no nested cards, no coloured side borders above 1px, no unicode glyphs as icons (inline SVG), no dimming or shrinking of agent-decided issues. Cite the mockup for each as the worked example.

- [ ] **Step 4: Write `references/decision-page.md`**

The issue anatomy (header: id, title, chips, small marker for needs-owner / agent-decided / new in round N; body: blocks in the order the explainer gave; decision block: radios or buttons, Confirm, note), the full DOM contract from Task 3, how to embed `#review-data`, the counting rules, the dependency display, and the instruction to paste `tokens.css` and `review-page.js` unchanged.

- [ ] **Step 5: Write `SKILL.md`**

Frontmatter:
```yaml
---
name: wsbaser:report-design
description: House style for every report page a skill publishes — palette, type, components, when content may be folded, and the fixed script and anatomy for decision pages. Load before writing any report, explainer, review or test-result page so all of them look and behave alike. Not a template: pages are still written freehand.
---
```
Body, under 120 lines: what to load when (always `assets/tokens.css` and `references/components.md`; for a decision page also `references/decision-page.md` and `assets/review-page.js`); how to pick forms (list `forms/` here and the project's `.claude/review/forms/` if it exists, read each `when:` line, load only the files that match; a project file with the same name replaces the plugin's); the disclosure rule from spec section 8; the reminder that the Artifact tool's own `artifact-design` skill is still loaded; a closing check list (light and dark, no sideways scroll, every fold labelled with its size).

- [ ] **Step 6: Build `assets/example-review-page.html`**

Rebuild the accepted mockup's eight issues on top of `tokens.css` and `review-page.js` pasted unchanged, with `#review-data` and the data attributes of the DOM contract, no sample-specific script. Issue 7 (or one added issue) uses `ui-mockup` options so the form is demonstrated.

- [ ] **Step 7: Verify in a browser**

Serve the folder (`python -m http.server 8765 -d plugins/wsbaser/skills/report-design/assets`) and open `http://localhost:8765/example-review-page.html` with a browser tool at 1366x768. Check, by clicking: a radio selects and counts; Confirm and Reopen; a dispute button shows as disputed; changing issue 1 moves the Recommended tag on its dependent; a confirmed dependent shows the stale notice; filters; note appears in the preview; reload keeps state; Copy decisions fills the preview with text in the Task 2 format; dark scheme renders; no console errors; no horizontal scroll. Paste the copied text into `python plugins/wsbaser/skills/review/scripts/parse_decisions.py` against a record made from the example's `#review-data` and confirm no problems are reported.
Expected: all checks pass. Fix what does not.

- [ ] **Step 8: Commit**

```bash
git add plugins/wsbaser/skills/report-design
git commit -m "feat(report-design): skill, forms slot and worked example"
```

---

### Task 5: Rewrite `wsbaser:explain`

**Files:**
- Modify (replace whole file): `plugins/wsbaser/skills/explain/SKILL.md`
- Create: `plugins/wsbaser/skills/explain/references/writing-rules.md`
- Modify: `plugins/wsbaser/skills/explain/evals/evals.json`

**Interfaces:**
- Consumes: `wsbaser:report-design` (forms slot, components), record blocks (Task 1).
- Produces: embedded mode contract used by `review`: input is the path to `review.json` at stage `decided`; `explain` fills `explanation` for every issue and `blocks` for options that need them, then the file passes `check_record.py --stage ready`.

- [ ] **Step 1: Read the current skill and its evals**, so the existing triggers and the three existing eval prompts are kept.

- [ ] **Step 2: Write `references/writing-rules.md`**

The rules of spec section 8 with one example each taken from the owner's artifacts: answer first; size to the subject; today before the change; terms defined before use (inline for one or two, a small grid for three or more); code visible with `file:line` in the sentence before it; a claim made by someone else is split into parts with a verdict on each; unknowns stated at the claim ("checked by reading the code, not by running it"); sources inline; no fixed section template.

- [ ] **Step 3: Write `SKILL.md`**

Frontmatter: keep `name: wsbaser:explain`; description keeps the current trigger wording and adds "Also writes the per-issue explanations inside a review page when called by wsbaser:review."
Body, under 150 lines, with these parts:
1. **Pick the mode.** Short answer in the terminal; published explainer page (load `wsbaser:report-design`, publish with the Artifact tool); embedded (a `review.json` path is given).
2. **Trace before writing.** Follow the mechanism through the code, across repos when needed; every claim traces to something read.
3. **Choose the form per subject.** List the forms slot (plugin and project), read the `when:` lines, pick what fits; plain prose is the default. Do not name specific forms here.
4. **Decide what is visible.** The disclosure rule: short content inline, fold only 600 characters or more, label states the size.
5. **Embedded mode.** For each issue write blocks sized to that issue: a one-line issue gets one sentence; an issue the owner cannot judge without background gets it; for an issue with `origin`, lead with the quote and the verdict. Give options their own blocks when choosing between them needs more than a label (for example what each produces). Run `check_record.py --stage ready` and fix what it reports.
6. **Self-check** before handing over: is anything short folded; is any term undefined; is any claim about code without code or `file:line`; do two issues of different weight look the same length.

- [ ] **Step 4: Extend `evals/evals.json`**

Keep existing entries. Add, in the same shape (`id`, `name`, `prompt`, `expected_output`):
- `embedded-mixed-depth`: prompt gives a `review.json` at stage `decided` with a one-line issue, a race-condition issue and a UI question; expected: three explanations of clearly different length and form, valid at stage `ready`, no fold under 600 characters.
- `short-question-stays-short`: a one-fact question; expected: a terminal answer of a few lines, no artifact.
- `reviewer-claim`: a review comment to check; expected: quote, per-part verdict, code with `file:line`.

- [ ] **Step 5: Review the skill file**

Dispatch the `wsbaser:skill-reviewer` agent on `plugins/wsbaser/skills/explain/SKILL.md`.
Expected: no blocking findings. Fix what it reports.

- [ ] **Step 6: Commit**

```bash
git add plugins/wsbaser/skills/explain
git commit -m "feat(explain): rewrite with form selection and embedded mode"
```

---

### Task 6: `wsbaser:decide` and the kinds slot

**Files:**
- Create: `plugins/wsbaser/skills/decide/SKILL.md`
- Create: `plugins/wsbaser/skills/decide/references/ask-rule.md`
- Create: `plugins/wsbaser/skills/decide/kinds/code-design.md`, `kinds/ui-ux.md`, `kinds/product.md`
- Create: `plugins/wsbaser/skills/decide/evals/evals.json`

**Interfaces:**
- Consumes: `review.json` at stage `intake` (Task 1).
- Produces: the same file at stage `decided`: per issue `kind`, `attributes`, `mode`, `options`, `recommendation`, `needsOwner` and reason, `dependsOn`, `origin.verdict` and reason when there is an origin, and for issues the agent decided `decision = { by: "agent", choice: <recommended>, note: "", status: "decided" }`.

- [ ] **Step 1: Write `references/ask-rule.md`**

The single place that defines when the owner is asked. Ask (`needsOwner: true`) when any holds: no option is clearly better on the evidence; the choice is costly to reverse (data shape, public contract, anything users or other teams will build on, anything shipped to customers); it is a product or priority decision only the owner can make; confidence in the recommendation is low. Otherwise decide. Always give a recommendation when one is defensible, even when asking. State that this file is the tuning point for autonomy and should be edited when too many or too few questions reach the owner.

- [ ] **Step 2: Write the three kind files**

Each has `when:` and four parts: signals that an issue is of this kind; what to research and how deep; which installed skill to consult and how to pass the issue; which attributes usually matter and what every option must come with.

| File | `when:` | Consult | Options must carry |
|---|---|---|---|
| `code-design.md` | the issue is about how code is structured, named, layered or made testable | `mattpocock-skills:codebase-design`; `wsbaser:architecture-fit` when a boundary moves | the code touched, complexity, risk, reversibility |
| `ui-ux.md` | the issue changes what a user sees or does on a screen | `impeccable` | a `ui-mockup` block of the real screen with real values; two or three options; the UX convention researched on the web with sources |
| `product.md` | the issue is what the product should do, for whom, or in what order | none by default; web research on domain practice and user expectation | who is affected, cost of reversal, what is not decided by choosing it |

- [ ] **Step 3: Check the slot**

Run: `python plugins/wsbaser/skills/review/scripts/check_slots.py plugins/wsbaser/skills/decide/kinds`
Expected: no output, exit 0.

- [ ] **Step 4: Write `SKILL.md`**

Frontmatter:
```yaml
---
name: wsbaser:decide
description: Decides open issues the way a careful senior would — sizes research to each issue, consults the installed skill that fits its kind, picks the best option with reasons and sources, and marks only the issues that truly need the owner. Takes a review.json and fills in options, recommendations and agent decisions. Use from wsbaser:review, or whenever a list of open questions should be settled with as few questions to the user as possible.
---
```
Body, under 160 lines:
1. **Triage all issues in the main thread first:** kind (free text), stakes, cost of reversal, whether the answer is already evident from code or conversation.
2. **Load kind guidance:** list the kinds slot (plugin and project `.claude/review/kinds/`), read `when:` lines, load matching files; for a kind with no file, choose a skill from the installed list by description, or none.
3. **Size the effort per issue:** evident, decide now with no research; local question, read code only; needs outside knowledge, web research scaled to the stakes; important issues get both research and the fitting skill.
4. **Use subagents economically:** trivial issues inline; related issues batched in one subagent; a heavy issue alone; independent work in one parallel batch; each subagent brief names the issue, what is already known, and the fields to return.
5. **For issues with an origin:** judge the claim first (`valid`, `not-valid`, `partly`) with the evidence; a not-valid claim is still an issue whose recommendation is to decline it, with the reply reason.
6. **Build options and pick:** one real option uses `mode: "buttons"` with dispute options that fit the issue; several use `mode: "radio"`; attributes on each option are the ones that matter for this issue.
7. **Apply `references/ask-rule.md`.**
8. **Find dependencies** between issues and write `dependsOn` with a map for every parent option.
9. **Record honestly:** sources as links or `file:line`; what was not verified goes in `recommendation.unverified`.
10. **Validate:** `check_record.py --stage decided`; fix and rerun until clean.

- [ ] **Step 5: Write `evals/evals.json`**

Same shape as `explain/evals/evals.json`. Entries:
- `evident-issues-no-research`: three issues answerable from the given code; expected: all decided by the agent, no web search, none needs the owner.
- `costly-to-reverse-asks`: a public API naming choice; expected: `needsOwner` true with a recommendation and the reason.
- `invalid-review-comment`: a reviewer asks for a guard that already exists two lines above; expected: verdict `not-valid`, recommendation to decline, evidence with `file:line`.
- `ui-question-gets-mockups`: how a cost field should be shown; expected: `impeccable` consulted, two or three options each with a `ui-mockup` block, sources for the convention.
- `dependent-pair`: two questions where the second follows from the first; expected: `dependsOn` with a complete map.
- `fifteen-issues`: fifteen mixed issues; expected: batched subagents, not fifteen; record valid at `decided`.

- [ ] **Step 6: Review the skill file** with the `wsbaser:skill-reviewer` agent; fix blocking findings.

- [ ] **Step 7: Commit**

```bash
git add plugins/wsbaser/skills/decide
git commit -m "feat(decide): decision maker skill with kinds slot"
```

---

### Task 7: `wsbaser:review` and the intake slot

**Files:**
- Create: `plugins/wsbaser/skills/review/SKILL.md`
- Create: `plugins/wsbaser/skills/review/intake/azure-devops-pr.md`, `intake/task-ticket.md`, `intake/supplied-issues.md`
- Create: `plugins/wsbaser/skills/review/evals/evals.json`

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces: for callers, the return message: the line `Review settled: <n> decisions` followed by the decision text (Task 2 format) and the path to `review.json`; or `Review not settled` with the undecided ids when the owner stops early.

- [ ] **Step 1: Write the three intake files**

| File | `when:` | Content |
|---|---|---|
| `azure-devops-pr.md` | the topic is an Azure DevOps pull request or its review comments | how to fetch the PR, its diff and all comment threads (`az repos pr show`, `az devops invoke` for threads, or the project's own PR skill when present); one issue per unresolved thread; `origin` filled with quote, author and `file:line`; resolved threads skipped unless asked |
| `task-ticket.md` | the topic is a ticket, story or task to analyse before implementing | read the ticket and every linked source in full, read the code it touches, list the open questions and risky assumptions as issues; `origin` is null |
| `supplied-issues.md` | the caller passes its own list of open points | take them as they are, one issue each, keep the caller's wording as the title, do not add issues unless something blocking is found |

- [ ] **Step 2: Check the slot**

Run: `python plugins/wsbaser/skills/review/scripts/check_slots.py plugins/wsbaser/skills/review/intake`
Expected: no output, exit 0.

- [ ] **Step 3: Write `SKILL.md`**

Frontmatter:
```yaml
---
name: wsbaser:review
description: Settles the open issues of a topic and gets the owner's sign-off on one page — finds the issues (PR review comments, questions before implementing a task, points raised by another skill), has each researched and decided, explains each at the depth it needs, publishes a review page where the owner confirms or changes each decision, and returns the decision list. Does not implement anything. Use when asked to review PR comments and propose answers, analyse a task and prepare open questions, "prepare a review artifact", "what do you need me to decide", or when a skill needs several decisions from the user at once.
---
```
Body, under 180 lines, following spec section 10:
1. **Intake.** List the intake slot (plugin and project), match by `when:`, follow the file. Create `review-<id>/review.json` (location: caller's choice, else the session scratchpad). Validate at `intake`.
2. **Frame.** Decide which attributes matter for this task and the order of issues (dependencies before dependents, then by stakes).
3. **Decide.** Invoke `wsbaser:decide` with the file path.
4. **Explain.** Invoke `wsbaser:explain` in embedded mode with the file path.
5. **Build and publish.** Invoke `wsbaser:report-design`, load `artifact-design` as the Artifact tool requires, write the page freehand from the record with `tokens.css` and `review-page.js` pasted unchanged, validate at `ready` first, publish with the Artifact tool, keep the artifact URL in `review.json` under `review.artifactUrl`.
6. **Hand over and wait.** Give the link and one line of what needs the owner ("2 of 9 need you"). Always wait for the pasted decisions, even when none need the owner.
7. **Read the paste.** Run `parse_decisions.py`; report any problems to the owner in plain words and ask for a fresh paste when issues could not be read.
8. **Settle disputes.** For each disputed issue, and for any decided issue whose note argues against the choice, re-run decide and explain for those issues with the note as input, raise `review.round`, mark the reworked issues with the new round, republish to the same URL, and wait again.
9. **Return** only when `settled` is true, in the form under Interfaces. If the owner says to stop, return `Review not settled`.
10. **Later rounds from the caller.** When invoked again with an existing `review.json`, add the new issues with the next round number, keep earlier decisions, republish to the same URL.
End with a short "what this skill does not do" list: no implementation, no replies posted to the PR, no silent decisions outside the page.

- [ ] **Step 4: Write `evals/evals.json`**

Entries, same shape:
- `pr-comments-4421` and `pr-comments-4399`: "Review the comments in <PR URL>, check if they are valid, research each and propose the best solution." Expected: a published review page; every unresolved thread is an issue with quote and verdict; radios where there are several solutions, buttons where one; no fold under 600 characters; at least two issues of clearly different depth.
- `task-analysis`: the owner's pre-implementation prompt from the spec's example (full analysis, open questions, product versus technical versus UI/UX). Expected: issues found by the skill; a UI issue with mockup options; most issues agent-decided; the needs-owner ones are product or costly-to-reverse.
- `two-issues` and `fifteen-issues`: size extremes. Expected: valid page both times; fifteen stays one column and readable.
- `round-two`: scripted decision text containing one dispute. Expected: the disputed issue is reworked, the page republished to the same URL with a round-2 marker, earlier decisions kept.
- `half-paste`: scripted text cut in the middle. Expected: the skill names the unread issues and asks again; it does not return.
For runs with no human, the eval prompt includes the scripted decision text to feed after publishing (spec section 11).

- [ ] **Step 5: Review the skill file** with the `wsbaser:skill-reviewer` agent; fix blocking findings.

- [ ] **Step 6: Run the tools once more and commit**

Run: `python -m unittest discover -s plugins/wsbaser/skills/review/tests -v` and `node --test plugins/wsbaser/skills/report-design/tests/`
Expected: all pass.

```bash
git add plugins/wsbaser/skills/review
git commit -m "feat(review): orchestrator skill with intake slot"
```

---

### Task 8: Switch `wsbaser:interview` to the review page

**Files:**
- Modify: `plugins/wsbaser/skills/interview/SKILL.md` (frontmatter description; Step 3 "Conduct the Interview" from its heading to just before "## Step 4: Generate the Spec")

**Interfaces:**
- Consumes: `wsbaser:review` and its return message (Task 7).

- [ ] **Step 1: Replace Step 3**

Keep Steps 1, 2, 4 and 5 and the solution-summary block. New Step 3, "Settle the open points":
1. From the categories selected in Step 2, list every non-obvious open point (keep the existing rule: nothing already clear from the conversation or the code). Keep the three questioning techniques as ways to find points, not as questions to ask.
2. Invoke `wsbaser:review` through the `Skill` tool with the feature name, the gathered context and the list of points (the `supplied-issues` intake). A pure preference point is passed as it is; it will appear with nothing preselected.
3. When `review` has published, call `AskUserQuestion` once: question `Review page is ready: <url>. <n> of <m> points need you. Go through it, click Copy decisions, then choose how to continue.`, header `Decisions`, options `I'll paste the decisions next` (the user pastes in the terminal on the next turn), `Accept all recommendations` (treated as every recommended option confirmed), `Stop here`. A paste given through the free-text answer is used directly.
4. Apply the returned decisions. If they expose new open points, invoke `wsbaser:review` again for the same review (next round) and announce it with the same `AskUserQuestion`.
5. When nothing is open, run `wsbaser:architecture-fit` exactly as today; a REFACTOR FIRST verdict becomes new points in a further round.
6. Show the solution summary and the wrap-up question as today.

- [ ] **Step 2: Update the frontmatter description** to say the open points are researched, decided and presented on one review page instead of asked one by one.

- [ ] **Step 3: Check nothing else in the file still tells the agent to ask questions one at a time**

Run: `grep -n "AskUserQuestion\|one at a time\|each question" plugins/wsbaser/skills/interview/SKILL.md`
Expected: only the review hand-off question and the wrap-up question remain.

- [ ] **Step 4: Review** with the `wsbaser:skill-reviewer` agent; fix blocking findings. Commit.

```bash
git add plugins/wsbaser/skills/interview
git commit -m "feat(interview): settle open points through the review page"
```

---

### Task 9: Evaluate across the range and fix

**Files:**
- Modify: whichever skill files the runs show to be wrong
- Workspaces: `eval-workspaces/<skill>/` (git-ignored)

**Interfaces:**
- Consumes: the four `evals/evals.json` files.

- [ ] **Step 1: Capture sources that live outside this repo**

On the owner's machine, for PRs 4399 and 4421 in `7C_Frontend`: if Azure DevOps and the checkout are reachable, the evals use them live. If not, save each PR's metadata, diff and comment threads once as JSON under `eval-workspaces/review/fixtures/` and point the eval prompts at those files. Record which was used.

- [ ] **Step 2: Run the evals**

Invoke the `skill-creator:skill-creator` skill and follow its evaluation flow for `wsbaser:decide`, `wsbaser:explain`, `wsbaser:review` in that order, then an `interview` run on a small feature. Use the scripted decision texts (accept all; overrule one; leave one undecided; one "Discuss") where a run needs the owner.

- [ ] **Step 3: Judge each run against the spec's list** (section 11) and record a verdict per criterion: right issues; each recommendation defensible and sourced; the right issues and only those reached the owner; depth varies with the issue; nothing short is folded; radios and buttons per the rule; dependencies and a second round work; page passes `check_record.py --stage ready` and the copied text parses with no problems.

- [ ] **Step 4: Fix and rerun** the failing evals until each criterion passes or is written down as a known limit with the reason. Fixes go to the owning part only: recommendation quality to `decide` (ask rule, kind files), explanation to `explain` or a form file, look and behaviour to `report-design`, flow to `review`.

- [ ] **Step 5: Show the owner two published pages** (one PR review, one task analysis) and collect their verdict before calling the project done.

- [ ] **Step 6: Commit**

```bash
git add plugins/wsbaser/skills
git commit -m "fix(review): adjustments from evaluation runs"
```

---

### Task 10: Document and close

**Files:**
- Modify: `plugins/wsbaser/README.md` (skill list)
- Modify: `README.md` if it lists skills

- [ ] **Step 1: Add the three new skills and the rewritten `explain` to the README skill list**, one line each, plus a short "Extending" paragraph: add a file to `review/intake/`, `decide/kinds/` or `report-design/forms/` (or the same folders under `.claude/review/` in a project); it must start with a `when:` line; run `check_slots.py` on the folder.

- [ ] **Step 2: Final checks**

Run:
```bash
python -m unittest discover -s plugins/wsbaser/skills/review/tests -v
node --test plugins/wsbaser/skills/report-design/tests/
python plugins/wsbaser/skills/review/scripts/check_slots.py plugins/wsbaser/skills/review/intake plugins/wsbaser/skills/decide/kinds plugins/wsbaser/skills/report-design/forms
grep -rn "ui-mockup\|azure-devops\|impeccable\|code-design" plugins/wsbaser/skills/review/SKILL.md plugins/wsbaser/skills/decide/SKILL.md plugins/wsbaser/skills/explain/SKILL.md plugins/wsbaser/skills/report-design/SKILL.md plugins/wsbaser/skills/report-design/assets/review-page.js
```
Expected: tests pass; slot check silent; the grep prints nothing (core files name no specific kind, form or source).

- [ ] **Step 3: Commit**

```bash
git add README.md plugins/wsbaser/README.md
git commit -m "docs(review): list the review skill family and how to extend it"
```

---

## Notes on choices made in this plan

- The copied text puts option ids in square brackets (`[B]`) and adds a `Review:` line. The spec's sample showed `A - Information`; the brackets make the text safely parseable and the id line stops a paste from one review being applied to another.
- The fold threshold (600 characters) turns the owner's rule "short content is never hidden" into something the validator can refuse.
- `review.json` is validated at three stages so each part can be tested alone.
