#!/usr/bin/env node
/*
 * inject-report.js — embed REPORT_DATA JSON into the report template safely.
 *
 * Usage: node inject-report.js <template.html> <report-data.json> <title> <output.html>
 *
 * Three embedding hazards this handles (each otherwise blanks the page):
 *  1. String-form replace would interpret $&, $1, $$ in embedded DOM/console data -> function replace.
 *  2. A literal "</script>" inside captured failure_html.html closes the report's <script> early ->
 *     escape "</" to "<\/" (a no-op inside a JSON string).
 *  3. Raw U+2028 / U+2029 are line terminators inside a JS string literal -> escape them.
 */
const fs = require("fs");
const [tpl, dataFile, title, out] = process.argv.slice(2);
if (!tpl || !dataFile || !out) {
  process.stderr.write(
    "usage: inject-report.js <template> <data.json> <title> <output>\n"
  );
  process.exit(1);
}
const LS = new RegExp(String.fromCharCode(0x2028), "g");
const PS = new RegExp(String.fromCharCode(0x2029), "g");
let t = fs.readFileSync(tpl, "utf8");
let d = fs
  .readFileSync(dataFile, "utf8")
  .replace(/<\//g, "<\\/")
  .replace(LS, "\\u2028")
  .replace(PS, "\\u2029");
t = t
  .replace("{{REPORT_DATA_JSON}}", () => d)
  .replace("{{TITLE}}", () => title || "E2E Run");
const left = t.match(/\{\{[A-Z_]+\}\}/g) || [];
if (left.length)
  process.stderr.write(
    "warning: unreplaced placeholders: " + left.join(", ") + "\n"
  );
fs.writeFileSync(out, t);
process.stderr.write(
  "inject-report: wrote " + out + " (" + t.length + " bytes)\n"
);
