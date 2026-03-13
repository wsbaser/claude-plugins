---
name: generate-test-report
description: "Generates a comprehensive, self-contained HTML test report from browser test results in the current conversation.
  Use after running /wsbaser:verify-feature or after manual browser testing — reads all scenario results, steps, screenshots, issues, and code findings from context and writes .reports/{slug}.html.
  Produces an Allure-style report with a sidebar scenario list, per-scenario step drill-down, code analysis for failures, and a 'Copy fix prompt' button on each issue.
  Always use this when the user asks to generate a test report, save test results, or document browser testing outcomes."
---

Extract test execution results from the current conversation and produce a polished, self-contained HTML report saved to `.reports/{slug}.html`.

## Phase 1 — Context Extraction

Read the entire conversation and extract the following data model. Build it as a JSON object called `REPORT_DATA`.

### Top-level fields

| Field | Description |
|-------|-------------|
| `title` | Human-readable report title, e.g. "E2E Test Report — Invoice Module" |
| `slug` | Kebab-case filename, 3–5 words, e.g. "invoice-module-e2e" |
| `subtitle` | Optional subtitle or feature context |
| `branch` | Git branch under test (run `git branch --show-current` if not in context) |
| `date` | Test date YYYY-MM-DD (today if not in context) |
| `app_url` | Base URL of app tested |
| `tester` | Who ran the tests, e.g. "Claude automated browser test" or "Manual test" |
| `scenarios[]` | Array of scenario objects (see below) |
| `screenshots[]` | Flat array of all screenshot objects (see below) |

### Scenario object

```json
{
  "id": 0,
  "name": "Login Flow",
  "status": "pass",
  "steps": [...],
  "issues": [...],
  "code_analysis": null
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `id` | integer | Zero-based index |
| `name` | string | Scenario/journey name |
| `status` | `"pass"` / `"fail"` / `"issue"` | `fail` = step failed; `issue` = completed but with findings; `pass` = all clear |
| `steps[]` | array | Step objects |
| `issues[]` | array | Issue objects found during this scenario |
| `code_analysis` | object or null | Code context for failed/issue scenarios |

### Step object

```json
{
  "n": 1,
  "title": "Navigate to login page",
  "description": "Opened http://localhost:7000/login and verified form rendered",
  "status": "pass",
  "screenshot_index": 0,
  "console_errors": []
}
```

`screenshot_index` is the index into the top-level `screenshots[]` array, or `null` if no screenshot.

### Issue object

```json
{
  "description": "Form submits without validating empty required fields",
  "severity": "high",
  "file_path": "src/Forms/LoginForm.razor",
  "line_number": 42,
  "screenshot_index": 2,
  "steps_to_reproduce": ["Navigate to /login", "Leave email blank", "Click Submit"],
  "console_error": "TypeError: Cannot read property 'value' of null"
}
```

`file_path`, `line_number`, `screenshot_index`, and `console_error` may be `null` if not available.

### Code analysis object (for failed/issue scenarios only)

```json
{
  "filename": "src/Forms/LoginForm.razor",
  "line_start": 38,
  "line_end": 50,
  "language": "csharp",
  "code_html": "...",
  "explanation": "The null check on line 42 is missing, allowing the form to submit when email is empty."
}
```

`code_html` is pre-rendered HTML with syntax highlight spans (`.kw`, `.ty`, `.fnn`, `.nm`, `.co`) — same convention as `generate-bug-report`.

### Screenshot object

```json
{
  "path": ".reports/screenshots/login-flow/01-login-page.png",
  "caption": "Login page loaded",
  "scenario_id": 0,
  "step_n": 1,
  "data_uri": ""
}
```

`data_uri` is filled in Phase 2. Gather paths from conversation; if a step has no screenshot, omit it from this array.

---

### Extraction rules

- Look for structured agent results from `verify-feature` outputs (sections like "Steps completed:", "Issues found:", "Screenshots taken:", "DB validation results:").
- Also look for inline test notes, browser action logs, and any `mcp__chrome-*` tool output discussed in conversation.
- If a scenario has no issues and all steps passed, set `status: "pass"`. If it has issues but completed, set `status: "issue"`. If a step explicitly failed or the scenario could not complete, set `status: "fail"`.
- If any field cannot be determined, use a sensible default (`tester: "Manual test"`, `subtitle: ""`).

---

## Phase 2 — Screenshot Encoding

For each screenshot in `screenshots[]` where `data_uri` is empty:
1. Read the file as binary.
2. Base64-encode it.
3. Determine mime type from extension (`image/png`, `image/jpeg`).
4. Set `data_uri = "data:{mime};base64,{data}"`.

If a file does not exist at the path, set `data_uri: null` and omit that screenshot from rendering.

---

## Phase 3 — HTML Report Generation

Write `.reports/{slug}.html`. Create `.reports/` if it does not exist.

Embed `REPORT_DATA` as an inline JS variable, then render everything from it. Use the exact template below.

### Status color mapping

| Status | Color var | Border | Background |
|--------|-----------|--------|------------|
| `pass` | `--green` | `rgba(26,127,55,.3)` | `rgba(26,127,55,.08)` |
| `fail` | `--red` | `rgba(207,34,46,.3)` | `rgba(207,34,46,.08)` |
| `issue` | `--amber` | `rgba(191,135,0,.3)` | `rgba(191,135,0,.08)` |

### Severity badge mapping

| Severity | Class | Text |
|----------|-------|------|
| `high` | `badge fail` | `HIGH` |
| `medium` | `badge warn` | `MED` |
| `low` | `badge info` | `LOW` |

---

## Full HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Report — {{TITLE}}</title>
<style>
:root{
  --bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--bsub:#e8ecf0;
  --text:#1f2328;--muted:#656d76;--light:#8c959f;
  --green:#1a7f37;--gbg:rgba(26,127,55,.08);--gbd:rgba(26,127,55,.3);
  --red:#cf222e;--rbg:rgba(207,34,46,.08);--rbd:rgba(207,34,46,.3);
  --amber:#bf8700;--abg:rgba(191,135,0,.08);--abd:rgba(191,135,0,.3);
  --blue:#0969da;--bbg:rgba(9,105,218,.08);--bbd:rgba(9,105,218,.2);
  --mono:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --r:8px;--sh:0 1px 3px rgba(0,0,0,.08);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;height:100vh;display:flex;flex-direction:column;overflow:hidden}
code{font-family:var(--mono);font-size:12px;background:rgba(0,0,0,.05);padding:1px 5px;border-radius:3px}

/* Header */
.hdr{background:var(--surface);border-bottom:1px solid var(--border);padding:24px 40px;display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0}
.hl{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.htitle{font-size:24px;font-weight:700;line-height:1.3}
.bp{display:inline-flex;align-items:center;font-family:var(--mono);font-size:11px;color:var(--blue);background:var(--bbg);border:1px solid rgba(9,105,218,.2);border-radius:20px;padding:3px 10px;margin-top:6px;width:fit-content}
.hmeta{font-size:12px;color:var(--muted);margin-top:2px}
.hright{text-align:right;font-size:12px;color:var(--muted);line-height:1.8}

/* Summary stat bar */
.stats{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;gap:32px;flex-shrink:0}
.stat{display:flex;align-items:center;gap:8px}
.sv{font-family:var(--mono);font-size:20px;font-weight:700}
.sv.g{color:var(--green)}.sv.r{color:var(--red)}.sv.a{color:var(--amber)}.sv.b{color:var(--blue)}
.sl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.sdiv{width:1px;background:var(--border);height:32px;margin:0 4px}

/* Main two-panel layout */
.main{display:flex;flex:1;overflow:hidden}

/* Sidebar */
.sidebar{width:260px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;background:var(--surface)}
.sidebar-hd{padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);border-bottom:1px solid var(--bsub);background:var(--bg)}
.sitem{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--bsub);transition:background .12s}
.sitem:hover{background:var(--bg)}
.sitem.active{background:var(--bbg);border-left:3px solid var(--blue);padding-left:13px}
.sdot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.sdot.pass{background:var(--green)}.sdot.fail{background:var(--red)}.sdot.issue{background:var(--amber)}
.sname{font-size:13px;flex:1;line-height:1.3}
.scount{font-family:var(--mono);font-size:11px;color:var(--muted);flex-shrink:0}

/* Detail panel */
.detail{flex:1;overflow-y:auto;padding:28px 40px}
.empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px}

/* Scenario detail sections */
.sec{margin-bottom:28px}
.stit{font-size:16px;font-weight:600;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bsub);display:flex;align-items:center;gap:8px}
.stit::before{content:'';display:inline-block;width:3px;height:16px;background:var(--blue);border-radius:2px}

/* Scenario title in detail */
.dtitle{font-size:20px;font-weight:700;margin-bottom:4px}
.dstatus{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:3px 10px;border-radius:20px;margin-bottom:20px}
.dstatus.pass{color:var(--green);background:var(--gbg);border:1px solid var(--gbd)}
.dstatus.fail{color:var(--red);background:var(--rbg);border:1px solid var(--rbd)}
.dstatus.issue{color:var(--amber);background:var(--abg);border:1px solid var(--abd)}

/* Steps */
.tstep{display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid var(--bsub)}
.tstep:last-child{border-bottom:none}
.tn{width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.tn.fail{background:var(--red)}.tn.pass{background:var(--green)}.tn.info{background:var(--light)}
.tb{flex:1}
.tt{font-weight:600;font-size:13.5px;margin-bottom:2px}
.td2{color:var(--muted);font-size:13px}
.badge{display:inline-flex;align-items:center;font-family:var(--mono);font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;margin-left:auto;flex-shrink:0}
.badge.pass{background:var(--gbg);color:var(--green);border:1px solid var(--gbd)}
.badge.fail{background:var(--rbg);color:var(--red);border:1px solid var(--rbd)}
.badge.info{background:var(--bbg);color:var(--blue);border:1px solid var(--bbd)}
.badge.warn{background:var(--abg);color:var(--amber);border:1px solid var(--abd)}
.ce{margin-top:6px;font-family:var(--mono);font-size:11px;color:var(--red);background:var(--rbg);padding:6px 10px;border-radius:4px;border:1px solid var(--rbd)}

/* Screenshot thumbnails in steps */
.thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.thumb{width:80px;height:54px;object-fit:cover;border-radius:4px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s,transform .15s}
.thumb:hover{border-color:var(--blue);transform:scale(1.04)}

/* Issue cards */
.icard{border-left:3px solid var(--red);background:var(--rbg);border-radius:0 6px 6px 0;padding:14px 16px;margin-bottom:10px}
.icard.medium{border-color:var(--amber);background:var(--abg)}
.icard.low{border-color:var(--blue);background:var(--bbg)}
.itop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.idesc{font-weight:600;font-size:13px;flex:1}
.ibadges{display:flex;gap:6px;flex-shrink:0;align-items:center}
.imeta{font-size:12px;color:var(--muted);margin-bottom:6px}
.imeta code{color:var(--text)}
.isteps{font-size:12px;color:var(--muted);margin-top:6px}
.isteps ol{margin-left:16px;margin-top:2px}
.fix-btn{font-family:var(--sans);font-size:11px;font-weight:600;color:var(--blue);background:var(--bbg);border:1px solid var(--bbd);border-radius:5px;padding:4px 10px;cursor:pointer;transition:background .15s}
.fix-btn:hover{background:rgba(9,105,218,.16)}

/* Code block */
.cw{background:#0d1117;border:1px solid #30363d;border-radius:var(--r);overflow:hidden}
.ch{background:#161b22;border-bottom:1px solid #30363d;padding:8px 16px;font-family:var(--mono);font-size:11px;color:#8b949e;display:flex;align-items:center;justify-content:space-between}
.dots{display:flex;gap:6px}.dot{width:10px;height:10px;border-radius:50%}
.dr{background:#ff5f57}.dy{background:#ffbd2e}.dg{background:#28c840}
pre{padding:16px;font-family:var(--mono);font-size:12.5px;line-height:1.7;overflow-x:auto;color:#e6edf3;margin:0}
.kw{color:#ff7b72}.ty{color:#ffa657}.co{color:#8b949e;font-style:italic}.fnn{color:#d2a8ff}.nm{color:#79c0ff}
.cexp{font-size:13px;color:var(--muted);margin-top:12px}

/* Lightbox */
#lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:1000;align-items:center;justify-content:center;flex-direction:column;gap:12px}
#lb.active{display:flex}
#lbi{max-width:90vw;max-height:82vh;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
#lbnav{display:flex;gap:16px;align-items:center}
#lbnav button{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:18px;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center}
#lbnav button:hover{background:rgba(255,255,255,.2)}
#lbx{position:absolute;top:16px;right:20px;color:#fff;font-size:26px;cursor:pointer;background:none;border:none;opacity:.8;line-height:1}
#lbc{color:rgba(255,255,255,.55);font-size:12px;font-family:var(--mono)}
#lbcap{color:rgba(255,255,255,.8);font-size:13px}

/* Toast */
#toast{position:fixed;bottom:20px;right:20px;background:#1f2328;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:2000}
#toast.visible{opacity:1}

/* Footer */
.ftr{border-top:1px solid var(--border);background:var(--surface);padding:16px 40px;font-size:12px;color:var(--muted);flex-shrink:0}
</style>
</head>
<body>

<header class="hdr">
  <div>
    <div class="hl">Test Report</div>
    <div class="htitle" id="rptTitle"></div>
    <div class="bp" id="rptBranch"></div>
    <div class="hmeta" id="rptSubtitle"></div>
  </div>
  <div class="hright" id="rptMeta"></div>
</header>

<div class="stats" id="rptStats"></div>

<div class="main">
  <nav class="sidebar">
    <div class="sidebar-hd">Scenarios</div>
    <div id="scenarioList"></div>
  </nav>
  <div class="detail" id="detailPanel">
    <div class="empty">Select a scenario to view details</div>
  </div>
</div>

<footer class="ftr" id="rptFooter"></footer>

<div id="lb">
  <button id="lbx" onclick="closeLb()" title="Close (ESC)">&times;</button>
  <img id="lbi" src="" alt="">
  <div id="lbcap"></div>
  <div id="lbnav">
    <button onclick="lbPrev()">&#8592;</button>
    <span id="lbc"></span>
    <button onclick="lbNext()">&#8594;</button>
  </div>
</div>

<div id="toast"></div>

<script>
// ── DATA ────────────────────────────────────────────────────
const D = {{REPORT_DATA_JSON}};

// ── HELPERS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function statusIcon(s){ return s==='pass'?'✓':s==='fail'?'✗':'!'; }
function statusLabel(s){ return s==='pass'?'PASSED':s==='fail'?'FAILED':'ISSUES'; }
function sevClass(s){ return s==='high'?'fail':s==='medium'?'warn':'info'; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── RENDER HEADER ────────────────────────────────────────────
$('rptTitle').textContent = D.title;
if(D.branch) $('rptBranch').innerHTML = '&#9135; '+esc(D.branch);
if(D.subtitle) $('rptSubtitle').textContent = D.subtitle;
$('rptMeta').innerHTML =
  `<div><strong>App:</strong> ${esc(D.app_url||'—')}</div>`+
  `<div><strong>Date:</strong> ${esc(D.date)}</div>`+
  `<div><strong>Tester:</strong> ${esc(D.tester)}</div>`;

// ── RENDER STATS ─────────────────────────────────────────────
(function(){
  const total = D.scenarios.length;
  const passed = D.scenarios.filter(s=>s.status==='pass').length;
  const failed = D.scenarios.filter(s=>s.status==='fail').length;
  const issues = D.scenarios.filter(s=>s.status==='issue').length;
  const shots  = D.screenshots.filter(s=>s.data_uri).length;
  const pct = total ? Math.round(passed/total*100) : 0;
  $('rptStats').innerHTML =
    `<div class="stat"><div class="sv b">${total}</div><div class="sl">Scenarios</div></div>`+
    `<div class="sdiv"></div>`+
    `<div class="stat"><div class="sv g">${passed}</div><div class="sl">Passed</div></div>`+
    `<div class="sdiv"></div>`+
    `<div class="stat"><div class="sv r">${failed}</div><div class="sl">Failed</div></div>`+
    `<div class="sdiv"></div>`+
    `<div class="stat"><div class="sv a">${issues}</div><div class="sl">Issues</div></div>`+
    `<div class="sdiv"></div>`+
    `<div class="stat"><div class="sv">${pct}%</div><div class="sl">Pass Rate</div></div>`+
    `<div class="sdiv"></div>`+
    `<div class="stat"><div class="sv b">${shots}</div><div class="sl">Screenshots</div></div>`;
})();

// ── ISSUE REGISTRY (populated during renderDetail calls) ─────
const allIssues = [];

// ── RENDER SIDEBAR ───────────────────────────────────────────
(function(){
  const list = $('scenarioList');
  D.scenarios.forEach((sc,i)=>{
    const issueCount = sc.issues?sc.issues.length:0;
    const stepCount  = sc.steps?sc.steps.length:0;
    const el = document.createElement('div');
    el.className='sitem';
    el.dataset.id=i;
    el.innerHTML=
      `<div class="sdot ${sc.status}"></div>`+
      `<div class="sname">${esc(sc.name)}</div>`+
      `<div class="scount">${issueCount>0?issueCount+' ⚠':stepCount+' steps'}</div>`;
    el.onclick=()=>selectScenario(i);
    list.appendChild(el);
  });
})();

// ── SELECT SCENARIO ──────────────────────────────────────────
function selectScenario(i){
  document.querySelectorAll('.sitem').forEach(el=>el.classList.remove('active'));
  document.querySelector(`.sitem[data-id="${i}"]`).classList.add('active');
  renderDetail(D.scenarios[i]);
}

// ── RENDER DETAIL ────────────────────────────────────────────
function renderDetail(sc){
  let html='';

  // Title + status
  html+=`<div class="dtitle">${esc(sc.name)}</div>`;
  html+=`<div class="dstatus ${sc.status}">${statusIcon(sc.status)} ${statusLabel(sc.status)}</div>`;

  // Steps
  if(sc.steps&&sc.steps.length){
    html+=`<div class="sec"><div class="stit">Steps</div><div class="tl">`;
    sc.steps.forEach(st=>{
      const tnClass = st.status==='pass'?'pass':st.status==='fail'?'fail':'info';
      const shot = st.screenshot_index!=null ? D.screenshots[st.screenshot_index] : null;
      html+=`<div class="tstep">`;
      html+=`<div class="tn ${tnClass}">${st.n}</div>`;
      html+=`<div class="tb">`;
      html+=`<div class="tt">${esc(st.title)}</div>`;
      if(st.description) html+=`<div class="td2">${esc(st.description)}</div>`;
      if(st.console_errors&&st.console_errors.length){
        st.console_errors.forEach(e=>{ html+=`<div class="ce">⚠ ${esc(e)}</div>`; });
      }
      if(shot&&shot.data_uri){
        const idx = D.screenshots.indexOf(shot);
        html+=`<div class="thumbs"><img class="thumb" src="${shot.data_uri}" alt="${esc(shot.caption)}" title="${esc(shot.caption)}" onclick="openLb(${idx})"></div>`;
      }
      html+=`</div>`;
      html+=`<span class="badge ${tnClass}">${statusIcon(st.status)} ${st.status.toUpperCase()}</span>`;
      html+=`</div>`;
    });
    html+=`</div></div>`;
  }

  // Issues
  if(sc.issues&&sc.issues.length){
    html+=`<div class="sec"><div class="stit">Issues Found</div>`;
    sc.issues.forEach((iss,ii)=>{
      const sc_class = iss.severity==='medium'?'medium':iss.severity==='low'?'low':'';
      const shot = iss.screenshot_index!=null ? D.screenshots[iss.screenshot_index] : null;
      html+=`<div class="icard ${sc_class}">`;
      html+=`<div class="itop">`;
      html+=`<div class="idesc">${esc(iss.description)}</div>`;
      html+=`<div class="ibadges">`;
      const issIdx = allIssues.push(iss) - 1;
      html+=`<span class="badge ${sevClass(iss.severity)}">${iss.severity.toUpperCase()}</span>`;
      html+=`<button class="fix-btn" onclick="copyFix(${issIdx})">⎘ Copy fix prompt</button>`;
      html+=`</div></div>`;
      if(iss.file_path){
        html+=`<div class="imeta">📄 <code>${esc(iss.file_path)}${iss.line_number?':'+iss.line_number:''}</code></div>`;
      }
      if(iss.console_error){
        html+=`<div class="ce">${esc(iss.console_error)}</div>`;
      }
      if(iss.steps_to_reproduce&&iss.steps_to_reproduce.length){
        html+=`<div class="isteps"><strong>Steps to reproduce:</strong><ol>`;
        iss.steps_to_reproduce.forEach(s=>{ html+=`<li>${esc(s)}</li>`; });
        html+=`</ol></div>`;
      }
      if(shot&&shot.data_uri){
        const idx = D.screenshots.indexOf(shot);
        html+=`<div class="thumbs" style="margin-top:10px"><img class="thumb" src="${shot.data_uri}" alt="${esc(shot.caption)}" onclick="openLb(${idx})"></div>`;
      }
      html+=`</div>`;
    });
    html+=`</div>`;
  }

  // Code analysis
  if(sc.code_analysis){
    const ca = sc.code_analysis;
    html+=`<div class="sec"><div class="stit">Code Analysis</div>`;
    html+=`<p style="font-size:13px;color:var(--muted);margin-bottom:10px"><code>${esc(ca.filename)}</code> lines ${ca.line_start}–${ca.line_end}:</p>`;
    html+=`<div class="cw"><div class="ch"><div class="dots"><div class="dot dr"></div><div class="dot dy"></div><div class="dot dg"></div></div><span>${esc(ca.filename)}:${ca.line_start}</span></div><pre>${ca.code_html}</pre></div>`;
    if(ca.explanation) html+=`<p class="cexp">${esc(ca.explanation)}</p>`;
    html+=`</div>`;
  }

  // All screenshots for this scenario (gallery)
  const scenShots = D.screenshots.filter(s=>s.scenario_id===sc.id&&s.data_uri);
  if(scenShots.length>1){
    html+=`<div class="sec"><div class="stit">All Screenshots</div><div class="thumbs">`;
    scenShots.forEach(s=>{
      const idx = D.screenshots.indexOf(s);
      html+=`<img class="thumb" src="${s.data_uri}" alt="${esc(s.caption)}" title="${esc(s.caption)}" onclick="openLb(${idx})">`;
    });
    html+=`</div></div>`;
  }

  $('detailPanel').innerHTML = html;
}

// ── LIGHTBOX ─────────────────────────────────────────────────
const lbShots = D.screenshots.filter(s=>s.data_uri);
let lbCur=0;

function openLb(globalIdx){
  lbCur = lbShots.findIndex(s=>D.screenshots.indexOf(s)===globalIdx);
  if(lbCur<0) lbCur=0;
  showLb();
  $('lb').classList.add('active');
}
function showLb(){
  const s=lbShots[lbCur];
  $('lbi').src=s.data_uri;
  $('lbcap').textContent=s.caption||'';
  $('lbc').textContent=(lbCur+1)+' / '+lbShots.length;
}
function closeLb(){ $('lb').classList.remove('active'); }
function lbNext(){ lbCur=(lbCur+1)%lbShots.length; showLb(); }
function lbPrev(){ lbCur=(lbCur-1+lbShots.length)%lbShots.length; showLb(); }
$('lb').addEventListener('click',e=>{ if(e.target===$('lb')) closeLb(); });
document.addEventListener('keydown',e=>{
  if(!$('lb').classList.contains('active')) return;
  if(e.key==='Escape') closeLb();
  if(e.key==='ArrowRight') lbNext();
  if(e.key==='ArrowLeft') lbPrev();
});

// ── FIX PROMPT ───────────────────────────────────────────────
function copyFix(idx){
  const issue = allIssues[idx];
  let p = `Please fix the following bug found during E2E browser testing:\n\n`;
  p += `**Issue:** ${issue.description}\n`;
  p += `**Severity:** ${issue.severity}\n`;
  if(issue.file_path) p += `**File:** ${issue.file_path}${issue.line_number?':'+issue.line_number:''}\n`;
  if(issue.steps_to_reproduce&&issue.steps_to_reproduce.length){
    p += `\n**Steps to reproduce:**\n`;
    issue.steps_to_reproduce.forEach((s,i)=>{ p+=`${i+1}. ${s}\n`; });
  }
  if(issue.console_error) p += `\n**Console error:**\n\`\`\`\n${issue.console_error}\n\`\`\`\n`;
  if(issue.screenshot_index!=null){
    const shot = D.screenshots[issue.screenshot_index];
    if(shot&&shot.data_uri) p += `\n**Screenshot:** ${shot.data_uri}`;
  }
  navigator.clipboard.writeText(p).then(()=>showToast('Copied!'));
}

function showToast(msg){
  const t=$('toast');
  t.textContent=msg;
  t.classList.add('visible');
  setTimeout(()=>t.classList.remove('visible'),1500);
}

// ── FOOTER ───────────────────────────────────────────────────
$('rptFooter').textContent =
  `Branch: ${D.branch||'—'}  ·  Date: ${D.date}  ·  Tester: ${D.tester}`;

// Auto-select first scenario
if(D.scenarios.length) selectScenario(0);
</script>
</body>
</html>
```

Replace `{{REPORT_DATA_JSON}}` with the JSON-serialized `REPORT_DATA` object (screenshots with `data_uri` already encoded). Replace `{{TITLE}}` in the `<title>` tag with the report title.

---

## Output Rules

1. Single self-contained file — no external resources, no CDN imports.
2. Screenshots embedded as `data:` URIs only — never file paths.
3. Save to `.reports/{slug}.html`. Create `.reports/` if it does not exist.
4. `REPORT_DATA_JSON` must be valid JSON — escape any special characters in strings.
5. The `screenshots[]` array must include `data_uri` for every screenshot that exists on disk; set `data_uri: null` for any file not found (those are silently skipped in rendering).
6. If no scenarios could be extracted from context, write a minimal report with a single scenario named "No test data found" with `status: "issue"` and one step explaining that no test results were detected in the conversation.
7. The HTML must open in a browser with no console errors.
