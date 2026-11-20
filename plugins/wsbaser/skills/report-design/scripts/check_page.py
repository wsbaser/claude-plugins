"""Check a decision page against the mechanical rules of references/decision-page.md.

Usage: python check_page.py <page.html>
Prints one problem per line and exits 1 when there are any; prints "ok" and exits 0 otherwise.
It checks what a script can see (pasted assets, ids, required hooks, order, escaping).
Looks, wording and what the owner sees still need a look at the rendered page.
"""
import json
import re
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"


def _norm(text):
    return text.replace("\r\n", "\n").strip()


def check(html):
    problems = []
    add = problems.append

    styles = re.findall(r"<style[^>]*>(.*?)</style>", html, re.S)
    tokens = (ASSETS / "tokens.css").read_text(encoding="utf-8")
    if not styles or _norm(styles[0]) != _norm(tokens):
        add("first <style> is not assets/tokens.css pasted unchanged")
    for css in styles[1:]:
        for colour in re.findall(r"#[0-9a-fA-F]{3,8}\b", css):
            if colour.lower() not in ("#fff", "#ffffff"):
                add(f"page CSS uses the literal colour {colour}; use a token")

    scripts = re.findall(r"<script(?![^>]*\b(?:type|src)=)[^>]*>(.*?)</script>", html, re.S)
    js = (ASSETS / "review-page.js").read_text(encoding="utf-8")
    if len(scripts) != 1:
        add(f"expected exactly one behaviour script (assets/review-page.js), found {len(scripts)}")
    if not scripts or _norm(scripts[-1]) != _norm(js):
        add("the last <script> is not assets/review-page.js pasted unchanged")

    m = re.search(r'<script type="application/json" id="review-data">(.*?)</script>', html, re.S)
    if not m:
        add("no <script type=\"application/json\" id=\"review-data\">")
        return problems
    raw = m.group(1)
    if "<" in raw:
        add("#review-data holds a raw '<'; escape every one as the JSON unicode escape")
    try:
        data = json.loads(raw)
    except ValueError as e:
        add(f"#review-data does not parse: {e}")
        return problems
    issues = data.get("issues") or []

    articles = {}
    for am in re.finditer(r'<article\b[^>]*\bdata-issue="([^"]+)"[^>]*>(.*?)</article>', html, re.S):
        articles[am.group(1)] = am.group(0)
    order_page = list(articles)
    order_data = [i.get("id") for i in issues]
    if order_page != order_data:
        add(f"#review-data order {order_data} differs from the page order {order_page}")
    needs = [i["id"] for i in issues if i.get("needsOwner")]
    if order_data[: len(needs)] != needs:
        add(f"needs-owner issues {needs} must come before agent-decided ones (data order {order_data})")

    pills = re.findall(r'<a\b[^>]*\bdata-pill="([^"]+)"', html)
    for issue in issues:
        iid = issue.get("id")
        art = articles.get(iid)
        if art is None:
            add(f"issue {iid}: no <article data-issue=\"{iid}\">")
            continue
        if iid not in pills:
            add(f"issue {iid}: no strip pill <a data-pill=\"{iid}\">")
        if f'id="issue-{iid}"' not in art:
            add(f"issue {iid}: the article needs id=\"issue-{iid}\"")
        for hook, what in (("data-verdict", "verdict line"), ("data-toggle", "fold toggle"),
                           ("data-stale-notice", "stale notice"), ("data-note", "note field")):
            if hook not in art:
                add(f"issue {iid}: no {what} ([{hook}])")
        if not re.search(r"<textarea[^>]*data-note[^>]*\bid=", art):
            add(f"issue {iid}: the note textarea needs an id")
        if issue.get("needsOwner"):
            for hook in ('data-act="confirm"', 'data-act="reopen"', "data-go-next"):
                if hook not in art:
                    add(f"issue {iid}: needs-owner issue without [{hook}]")
        elif 'data-act="restore"' not in art:
            add(f"issue {iid}: agent-decided issue without [data-act=\"restore\"]")
        for o in issue.get("options") or []:
            oid = o.get("id")
            if issue.get("mode") == "radio" and not o.get("dispute"):
                label = re.search(r'<label\b[^>]*>(?:(?!</label>).)*?value="%s"(?:(?!</label>).)*</label>' % re.escape(str(oid)), art, re.S)
                if not label:
                    add(f"issue {iid}: no <label> holding the radio for option {oid}")
                elif "data-rec-tag" not in label.group(0):
                    add(f"issue {iid}: option {oid} has no Recommended tag inside its <label>")
            elif f'data-choice="{oid}"' not in art:
                add(f"issue {iid}: no button[data-choice=\"{oid}\"]")
        h2 = re.search(r"<h2[^>]*>(.*?)</h2>", art, re.S)
        if h2:
            title = re.sub(r"<[^>]+>", "", h2.group(1)).strip()
            for h3 in re.findall(r"<h3[^>]*>(.*?)</h3>", art, re.S):
                if re.sub(r"<[^>]+>", "", h3).strip() == title:
                    add(f"issue {iid}: the title is repeated as a question heading")
    extra = sorted(set(pills) - set(order_data))
    if extra:
        add(f"strip pills for unknown issues {extra}")

    for hook in ("data-you-count", "data-next", "data-preview"):
        if hook not in html:
            add(f"page has no [{hook}]")
    copies = re.findall(r"<button\b[^>]*\bdata-copy\b", html)
    if len(copies) < 2:
        add(f"expected two Copy decisions buttons (bar and copied-text summary), found {len(copies)}")
    if not re.search(r"<summary[^>]*>(?:(?!</summary>).)*data-copy", html, re.S):
        add("the copied-text <summary> has no Copy decisions button")
    if "[hidden]" not in html.replace(" ", ""):
        add("page CSS lacks [hidden]{display:none!important}")
    return problems


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("usage: python check_page.py <page.html>")
        return 2
    problems = check(Path(argv[0]).read_text(encoding="utf-8"))
    for p in problems:
        print(p)
    if not problems:
        print("ok")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
