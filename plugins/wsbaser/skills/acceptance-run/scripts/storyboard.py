#!/usr/bin/env python3
"""Draw a Before / Now storyboard for the "Why it exists" tab.

Usage: python storyboard.py <spec.json> <figure.json>

The spec describes one concrete situation and, per lane, what the user goes
through: the records as the app shows them, the action between them, and the
outcome in business terms. The script does the layout and writes a figure
object ({"h", "html"}) for run-data domain.figures.

Spec:
{
  "h": "What changes when a journal was posted by mistake",
  "example": "Example: <tspan class=\"h\">AT-REV1</tspan> holds 5 units bought at 100 kr. …",
  "lanes": [
    { "tag": "BEFORE", "title": "Fix it by hand", "sub": ["type the opposite", "journal yourself"],
      "items": [
        { "card": { "title": "J1 · General journal", "status": "Posted", "kind": "Addition · AT-REV1",
                    "value": "+10 @ 120 kr", "note": ["Mistake: entered twice"], "noteClass": "warn",
                    "strip": "Reversed by #R1", "accent": false } },
        { "arrow": { "label": ["user types", "a correction"], "button": "Reverse" } },
        { "result": { "head": "Result", "kv": ["Stock left:", "5 @ 120"],
                      "rows": [[true, "5 units, correct"], [false, "Value 600 kr, should be 500"]] } } ],
      "link": { "from": 0, "to": 2, "label": "linked both ways" },
      "accent": false }
  ],
  "rails": ["Only once: Reverse disappears after use", "…"],
  "caption": "The takeaway sentence (HTML).",
  "aria": "The same claim in plain text."
}

Lane items run left to right: card (230 px), arrow (76 px), result (250 px).
Up to four cards or results per lane fit in 1040 px. A link joins two cards
of the same lane (item indexes) with a two-headed dashed curve under them.
"""
import json
import sys
from html import escape

CARD_W, ARROW_W, RESULT_W, LANE_X = 220, 100, 230, 160
CARD_H, LANE_GAP, W = 150, 36, 1040


LIMITS = {"example": 150, "sub": 21, "arrow": 14, "card_title": 22, "card_line": 28, "card_value": 22, "row": 28, "rail": 120}


def plain_len(s):
    import re
    return len(re.sub(r"<[^>]+>", "", s))


def check(spec):
    """Text that would not fit its box: report all of it at once, so one edit fixes the spec."""
    errs = []
    def need(s, limit, where):
        if plain_len(s) > limit:
            errs.append(f"{where}: '{s}' is {plain_len(s)} characters; at most {limit} fit. Shorten or split into lines.")
    ex = spec.get("example") or []
    for line in [ex] if isinstance(ex, str) else ex:
        need(line, LIMITS["example"], "example line")
    for li, lane in enumerate(spec["lanes"], 1):
        for s_ in lane.get("sub", []):
            need(s_, LIMITS["sub"], f"lane {li} sub")
        for item in lane["items"]:
            if "card" in item:
                c = item["card"]
                need(c.get("title", "") + "   " + c.get("status", ""), LIMITS["card_title"] + 8, f"lane {li} card title + status")
                need(c.get("kind", ""), LIMITS["card_line"] + 4, f"lane {li} card kind")
                need(c.get("value", ""), LIMITS["card_value"], f"lane {li} card value")
                notes = c.get("note", [])
                for n in notes:
                    need(n, LIMITS["card_line"], f"lane {li} card note")
                if len(notes) > (1 if c.get("strip") else 3):
                    errs.append(f"lane {li} card '{c.get('title')}': {len(notes)} note lines; a card with a strip has room for 1, without for 3")
            elif "arrow" in item:
                for s_ in item["arrow"].get("label", []):
                    need(s_, LIMITS["arrow"], f"lane {li} arrow label")
            elif "result" in item:
                r = item["result"]
                if r.get("kv"):
                    need(r["kv"][0] + " " + r["kv"][1], LIMITS["row"], f"lane {li} result kv")
                for _, row in r.get("rows", []):
                    need(row, LIMITS["row"] - 2, f"lane {li} result row")
                if len(r.get("rows", [])) > (4 if not r.get("kv") else 4):
                    errs.append(f"lane {li} result: at most 4 rows fit")
    for r_ in spec.get("rails", []):
        need(r_, LIMITS["rail"], "rail")
    return errs


def build(spec):
    o, y = [], 24
    text = lambda x, yy, s, c="", a="start": o.append(f'<text class="{c}" x="{x:g}" y="{yy:g}" text-anchor="{a}">{s}</text>')
    rect = lambda x, yy, w, h, c, rx=6: o.append(f'<rect class="{c}" x="{x:g}" y="{yy:g}" width="{w:g}" height="{h:g}" rx="{rx}"/>')
    o.append('<defs><marker id="sbA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
             '<path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>')
    ex = spec.get("example") or []
    for line in [ex] if isinstance(ex, str) else ex:
        text(20, y, line)
        y += 20
    y += 4 if ex else 0

    for li, lane in enumerate(spec["lanes"]):
        if li:
            o.append(f'<line class="grid" x1="20" y1="{y - LANE_GAP / 2 + 6:g}" x2="{W - 20}" y2="{y - LANE_GAP / 2 + 6:g}"/>')
        text(20, y + 30, escape(lane.get("tag", "")), "lane acc" if lane.get("accent") else "lane")
        text(20, y + 50, escape(lane.get("title", "")), "h")
        for i, s in enumerate(lane.get("sub", [])):
            text(20, y + 70 + 16 * i, escape(s), "sm")
        x, centers = LANE_X, {}
        for idx, item in enumerate(lane["items"]):
            if "card" in item:
                c = item["card"]
                rect(x, y, CARD_W, CARD_H, "acc-box" if c.get("accent") else "box")
                text(x + 14, y + 26, escape(c.get("title", "")), "h")
                if c.get("status"):
                    pw = 10 + 7 * len(c["status"])
                    rect(x + CARD_W - 12 - pw, y + 11, pw, 20, "pill", 10)
                    text(x + CARD_W - 12 - pw / 2, y + 25, escape(c["status"]), "sm", "middle")
                if c.get("kind"):
                    text(x + 14, y + 54, escape(c["kind"]), "sm")
                if c.get("value"):
                    text(x + 14, y + 76, escape(c["value"]), "mono big")
                for i, line in enumerate(c.get("note", [])):
                    text(x + 14, y + 102 + 16 * i, line, c.get("noteClass", "sm"))
                if c.get("strip"):
                    rect(x + 12, y + 116, CARD_W - 24, 24, "acc-box", 4)
                    text(x + 24, y + 132, escape(c["strip"]), "acc")
                centers[idx] = x + CARD_W / 2
                x += CARD_W
            elif "arrow" in item:
                a = item["arrow"]
                mid = x + ARROW_W / 2
                if a.get("button"):
                    bw = 16 + 7.5 * len(a["button"])
                    rect(mid - bw / 2, y + 58, bw, 26, "btn", 4)
                    text(mid, y + 76, escape(a["button"]), "btn-t", "middle")
                    o.append(f'<line class="ln" x1="{x + 2:g}" y1="{y + 100:g}" x2="{x + ARROW_W - 2:g}" y2="{y + 100:g}" marker-end="url(#sbA)"/>')
                    for i, s in enumerate(a.get("label", [])):
                        text(mid, y + 118 + 14 * i, escape(s), "sm", "middle")
                else:
                    labels = a.get("label", [])
                    for i, s in enumerate(labels):
                        text(mid, y + 88 - 14 * (len(labels) - i), escape(s), "sm", "middle")
                    o.append(f'<line class="ln" x1="{x + 2:g}" y1="{y + 88:g}" x2="{x + ARROW_W - 2:g}" y2="{y + 88:g}" marker-end="url(#sbA)"/>')
                x += ARROW_W
            elif "result" in item:
                r = item["result"]
                rect(x, y, RESULT_W, CARD_H, "q")
                text(x + 14, y + 26, escape(r.get("head", "Result")), "h")
                top = y + 50
                if r.get("kv"):
                    text(x + 14, top, escape(r["kv"][0]), "sm")
                    text(x + 22 + 6.2 * len(r["kv"][0]), top, escape(r["kv"][1]), "mono h")
                    top += 26
                for i, (ok, line) in enumerate(r.get("rows", [])):
                    text(x + 14, top + 20 * i, ("✓ " if ok else "✕ ") + escape(line), "ok" if ok else "no")
                x += RESULT_W
            if x > W - 10:
                raise SystemExit(f"error: lane {li + 1} is {x:g} px wide; the picture is {W} px. Use fewer items.")
        link = lane.get("link")
        bottom = y + CARD_H
        if link:
            a, b = centers[link["from"]], centers[link["to"]]
            o.append(f'<path class="ln dash" d="M {a - 40:g} {bottom - 8:g} C {a - 40:g} {bottom + 26:g}, {b - 40:g} {bottom + 26:g}, {b - 40:g} {bottom - 8:g}" '
                     'marker-start="url(#sbA)" marker-end="url(#sbA)"/>')
            text((a + b) / 2 - 40, bottom + 36, escape(link.get("label", "")), "sm", "middle")
            bottom += 40
        y = bottom + LANE_GAP

    rails = spec.get("rails", [])
    if rails:
        text(20, y + 4, "Guard rails", "h")
        x, row = 120, 0
        for label in rails:
            w = 20 + 6.4 * len(label)
            if x + w > W - 10 and x > 120:
                x, row = 120, row + 1
            rect(x, y + 32 * row - 12, w, 24, "box", 12)
            text(x + 10, y + 32 * row + 4, escape(label), "sm")
            x += w + 10
        y += 32 * (row + 1)

    h = y + 4
    svg = (f'<svg class="dg dg-run" style="width:{W}px" role="img" viewBox="0 0 {W} {h:g}" aria-label="{escape(spec.get("aria", ""))}">'
           + "\n".join(o) + "</svg>")
    return {"h": spec.get("h", ""), "html": f'<figure class="fig"><div class="fig-scroll">{svg}</div><figcaption>{spec.get("caption", "")}</figcaption></figure>'}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    spec = json.loads(open(sys.argv[1], encoding="utf-8").read())
    for k in ("lanes", "caption", "aria"):
        if not spec.get(k):
            sys.exit(f"error: spec needs '{k}'")
    errs = check(spec)
    if errs:
        sys.exit("\n".join("error: " + e for e in errs))
    fig = build(spec)
    open(sys.argv[2], "w", encoding="utf-8").write(json.dumps(fig, ensure_ascii=False))
    print(f"wrote {sys.argv[2]}")


if __name__ == "__main__":
    main()
