---
when: the issue is about how code is structured, named, layered or made testable
---

# Code design

## Signals

The issue is about how the code is built, not about what it computes: naming, where a piece of logic lives, duplication, a class or function doing too much, a dependency pointing the wrong way, a seam missing for tests, error handling spread over several layers. A claim such as "this should be extracted", "wrong layer" or "hard to test" is this kind. A wrong result or a crash is not: that is a fix to behaviour, even when the fix is small.

## Research

- Read the code touched and its callers. Search for every usage before judging a rename or a move.
- Find the project's convention first: how sibling files name the same thing, where similar logic already lives, what `CLAUDE.md` or the docs in the repository say. The existing pattern usually beats a textbook ideal; break it only with a reason.
- Depth follows reach. A private name or a local helper: the file and its neighbours. A change to a signature other modules call, or to what depends on what: the callers, the tests, the wiring (dependency injection, registration, configuration).
- Search the web only for a library's or framework's own idiom, and cite its documentation.

## Skill to consult

- `mattpocock-skills:codebase-design` for module depth, seams, interfaces and testability.
- `wsbaser:architecture-fit` as well when an option moves a boundary: between layers, modules or services, or in the direction a dependency points.

Call the skill with the Skill tool. Pass the issue title, the code with `file:line`, the options you are weighing, and ask which option fits and why. Skip both for an evident issue, such as a rename to match the file's own convention.

## Attributes and options

Every option carries these attributes:

- **Code touched**: the files or members it changes, with `file:line`.
- **Complexity**: what a reader has to hold in mind afterwards, compared with today.
- **Risk**: what could break and how far it reaches.
- **Reversibility**: a private change undone in one commit, or a signature other code or other teams depend on.

On the issue, record the confidence and, when it is not obvious, the blast radius.
