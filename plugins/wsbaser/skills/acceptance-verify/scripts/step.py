#!/usr/bin/env python3
"""Write results/steps/<id>.json from what the page helper returned, plus a few fields you add.

Usage: python step.py <workdir> <run-id> <step-id> [--key N[,N…]] [--ok N[,N…]] [--draft <file>]

Reads   <workdir>/results/raw/<id>.json     what `window.__av.end()` returned, saved with evaluate_script's filePath
        <workdir>/results/drafts/<id>.json  optional (or --draft): fields you write yourself — summary, cause,
                                            failure, issue, actions, console, values, records, notes, captions
        <workdir>/run-data.json             to map answer-sheet checks to their ACs
        <workdir>/evidence/<run-id>/<id>-*.webp and <id>.mp4, found by name
Writes  <workdir>/results/steps/<id>.json, and full response bodies under evidence/

Fills in by itself, unless the draft says otherwise:
  status   pass when every check holds, fail when one does not ("blocked"/"manual"/"skip" only from the draft)
  method   asserted when there are checks
  acs      one verdict per AC when the checks carry an `ac` (from key.colAc) and the step covers several ACs
  shots    every <id>-<n>.webp in order; captions from the draft's "captions" list; the first one is the proof
  video    <id>.mp4 with dur = ms / 1000
  http     the step's API calls (redacted, excerpted), --key / --ok as in http_evidence.py
Prints the step's status and anything the reader would miss (a failed step without a cause or summary).
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from http_evidence import entries  # noqa: E402


def nums(args, flag):
    if flag in args:
        return {int(x) for x in args[args.index(flag) + 1].split(",") if x}
    return set()


def opt(args, flag):
    return args[args.index(flag) + 1] if flag in args else None


def main():
    a = sys.argv
    if len(a) < 4:
        sys.exit(__doc__)
    wd, run_id, sid = Path(a[1]), a[2], a[3]
    raw_p = wd / "results" / "raw" / f"{sid}.json"
    raw = json.loads(raw_p.read_text(encoding="utf-8")) if raw_p.is_file() else {}
    if isinstance(raw, dict) and "result" in raw and "checks" not in raw:
        raw = raw["result"]
    draft_p = Path(opt(a, "--draft")) if opt(a, "--draft") else wd / "results" / "drafts" / f"{sid}.json"
    draft = json.loads(draft_p.read_text(encoding="utf-8")) if draft_p.is_file() else {}
    data = json.loads((wd / "run-data.json").read_text(encoding="utf-8"))
    step = next((s for s in data["steps"] if s["id"] == sid), None)
    if not step:
        sys.exit(f"error: no step {sid} in run-data.json")

    checks = draft.get("checks") or raw.get("checks") or []
    r = {"id": sid}
    if raw.get("started"):
        r["started"] = raw["started"]
    if raw.get("ms"):
        r["ms"] = raw["ms"]
    r["checks"] = checks
    if "status" in draft:
        r["status"] = draft["status"]
    elif checks:
        r["status"] = "pass" if all(c.get("ok") for c in checks) else "fail"
    else:
        r["status"] = "manual"
    r["method"] = draft.get("method") or ("asserted" if checks else "observed")

    covered = step.get("ac") or []
    if len(covered) > 1 and any(c.get("ac") for c in checks):
        acs = {}
        for c in checks:
            for ac in [c.get("ac")] if c.get("ac") else covered:
                if ac in covered:
                    acs[ac] = "fail" if (acs.get(ac) == "fail" or not c.get("ok")) else "pass"
        r["acs"] = acs

    ev = wd / "evidence" / run_id
    caps = draft.get("captions") or []
    kinds = draft.get("kinds") or []
    shots = []
    pat = re.compile(rf"^{re.escape(sid)}-(\d+)\.webp$")
    for f in sorted((p for p in ev.glob(f"{sid}-*.webp") if pat.match(p.name)), key=lambda p: int(pat.match(p.name).group(1))):
        i = len(shots)
        sh = {"src": f"evidence/{run_id}/{f.name}", "cap": caps[i] if i < len(caps) else "",
              "kind": kinds[i] if i < len(kinds) else ("proof" if i == 0 else "context")}
        shots.append(sh)
    for sh, extra in zip(shots, draft.get("shotMeta") or []):
        sh.update(extra)  # at, url
    if shots:
        r["shots"] = shots
    clip = ev / f"{sid}.mp4"
    if clip.is_file() and raw.get("ms"):
        r["video"] = {"src": f"evidence/{run_id}/{clip.name}", "dur": round(raw["ms"] / 1000, 1)}

    calls = raw.get("calls") or []
    if calls:
        r["http"] = entries(calls, wd, run_id, sid, nums(a, "--key"), nums(a, "--ok"))

    for k in ("cause", "summary", "failure", "issue", "actions", "console", "tables", "records", "values", "notes", "retry", "workarounds"):
        if k in draft:
            r[k] = draft[k]

    out = wd / "results" / "steps" / f"{sid}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"{sid}: {r['status']} ({len(checks)} checks, {len(shots)} shots, {len(r.get('http') or [])} calls"
          + (", clip" if "video" in r else "") + (f", acs {r['acs']}" if "acs" in r else "") + ")")
    if r["status"] in ("fail", "blocked", "manual") and not (r.get("summary") or r.get("failure")):
        print(f"  needs: summary in results/drafts/{sid}.json")
    if r["status"] == "fail" and not r.get("cause"):
        print(f"  needs: cause (product, known, run, env) in results/drafts/{sid}.json")
    if step.get("known") and r["status"] == "fail" and r.get("cause") != "known":
        print(f"  note: the step is marked as a known failure ({step['known']}); use cause 'known' if this is it")


if __name__ == "__main__":
    main()
