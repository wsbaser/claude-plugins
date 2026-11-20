"""Check a slot folder: every file is kebab-case Markdown with a `when:` line in its frontmatter.

CLI: python check_slots.py <folder> [<folder>...]
Prints one error per line, exits 1 when there are errors.
"""
import pathlib
import re
import sys

KEBAB_FILE = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*\.md")


def _when_value(text):
    lines = text.lstrip("﻿").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            return None
        match = re.match(r"when:(.*)$", line)
        if match:
            return match.group(1).strip()
    return None


def check_folder(path):
    """Return a list of error strings for the slot folder; empty means valid."""
    folder = pathlib.Path(path)
    if not folder.is_dir():
        return [f"{path}: not a folder"]
    files = sorted(p for p in folder.iterdir() if p.is_file())
    if not files:
        return [f"{path}: folder has no slot files"]
    errors = []
    for file in files:
        if not KEBAB_FILE.fullmatch(file.name):
            errors.append(f"{file.name}: file name must be kebab-case Markdown (for example ui-mockup.md)")
        try:
            text = file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"{file.name}: cannot read as UTF-8: {exc}")
            continue
        if not _when_value(text):
            errors.append(f"{file.name}: frontmatter needs a non-empty one-line `when:` key")
    return errors


def main(argv=None):
    folders = (sys.argv[1:] if argv is None else argv)
    if not folders:
        print("usage: check_slots.py <folder> [<folder>...]")
        return 1
    errors = []
    for folder in folders:
        errors.extend(check_folder(folder))
    for error in errors:
        print(error)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
