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

test('state is never mutated', () => {
  const issues = reduced();
  const s0 = R.createState(issues, {});
  const snap = JSON.stringify(s0);
  R.choose(s0, issues, '1', 'B'); R.confirm(s0, issues, '1'); R.setNote(s0, '1', 'x'); R.reopen(s0, issues, '3');
  assert.strictEqual(JSON.stringify(s0), snap);
});

test('owner decision whose recommendation later changed is kept and flagged', () => {
  const issues = reduced();
  const saved = R.confirm(R.createState(issues, {}), issues, '1');
  issues[0].recommended = 'C';
  const s = R.createState(issues, saved);
  assert.deepStrictEqual([s['1'].choice, s['1'].status, s['1'].stale], ['A', 'decided', true]);
});

test('single issue, single-solution review, line-end characters in text', () => {
  const issues = [reduced()[2]];
  issues[0].title = 'a b\r\nc';
  const s = R.createState(issues, {});
  const t = R.buildText(record.review, issues, s);
  assert.match(t, /1 of 1 decided/);
  assert.match(t, /\n3\. a b c\n   Decision: \[accept\] Accept - apply the null guard \(agent decided, owner left it\)/);
  assert.ok(!/Undecided:|Disputed:/.test(t));
});
