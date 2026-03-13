---
name: generate-bug-report
description: "Generates a self-contained HTML bug verification report from current conversation context.
  Use after manually or programmatically verifying a bug — the skill reads all test results,
  screenshots, call chain, and code snippets from the conversation and writes .reports/{slug}.html.

  Examples:

  - Example 1:
    user: 'I just verified the delete-on-dispose bug — no DELETE calls fired'
    assistant: 'Using generate-bug-report to produce the verification report.'
    <Skill tool call: wsbaser:generate-bug-report>

  - Example 2:
    user: '/wsbaser:generate-bug-report'
    assistant: 'Invoking the generate-bug-report skill.'
    <Skill tool call: wsbaser:generate-bug-report>

  - Example 3:
    user: 'The null reference is confirmed. Generate the report.'
    assistant: 'Using generate-bug-report skill to document this finding.'
    <Skill tool call: wsbaser:generate-bug-report>"
---

Extract bug verification details from the current conversation and produce a polished, self-contained HTML report saved to `.reports/{slug}.html`.

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
| `stats[]` | Array of 3–4 metric cards: `{label, value, sub, color?}` |
| `test_steps[]` | `{n, title, description, status: "pass"\|"fail"\|"info"}` |
| `network_summary` | `{count, unit, description}` — e.g. `{count: "0", unit: "DELETE requests captured", description: "..."}` |
| `call_chain[]` | Execution path nodes: `{label, type: "trigger"\|"normal"\|"blocked"}` |
| `call_chain_note` | (optional) explanatory note below the call chain |
| `code_snippet` | `{filename, line_start, line_end, language, html}` — pre-rendered HTML with syntax-highlight spans |
| `code_explanation` | What the snippet does and why it matters |
| `findings_rows[]` | `{finding, actual, status: "mitigated"\|"confirmed"\|"inconclusive"}` |
| `screenshot_paths[]` | Paths to screenshots saved during the test (empty = omit screenshot section) |
| `trace_path` | (optional) path to a trace file |

If any field cannot be determined from context, use a sensible default (e.g., `verdict = INCONCLUSIVE`, `tester = "Manual test"`).

## Phase 2 — Screenshot Encoding

For each path in `screenshot_paths[]`:
1. Read the file as binary.
2. Base64-encode it.
3. Determine mime type (`image/png`, `image/jpeg`, etc.) from extension.
4. Build `data:{mime};base64,{data}` URI.

If the list is empty, omit the screenshot grid section entirely.

## Phase 3 — HTML Report Generation

Write `.reports/{slug}.html` using the exact template below. Replace all `{{PLACEHOLDER}}` tokens with extracted data. Create `.reports/` if it does not exist.

### Verdict color mapping

| Verdict | Banner style | Icon bg | Text color | Icon |
|---------|-------------|---------|------------|------|
| MITIGATED | `background:var(--gbg);border:1.5px solid var(--gbd)` | `background:var(--green)` | `color:var(--green)` | `&#10003;` |
| CONFIRMED | `background:rgba(207,34,46,.08);border:1.5px solid rgba(207,34,46,.3)` | `background:var(--red)` | `color:var(--red)` | `&#9888;` |
| INCONCLUSIVE | `background:var(--abg);border:1.5px solid rgba(191,135,0,.3)` | `background:var(--amber)` | `color:var(--amber)` | `&#63;` |

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

Nodes separated by `<div class="fa">&rarr;</div>`.

### Findings status badge mapping

| Status | HTML |
|--------|------|
| mitigated | `<span class="badge pass">&#10003; MITIGATED</span>` |
| confirmed | `<span class="badge fail">&#10007; CONFIRMED</span>` |
| inconclusive | `<span class="badge info">&#8505; INCONCLUSIVE</span>` |

---

## Full HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bug Verification — {{BUG_NAME}}</title>
<style>
:root{
  --bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--bsub:#e8ecf0;
  --text:#1f2328;--muted:#656d76;--light:#8c959f;
  --green:#1a7f37;--gbg:rgba(26,127,55,.08);--gbd:rgba(26,127,55,.3);
  --red:#cf222e;--amber:#bf8700;--abg:rgba(191,135,0,.08);
  --blue:#0969da;--bbg:rgba(9,105,218,.08);
  --mono:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --r:8px;--sh:0 1px 3px rgba(0,0,0,.08);--shm:0 4px 12px rgba(0,0,0,.1);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);background:var(--bg);color:var(--text);font-size:14px;line-height:1.6}
code{font-family:var(--mono);font-size:12px;background:rgba(0,0,0,.05);padding:1px 5px;border-radius:3px}
.hdr{background:var(--surface);border-bottom:1px solid var(--border);padding:24px 40px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
.hl{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.ht{font-size:26px;font-weight:700;line-height:1.3}
.hs{font-family:var(--mono);font-size:12px;color:var(--muted);margin-top:4px}
.bp{display:inline-flex;align-items:center;font-family:var(--mono);font-size:11px;color:var(--blue);background:var(--bbg);border:1px solid rgba(9,105,218,.2);border-radius:20px;padding:3px 10px;margin-top:6px;width:fit-content}
.verdict{margin:28px 40px;border-radius:var(--r);padding:20px 28px;display:flex;align-items:center;gap:20px}
.vi{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:22px}
.vt{font-size:20px;font-weight:700;margin-bottom:4px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:0 40px 28px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;box-shadow:var(--sh)}
.sl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:6px}
.sv{font-family:var(--mono);font-size:22px;font-weight:700}.sv.g{color:var(--green)}.sv.r{color:var(--red)}.sv.sm{font-size:16px;margin-top:4px}
.ss2{font-size:11px;color:var(--light);margin-top:3px}
.con{padding:0 40px 48px}
.sec{margin-bottom:36px}
.stit{font-size:16px;font-weight:600;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bsub);display:flex;align-items:center;gap:8px}
.stit::before{content:'';display:inline-block;width:3px;height:16px;background:var(--blue);border-radius:2px}
.tl{display:flex;flex-direction:column}
.tstep{display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid var(--bsub)}
.tstep:last-child{border-bottom:none}
.tn{width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.tb{flex:1}
.tt{font-weight:600;font-size:13.5px;margin-bottom:2px}
.td2{color:var(--muted);font-size:13px}
.badge{display:inline-flex;align-items:center;font-family:var(--mono);font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;margin-left:auto;flex-shrink:0}
.pass{background:var(--gbg);color:var(--green);border:1px solid var(--gbd)}
.fail{background:rgba(207,34,46,.08);color:var(--red);border:1px solid rgba(207,34,46,.3)}
.info{background:var(--bbg);color:var(--blue);border:1px solid rgba(9,105,218,.2)}
.nr{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;box-shadow:var(--sh);display:flex;align-items:center;gap:24px}
.nc{font-family:var(--mono);font-size:54px;font-weight:700;line-height:1;flex-shrink:0}
.nl{font-size:15px;font-weight:600;margin-bottom:3px}
.flow{display:flex;align-items:center;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;box-shadow:var(--sh);gap:4px}
.fn{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-family:var(--mono);font-size:12px;white-space:nowrap}
.fn.trig{border-color:var(--amber);background:var(--abg);color:var(--amber)}
.fn.blk{border-color:var(--green);background:var(--gbg);color:var(--green);text-decoration:line-through;opacity:.6}
.fn.fail-blk{border-color:var(--red);background:rgba(207,34,46,.08);color:var(--red)}
.fa{color:var(--light);font-size:18px;padding:0 4px}
.cw{background:#0d1117;border:1px solid #30363d;border-radius:var(--r);overflow:hidden}
.ch{background:#161b22;border-bottom:1px solid #30363d;padding:8px 16px;font-family:var(--mono);font-size:11px;color:#8b949e;display:flex;align-items:center;justify-content:space-between}
.dots{display:flex;gap:6px}.dot{width:10px;height:10px;border-radius:50%}
.dr{background:#ff5f57}.dy{background:#ffbd2e}.dg{background:#28c840}
pre{padding:16px;font-family:var(--mono);font-size:12.5px;line-height:1.7;overflow-x:auto;color:#e6edf3}
.kw{color:#ff7b72}.ty{color:#ffa657}.co{color:#8b949e;font-style:italic}.fnn{color:#d2a8ff}.nm{color:#79c0ff}
.hlr{background:rgba(255,255,0,.08);display:block;margin:0 -16px;padding:0 16px}
.tw{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 14px;font-weight:600;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);background:var(--bg)}
td{padding:10px 14px;border-bottom:1px solid var(--bsub)}
tr:last-child td{border-bottom:none}
.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.sc{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);cursor:pointer;transition:box-shadow .2s,transform .2s}
.sc:hover{box-shadow:var(--shm);transform:translateY(-2px)}
.sc img{width:100%;display:block}
.scap{padding:10px 14px;border-top:1px solid var(--bsub);font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:space-between}
.sst{font-family:var(--mono);font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 6px;color:var(--light)}
#lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#lb.active{display:flex}
#lb img{max-width:90vw;max-height:85vh;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
#lbnav{display:flex;gap:16px;align-items:center}
#lbnav button{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:20px;width:44px;height:44px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center}
#lbnav button:hover{background:rgba(255,255,255,.2)}
#lbx{position:absolute;top:20px;right:24px;color:#fff;font-size:28px;cursor:pointer;background:none;border:none;opacity:.8;line-height:1}
#lbc{color:rgba(255,255,255,.6);font-size:13px;font-family:var(--mono)}
.ftr{border-top:1px solid var(--border);background:var(--surface);padding:20px 40px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted)}
.ftr a{color:var(--blue);text-decoration:none}.ftr a:hover{text-decoration:underline}
.na{margin-top:12px;padding:12px 16px;background:var(--gbg);border:1px solid var(--gbd);border-radius:var(--r);font-size:13px;color:var(--green)}
.nb{margin-top:12px;padding:12px 16px;background:var(--abg);border:1px solid rgba(191,135,0,.3);border-radius:var(--r);font-size:13px}
</style>
</head>
<body>

<header class="hdr">
  <div>
    <div class="hl">Bug Verification Report</div>
    <h1 class="ht">{{BUG_NAME}}</h1>
    <div class="hs">{{SUBTITLE}}</div>
    <div class="bp">&#9135; {{BRANCH_NAME}}</div>
  </div>
  <div style="text-align:right;color:var(--muted);font-size:12px;line-height:2.2">
    <div><strong>Date:</strong> {{DATE}}</div>
    <div><strong>App:</strong> {{APP_URL}}</div>
    <div><strong>Tester:</strong> {{TESTER}}</div>
  </div>
</header>

<div class="verdict" style="{{VERDICT_BANNER_STYLE}}">
  <div class="vi" style="{{VERDICT_ICON_STYLE}}">{{VERDICT_ICON}}</div>
  <div>
    <div class="vt" style="{{VERDICT_TEXT_STYLE}}">{{VERDICT_LABEL}}</div>
    <div>{{VERDICT_DESCRIPTION}}</div>
  </div>
</div>

<div class="stats">{{STATS_HTML}}</div>

<div class="con">

  <div class="sec">
    <div class="stit">Test Execution</div>
    <div class="tl">{{STEPS_HTML}}</div>
  </div>

  <div class="sec">
    <div class="stit">Network Capture Result</div>
    <div class="nr">
      <div class="nc" style="{{NETWORK_COUNT_COLOR}}">{{NETWORK_COUNT}}</div>
      <div>
        <div class="nl">{{NETWORK_UNIT}}</div>
        <div>{{NETWORK_DESCRIPTION}}</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="stit">{{CALL_CHAIN_TITLE}}</div>
    <p style="font-size:13.5px;color:var(--muted);margin-bottom:14px">{{CALL_CHAIN_INTRO}}</p>
    <div class="flow">{{CALL_CHAIN_HTML}}</div>
    {{CALL_CHAIN_NOTE_HTML}}
  </div>

  <div class="sec">
    <div class="stit">{{CODE_SECTION_TITLE}}</div>
    <p style="font-size:13.5px;color:var(--muted);margin-bottom:14px"><code>{{CODE_FILENAME}}</code> lines {{CODE_LINE_START}}&ndash;{{CODE_LINE_END}}:</p>
    <div class="cw">
      <div class="ch">
        <div class="dots"><div class="dot dr"></div><div class="dot dy"></div><div class="dot dg"></div></div>
        <span>{{CODE_FILENAME}}:{{CODE_LINE_START}}</span>
      </div>
      <pre>{{CODE_HTML}}</pre>
    </div>
    <p style="font-size:13.5px;color:var(--muted);margin-top:14px">{{CODE_EXPLANATION}}</p>
  </div>

  <div class="sec">
    <div class="stit">Review Finding vs Actual Result</div>
    <div class="tw">
      <table>
        <thead><tr><th>Review Finding</th><th>Actual Result</th><th>Status</th></tr></thead>
        <tbody>{{FINDINGS_HTML}}</tbody>
      </table>
    </div>
  </div>

  {{SCREENSHOTS_SECTION_HTML}}

</div>

<footer class="ftr">
  <div>Branch: <code>{{BRANCH_NAME}}</code> &middot; Date: {{DATE}} &middot; Tester: {{TESTER}}</div>
  <div>{{TRACE_HTML}}</div>
</footer>

{{LIGHTBOX_HTML}}
{{LIGHTBOX_SCRIPT}}

</body>
</html>
```

---

## Snippet Reference

### Stats card
```html
<div class="stat">
  <div class="sl">LABEL</div>
  <div class="sv g">VALUE</div>  <!-- .g green | .r red | omit for default -->
  <div class="ss2">SUBLABEL</div>
</div>
```

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

### Lightbox (include only when screenshots present)
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

---

## Output Rules

1. Single self-contained file — no external resources, no CDN imports.
2. Screenshots embedded as `data:` URIs only — never file paths.
3. Save to `.reports/{slug}.html`. Create `.reports/` if it does not exist.
4. Mandatory sections: header, verdict, stats, test execution, network capture, call chain, code section, findings table, footer. Screenshot section only if screenshots exist.
5. Syntax highlight spans: `.kw` keywords · `.ty` types · `.fnn` function names · `.nm` literals · `.co` comments · `.hlr` highlighted line block.
6. The HTML must open in a browser with no console errors.
