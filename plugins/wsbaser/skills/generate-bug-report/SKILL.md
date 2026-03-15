---
name: generate-bug-report
description: "Produces a verdict-focused HTML bug report (MITIGATED / CONFIRMED / INCONCLUSIVE) with call chain visualization, network capture summary, and code snippet. Writes a self-contained file to .reports/{slug}.html. Invoke after a single bug is verified — manually or via verify-bug. Use generate-test-report instead for multi-scenario test suites."
---

Extract bug verification details from the current conversation and produce a polished, self-contained HTML report saved to `.reports/{slug}.html`.

## When to Use This Skill

Invoke whenever:
- User says "generate the report", "save bug findings", "document this bug", or "write the report"
- Direct invocation `/wsbaser:generate-bug-report`
- `verify-bug` completes and requests report generation
- User confirms a bug finding and asks to record it

## Phase 1 — Context Extraction

Read the entire conversation and extract:

| Field | Description |
|-------|-------------|
| `bug_name` | Human-readable title, e.g. "DisposeData → DELETE /invoices/0" |
| `slug` | Kebab-case filename, 4–6 words, e.g. "delete-on-dispose-new-invoice" |
| `subtitle` | File + method context, e.g. "InvoiceSliderDialog.razor.cs · FormBehavior.DisposeData()" |
| `verdict` | One of: `MITIGATED` / `CONFIRMED` / `INCONCLUSIVE` |
| `verdict_label` | Human sentence, e.g. "Bug Mitigated — Guard Is In Place" |
| `verdict_description` | 1–2 sentence explanation of what was found |
| `branch_name` | Git branch under test (run `git branch --show-current` if not in context) |
| `date` | Test date YYYY-MM-DD (today if not in context) |
| `app_url` | Base URL of app tested, e.g. "http://localhost:7000" |
| `tester` | Who ran the test, e.g. "Claude automated browser test" |
| `stats[]` | Array of 3–4 stat bar items: `{label, value, color?}` |
| `test_steps[]` | `{n, title, description, status: "pass"\|"fail"\|"info"}` |
| `network_summary` | `{count, unit, description}` — e.g. `{count: "0", unit: "DELETE requests captured", description: "..."}` |
| `call_chain_title` | Section heading, e.g. "Execution Call Chain" |
| `call_chain_intro` | One sentence describing the execution flow shown |
| `call_chain[]` | Execution path nodes: `{label, type: "trigger"\|"normal"\|"blocked"\|"failed"}` |
| `call_chain_note` | (optional) explanatory note below the call chain |
| `code_section_title` | Code section heading, e.g. "Guard Implementation" or "Relevant Code" |
| `code_snippet` | `{filename, line_start, line_end, language, html}` — pre-rendered HTML with syntax-highlight spans |
| `code_explanation` | What the snippet does and why it matters |
| `findings_rows[]` | `{finding, actual, status: "mitigated"\|"confirmed"\|"inconclusive"}` |
| `screenshot_paths[]` | Paths to screenshots saved during the test (empty = omit screenshot section) |
| `trace_path` | (optional) path to a trace file |

If any field cannot be determined from context, use a sensible default (e.g., `verdict = INCONCLUSIVE`, `tester = "Manual test"`, `call_chain_title = "Execution Call Chain"`).

## Phase 2 — Screenshot Encoding

Use the bundled Node.js script — do **not** write inline bash/node/python code for encoding. Inline scripts using backticks (template literals) break bash quoting, and `python3` is not available on Windows.

**Step 1 — Locate the script:**
Use Glob to find:
`~/.claude/plugins/cache/wsbaser-plugins/wsbaser/*/skills/generate-bug-report/scripts/encode-screenshots.js`
Use the **most recently modified** result (Glob returns paths sorted by modification time — use the first).

**Step 2 — Build the path list:**
Collect all entries in `screenshot_paths[]` into a JSON array string, e.g.:
`'[".reports/screenshots/bug/01-before.png",".reports/screenshots/bug/02-after.png"]'`

**Step 3 — Run the script:**
```bash
node "<script_path>" '<json-array>'
```
> Run this in bash (Git Bash on Windows). Single-quoted strings are safe in bash; if running in cmd/PowerShell, use double quotes around the JSON array instead.

The script prints a JSON array of `{"path": "...", "data_uri": "..."}` objects to stdout.

**Step 4 — Apply results:**
Use the returned `data_uri` values when generating screenshot HTML. If `data_uri` is `null`, the file was not found — skip that screenshot.

If `screenshot_paths[]` is empty, omit the screenshot grid section entirely.

**Fallback:** If the script is not found, omit all screenshots and continue — the report generates without images.

## Phase 3 — HTML Report Generation

Locate and read the HTML template:
1. Use Glob to find it: `~/.claude/plugins/cache/wsbaser-plugins/wsbaser/*/skills/generate-bug-report/assets/report-template.html`
2. Read the first result with the Read tool (use the most recently modified file if multiple versions exist)

Replace all `{{PLACEHOLDER}}` tokens with extracted data. Create `.reports/` if it does not exist.

### Verdict class mapping

| Verdict | `{{VERDICT_CLASS}}` | `{{VERDICT_ICON}}` |
|---------|---------------------|-------------------|
| MITIGATED | `mitigated` | `&#10003;` |
| CONFIRMED | `confirmed` | `&#9888;` |
| INCONCLUSIVE | `inconclusive` | `&#63;` |

### Network count class

| Condition | `{{NETWORK_COUNT_CLASS}}` |
|-----------|--------------------------|
| 0 requests (expected outcome) | `g` |
| >0 requests (unexpected) | `r` |
| neutral / informational | *(omit)* |

### Step badge mapping

| Status | Class | Text |
|--------|-------|------|
| pass | `badge pass` | `&#10003; PASS` |
| fail | `badge fail` | `&#10007; FAIL` |
| info | `badge info` | `&#8505; INFO` |

### Call chain node type mapping

| Type | CSS class |
|------|-----------|
| trigger | `fn trig` — amber border, entry point |
| normal | `fn` — default |
| blocked | `fn blk` — green border + strikethrough (mitigated path) |
| failed | `fn fail-blk` — red border + text (confirmed failure path) |

Nodes separated by `<div class="fa">&rarr;</div>`.

### Findings status badge mapping

| Status | HTML |
|--------|------|
| mitigated | `<span class="badge pass">&#10003; MITIGATED</span>` |
| confirmed | `<span class="badge fail">&#10007; CONFIRMED</span>` |
| inconclusive | `<span class="badge info">&#8505; INCONCLUSIVE</span>` |

---

## Snippet Reference

### Stats bar item
```html
<div class="stat"><div class="sv g">VALUE</div><div class="sl">LABEL</div></div>
<!-- .g green | .r red | omit for default -->
```

Add `<div class="sdiv"></div>` between each stat item in `{{STATS_HTML}}`.

### Test step
```html
<div class="tstep">
  <div class="tn">N</div>
  <div class="tb">
    <div class="tt">TITLE</div>
    <div class="td2">DESCRIPTION</div>
  </div>
  <span class="badge pass">&#10003; PASS</span>  <!-- or .fail / .info -->
</div>
```

### Findings row
```html
<tr>
  <td>FINDING</td>
  <td>ACTUAL</td>
  <td><span class="badge pass">&#10003; MITIGATED</span></td>
</tr>
```

### Screenshot grid (omit section entirely if no screenshots)
```html
<div class="sec">
  <div class="stit">Screenshots</div>
  <div class="sg" id="shots">
    <div class="sc" onclick="openLb(0)">
      <img src="DATA_URI" alt="CAPTION" loading="lazy">
      <div class="scap"><span>CAPTION</span><span class="sst">Step N</span></div>
    </div>
  </div>
</div>
```

### Lightbox — single `{{LIGHTBOX_HTML}}` placeholder (include only when screenshots present)
```html
<div id="lb">
  <button id="lbx" onclick="closeLb()" title="Close (ESC)">&times;</button>
  <img id="lbi" src="" alt="">
  <div id="lbnav">
    <button onclick="lbPrev()">&#8592;</button>
    <span id="lbc"></span>
    <button onclick="lbNext()">&#8594;</button>
  </div>
</div>
<!-- Lightbox script (minified intentionally for compact self-contained output) -->
<script>
const shots=document.querySelectorAll('#shots .sc img');
const srcs=[...shots].map(i=>i.src);
let cur=0;
function openLb(n){cur=n;document.getElementById('lbi').src=srcs[cur];document.getElementById('lb').classList.add('active');document.getElementById('lbc').textContent=(cur+1)+' / '+srcs.length;}
function closeLb(){document.getElementById('lb').classList.remove('active');}
function lbNext(){cur=(cur+1)%srcs.length;openLb(cur);}
function lbPrev(){cur=(cur-1+srcs.length)%srcs.length;openLb(cur);}
document.getElementById('lb').addEventListener('click',function(e){if(e.target===this)closeLb();});
document.addEventListener('keydown',function(e){if(!document.getElementById('lb').classList.contains('active'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowRight')lbNext();if(e.key==='ArrowLeft')lbPrev();});
</script>
```

### Call chain note variants
```html
<div class="na">SUCCESS NOTE — green box</div>
<div class="nb"><strong style="color:var(--amber)">Note:</strong> WARNING NOTE — amber box</div>
```

### Trace footer link
```html
Trace: <a href="TRACE_PATH">TRACE_FILENAME</a>
```

### Code snippet (`code_snippet.html`) — pre-rendered syntax-highlighted HTML

The `html` field of `code_snippet` is a `<pre>` block with inline `<span>` tags. Generate it directly from the source code:

```html
<pre><span class="kw">if</span> (<span class="nm">id</span> == <span class="nm">0</span>) <span class="co">// guard: skip delete for unsaved records</span>
  <span class="kw">return</span>;
<span class="hlr"><span class="fnn">DeleteAsync</span>(<span class="nm">id</span>);</span></pre>
```

Span classes: `.kw` keywords · `.ty` types · `.fnn` function names · `.nm` literals/identifiers · `.co` comments · `.hlr` highlighted line block (wraps the entire line including its spans).

---

## Output Rules

1. **Single self-contained file** — no external resources, no CDN imports.
2. **Screenshots as `data:` URIs only** — never file paths.
3. **Save to `.reports/{slug}.html`** — create `.reports/` if it does not exist.
4. Mandatory sections: header, verdict, stats, test execution, network capture, call chain, code section, findings table, footer. Screenshot section only if screenshots exist.
5. Syntax highlight spans: `.kw` keywords · `.ty` types · `.fnn` function names · `.nm` literals · `.co` comments · `.hlr` highlighted line block.
6. **The HTML must open in a browser with no console errors** — validate all placeholders are replaced before writing.
