#!/usr/bin/env python3
"""Pull the run data out of a published acceptance-run page.

Usage: python extract.py <page.html> <workdir>

Writes <workdir>/run-data.json and prints what the run contains, including
the results of an earlier automated run if the page already has them.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

RUN_DATA = re.compile(r'<script id="run-data" type="application/json">(.*?)</script>', re.S)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    html = Path(sys.argv[1]).read_text(encoding="utf-8")
    m = RUN_DATA.search(html)
    if not m:
        sys.exit("error: no run data in this page; it was not built by acceptance-run")
    data = json.loads(m.group(1))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    (out / "run-data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")

    meta, steps = data["meta"], data["steps"]
    print(f"{meta['ticket']} · {meta.get('title', '')} · {meta.get('sliceLabel', '')}")
    print(f"app: {meta.get('appBase') or '(none)'}  tenant: {meta.get('alias') or '(none)'}")
    print(f"{len(data['phases'])} phases, {len(steps)} steps ({sum(1 for s in steps if s.get('code'))} with HTTP/SQL snippets), {len(data.get('ac') or {})} ACs")
    if meta.get("knownIssues"):
        print("known issues: " + "; ".join(meta["knownIssues"]))
    res = data.get("results")
    if res:
        st = Counter(r.get("status") for r in (res.get("steps") or {}).values())
        print(f"earlier automated run {res.get('run', {}).get('id')}: " + ", ".join(f"{n} {k}" for k, n in st.items()))
        redo = [i for i, r in res["steps"].items() if r.get("status") in ("fail", "blocked")]
        if redo:
            print("failed or blocked: " + " ".join(redo))
    print(f"wrote {out / 'run-data.json'}")


if __name__ == "__main__":
    main()
