"""Validate a review issue record (review.json). Stdlib only.

Stages accumulate: "intake" < "decided" < "ready". See ../references/record.md.

CLI: python check_record.py <review.json> --stage ready
Prints one error per line, exits 1 when there are errors.
"""
import argparse
import json
import re
import sys

STAGES = ("intake", "decided", "ready")
REVIEW_ID = re.compile(r"[a-z0-9-]+")
ISSUE_ID = re.compile(r"[A-Za-z0-9-]+")
VERDICTS = ("valid", "not-valid", "partly")
DECISION_BY = ("agent", "owner", None)
DECISION_STATUS = ("decided", "undecided", "disputed")
MODES = ("radio", "buttons")
MIN_FOLD_CHARS = 600


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _nonempty(v):
    return isinstance(v, str) and v.strip() != ""


def _options(issue):
    opts = issue.get("options")
    if not isinstance(opts, list):
        return []
    return [o for o in opts if isinstance(o, dict)]


def _option_ids(issue):
    return [o.get("id") for o in _options(issue)]


def _check_intake(record, errors):
    if record.get("schema") != 1:
        errors.append("schema must be 1")
    review = record.get("review")
    review_round = None
    if not isinstance(review, dict):
        errors.append("review must be an object")
    else:
        rid = review.get("id")
        if not (isinstance(rid, str) and REVIEW_ID.fullmatch(rid)):
            errors.append("review.id must match ^[a-z0-9-]+$")
        if not _nonempty(review.get("title")):
            errors.append("review.title must be non-empty")
        review_round = review.get("round")
        if not (_is_int(review_round) and review_round >= 1):
            errors.append("review.round must be an integer >= 1")
            review_round = None
        url = review.get("artifactUrl")
        if url is not None and not isinstance(url, str):
            errors.append("review.artifactUrl must be a string when present")
    issues = record.get("issues")
    if not isinstance(issues, list):
        errors.append("issues must be a list")
        return
    seen = set()
    for index, issue in enumerate(issues):
        if not isinstance(issue, dict):
            errors.append(f"issue #{index + 1}: must be an object")
            continue
        iid = issue.get("id")
        label = f"issue {iid}"
        if not (isinstance(iid, str) and ISSUE_ID.fullmatch(iid)):
            errors.append(f"issue #{index + 1}: id must match ^[A-Za-z0-9-]+$")
        elif iid in seen:
            errors.append(f"{label}: duplicate issue id")
        else:
            seen.add(iid)
        title = issue.get("title")
        if not _nonempty(title) or "\n" in title or "\r" in title:
            errors.append(f"{label}: title must be non-empty and single-line")
        rnd = issue.get("round")
        if not _is_int(rnd) or rnd < 1:
            errors.append(f"{label}: round must be an integer >= 1")
        elif review_round is not None and rnd > review_round:
            errors.append(f"{label}: round {rnd} is greater than review.round {review_round}")


def _check_decided_issue(issue, ids, errors):
    label = f"issue {issue.get('id')}"
    options = _options(issue)
    raw = issue.get("options")
    option_ids = [o.get("id") for o in options]
    if not isinstance(raw, list) or not options or len(options) != len(raw):
        errors.append(f"{label}: options must be a non-empty list of objects")
    if len(set(map(str, option_ids))) != len(option_ids):
        errors.append(f"{label}: duplicate option id")
    real = [o for o in options if not o.get("dispute")]
    mode = issue.get("mode")
    if mode not in MODES:
        errors.append(f"{label}: mode must be radio or buttons")
    elif mode == "buttons" and len(real) != 1:
        errors.append(f"{label}: buttons mode needs exactly one real option, found {len(real)}")
    elif mode == "radio" and len(real) < 2:
        errors.append(f"{label}: radio mode needs two or more real options, found {len(real)}")

    needs_owner = issue.get("needsOwner")
    if not isinstance(needs_owner, bool):
        errors.append(f"{label}: needsOwner must be true or false")
    elif needs_owner and not _nonempty(issue.get("needsOwnerReason")):
        errors.append(f"{label}: needsOwner is true but needsOwnerReason is empty")

    rec = issue.get("recommendation")
    if rec is None:
        if needs_owner is not True:
            errors.append(f"{label}: recommendation is null, so needsOwner must be true")
    elif not isinstance(rec, dict):
        errors.append(f"{label}: recommendation must be an object or null")
    else:
        target = [o for o in options if o.get("id") == rec.get("option")]
        if not target:
            errors.append(f"{label}: recommendation.option {rec.get('option')!r} is not an option id")
        elif target[0].get("dispute"):
            errors.append(f"{label}: recommendation.option names a dispute option")
        if not _nonempty(rec.get("reason")):
            errors.append(f"{label}: recommendation.reason must be non-empty")

    origin = issue.get("origin")
    if origin is not None:
        if not isinstance(origin, dict):
            errors.append(f"{label}: origin must be an object or null")
        else:
            if not _nonempty(origin.get("quote")):
                errors.append(f"{label}: origin.quote must be non-empty")
            if origin.get("verdict") not in VERDICTS:
                errors.append(f"{label}: origin.verdict must be one of {', '.join(VERDICTS)}")
            if not _nonempty(origin.get("verdictReason")):
                errors.append(f"{label}: origin.verdictReason must be non-empty")

    dep = issue.get("dependsOn")
    if dep is not None:
        _check_depends_on(issue, dep, ids, option_ids, errors)

    decision = issue.get("decision")
    if not isinstance(decision, dict):
        errors.append(f"{label}: decision must be an object")
    else:
        if decision.get("by") not in DECISION_BY:
            errors.append(f"{label}: decision.by must be agent, owner or null")
        if decision.get("status") not in DECISION_STATUS:
            errors.append(f"{label}: decision.status must be one of {', '.join(DECISION_STATUS)}")
        if decision.get("by") == "agent" and decision.get("choice") not in option_ids:
            errors.append(f"{label}: decision.choice must be an existing option id when decision.by is agent")


def _check_depends_on(issue, dep, issues_by_id, own_option_ids, errors):
    label = f"issue {issue.get('id')}"
    if not isinstance(dep, dict):
        errors.append(f"{label}: dependsOn must be an object or null")
        return
    parent_id = dep.get("issue")
    if parent_id == issue.get("id"):
        errors.append(f"{label}: dependsOn.issue is the issue itself")
        return
    parent = issues_by_id.get(parent_id) if isinstance(parent_id, str) else None
    if parent is None:
        errors.append(f"{label}: dependsOn.issue {parent_id!r} does not exist")
        return
    mapping = dep.get("map")
    if not isinstance(mapping, dict):
        errors.append(f"{label}: dependsOn.map must be an object")
        return
    parent_option_ids = _option_ids(parent)
    for key, value in mapping.items():
        if key not in parent_option_ids:
            errors.append(f"{label}: dependsOn.map key {key!r} is not an option of issue {parent_id}")
        if value not in own_option_ids:
            errors.append(f"{label}: dependsOn.map value {value!r} is not an option of this issue")


def _check_cycles(issues, errors):
    parents = {}
    for issue in issues:
        dep = issue.get("dependsOn")
        if isinstance(dep, dict) and isinstance(issue.get("id"), str):
            parents[issue["id"]] = dep.get("issue")
    for start in parents:
        seen = {start}
        node = parents.get(start)
        while isinstance(node, str) and node in parents:
            if node == start:
                errors.append(f"issue {start}: dependsOn forms a cycle")
                break
            if node in seen:
                break
            seen.add(node)
            node = parents[node]


def _fold_chars(blocks):
    total = 0
    for block in blocks if isinstance(blocks, list) else []:
        if not isinstance(block, dict):
            continue
        for key in ("text", "code"):
            if isinstance(block.get(key), str):
                total += len(block[key])
        total += _fold_chars(block.get("blocks"))
    return total


def _check_blocks(blocks, label, where, errors):
    if not isinstance(blocks, list):
        errors.append(f"{label}: {where} must be a list")
        return
    for block in blocks:
        if not isinstance(block, dict) or not _nonempty(block.get("form")):
            errors.append(f"{label}: every block in {where} needs a form")
            continue
        if block["form"] == "fold":
            if not _nonempty(block.get("label")):
                errors.append(f"{label}: fold in {where} needs a label")
            if not _nonempty(block.get("size")):
                errors.append(f"{label}: fold in {where} needs a size")
            inner = block.get("blocks")
            _check_blocks(inner, label, f"fold in {where}", errors)
            chars = _fold_chars(inner)
            if chars < MIN_FOLD_CHARS:
                errors.append(
                    f"{label}: fold in {where} holds {chars} characters; "
                    f"under {MIN_FOLD_CHARS} it must not be folded")


def _check_ready_issue(issue, errors):
    label = f"issue {issue.get('id')}"
    explanation = issue.get("explanation")
    if not isinstance(explanation, list) or not explanation:
        errors.append(f"{label}: explanation must be a non-empty list")
    else:
        _check_blocks(explanation, label, "explanation", errors)
    for option in _options(issue):
        if "blocks" in option:
            _check_blocks(option["blocks"], label, f"option {option.get('id')}", errors)


def validate(record, stage):
    """Return a list of error strings; empty means valid for the stage."""
    if stage not in STAGES:
        return [f"unknown stage {stage!r}; use one of {', '.join(STAGES)}"]
    if not isinstance(record, dict):
        return ["record must be an object"]
    errors = []
    _check_intake(record, errors)
    issues = [i for i in record.get("issues", []) if isinstance(i, dict)] \
        if isinstance(record.get("issues"), list) else []
    if STAGES.index(stage) >= 1:
        by_id = {i["id"]: i for i in issues if isinstance(i.get("id"), str)}
        for issue in issues:
            _check_decided_issue(issue, by_id, errors)
        _check_cycles(issues, errors)
    if STAGES.index(stage) >= 2:
        for issue in issues:
            _check_ready_issue(issue, errors)
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate a review.json issue record")
    parser.add_argument("path")
    parser.add_argument("--stage", choices=STAGES, default="ready")
    args = parser.parse_args(argv)
    try:
        with open(args.path, encoding="utf-8") as f:
            record = json.load(f)
    except (OSError, ValueError) as exc:
        print(f"cannot read {args.path}: {exc}")
        return 1
    errors = validate(record, args.stage)
    for error in errors:
        print(error)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
