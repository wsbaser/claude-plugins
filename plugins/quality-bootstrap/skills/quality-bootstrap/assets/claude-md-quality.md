## Quality and planning (quality-bootstrap; details in docs/quality/toolchain.md)

- Gates: `<gate command>`. Run them before claiming work is done and quote the result.
- Tests are the spec. If a test or the test infrastructure looks wrong, write `BLOCKED.md` (what, why, evidence) and stop instead of changing it, unless the task is to change that test.
- Gate scripts, gate configs, baselines and `.claude/settings.json` change only in human-reviewed commits.
- Use only the tools in docs/quality/toolchain.md; a new tool needs a policy and catalog update first.
- Plans: ground them in the existing code with the feature-dev `code-explorer` agent (closest implementation, its wiring, the conventions).
- Acceptance criteria are EARS with ids (`AC-<n>: WHEN … THE system SHALL …`); every task names its AC ids and an automated verify command.
- A new interface between modules: follow docs/quality/interface-design.md (codebase-design, scored with api-and-interface-design) and record an ADR before tasks build on it.
- At most ~10 tasks per plan; split bigger work into vertical slices.
- Execute a plan only after `plan-readiness` returns PASS (CONCERNS need the owner's OK). Plans and DECISIONS.md live in `<plans directory>`.
