#!/usr/bin/env python3
"""Build an acceptance-run page from a run-data JSON file.

Usage: python build.py <run-data.json> <out.html>

Checks the data before building, so a broken reference shows up here
instead of as a silently empty step in the page. Exits non-zero on errors.
"""
import json
import re
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template.html"
TOKEN = re.compile(r"\{([A-Z][A-Z0-9_]*)\}")
RESERVED = {"BASE", "ALIAS"}


def strings(node):
    """Yield every string inside a JSON value."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


def validate(d, out_dir=None, published=()):
    errors, warnings = [], []
    for k in ("meta", "phases", "steps"):
        if k not in d:
            errors.append(f"missing top-level key '{k}'")
    if errors:
        return errors, warnings
    for k in ("ticket", "title", "storageKey"):
        if not d["meta"].get(k):
            errors.append(f"meta.{k} is required")

    fields = {}
    for g in (d.get("data") or {}).get("groups", []):
        for f in g.get("fields", []):
            if f["k"] in fields:
                errors.append(f"field '{f['k']}' defined twice")
            fields[f["k"]] = f
        for r in (g.get("table") or {}).get("rows", []):
            for c in r.get("cells", []):
                if isinstance(c, dict) and c.get("k") and c["k"] not in fields:
                    errors.append(f"table cell in group '{g['title']}' uses undefined field '{c['k']}'")

    ids = [s.get("id") for s in d["steps"]]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        errors.append(f"duplicate step ids: {sorted(dupes)}")
    key_steps = {r["step"] for r in (d.get("key") or {}).get("rows", [])}
    for s in d["steps"]:
        for req in ("id", "t", "d", "e"):
            if not s.get(req):
                errors.append(f"step {s.get('id')}: '{req}' is required")
        if not isinstance(s.get("ph"), int) or not 0 <= s["ph"] < len(d["phases"]):
            errors.append(f"step {s.get('id')}: phase index {s.get('ph')} out of range")
        for k in s.get("fields", []):
            if k not in fields:
                errors.append(f"step {s['id']}: inline field '{k}' is not defined in data.groups")
        if s.get("check") and s["check"] not in key_steps:
            errors.append(f"step {s['id']}: check '{s['check']}' has no row in key.rows")
        if not s.get("b"):
            warnings.append(f"step {s['id']}: no business meaning (b)")

    for r in (d.get("key") or {}).get("rows", []):
        if r["step"] not in ids:
            errors.append(f"key row '{r['step']}' points to a step that does not exist")
        cols = (d.get("key") or {}).get("cols", [])
        if len(r.get("items", [])) != len(cols):
            errors.append(f"key row '{r['step']}' has {len(r.get('items', []))} items for {len(cols)} columns")
        for c in r.get("items", []):
            if c.get("v") and c["v"] not in fields:
                errors.append(f"key row '{r['step']}' references undefined field '{c['v']}'")

    dom = d.get("domain")
    if not dom:
        errors.append("domain is required: the 'Why it exists' tab")
    else:
        figs = dom.get("figures") or []
        if not any("<svg" in (f.get("html") or "") for f in figs):
            errors.append("domain.figures needs at least one figure with an inline <svg> picture")
        for f in figs:
            if "{" in (f.get("html") or "") and TOKEN.search(f["html"]):
                errors.append(f"domain figure '{f.get('h')}': use <tspan data-t=\"KEY\"> for live values, not {{KEY}} inside SVG")

    covered = set()
    for ac, (_, refs) in (d.get("ac") or {}).items():
        for i in refs:
            if i not in ids:
                errors.append(f"{ac} lists step '{i}' that does not exist")
            covered.add(i)
        if not refs:
            errors.append(f"{ac} has no covering step")
    if not d.get("ac"):
        warnings.append("no acceptance criteria mapped (ac)")

    for text in strings({k: v for k, v in d.items() if k not in ("data", "results")}):
        for name in TOKEN.findall(text):
            if name not in fields and name not in RESERVED:
                warnings.append(f"token {{{name}}} has no field; it will render literally")

    if d.get("results"):
        validate_results(d["results"], ids, fields, out_dir, set(published), errors, warnings)
    for text in strings(d):
        for pat, what in SECRETS:
            if pat.search(text):
                errors.append(f"looks like a {what} in the run data; redact it (the page is shareable): {pat.search(text).group(0)[:24]}…")
    return errors, sorted(set(warnings))


STATUSES = {"pass", "fail", "blocked", "skip", "manual"}
METHODS = {"asserted", "observed", "manual"}
CAUSES = {"product", "run", "env", "known"}
SECRETS = [
    (re.compile(r"Bearer\s+[A-Za-z0-9\-_.=]{16,}"), "bearer token"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+"), "JWT"),
    (re.compile(r"(?i)\"(password|passwd|secret|refresh_?token|access_?token|client_?secret)\"\s*:\s*\"(?!\[redacted\])[^\"]+\""), "credential field"),
    # A placeholder such as "Bearer {TOKEN}" or "<token>" is fine; a real value is not.
    (re.compile(r"(?i)(?:^|\n)\s*(?:authorization|cookie|set-cookie)\s*:\s*(?!\[redacted\])(?:bearer\s+|basic\s+)?(?![{<\[])\S{8,}"), "auth header"),
]


def validate_results(res, ids, fields, out_dir, published, errors, warnings):
    """Automated results: every reference must resolve, and every file the page shows must exist."""
    run = res.get("run") or {}
    if not run.get("id"):
        errors.append("results.run.id is required (a new id makes the page drop marks made against an older run)")
    videos = {v.get("id"): v for v in res.get("videos", [])}

    def need_file(src, where):
        if not src:
            errors.append(f"{where}: empty file path")
        elif out_dir and src not in published and not (out_dir / src).is_file():
            errors.append(f"{where}: file '{src}' not found next to the page")

    for v in videos.values():
        need_file(v.get("src"), f"video {v.get('id')}")
    for k in (res.get("values") or {}):
        if k not in fields:
            errors.append(f"results.values.{k} is not a field in data.groups")
    for sid, r in (res.get("steps") or {}).items():
        where = f"results step {sid}"
        if sid not in ids:
            errors.append(f"{where}: no such step")
        st = r.get("status")
        if st not in STATUSES:
            errors.append(f"{where}: status '{st}' is not one of {sorted(STATUSES)}")
        if r.get("method") and r["method"] not in METHODS:
            errors.append(f"{where}: method '{r['method']}' is not one of {sorted(METHODS)}")
        if r.get("cause") and r["cause"] not in CAUSES:
            errors.append(f"{where}: cause '{r['cause']}' is not one of {sorted(CAUSES)}")
        if st in ("fail", "blocked", "manual") and not (r.get("summary") or r.get("failure")):
            errors.append(f"{where}: a {st} step needs a summary or failure that says why")
        if st == "fail" and not r.get("cause"):
            errors.append(f"{where}: a failed step needs a cause (product, run, env or known)")
        checks = r.get("checks") or []
        if r.get("method") == "asserted" and not checks:
            errors.append(f"{where}: method 'asserted' needs at least one check with expected and actual")
        for c in checks:
            if "ok" not in c or "actual" not in c:
                errors.append(f"{where}: every check needs 'actual' and 'ok'")
        if st == "pass" and any(not c.get("ok") for c in checks):
            errors.append(f"{where}: passes although a check does not hold")
        if st in ("pass", "fail") and not r.get("shots") and not r.get("http"):
            warnings.append(f"{where}: {st} without a screenshot or API call; the viewer has nothing to look at")
        for i, sh in enumerate(r.get("shots") or []):
            need_file(sh.get("src"), f"{where} shot {i + 1}")
        for h in r.get("http") or []:
            if h.get("full"):
                need_file(h["full"], f"{where} http {h.get('url')}")
        vref = r.get("video")
        if vref and vref.get("src"):
            need_file(vref["src"], f"{where} recording")
            if not vref.get("dur"):
                errors.append(f"{where}: a step recording needs 'dur' in seconds (measure it in a browser)")
        elif vref:
            if vref.get("id") not in videos:
                errors.append(f"{where}: video '{vref.get('id')}' is not in results.videos")
            elif not (0 <= vref.get("t0", -1) <= vref.get("t1", -1)):
                errors.append(f"{where}: video t0/t1 must satisfy 0 <= t0 <= t1")
    missing = [i for i in ids if i not in (res.get("steps") or {})]
    if missing:
        warnings.append(f"no automated result for steps {missing}; they show as 'not part of the automated run'")


def build(data, out_path, published=()):
    """Validate and write the page. Returns False (after printing errors) when the data is broken."""
    out_path = Path(out_path)
    errors, warnings = validate(data, out_path.resolve().parent, published)
    for w in warnings:
        print(f"warning: {w}")
    if errors:
        for e in errors:
            print(f"error: {e}")
        return False
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("__TITLE__", f"{data['meta']['ticket']} Acceptance Run")
    html = html.replace("/*__RUN_DATA__*/", payload)
    out_path.write_text(html, encoding="utf-8", newline="\n")
    print(f"built {out_path} ({len(data['steps'])} steps, {len(data.get('ac') or {})} ACs"
          + (f", results for {len((data.get('results') or {}).get('steps') or {})} steps" if data.get("results") else "") + ")")
    return True


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not build(data, sys.argv[2]):
        sys.exit(1)


if __name__ == "__main__":
    main()
