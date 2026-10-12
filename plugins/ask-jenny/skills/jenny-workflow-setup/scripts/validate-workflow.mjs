#!/usr/bin/env node
// Validate an Ask Jenny workflow YAML the way Jenny's loader will, before committing it.
// Usage: node validate-workflow.mjs <workflow.yaml> [--jenny <jenny-source-root>]
//
// Always checks the loader rules (Jenny's WorkflowLoaderService, 2026-10): required root fields
// (id, name, non-blank description, stages[]), stage shape, `outputs` present on every stage,
// unique stage ids, every `inputs[].from`, `when:` operand and `retryTarget` naming a stage declared
// EARLIER with that output, the `when:` grammar (`<stage>.<output>` [== | != 'literal']),
// skipFinalVerification only with continueOnLoopExhausted, and unknown {{tokens}} (warning).
// Also: positions unique (stages sharing a position are mutually exclusive — warning) and
// `status: 'loop'` only on stages with a retryTarget.
// With --jenny, the allowed stage keys, categories, output types and known tokens are read from
// Jenny's source (libs/types/src/workflow.ts, libs/prompts/src/stage-prompts.ts) instead of the
// built-in copy, so a newer Jenny is checked against itself. Needs a YAML parser: the `yaml`
// package is resolved from the Jenny source, the repo, or this directory.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const jennyAt = argv.indexOf('--jenny');
const jenny = jennyAt >= 0 ? path.resolve(argv[jennyAt + 1]) : null;
const file = argv.find((a, i) => !a.startsWith('--') && i !== jennyAt + 1);
if (!file) {
  console.error('usage: validate-workflow.mjs <workflow.yaml> [--jenny <jenny-source-root>]');
  process.exit(2);
}

let YAML = null;
for (const base of [jenny && path.join(jenny, 'package.json'), path.join(process.cwd(), 'package.json'), import.meta.url].filter(Boolean)) {
  try {
    YAML = createRequire(base)('yaml');
    break;
  } catch {
    /* try next */
  }
}
if (!YAML) {
  console.error('validate-workflow: no `yaml` package found (pass --jenny <jenny-source-root> or run from a repo that has it)');
  process.exit(2);
}

// Built-in copy of Jenny's contract; replaced from source when --jenny is given.
let stageKeys = ['id', 'label', 'category', 'position', 'stagePrompt', 'stageSystemPrompt', 'description', 'required', 'defaultEnabled', 'maxRetries', 'retryTarget', 'continueOnLoopExhausted', 'skipFinalVerification', 'outputs', 'inputs', 'when', 'model', 'timeoutMs', 'pauseBefore'];
let requiredKeys = ['id', 'label', 'category', 'position', 'stagePrompt', 'stageSystemPrompt'];
let categories = ['SPEC', 'BUILD', 'TEST'];
let outputTypes = ['file', 'file[]', 'url', 'text', 'json'];
let tokens = ['featureId', 'artifactHandle'];
const source = [];
if (jenny) {
  const types = path.join(jenny, 'libs/types/src/workflow.ts');
  const prompts = path.join(jenny, 'libs/prompts/src/stage-prompts.ts');
  if (fs.existsSync(types)) {
    const ts = fs.readFileSync(types, 'utf8');
    const body = ts.match(/export interface StageDefinition \{([\s\S]*?)\n\}/)?.[1];
    if (body) {
      const fields = [...body.matchAll(/^\s*(\w+)(\?)?:/gm)];
      stageKeys = fields.map((m) => m[1]);
      requiredKeys = fields.filter((m) => !m[2]).map((m) => m[1]);
      source.push(`StageDefinition from ${types}`);
    }
    const cat = ts.match(/export type StageCategory = ([^;]+);/)?.[1];
    if (cat) categories = [...cat.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const out = ts.match(/export type OutputType = ([^;]+);/)?.[1];
    if (out) outputTypes = [...out.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  } else console.warn(`validate-workflow: ${types} not found; using the built-in contract`);
  if (fs.existsSync(prompts)) {
    const t = fs.readFileSync(prompts, 'utf8').match(/KNOWN_WORKFLOW_TOKENS = \[([^\]]*)\]/)?.[1];
    if (t) tokens = [...t.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
}

const errors = [];
const warnings = [];
let def;
try {
  def = YAML.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`YAML parse error: ${e.message}`);
  process.exit(1);
}

for (const k of ['id', 'name']) if (typeof def?.[k] !== 'string' || !def[k]) errors.push(`missing root "${k}"`);
if (typeof def?.description !== 'string' || !def.description.trim()) errors.push('missing or blank root "description"');
else if (!/\bNot for\b/.test(def.description)) warnings.push('description lacks the "Not for …" clause of Jenny\'s selection contract');
if (!Array.isArray(def?.stages) || !def.stages.length) errors.push('"stages" must be a non-empty list');

const OPERAND = /^[^\s.'=!]+\.[^\s.'=!]+$/;
const operand = (t) => (OPERAND.test(String(t).trim()) ? String(t).trim().split('.') : null);
const earlier = new Map();
const positions = new Map();
for (const [i, st] of (def?.stages ?? []).entries()) {
  const at = `stage ${st?.id ?? `#${i}`}`;
  if (!st || typeof st !== 'object' || typeof st.id !== 'string' || !st.id) {
    errors.push(`stage #${i}: not a stage object with a non-empty string id`);
    continue;
  }
  for (const k of requiredKeys) if (st[k] === undefined) errors.push(`${at}: missing "${k}"`);
  for (const k of Object.keys(st)) if (!stageKeys.includes(k)) errors.push(`${at}: unknown key "${k}" (not in StageDefinition)`);
  if (st.category && !categories.includes(st.category)) errors.push(`${at}: category "${st.category}" not one of ${categories.join('/')}`);
  if (earlier.has(st.id)) errors.push(`${at}: duplicate stage id`);
  if (!('outputs' in st)) errors.push(`${at}: missing "outputs" (use {} if it produces none)`);
  for (const [name, o] of Object.entries(st.outputs ?? {})) {
    if (!outputTypes.includes(o?.type)) errors.push(`${at}: output "${name}" type "${o?.type}" not one of ${outputTypes.join(', ')}`);
    if (o?.schema && o.type !== 'json') errors.push(`${at}: output "${name}" has a schema but is not type json`);
  }
  const resolve = (ref, what) => {
    const op = operand(ref);
    if (!op) return errors.push(`${at}: ${what} "${ref}" is not a valid <stageId>.<outputName> reference`);
    const outs = earlier.get(op[0]);
    if (!outs) errors.push(`${at}: ${what} "${ref}" — stage "${op[0]}" is not declared before this stage`);
    else if (!outs.has(op[1])) errors.push(`${at}: ${what} "${ref}" — stage "${op[0]}" does not declare output "${op[1]}"`);
  };
  for (const inp of st.inputs ?? []) {
    if (typeof inp?.as !== 'string') errors.push(`${at}: input without a string "as"`);
    for (const ref of [inp?.from].flat()) resolve(ref, `input "${inp?.as}"`);
  }
  if (st.when != null) {
    const raw = String(st.when).trim();
    const opAt = raw.search(/[=!]=/);
    if (opAt >= 0 && !/^'[^']*'$/.test(raw.slice(opAt + 2).trim())) errors.push(`${at}: when "${raw}" — right side must be a single-quoted literal`);
    resolve(opAt >= 0 ? raw.slice(0, opAt) : raw, 'when');
  }
  if (st.retryTarget != null && !earlier.has(st.retryTarget)) errors.push(`${at}: retryTarget "${st.retryTarget}" is not a stage declared before it`);
  if (st.skipFinalVerification === true && st.continueOnLoopExhausted !== true) errors.push(`${at}: skipFinalVerification without continueOnLoopExhausted: true`);
  if (st.retryTarget == null && /status:\s*'loop'/.test(st.stageSystemPrompt ?? '')) errors.push(`${at}: tells the agent to return status 'loop' but has no retryTarget`);
  if (positions.has(st.position)) warnings.push(`${at}: shares position ${st.position} with ${positions.get(st.position)} (mutually exclusive stages)`);
  positions.set(st.position, st.id);
  for (const text of [st.stagePrompt, st.stageSystemPrompt])
    for (const m of String(text ?? '').matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))
      if (!tokens.includes(m[1])) (/^[A-Z_]+$/.test(m[1]) ? errors : warnings).push(`${at}: token {{${m[1]}}} ${/^[A-Z_]+$/.test(m[1]) ? 'is an unfilled setup placeholder' : 'is not substituted by Jenny'}`);
  earlier.set(st.id, new Set(Object.keys(st.outputs ?? {})));
}

console.log(`${file}: ${errors.length} error(s), ${warnings.length} warning(s)${source.length ? ` — checked against ${source.join(', ')}` : ' — built-in contract'}`);
for (const e of errors) console.log(`  error: ${e}`);
for (const w of warnings) console.log(`  warning: ${w}`);
process.exit(errors.length ? 1 : 0);
