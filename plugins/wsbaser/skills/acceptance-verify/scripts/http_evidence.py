#!/usr/bin/env python3
"""Turn a dump of window.__av.take() into the step's `http` entries.

Usage: python http_evidence.py <calls.json> <workdir> <run-id> <step-id> [--key N[,N…]] [--ok N[,N…]]

calls.json is what evaluate_script returned from `() => window.__av.take()`,
saved with its filePath option. The bodies are already redacted by capture.js;
this script redacts again, writes each full response to
evidence/<run-id>/<step>-http-<n>.json, and prints the `http` list (with
excerpts) to paste into results/steps/<step>.json.
--key marks the calls (1-based) that prove the step; --ok marks expected
error statuses, e.g. a 409 the step wants to see.
"""
import json
import re
import sys
from pathlib import Path

SECRET = re.compile(r'(?i)"(password|passwd|secret|token|access_?token|refresh_?token|client_?secret|api_?key)"\s*:\s*"(?!\[redacted\])[^"]*"')
EXCERPT = 3000


def scrub(text):
    text = SECRET.sub(lambda m: f'"{m.group(1)}": "[redacted]"', text or "")
    return re.sub(r"(?i)(bearer\s+)[\w.\-=]+", r"\1[redacted]", text)


def nums(args, flag):
    if flag in args:
        return {int(x) for x in args[args.index(flag) + 1].split(",") if x}
    return set()


def main():
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    calls_path, wd, run_id, step = sys.argv[1:5]
    raw = json.loads(Path(calls_path).read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "result" in raw:
        raw = raw["result"]
    key, ok = nums(sys.argv, "--key"), nums(sys.argv, "--ok")
    out_dir = Path(wd) / "evidence" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for i, c in enumerate(raw, 1):
        res, req = scrub(c.get("res", "")), scrub(c.get("req", ""))
        e = {"method": c.get("method"), "url": c.get("url"), "status": c.get("status"), "ms": c.get("ms"),
             "req": req[:EXCERPT], "res": res[:EXCERPT]}
        if len(res) > EXCERPT:
            name = f"{step}-http-{i}.json"
            (out_dir / name).write_text(res, encoding="utf-8", newline="\n")
            e["full"] = f"evidence/{run_id}/{name}"
        if i in key:
            e["key"] = True
        if i in ok:
            e["ok"] = True
        entries.append(e)
    print(json.dumps(entries, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
