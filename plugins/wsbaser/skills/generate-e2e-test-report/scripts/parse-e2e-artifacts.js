#!/usr/bin/env node
/*
 * parse-e2e-artifacts.js — turn on-disk Playwright/NUnit E2E diagnostic artifacts into a
 * single REPORT_DATA JSON object for the generate-e2e-test-report template.
 *
 * No external deps. Reads the diagnostics tree written by TestDiagnostics.cs:
 *   {results}/{SanitizedTestName(<=50ch)}/{yyyyMMdd_HHmmss_fff}/
 *      final_state_PASSED.png | final_state_FAILED.png   (status signal — exactly one)
 *      failure_screenshot.png, failure_html.html, page_state.json   (failure only)
 *      console.json, network.json, test_steps.log                   (when non-empty)
 * Optional richer sources: a TRX (durations/assertion/stack), the .feature dir (BDD intent),
 * captured `dotnet test` stdout (assertion + Output Directory mapping when no TRX).
 *
 * Usage:
 *   node parse-e2e-artifacts.js --results <dir> [options] > report-data.json
 * Options:
 *   --results <dir>      diagnostics results dir (default: tests/7c.FrontEnd.E2ETests/bin/Debug/net8.0/tests/results)
 *   --features <dir>     .feature dir for BDD intent (default: tests/BddScenarios)
 *   --trx <file>         NUnit TRX for durations/assertion/stack (repeatable)
 *   --stdout <file>      captured dotnet test stdout (fallback for assertion/output-dir)
 *   --runs latest|all    DEPRECATED / ignored — the report always shows only the latest run per test
 *   --filter <regex>     include only test folders matching (case-insensitive)
 *   --since <ISO|ts>     only runs at/after this time (scope to one session)
 *   --screenshots failures|all|none   which final-state shots to embed (default failures)
 *   --max-dom <kb>       cap embedded failure DOM (default 150)
 *   --title <s> --branch <s> --commit <s> --runsettings <s>   run metadata
 *   --out <file>         write JSON here instead of stdout
 */
const fs = require("fs");
const path = require("path");

// ---- args -------------------------------------------------------------
function parseArgs(a) {
  const o = { trx: [] };
  for (let i = 2; i < a.length; i++) {
    const k = a[i];
    const v = a[i + 1];
    switch (k) {
      case "--results":
        o.results = v;
        i++;
        break;
      case "--features":
        o.features = v;
        i++;
        break;
      case "--trx":
        o.trx.push(v);
        i++;
        break;
      case "--stdout":
        o.stdout = v;
        i++;
        break;
      case "--runs":
        o.runs = v;
        i++;
        break;
      case "--filter":
        o.filter = v;
        i++;
        break;
      case "--since":
        o.since = v;
        i++;
        break;
      case "--screenshots":
        o.screenshots = v;
        i++;
        break;
      case "--max-dom":
        o.maxDom = parseInt(v, 10);
        i++;
        break;
      case "--title":
        o.title = v;
        i++;
        break;
      case "--branch":
        o.branch = v;
        i++;
        break;
      case "--commit":
        o.commit = v;
        i++;
        break;
      case "--runsettings":
        o.runsettings = v;
        i++;
        break;
      case "--out":
        o.out = v;
        i++;
        break;
    }
  }
  return o;
}
const A = parseArgs(process.argv);
const RESULTS =
  A.results || "tests/7c.FrontEnd.E2ETests/bin/Debug/net8.0/tests/results";
const FEATURES = A.features || "tests/BddScenarios";
const RUNS = A.runs || "latest";
const SHOT_POLICY = A.screenshots || "failures";
const MAX_DOM = (A.maxDom || 150) * 1024;
const FILTER = A.filter ? new RegExp(A.filter, "i") : null;
const SINCE = A.since ? tsToDate(A.since) : null;
const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function log(m) {
  process.stderr.write(m + "\n");
}
function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}
function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}
function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch (e) {
    return false;
  }
}
function dataUri(p) {
  try {
    const ext = p.slice(p.lastIndexOf(".") + 1).toLowerCase();
    return (
      "data:" +
      (MIME[ext] || "image/png") +
      ";base64," +
      fs.readFileSync(p).toString("base64")
    );
  } catch (e) {
    return null;
  }
}
// folder ts "yyyyMMdd_HHmmss_fff" -> Date
function tsToDate(ts) {
  const m = String(ts).match(
    /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d{3})/
  );
  if (m)
    return new Date(
      Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7])
    );
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}
// CamelCase_Underscore test name -> readable sentence
function humanize(n) {
  return String(n)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ---- discover runs ----------------------------------------------------
if (!exists(RESULTS)) {
  log("parse-e2e: results dir not found: " + RESULTS);
  process.stdout.write("{}\n");
  process.exit(0);
}
const testFolders = fs
  .readdirSync(RESULTS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const records = []; // one per test
let ti = 0;
for (const folder of testFolders) {
  if (FILTER && !FILTER.test(folder)) continue;
  const fdir = path.join(RESULTS, folder);
  let runs = fs
    .readdirSync(fdir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      ts: d.name,
      dir: path.join(fdir, d.name),
      date: tsToDate(d.name),
    }));
  if (SINCE) runs = runs.filter((r) => r.date && r.date >= SINCE);
  runs.forEach((r) => {
    r.status = exists(path.join(r.dir, "final_state_FAILED.png"))
      ? "fail"
      : exists(path.join(r.dir, "final_state_PASSED.png"))
      ? "pass"
      : "unknown";
  });
  runs = runs
    .filter((r) => r.status !== "unknown")
    .sort((a, b) =>
      a.date && b.date ? a.date - b.date : a.ts.localeCompare(b.ts)
    );
  if (!runs.length) continue;
  // Report only the single most recent run per test. The diagnostics tree
  // accumulates every historical execution (often hundreds, across days and
  // different code states), so aggregating them into a "flake" rate is
  // misleading — a solid-red→green history is a fix timeline, not flakiness.
  // The report always reflects the latest run's outcome and evidence, nothing
  // else. (`--runs` / `--since` no longer change this; kept for compatibility.)
  runs = [runs[runs.length - 1]];
  const passed = runs.filter((r) => r.status === "pass"),
    failed = runs.filter((r) => r.status === "fail");
  const status = failed.length ? "fail" : "pass";
  const attemptRuns = runs;
  records.push({ ti: ti++, folder, status, runs, passed, failed, attemptRuns });
}

// ---- optional TRX -----------------------------------------------------
const trxByName = {};
const trxClassByMethod = {};
for (const tf of A.trx) {
  const xml = readText(tf);
  if (!xml) continue;
  // TestDefinitions: map method name -> className (FQN of the test class).
  let dm;
  const defRe =
    /<TestMethod\b[^>]*\bcodeBase=[^>]*\bclassName="([^"]+)"[^>]*\bname="([^"]+)"/g;
  while ((dm = defRe.exec(xml))) trxClassByMethod[dm[2]] = dm[1];
  const defRe2 =
    /<TestMethod\b[^>]*\bclassName="([^"]+)"[^>]*\bname="([^"]+)"/g;
  while ((dm = defRe2.exec(xml)))
    if (!trxClassByMethod[dm[2]]) trxClassByMethod[dm[2]] = dm[1];
  // TRX attribute order is not fixed (duration can precede outcome), so read attributes by name
  // rather than positionally. Handle both self-closing (passed) and block (failed) results.
  const attr = (s, n) => {
    const m = s.match(new RegExp("\\b" + n + '="([^"]*)"'));
    return m ? m[1] : null;
  };
  const re =
    /<UnitTestResult\b([^>]*?)\/>|<UnitTestResult\b([^>]*?)>([\s\S]*?)<\/UnitTestResult>/g;
  let m;
  while ((m = re.exec(xml))) {
    const head = m[1] || m[2] || "";
    const inner = m[3] || "";
    const name = attr(head, "testName");
    if (!name) continue;
    const msg = (inner.match(/<Message>([\s\S]*?)<\/Message>/) || [])[1];
    const stack = (inner.match(/<StackTrace>([\s\S]*?)<\/StackTrace>/) ||
      [])[1];
    const className = (trxClassByMethod[name] || "").split(",")[0];
    trxByName[name] = {
      outcome: attr(head, "outcome"),
      durationMs: trxDur(attr(head, "duration")),
      message: msg ? decodeXml(msg) : null,
      stack: stack ? decodeXml(stack) : null,
      className: className ? className.split(".").pop() : null,
    };
  }
}
function trxDur(d) {
  const m = String(d).match(/(\d+):(\d+):(\d+)\.?(\d+)?/);
  if (!m) return null;
  return (
    (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 +
    (m[4] ? +("" + m[4]).padEnd(3, "0").slice(0, 3) : 0)
  );
}
function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
// match a folder (<=50ch sanitized) to a TRX full method name
function trxFor(folder) {
  for (const name in trxByName) {
    const san = name.replace(/[^A-Za-z0-9_.\- ]/g, "_").slice(0, 50);
    if (san === folder || norm(name).startsWith(norm(folder)))
      return trxByName[name];
  }
  return null;
}

// ---- optional .feature scenarios -------------------------------------
const scenarios = [];
if (exists(FEATURES)) {
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".feature")) parseFeature(p);
    }
  })(FEATURES);
}
function parseFeature(p) {
  const txt = readText(p);
  if (!txt) return;
  const lines = txt.split(/\r?\n/);
  let cur = null;
  for (let raw of lines) {
    const line = raw.trim();
    const sm = line.match(/^Scenario(?: Outline)?:\s*(.+)$/);
    if (sm) {
      cur = { title: sm[1].trim(), steps: [] };
      scenarios.push(cur);
      continue;
    }
    const gm = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
    if (gm && cur) cur.steps.push({ keyword: gm[1], text: gm[2] });
  }
}
function bddFor(folder, displayName) {
  const targets = [norm(displayName), norm(folder)];
  let best = null,
    bestScore = 0;
  for (const sc of scenarios) {
    const sn = norm(sc.title);
    let score = 0;
    for (const t of targets) {
      const words = sc.title
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      const hit = words.filter((w) => t.includes(norm(w))).length;
      score = Math.max(score, hit / Math.max(1, words.length));
    }
    if (sn && (targets[0].includes(sn) || sn.includes(targets[0])))
      score = Math.max(score, 0.9);
    if (score > bestScore) {
      bestScore = score;
      best = sc;
    }
  }
  if (best && bestScore >= 0.5)
    return { summary: best.title, source: "feature", steps: best.steps };
  return null;
}

// ---- per-test parse ---------------------------------------------------
const out = {
  run: {},
  categories: [],
  suites: [],
  tests: [],
  screenshots: [],
  console: [],
  network: [],
};
const consoleArr = out.console,
  netArr = out.network,
  shotArr = out.screenshots;
const NOISE =
  /bundle\.scp\.css|maps\.googleapis|GoogleMaps|favicon|\.dll$|\.wasm$|blazor\.boot\.json/i;

function levelOf(type) {
  return type === "error"
    ? "error"
    : type === "warning"
    ? "warning"
    : type === "info"
    ? "info"
    : type === "log"
    ? "log"
    : null;
}
function pushConsole(ti, arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  let last = null;
  for (const c of arr) {
    const lvl = levelOf(c.type);
    if (!lvl) continue; // drop table/group noise
    if (/\[TABLE\]/i.test(c.text) || (c.text || "").length > 4000) continue;
    if (last && last.text === c.text && last.level === lvl) {
      last.count++;
      continue;
    }
    const id = `c${ti}-${consoleArr.length}`;
    const row = {
      id,
      level: lvl,
      text: c.text || "",
      ts: fmtClock(c.timestamp),
      location: c.location || "",
      count: 1,
    };
    consoleArr.push(row);
    out.push(id);
    last = row;
  }
  return out;
}
function fmtClock(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toISOString().slice(11, 23);
}
function pushNetwork(ti, arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const n of arr) {
    const id = `n${ti}-${n.id || netArr.length}`;
    netArr.push({
      id,
      method: n.method,
      url: n.url,
      status: n.status,
      statusText: n.statusText,
      durationMs: n.durationMs,
      error: n.error,
      type: n.resourceType,
    });
    out.push(id);
  }
  return out;
}
function parseSteps(txt) {
  if (!txt) return [];
  const out = [];
  let idx = 0;
  const lines = txt.split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(
      /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*Step\s*(\d+):\s*(.+)$/
    );
    if (m) {
      idx++;
      const fail = /FAIL/i.test(m[3]);
      out.push({
        idx,
        title: m[3].trim(),
        tOffset: m[1],
        status: fail ? "fail" : "pass",
        note: "",
      });
    } else if (out.length && l.trim() && /^\s+/.test(l)) {
      const last = out[out.length - 1];
      last.note = (last.note ? last.note + " · " : "") + l.trim();
    }
  }
  return out;
}
function categorize(message, stack, failedNet, consoleErr) {
  const m = (message || "") + " " + (stack || "");
  if (/Expected:|But was:|Assert|Should\(\)/i.test(m))
    return { name: "Assertion failure", cause: "assertion" };
  if (failedNet && failedNet.length)
    return { name: "Network error (4xx/5xx)", cause: "network" };
  if (/Timeout|waiting for|exceeded|locator/i.test(m))
    return { name: "Element / timeout", cause: "timeout" };
  if (
    consoleErr &&
    consoleErr.some((t) => /ManagedError|Unhandled|Exception/i.test(t))
  )
    return { name: "App console exception", cause: "console" };
  if (/login|WASM|fixture|boot/i.test(m))
    return { name: "Infrastructure (boot/login)", cause: "infra" };
  return { name: "Other failure", cause: "other" };
}
function extractExpectedActual(message) {
  if (!message) return {};
  const m = message.match(
    /Expected:\s*([\s\S]*?)\s*But was:\s*([\s\S]*?)(?:\n\s*\n|$)/
  );
  if (m) return { expected: m[1].trim(), actual: m[2].trim() };
  return {};
}

// ---- authoritative test list -----------------------------------------
// When a TRX is available it is the source of truth for *which tests ran in the latest run*
// (TestResults/e2e.trx is overwritten every `dotnet test`). The on-disk results tree accumulates
// historical runs, so folder-driven listing leaks stale tests and — when the framework misnames
// folders — collapses many tests into one. We therefore seed the list from the TRX and attach each
// test's diagnostic folder by name. Without a TRX we fall back to the folder-driven list.
const recByFolder = {};
for (const r of records) recByFolder[r.folder] = r;
const sanitizeSeg = (s) =>
  String(s)
    .replace(/[^A-Za-z0-9_.\- ]/g, "_")
    .slice(0, 50);
function folderRecordFor(method, className) {
  // Post-fix framework convention: folder = "{SimpleClassName}.{Method}".
  const simple = className ? String(className).split(".").pop() : "";
  const expected = simple
    ? `${sanitizeSeg(simple)}.${sanitizeSeg(method)}`
    : sanitizeSeg(method);
  if (recByFolder[expected]) return recByFolder[expected];
  // Fallbacks: legacy method-only folders, then a normalized endsWith match.
  for (const r of records)
    if (r.folder === method || r.folder.endsWith("." + method)) return r;
  const mnorm = norm(method);
  for (const r of records)
    if (norm(r.folder) === mnorm || norm(r.folder).endsWith(mnorm)) return r;
  return null;
}

const trxNames = Object.keys(trxByName);
let entries;
if (trxNames.length) {
  let n = 0;
  entries = trxNames.map((name) => {
    const trx = trxByName[name];
    const rec = folderRecordFor(name, trx.className);
    const status =
      trx.outcome === "Failed"
        ? "fail"
        : trx.outcome === "Passed"
        ? "pass"
        : rec
        ? rec.status
        : "unknown";
    return { ti: n++, name, className: trx.className || "", status, rec, trx };
  });
} else {
  entries = records.map((rec) => ({
    ti: rec.ti,
    name: rec.folder,
    className: (trxFor(rec.folder) || {}).className || "",
    status: rec.status,
    rec,
    trx: trxFor(rec.folder),
  }));
}

for (const entry of entries) {
  const ti = entry.ti;
  const rec = entry.rec; // null when TRX lists a test with no diagnostic folder
  const trx = entry.trx;
  const displayName = humanize(entry.name);
  const test = {
    id: ti,
    name: entry.name,
    displayName,
    className: entry.className || (trx && trx.className) || "",
    status: entry.status,
    durationMs: trx ? trx.durationMs : null,
    tags: [],
    attempts: [],
    bdd: bddFor(entry.name, displayName) || {
      source: "derived",
      summary: displayName,
      steps: deriveGherkin(displayName),
    },
    steps: [],
    failure: null,
    consoleIds: [],
    networkIds: [],
    screenshotIds: [],
    noDiagnostics: !rec,
    diagDir: null, // absolute path to this test's representative run folder (for subagent enrichment)
    // Subagent-provided (Phase 1.5, merged in by merge-analysis.js). Null until enriched.
    scenario: null, // { source: 'feature'|'generated', title, steps:[{keyword,text}], note }
    failureAnalysis: null, // { verdict, headline, detail, expected, actual, noise:[] }
  };

  let cIds = [],
    nIds = [],
    rep = null;
  if (rec) {
    test.diagDir = rec.attemptRuns[0].dir;
    // attempts metadata
    test.attempts = rec.runs.map((r, i) => ({
      index: i,
      status: r.status,
      ts: r.ts,
    }));
    // representative run = first attemptRun (latest failed if present)
    rep = rec.attemptRuns[0];
    // steps + console + network for representative
    test.steps = parseSteps(readText(path.join(rep.dir, "test_steps.log")));
    cIds = pushConsole(ti, readJson(path.join(rep.dir, "console.json")));
    nIds = pushNetwork(ti, readJson(path.join(rep.dir, "network.json")));
    test.consoleIds = cIds;
    test.networkIds = nIds;
    // screenshots
    const wantFinal =
      SHOT_POLICY === "all" ||
      (SHOT_POLICY === "failures" && test.status !== "pass");
    if (wantFinal) {
      const fs1 = path.join(
        rep.dir,
        rep.status === "fail"
          ? "final_state_FAILED.png"
          : "final_state_PASSED.png"
      );
      const u = dataUri(fs1);
      if (u) {
        const id = `s${ti}-final`;
        shotArr.push({
          id,
          caption: "Final state (" + rep.status + ")",
          dataUri: u,
        });
        test.screenshotIds.push(id);
      }
    }
  }

  // failure evidence
  if (test.status === "fail") {
    const failRun = rec
      ? rec.failed.length
        ? rec.failed[rec.failed.length - 1]
        : rep
      : null;
    let ps = null,
      dom = null,
      crash = false,
      failConsole = [],
      failNet = [],
      fshotId = null;
    if (failRun) {
      ps = readJson(path.join(failRun.dir, "page_state.json"));
      dom = readText(path.join(failRun.dir, "failure_html.html"));
      if (dom) {
        crash = /class="reload"/.test(dom) && dom.length < 4000;
        if (dom.length > MAX_DOM)
          dom = dom.slice(0, MAX_DOM) + "\n… [truncated]";
      }
      failConsole =
        failRun === rep
          ? cIds
          : pushConsole(ti, readJson(path.join(failRun.dir, "console.json")));
      failNet =
        failRun === rep
          ? nIds
          : pushNetwork(ti, readJson(path.join(failRun.dir, "network.json")));
      const fu = dataUri(path.join(failRun.dir, "failure_screenshot.png"));
      if (fu) {
        fshotId = `s${ti}-fail`;
        shotArr.push({
          id: fshotId,
          caption: "Failure — " + (ps ? ps.url : ""),
          dataUri: fu,
        });
      }
    }
    const consoleErrIds = failConsole.filter((id) => {
      const c = consoleArr.find((x) => x.id === id);
      return c && c.level === "error" && !NOISE.test(c.text);
    });
    const failedReqIds = failNet.filter((id) => {
      const n = netArr.find((x) => x.id === id);
      return (
        n && (n.status >= 400 || n.error || !n.status) && !NOISE.test(n.url)
      );
    });
    const message = trx
      ? trx.message
      : rec
      ? findStdoutMessage(rec.folder)
      : null;
    const ea = extractExpectedActual(message);
    const cat = categorize(
      message,
      trx && trx.stack,
      failedReqIds.map((id) => netArr.find((x) => x.id === id)),
      consoleErrIds.map(
        (id) => (consoleArr.find((x) => x.id === id) || {}).text
      )
    );
    const failStepIdx =
      (test.steps.find((s) => s.status === "fail") || {}).idx || null;
    test.failure = {
      category: cat.name,
      cause: cat.cause,
      stepIdx: failStepIdx,
      expected: ea.expected,
      actual: ea.actual,
      message:
        message || "(no assertion message captured — run with --logger trx)",
      stack: trx && trx.stack,
      failureScreenshotId: fshotId,
      pageUrl: ps ? ps.url : null,
      domHtml: dom,
      crash,
      consoleErrorIds: consoleErrIds,
      failedRequestIds: failedReqIds,
    };
  }
  out.tests.push(test);
}
function deriveGherkin(displayName) {
  const parts = displayName.split(/\s+(?:When|If|After|Then|And)\s+/i);
  return [{ keyword: "Given", text: displayName }]
    .slice(0, 1)
    .concat(
      parts.length > 1
        ? [
            { keyword: "When", text: parts[1] || "" },
            { keyword: "Then", text: parts.slice(2).join(" ") || displayName },
          ]
        : []
    )
    .filter((g) => g.text);
}
function findStdoutMessage(folder) {
  if (!A.stdout) return null;
  const txt = readText(A.stdout);
  if (!txt) return null;
  const i = txt.indexOf(folder.slice(0, 40));
  if (i < 0) return null;
  const seg = txt.slice(i, i + 1200);
  const m = seg.match(/(Expected:[\s\S]*?But was:[\s\S]*?)(?:\n\s*\n|at )/);
  return m ? m[1].trim() : null;
}

// className from TRX if present
for (const t of out.tests) {
  const trx = trxFor(t.name);
  if (trx && trx.className) t.className = trx.className;
}

// ---- suites (group by className or folder prefix) ---------------------
const suiteMap = {};
for (const t of out.tests) {
  const key = t.className || "E2E Tests";
  if (!suiteMap[key]) suiteMap[key] = { name: key, testIds: [] };
  suiteMap[key].testIds.push(t.id);
}
out.suites = Object.values(suiteMap);

// ---- categories -------------------------------------------------------
const catMap = {};
for (const t of out.tests) {
  if (t.failure) {
    const c = t.failure.category;
    catMap[c] = catMap[c] || {
      name: c,
      cause: t.failure.cause,
      count: 0,
      testIds: [],
    };
    catMap[c].count++;
    catMap[c].testIds.push(t.id);
  }
}
out.categories = Object.values(catMap);

// ---- run totals -------------------------------------------------------
const totals = {
  total: out.tests.length,
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
};
for (const t of out.tests)
  totals[
    t.status === "pass"
      ? "passed"
      : t.status === "fail"
      ? "failed"
      : t.status === "flaky"
      ? "flaky"
      : "skipped"
  ]++;
const totalDur = out.tests.reduce((s, t) => s + (t.durationMs || 0), 0) || null;
out.run = {
  title: A.title || "E2E Test Run",
  branch: A.branch,
  commit: A.commit,
  runsettings: A.runsettings,
  generatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC",
  os: process.platform,
  durationMs: totalDur,
  totals,
  passRatePct: totals.total
    ? Math.round((totals.passed / totals.total) * 100)
    : 0,
};

log(
  `parse-e2e: ${totals.total} tests (${totals.passed}P/${totals.failed}F/${totals.flaky}flaky), ${shotArr.length} shots, ${consoleArr.length} console, ${netArr.length} net.`
);
const json = JSON.stringify(out);
if (A.out) {
  fs.writeFileSync(A.out, json);
  log("wrote " + A.out);
} else process.stdout.write(json + "\n");
