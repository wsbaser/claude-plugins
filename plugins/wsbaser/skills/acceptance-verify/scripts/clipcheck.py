#!/usr/bin/env python3
"""Check that every step recording plays to its end, and fix the step files when one does not.

Usage: python clipcheck.py <workdir>                      writes <workdir>/clipcheck.html
       python clipcheck.py <workdir> --apply <result.json>  applies what the page found

Between the two: open file:///<workdir>/clipcheck.html in the browser (not in a tab that is recording),
wait for the title "done", and save `() => window.__clipcheck` with evaluate_script's filePath.

The page loads each clip, reads its length, and seeks to 25 %, 50 %, 75 % and the end. A clip that
errors at any point is damaged (it happened when a second tab opened during a recording). A clip much
shorter than its step's clock is compressed (a full page load removed the ticker). --apply removes a
damaged clip from its step and gives a compressed one its measured length, each with a note.
"""
import json
import sys
from pathlib import Path

PAGE = """<!doctype html><meta charset="utf-8"><title>checking</title>
<body><pre id="out"></pre><script>
const CLIPS = __CLIPS__;
const out = [];
function one(c) {
  return new Promise((done) => {
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto";
    let marks = [], i = 0, failed = null, timer = setTimeout(() => finish("timeout"), 20000);
    function finish(err) {
      clearTimeout(timer);
      out.push({ step: c.step, src: c.src, dur: c.dur, measured: isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null, error: err || null });
      v.remove(); done();
    }
    v.onerror = () => finish("decode error at " + (marks[i - 1] != null ? marks[i - 1].toFixed(1) : "load") + " s");
    v.onloadedmetadata = () => {
      // Chrome reports Infinity for some screencast files until it has seeked to the end.
      const go = () => { marks = [0.25, 0.5, 0.75, 0.999].map((f) => f * v.duration); next(); };
      if (isFinite(v.duration)) go(); else { v.currentTime = 1e9; v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0; go(); }; }
    };
    function next() { if (i >= marks.length) return finish(null); v.currentTime = marks[i++]; }
    v.onseeked = () => { if (marks.length) next(); };
    v.src = c.src; document.body.appendChild(v);
  });
}
(async () => {
  for (const c of CLIPS) await one(c);
  window.__clipcheck = out;
  document.getElementById("out").textContent = JSON.stringify(out, null, 1);
  document.title = "done";
})();
</script>"""

COMPRESSED = 0.6  # measured / step clock below this means the ticker was lost


def steps(wd):
    for f in sorted((wd / "results" / "steps").glob("*.json")):
        yield f, json.loads(f.read_text(encoding="utf-8"))


def write_page(wd):
    clips = [{"step": r.get("id", f.stem), "src": r["video"]["src"], "dur": r["video"].get("dur")}
             for f, r in steps(wd) if (r.get("video") or {}).get("src")]
    (wd / "clipcheck.html").write_text(PAGE.replace("__CLIPS__", json.dumps(clips)), encoding="utf-8", newline="\n")
    print(f"{len(clips)} clips; open {(wd / 'clipcheck.html').resolve().as_uri()}")


def apply(wd, result_path):
    res = json.loads(Path(result_path).read_text(encoding="utf-8"))
    if isinstance(res, dict) and "result" in res:
        res = res["result"]
    by_src = {c["src"]: c for c in res}
    bad = 0
    for f, r in steps(wd):
        v = r.get("video") or {}
        c = by_src.get(v.get("src"))
        if not c:
            continue
        note = None
        if c["error"] or not c["measured"]:
            note = f"The recording of this step is damaged ({c['error'] or 'no length'}) and is not shown."
            r.pop("video")
        elif v.get("dur") and c["measured"] < COMPRESSED * v["dur"]:
            note = f"The recording plays compressed: {c['measured']} s for {v['dur']} s of work."
            v["dur"] = c["measured"]
        elif v.get("dur") and abs(c["measured"] - v["dur"]) > 1:
            v["dur"] = c["measured"]
        if note:
            bad += 1
            r["notes"] = (r.get("notes", "") + " " + note).strip()
            print(f"{r.get('id', f.stem)}: {note}")
        f.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"{len(res)} clips checked, {bad} with a problem")
    return bad


def main():
    if len(sys.argv) == 2:
        write_page(Path(sys.argv[1]))
    elif len(sys.argv) == 4 and sys.argv[2] == "--apply":
        apply(Path(sys.argv[1]), sys.argv[3])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
