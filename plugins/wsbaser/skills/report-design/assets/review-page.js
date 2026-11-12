/* Review page behaviour. Paste into each review page unchanged.
 * Reads <script type="application/json" id="review-data"> = { review, issues };
 * an issue's optional `decision` is the record's owner decision ({ by, choice, status }).
 * Pure functions first (never mutate their input), then boot() for the DOM. */
(function () {
  'use strict';

  var LINE_END = '[\\r\\n\\v\\f\\x1c-\\x1e\\x85\\u2028\\u2029]+';
  var LINE_END_RE = new RegExp('\\s*' + LINE_END + '\\s*', 'g');

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function ids(issues) { return issues.map(function (i) { return i.id; }); }
  function findIssue(issues, id) {
    for (var k = 0; k < issues.length; k++) if (issues[k].id === id) return issues[k];
    return null;
  }
  function findOption(issue, optionId) {
    var o = issue && issue.options || [];
    for (var k = 0; k < o.length; k++) if (o[k].id === optionId) return o[k];
    return null;
  }
  function copyState(state) {
    var out = {};
    Object.keys(state).forEach(function (k) { out[k] = Object.assign({}, state[k]); });
    return out;
  }
  function oneLine(text, joiner) {
    return String(text == null ? '' : text).trim().replace(LINE_END_RE, joiner).trim();
  }

  function recommendedFor(issue, state) {
    var dep = issue.dependsOn;
    if (dep && state && has(state, dep.issue) && state[dep.issue].choice != null && has(dep.map, state[dep.issue].choice)) {
      var mapped = dep.map[state[dep.issue].choice];
      if (findOption(issue, mapped)) return mapped;
    }
    return issue.recommended != null && findOption(issue, issue.recommended) ? issue.recommended : null;
  }

  /* Dependency sync: undecided dependents follow the parent; so do agent-decided
   * dependents (the agent's decision is "follow the map"); an owner decision
   * whose recommendation moved is kept and flagged stale. */
  function sync(state, issues) {
    var s = copyState(state);
    for (var pass = 0; pass <= issues.length; pass++) {
      var changed = false;
      issues.forEach(function (issue) {
        var st = s[issue.id], rec = recommendedFor(issue, s), next;
        if (!st) return;
        if (st.status === 'undecided') {
          next = { choice: rec, stale: false };
        } else if (st.by === 'owner') {
          var moved = st.rec !== undefined && st.rec !== rec;
          next = { choice: st.choice, stale: moved && st.choice !== rec };
        } else if (issue.dependsOn && rec != null) {
          next = { choice: rec, stale: false };
        } else {
          next = { choice: st.choice, stale: false };
        }
        if (st.choice !== next.choice || st.stale !== next.stale) {
          s[issue.id] = Object.assign({}, st, next);
          changed = true;
        }
      });
      if (!changed) break;
    }
    return s;
  }

  function createState(issues, saved) {
    var s = {};
    saved = saved && typeof saved === 'object' ? saved : {};
    issues.forEach(function (issue) {
      var agent = !issue.needsOwner && issue.agentChoice != null;
      var st = agent
        ? { choice: issue.agentChoice, note: '', status: 'decided', by: 'agent', stale: false }
        : { choice: issue.recommended != null && findOption(issue, issue.recommended) ? issue.recommended : null, note: '', status: 'undecided', by: null, stale: false };
      st.round = issue.round;
      var sv = has(saved, issue.id) && saved[issue.id] && typeof saved[issue.id] === 'object' ? saved[issue.id] : null;
      /* An issue reworked in a later round starts fresh; a saved entry without a round counts as round 1. */
      if (sv && issue.round > (typeof sv.round === 'number' ? sv.round : 1)) sv = null;
      /* The record's owner decision acts as a saved owner entry of the issue's round;
       * only an owner answer saved in this browser is newer. */
      var d = issue.decision;
      if (d && d.by === 'owner' && !(sv && sv.by === 'owner' && (sv.status === 'decided' || sv.status === 'disputed'))) {
        sv = { choice: d.choice, status: d.status, by: 'owner', round: issue.round, note: sv && typeof sv.note === 'string' ? sv.note : '' };
      }
      if (sv) {
        if (typeof sv.note === 'string') st.note = sv.note;
        var decidedBefore = sv.status === 'decided' || sv.status === 'disputed';
        if (decidedBefore && sv.by === 'agent') {
          if (issue.agentChoice != null) { st.choice = issue.agentChoice; st.status = 'decided'; st.by = 'agent'; }
        } else if (decidedBefore && findOption(issue, sv.choice)) {
          st.choice = sv.choice; st.by = 'owner';
          st.status = findOption(issue, sv.choice).dispute ? 'disputed' : 'decided';
          if (sv.rec !== undefined) st.rec = sv.rec;
        }
      }
      s[issue.id] = st;
    });
    return sync(s, issues);
  }

  function update(state, issues, id, change) {
    if (!has(state, id)) return state;
    var s = copyState(state);
    s[id] = Object.assign(s[id], change);
    return sync(s, issues);
  }

  function choose(state, issues, id, optionId) {
    var issue = findIssue(issues, id), opt = findOption(issue, optionId);
    if (!opt || !has(state, id)) return state;
    return update(state, issues, id, {
      choice: optionId, by: 'owner', status: opt.dispute ? 'disputed' : 'decided', stale: false, rec: recommendedFor(issue, state)
    });
  }

  function confirm(state, issues, id) {
    var issue = findIssue(issues, id);
    if (!issue || !has(state, id) || state[id].status !== 'undecided' || state[id].choice == null) return state;
    return update(state, issues, id, { status: 'decided', by: 'owner', stale: false, rec: recommendedFor(issue, state) });
  }

  function reopen(state, issues, id) {
    var issue = findIssue(issues, id);
    if (!issue || !has(state, id)) return state;
    var s = update(state, issues, id, { status: 'undecided', by: null, stale: false });
    delete s[id].rec;
    return update(s, issues, id, { choice: recommendedFor(issue, s) });
  }

  function restoreAgent(state, issues, id) {
    var issue = findIssue(issues, id);
    if (!issue || !has(state, id) || issue.agentChoice == null) return state;
    var s = update(state, issues, id, { choice: issue.agentChoice, by: 'agent', status: 'decided', stale: false });
    delete s[id].rec;
    return s;
  }

  function setNote(state, id, text) {
    if (!has(state, id)) return state;
    var s = copyState(state);
    s[id].note = String(text == null ? '' : text);
    return s;
  }

  function counts(state, issues) {
    var out = { decided: 0, total: issues.length, undecided: [], disputed: [] };
    issues.forEach(function (issue) {
      var st = state[issue.id];
      if (!st || st.status === 'undecided') out.undecided.push(issue.id);
      else if (st.status === 'disputed') out.disputed.push(issue.id);
      else out.decided++;
    });
    return out;
  }

  function labelOf(issue, optionId) {
    var o = findOption(issue, optionId);
    return o ? oneLine(o.label, ' ') : '';
  }

  function buildText(review, issues, state) {
    var c = counts(state, issues);
    var out = [
      'Decisions for ' + oneLine(review.title, ' ') + ', review round ' + review.round,
      'Review: ' + review.id,
      c.decided + ' of ' + c.total + ' decided',
      ''
    ];
    issues.forEach(function (issue) {
      var st = state[issue.id] || { choice: null, note: '', status: 'undecided', by: null };
      var rec = recommendedFor(issue, state);
      out.push(issue.id + '. ' + oneLine(issue.title, ' ') + (issue.round > 1 ? ' [new in round ' + issue.round + ']' : ''));
      if (st.status === 'undecided') {
        out.push(rec == null
          ? '   UNDECIDED. No recommendation.'
          : '   UNDECIDED. Agent recommends [' + rec + '] ' + labelOf(issue, rec) + '.');
      } else {
        var who = st.by === 'agent' ? 'agent decided, owner left it' : (st.choice === rec ? 'owner confirmed' : 'owner chose');
        var opt = findOption(issue, st.choice), line = '[' + st.choice + '] ' + labelOf(issue, st.choice);
        if (st.status === 'disputed') {
          out.push('   DISPUTED: ' + line + ' (' + who + ')');
        } else {
          var outcome = opt && opt.outcome ? ' - ' + oneLine(opt.outcome, ' ') : '';
          out.push('   Decision: ' + line + outcome + ' (' + who + ')');
        }
      }
      if (issue.dependsOn && has(state, issue.dependsOn.issue)) {
        var p = state[issue.dependsOn.issue];
        out.push('   Depends on: issue ' + issue.dependsOn.issue + ' = ' + (p.choice == null ? 'no choice yet' : '[' + p.choice + ']') +
          (p.status === 'decided' ? ' (confirmed)' : ' (not confirmed)'));
      }
      var note = oneLine(st.note, ' / ');
      if (note) out.push('   Note: ' + note);
    });
    if (c.undecided.length || c.disputed.length) out.push('');
    if (c.undecided.length) out.push('Undecided: ' + c.undecided.join(', ') + '. Do not act on these yet.');
    if (c.disputed.length) out.push('Disputed: ' + c.disputed.join(', ') + '. Re-think these using the notes.');
    return out.join('\n');
  }

  var api = {
    createState: createState, choose: choose, confirm: confirm, reopen: reopen,
    restoreAgent: restoreAgent, setNote: setNote, recommendedFor: recommendedFor,
    counts: counts, buildText: buildText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ---- DOM ---- */
  function boot() {
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var dataEl = $('#review-data'), data;
    try { data = JSON.parse(dataEl ? dataEl.textContent : ''); } catch (e) { return; }
    if (!data || !data.review) return;
    var review = data.review, issues = Array.isArray(data.issues) ? data.issues : [];
    var key = 'review:' + review.id, saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
    var state = createState(issues, saved);
    var filter = 'all';
    var articles = {};
    $$('article[data-issue]').forEach(function (a) { articles[a.getAttribute('data-issue')] = a; });

    function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }
    function optionIdOf(el) {
      if (!el) return null;
      if (el.getAttribute('data-choice') != null) return el.getAttribute('data-choice');
      if (el.getAttribute('data-option') != null) return el.getAttribute('data-option');
      var r = $('input[type=radio]', el);
      return r ? r.value : null;
    }
    var matches = {
      all: function () { return true; },
      needs: function (i) { return !!i.needsOwner; },
      agent: function (i) { return !i.needsOwner; },
      'new': function (i) { return i.round === review.round; }
    };

    function render() {
      issues.forEach(function (issue) {
        var a = articles[issue.id], st = state[issue.id], rec = recommendedFor(issue, state);
        if (!a || !st) return;
        a.setAttribute('data-state', st.status);
        a.setAttribute('data-by', st.by || '');
        a.hidden = !(matches[filter] || matches.all)(issue);
        $$('input[type=radio]', a).forEach(function (r) {
          r.checked = r.value === st.choice;
          var box = r.closest('label, [data-option]');
          if (box) box.classList.toggle('sel', r.checked);
        });
        $$('button[data-choice]', a).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-choice') === st.choice));
        });
        $$('[data-rec-tag]', a).forEach(function (t) {
          t.hidden = optionIdOf(t.closest('button[data-choice], [data-option], label')) !== rec;
        });
        $$('button[data-act]', a).forEach(function (b) {
          var act = b.getAttribute('data-act');
          b.hidden = act === 'confirm' ? !(st.status === 'undecided' && st.choice != null)
            : act === 'reopen' ? !(issue.needsOwner && st.status !== 'undecided')
            : act === 'restore' ? !(issue.agentChoice != null && st.by !== 'agent')
            : act === 'use-recommendation' ? rec == null : false;
        });
        $$('[data-stale-notice]', a).forEach(function (n) {
          n.hidden = !st.stale;
          if (rec != null) n.setAttribute('data-recommended', rec);
        });
        var ta = $('textarea[data-note]', a);
        if (ta && ta.value !== st.note) ta.value = st.note;
      });
      var c = counts(state, issues);
      $$('[data-progress]').forEach(function (p) { p.textContent = c.decided + ' of ' + c.total + ' decided'; });
      $$('[data-preview]').forEach(function (p) { p.textContent = buildText(review, issues, state); });
      $$('button[data-filter]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === filter));
      });
    }
    function apply(next) { state = next; save(); render(); }
    function issueIdOf(el) {
      var a = el.closest('article[data-issue]');
      return a ? a.getAttribute('data-issue') : null;
    }

    document.addEventListener('change', function (e) {
      var t = e.target, id = t && t.matches && t.matches('input[type=radio]') ? issueIdOf(t) : null;
      if (id != null) apply(choose(state, issues, id, t.value));
    });
    document.addEventListener('input', function (e) {
      var t = e.target, id = t && t.matches && t.matches('textarea[data-note]') ? issueIdOf(t) : null;
      if (id != null) apply(setNote(state, id, t.value));
    });

    var copyTimer;
    function copyText() {
      var btn = $('button[data-copy]');
      var label = btn && ($('[data-copy-label]', btn) || (btn.children.length ? null : btn));
      var original = label ? (label.getAttribute('data-original') || label.textContent) : '';
      if (label) label.setAttribute('data-original', original);
      var text = buildText(review, issues, state);
      function report(msg) {
        if (!label) return;
        label.textContent = msg;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () { label.textContent = original; }, 2500);
      }
      function fallback() {
        var prev = $('[data-preview]'), done = false;
        var d = prev && prev.closest('details');
        if (d) d.open = true;
        try {
          if (prev) {
            var range = document.createRange(); range.selectNodeContents(prev);
            var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          }
          done = document.execCommand('copy');
        } catch (e) { done = false; }
        report(done ? 'Copied' : 'Copy failed, select the text below');
      }
      try {
        navigator.clipboard.writeText(text).then(function () { report('Copied'); }, fallback);
      } catch (e) { fallback(); }
    }

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var b = t.closest('button');
      if (!b) return;
      var id = issueIdOf(b);
      if (b.hasAttribute('data-choice') && id != null) {
        apply(choose(state, issues, id, b.getAttribute('data-choice')));
      } else if (b.hasAttribute('data-act') && id != null) {
        var act = b.getAttribute('data-act'), issue = findIssue(issues, id);
        if (act === 'confirm') apply(confirm(state, issues, id));
        else if (act === 'reopen') apply(reopen(state, issues, id));
        else if (act === 'restore') apply(restoreAgent(state, issues, id));
        else if (act === 'use-recommendation' && issue) {
          var rec = recommendedFor(issue, state);
          if (rec != null) apply(choose(state, issues, id, rec));
        }
      } else if (b.hasAttribute('data-copy')) {
        copyText();
      } else if (b.hasAttribute('data-filter')) {
        filter = b.getAttribute('data-filter');
        render();
      }
    });

    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
