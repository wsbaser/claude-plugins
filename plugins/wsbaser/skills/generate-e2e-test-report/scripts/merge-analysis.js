#!/usr/bin/env node
/*
 * merge-analysis.js — fold Phase-1.5 subagent output into REPORT_DATA.
 *
 * The subagents (BDD matcher, per-test scenario generators, per-test failure analysts) each emit a
 * small JSON object keyed by test id. This script merges them onto the parsed REPORT_DATA so the
 * template can render a labelled Gherkin scenario and an agent failure analysis for every test.
 *
 * Usage:
 *   node merge-analysis.js <report-data.json> <analysis-dir> <out.json>
 *
 * <analysis-dir> contains one or more *.json files. Each file is either:
 *   - a single entry:  { "id": 3, "scenario": {...}, "failureAnalysis": {...} }
 *   - or an array of entries: [ { "id": 0, ... }, { "id": 1, ... } ]
 *
 * Entry shape (all fields optional except id):
 *   id: number                              // test id from REPORT_DATA.tests[].id
 *   scenario: {
 *     source: "feature" | "generated",      // matched a .feature, or generated from test source
 *     title: string,                        // scenario name / one-line intent
 *     steps: [ { keyword: "Given"|"When"|"Then"|"And"|"But", text: string } ],
 *     note?: string                         // e.g. ".feature: SplitPurchaseInvoiceLine.feature" or "generated from test source"
 *   }
 *   failureAnalysis: {
 *     verdict: "product-bug" | "test-issue" | "infra-noise" | "flaky" | "unknown",
 *     headline: string,                     // the REAL one-line cause
 *     detail: string,                       // a short paragraph
 *     expected?: string, actual?: string,   // the real assertion, if any
 *     noise?: string[]                      // console/network lines that are unrelated red herrings
 *   }
 */
const fs = require("fs");
const path = require("path");

const [, , dataPath, analysisDir, outPath] = process.argv;
if (!dataPath || !analysisDir || !outPath) {
  console.error(
    "usage: node merge-analysis.js <report-data.json> <analysis-dir> <out.json>"
  );
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const byId = {};
for (const t of data.tests) byId[t.id] = t;

let files = [];
try {
  files = fs
    .readdirSync(analysisDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(analysisDir, f));
} catch {
  console.error("analysis dir not found: " + analysisDir);
}

let applied = 0,
  scen = 0,
  fa = 0,
  skipped = 0;
for (const f of files) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.error("skip unparseable " + path.basename(f) + ": " + e.message);
    continue;
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  for (const e of entries) {
    const t = byId[e.id];
    if (!t) {
      skipped++;
      continue;
    }
    if (
      e.scenario &&
      Array.isArray(e.scenario.steps) &&
      e.scenario.steps.length
    ) {
      t.scenario = e.scenario;
      scen++;
    }
    if (
      e.failureAnalysis &&
      (e.failureAnalysis.headline || e.failureAnalysis.detail)
    ) {
      t.failureAnalysis = e.failureAnalysis;
      fa++;
    }
    applied++;
  }
}

// Drop the now-unneeded diagDir to keep the embedded JSON lean.
for (const t of data.tests) delete t.diagDir;

fs.writeFileSync(outPath, JSON.stringify(data));
console.error(
  `merge-analysis: ${applied} entries applied (${scen} scenarios, ${fa} failure analyses), ${skipped} unmatched ids; wrote ${outPath}`
);
