#!/usr/bin/env python3
"""Merge an automated run into the run data, build the page and plan the publish.

Usage: python finish.py <workdir>

Reads   <workdir>/run-data.json            (from extract.py)
        <workdir>/results/run.json         (run-level facts, videos)
        <workdir>/results/steps/<id>.json  (one file per step)
Writes  <workdir>/run-data.final.json
        <workdir>/<ticket>-acceptance.html
        <workdir>/publish.json             (file_path, root and the files batches for the Artifact tool)

A run.json with "partial": true re-runs only some steps: the earlier results of
the other steps, and their already-published evidence, are kept.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "acceptance-run" / "scripts"))
import build  # noqa: E402  (the shared page builder and validator)

MAX_FILE = 15 * 1024 * 1024
MAX_BATCH_FILES = 250
MAX_BATCH_BYTES = 12 * 1024 * 1024  # larger single publishes failed with ECONNRESET


def files_of(results):
    """Every evidence file a results object points at."""
    out = set()
    for v in results.get("videos") or []:
        if v.get("src"):
            out.add(v["src"])
    for r in (results.get("steps") or {}).values():
        out.update(sh["src"] for sh in r.get("shots") or [] if sh.get("src"))
        out.update(h["full"] for h in r.get("http") or [] if h.get("full"))
        if (r.get("video") or {}).get("src"):
            out.add(r["video"]["src"])
    return out


def tally(results):
    c = {}
    for r in (results.get("steps") or {}).values():
        c[r.get("status")] = c.get(r.get("status"), 0) + 1
    return c


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    wd = Path(sys.argv[1]).resolve()
    data = json.loads((wd / "run-data.json").read_text(encoding="utf-8"))
    prev = data.get("results") or {}
    run = json.loads((wd / "results" / "run.json").read_text(encoding="utf-8"))
    partial = bool(run.pop("partial", False)) and bool(prev)

    new_steps = {}
    for f in sorted((wd / "results" / "steps").glob("*.json")):
        r = json.loads(f.read_text(encoding="utf-8"))
        new_steps[r.pop("id", f.stem)] = r
    steps = dict(prev.get("steps") or {}) if partial else {}
    steps.update(new_steps)
    order = {s["id"]: i for i, s in enumerate(data["steps"])}
    steps = dict(sorted(steps.items(), key=lambda kv: order.get(kv[0], 1e9)))

    values = dict(prev.get("values") or {}) if partial else {}
    for r in steps.values():
        values.update(r.get("values") or {})
    records = [dict(x, step=x.get("step", sid)) for sid, r in steps.items() for x in r.get("records") or []]
    videos = list(run.pop("videos", []))
    if partial:
        used = {r["video"]["id"] for r in steps.values() if (r.get("video") or {}).get("id")}
        have = {v["id"] for v in videos}
        videos += [v for v in prev.get("videos") or [] if v["id"] in used and v["id"] not in have]

    previous = []
    if prev.get("run") and prev["run"].get("id") != run.get("id"):
        t = tally(prev)
        previous = [{"id": prev["run"]["id"], "finished": prev["run"].get("finished"),
                     "pass": t.get("pass", 0), "fail": t.get("fail", 0), "blocked": t.get("blocked", 0)}]
        previous += (prev["run"].get("previous") or [])[:4]
    if previous:
        run["previous"] = previous

    results = {"run": run, "values": values, "videos": videos, "records": records, "steps": steps}
    data["results"] = results
    published = files_of(prev) if partial else set()
    page = wd / f"{data['meta']['ticket']}-acceptance.html"
    (wd / "run-data.final.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    if not build.build(data, page, published):
        sys.exit(1)

    wanted = files_of(results)
    send = sorted(p for p in wanted if (wd / p).is_file() and p not in published)
    remove = sorted(files_of(prev) - wanted)
    too_big = [p for p in send if (wd / p).stat().st_size > MAX_FILE]
    if too_big:
        sys.exit("error: over 15 MB, split or re-take: " + ", ".join(too_big))

    batches, cur, size = [], {}, 0
    for p in send:
        n = (wd / p).stat().st_size
        if cur and (len(cur) >= MAX_BATCH_FILES or size + n > MAX_BATCH_BYTES):
            batches.append(cur)
            cur, size = {}, 0
        cur[p] = p
        size += n
    if cur or remove:
        batches.append(cur)
    for p in remove:
        batches[0][p] = None
    total = sum((wd / p).stat().st_size for p in send)
    plan = {"file_path": str(page), "root": str(wd), "batches": batches}
    (wd / "publish.json").write_text(json.dumps(plan, indent=1), encoding="utf-8", newline="\n")

    t = tally(results)
    print(f"results: " + ", ".join(f"{n} {k}" for k, n in t.items()) + (" (partial re-run)" if partial else ""))
    print(f"publish: {len(send)} files, {total / 1048576:.1f} MB in {len(batches)} batch(es)"
          + (f"; removes {len(remove)} files of the earlier run" if remove else ""))
    print(f"plan: {wd / 'publish.json'}")


if __name__ == "__main__":
    main()
