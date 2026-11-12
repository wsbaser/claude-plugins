"""Read a pasted decision text and merge it into a review record. Stdlib only.

The text format is described in ../references/decision-text.md.
A block the parser cannot read is reported in `problems` and never guessed:
it is left out of `issues`, so `merge` treats it as undecided.

CLI: python parse_decisions.py <review.json> < pasted.txt
Writes the merged record back to <review.json> and prints the summary as JSON.
"""
import copy
import json
import re
import sys

ISSUE_LINE = re.compile(r"([A-Za-z0-9-]+)\.\s+\S.*")
FOOTER_LINE = re.compile(r"(Undecided|Disputed):")
REVIEW_LINE = re.compile(r"Review:\s*(\S+)")
ROUND_IN_HEADER = re.compile(r"review round (\d+)$")
KEYWORDS = (
    ("decision", "Decision:"),
    ("disputed", "DISPUTED:"),
    ("undecided", "UNDECIDED."),
    ("note", "Note:"),
    ("depends", "Depends on:"),
)
CHOICE_LINE = re.compile(r"(?:Decision|DISPUTED):\s*\[([^\]]+)\]\s*(.*)")
WHO = re.compile(r"\((agent decided, owner left it|owner confirmed|owner chose)\)$")
WHO_TO_BY = {"agent decided, owner left it": "agent", "owner confirmed": "owner", "owner chose": "owner"}
STATUS_KINDS = ("decision", "disputed", "undecided")


def _logical_lines(raw_lines):
    """Join soft-wrapped lines: a line that starts no known keyword continues the previous one."""
    out = []
    for raw in raw_lines:
        line = raw.strip()
        if not line:
            continue
        kind = next((k for k, prefix in KEYWORDS if line.startswith(prefix)), None)
        if kind:
            out.append([kind, line])
        elif out:
            out[-1][1] += " " + line
    return out


def _read_block(issue_id, raw_lines):
    """Return (decision dict or None, problem or None)."""
    lines = _logical_lines(raw_lines)
    statuses = [line for line in lines if line[0] in STATUS_KINDS]
    if not statuses:
        return None, f"issue {issue_id}: no decision line found"
    if len(statuses) > 1:
        return None, f"issue {issue_id}: more than one decision line"
    kind, text = statuses[0]
    note = " / ".join(t[len("Note:"):].strip() for k, t in lines if k == "note")
    if kind == "undecided":
        return {"status": "undecided", "choice": None, "note": note, "by": None}, None
    match = CHOICE_LINE.fullmatch(text)
    if not match or not match.group(1).strip():
        return None, f"issue {issue_id}: cannot read the option in {text[:60]!r}"
    who = WHO.search(match.group(2))
    if not who:
        return None, f"issue {issue_id}: decision line is cut off or has no who-part"
    return {
        "status": "disputed" if kind == "disputed" else "decided",
        "choice": match.group(1).strip(),
        "note": note,
        "by": WHO_TO_BY[who.group(1)],
    }, None


def parse(text):
    """Read decision text. Returns review id, round, readable issues by id and problems."""
    lines = [line.rstrip() for line in text.splitlines()]
    review = None
    blocks = []  # [issue id, raw lines]
    header = []
    in_footer = False
    for line in lines:
        issue = None if line[:1].isspace() else ISSUE_LINE.fullmatch(line)
        if issue:
            blocks.append([issue.group(1), []])
            in_footer = False
        elif FOOTER_LINE.match(line):
            in_footer = True
        elif in_footer:
            continue
        elif blocks:
            blocks[-1][1].append(line)
        else:
            header.append(line)

    problems = []
    for index, line in enumerate(header):
        found = REVIEW_LINE.fullmatch(line.strip())
        if found:
            review = found.group(1)
            header = header[:index]
            break
    if review is None:
        problems.append("no Review line found")
    found = ROUND_IN_HEADER.search(" ".join(l.strip() for l in header if l.strip()))
    round_number = int(found.group(1)) if found else None
    if round_number is None:
        problems.append("review round not found in the first line")

    issues = {}
    seen = set()
    duplicated = set()
    for issue_id, raw in blocks:
        if issue_id in seen:
            duplicated.add(issue_id)
        seen.add(issue_id)
    for issue_id in sorted(duplicated):
        problems.append(f"issue {issue_id}: appears more than once")
    for issue_id, raw in blocks:
        if issue_id in duplicated or issue_id in issues:
            continue
        decision, problem = _read_block(issue_id, raw)
        if problem:
            problems.append(problem)
        else:
            issues[issue_id] = decision
    if not blocks:
        problems.append("no issue found in the pasted text")
    return {"review": review, "round": round_number, "issues": issues, "problems": problems}


def _undecided_decision():
    return {"by": None, "choice": None, "note": "", "status": "undecided"}


def _summary(record, problems):
    undecided, disputed = [], []
    for issue in record.get("issues", []):
        decision = issue.get("decision")
        status = decision.get("status") if isinstance(decision, dict) else None
        if status == "disputed":
            disputed.append(str(issue.get("id")))
        elif status != "decided":
            undecided.append(str(issue.get("id")))
    return {
        "record": record,
        "settled": not undecided and not disputed and not problems,
        "undecided": undecided,
        "disputed": disputed,
        "problems": problems,
    }


def merge(record, parsed):
    """Apply parsed decisions to a copy of the record. Issues are matched by id only."""
    record = copy.deepcopy(record)
    problems = list(parsed["problems"])
    review = record.get("review")
    record_review = review.get("id") if isinstance(review, dict) else None
    if parsed["review"] != record_review:
        problems.append(
            f"pasted text is for review {parsed['review']!r}, not {record_review!r}; nothing was applied")
        return _summary(record, problems)

    issues = [i for i in record.get("issues", []) if isinstance(i, dict)]
    known = {str(i.get("id")) for i in issues}
    for issue_id in parsed["issues"]:
        if issue_id not in known:
            problems.append(f"issue {issue_id}: not an issue of this review")
    for issue in issues:
        issue_id = str(issue.get("id"))
        pasted = parsed["issues"].get(issue_id)
        if pasted is None:
            if not any(p.startswith(f"issue {issue_id}:") for p in problems):
                problems.append(f"issue {issue_id}: missing from the pasted text")
            issue["decision"] = _undecided_decision()
            continue
        option_ids = [str(o.get("id")) for o in issue.get("options", []) if isinstance(o, dict)]
        if pasted["choice"] is not None and pasted["choice"] not in option_ids:
            problems.append(f"issue {issue_id}: option [{pasted['choice']}] does not exist")
            issue["decision"] = _undecided_decision()
            continue
        issue["decision"] = {
            "by": pasted["by"], "choice": pasted["choice"],
            "note": pasted["note"], "status": pasted["status"],
        }
    return _summary(record, problems)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("usage: parse_decisions.py <review.json> < pasted.txt")
        return 1
    try:
        with open(argv[0], encoding="utf-8") as f:
            record = json.load(f)
    except (OSError, ValueError) as exc:
        print(f"cannot read {argv[0]}: {exc}")
        return 1
    if not isinstance(record, dict):
        print(f"cannot read {argv[0]}: record must be an object")
        return 1
    text = sys.stdin.buffer.read().decode("utf-8-sig", errors="replace")
    result = merge(record, parse(text))
    with open(argv[0], "w", encoding="utf-8", newline="\n") as f:
        json.dump(result["record"], f, indent=2, ensure_ascii=False)
        f.write("\n")
    summary = {k: v for k, v in result.items() if k != "record"}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
