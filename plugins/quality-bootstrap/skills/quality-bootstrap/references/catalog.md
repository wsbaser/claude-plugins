# Approved tool catalog

Curated from a 2026-10 review of registries (Tessl outcome evals, skills.sh audits), benchmarks (SkillsBench, SWE-Skills-Bench, "Agent Skills Can Be Harmful") and vendor sources. One tool per job. Update this file — not SKILL.md — when the catalog changes, and bump the plugin version.

Identifiers can move between marketplaces. Before writing any identifier into settings, resolve it against the source's current `marketplace.json` / repo and record the exact name, version or commit SHA you found.

## Core (every repo)

| Id | Job | Source | Kind | Notes |
| -- | --- | ------ | ---- | ----- |
| superpowers | spec → plan → subagent execution → verification → finishing branches; TDD; systematic debugging | `obra/superpowers` via Anthropic marketplace `claude-plugins-official` | plugin | The process backbone. Do not add a second planning/TDD/execution framework next to it. |
| mattpocock codebase-design + domain-modeling | `codebase-design` (design an interface twice: minimal / flexible / common-caller / ports-and-adapters briefs, compared on depth, locality, seams) and `domain-modeling` (glossary + ADRs) | `mattpocock/skills` (marketplace `mattpocock`, also in `claude-plugins-official`) | skills (vendor these two) | Vendor only these two skill folders at the pinned SHA; do **not** enable the whole plugin (~35 skills incl. a second TDD, review and grilling flow). If the user already has the plugin, block it (`enabledPlugins: false`). |
| api-and-interface-design | scoring rubric for interface candidates (Hyrum's law, contract first, one error shape, boundary validation, additive change, discriminated unions, branded ids, idempotency) | `addyosmani/agent-skills` | skill (vendor the one skill) | Vendor only this skill into `.claude/skills/`, not the whole pack. |
| feature-dev | `code-explorer` agent to ground plans in existing code | Anthropic `claude-plugins-official` | plugin | Use the explorer; its architect/reviewer agents are optional. |
| plan-readiness | gate between plan and execution: AC → task → test traceability, verify commands, BLOCKERs with failure scenarios, Review Focus, size; PASS / CONCERNS / FAIL; `DECISIONS.md` | ships with quality-bootstrap (`skills/plan-readiness`) | skill (vendor) | Vendored in step 6b, pinned to the plugin version. Paired with `docs/quality/interface-design.md` (codebase-design + api-and-interface-design recipe). |
| pr-review-toolkit | `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer` | Anthropic (claude-code plugins) | plugin | Specialist reviewers on top of superpowers' per-task and final reviews. |
| built-in `/code-review`, `/security-review` | branch review with confidence ≥ 80; security review | Claude Code built-in | built-in | Do **not** install the separate `code-review` plugin: on current Claude Code it can skip its reviewers and still report "no issues" (anthropics/claude-code#100401). |
| trailofbits | `property-based-testing`, `differential-review`, `post-patch-validation`, `insecure-defaults`, `sharp-edges`, `spec-to-code-compliance`, `supply-chain-risk-auditor`, `fp-check` | `trailofbits/skills` marketplace | plugin | Enable only the listed skills; deny the rest. |
| socket-mcp | dependency risk score (MCP) + `socket-gate` PreToolUse hook that blocks agent installs of malicious/typosquatted packages | `SocketDev/socket-mcp` (hosted MCP); gate from npm `@socketsecurity/mcp` `dist/socket-gate/` (0.2.1 vetted 2026-10) | MCP + hook | Install through `enforcement.md` → "Socket install gate" (wrapper required: upstream auto-approves every other Bash command). Sends package names only. Cross-check with the package manager's own audit. |
| skill-creator | A/B-test any new skill against no-skill baseline before adoption | Anthropic `claude-plugins-official` | plugin | Used when the catalog grows. |

## Conditional

| Id | Condition (from detection) | Job | Source | Kind |
| -- | -------------------------- | --- | ------ | ---- |
| impeccable | any web UI | design context (PRODUCT.md, DESIGN.md), shape/critique/audit/polish/harden, deterministic `impeccable detect` (gate recipe: `web-ui-gates.md`) | `pbakaus/impeccable` (npm `impeccable`, 4.5.2 in 2026-10; launcher fetches a sha256-checked platform binary at install) | skill + npm CLI |
| shadcn | `components.json` present or shadcn/ui used | component library usage, registry search/install | `shadcn-ui/ui` skill + shadcn MCP | skill + MCP |
| vercel-react | React (the skills target React 19 / Next.js — check version fit, vetting rule 6) | `react-best-practices`, `composition-patterns` | `vercel-labs/agent-skills` | skills (vendor these two) |
| emil-design-eng | web UI | `break-ui` (worst-case data), `review-animations` | `emilkowalski/skills` | skills (vendor these two) |
| design-md | web UI with DESIGN.md | `designmd lint` (WCAG contrast, token references), export tokens | `@google/design.md` (npm dev dependency, 0.4.0 in 2026-10; format has no theme key yet) | CLI |
| dataviz | charts or dashboards in the UI | chart form, colour formula with validator, light/dark consistency | Claude built-in `dataviz` skill | built-in |
| azure | Azure infra (Bicep, `azure.yaml`, AKS manifests) | `azure-kubernetes`, `azure-diagnostics`, `azure-prepare` | `microsoft/github-copilot-for-azure`, `microsoft/azure-skills` | skills |
| postgres | Postgres (pg, Kysely, Prisma, Drizzle with postgres) | RLS, indexing, migrations | `supabase/agent-skills` → `supabase-postgres-best-practices` | skill |
| stripe | Stripe SDK | integration best practices | `stripe/ai` → `stripe-best-practices` (or `stripe@claude-plugins-official`) | skill/plugin |
| playwright | web UI | accessibility (`@axe-core/playwright`) and `toHaveScreenshot` per declared theme (`web-ui-gates.md`); E2E where the repo already has it | npm `@playwright/test`, `@axe-core/playwright` | CLI |

## Setup tooling (always approved)

The bootstrap's own plugin family: `quality-bootstrap` and the harness adapter plugins built on it (currently `ask-jenny`). They configure the repo rather than compete with a catalog job, so they are approved whichever marketplace hosts them — list them under `setupPlugins` in `approved.json` (matched by plugin name) and in the toolchain report. They are never blocked as a personal pack, even when their marketplace also hosts one that is blocked. Their marketplace goes into the admins' allowlist (enforcement.md layer 4); a blocked pack hosted next to them stays off per repo through `enabledPlugins: false`.

## Not adopted (block if installed)

| Tool | Reason |
| ---- | ------ |
| Anthropic `frontend-design`, ui-ux-pro-max, taste-skill | Compete with impeccable as the style authority. |
| Compound Engineering, spec-kit, BMAD, GSD, Agent OS | Second process framework next to superpowers; ideas only. |
| `code-review` plugin | Silent false negatives (anthropics/claude-code#100401). |
| comprehensive-review, code-review-ai, code-refactoring, codebase-cleanup, wshobson agents | Generic, overlapping reviewers without evidence. |
| Semgrep plugin | No native Windows support; sends files to Semgrep. |
| vercel `web-design-guidelines` | Fetches its rules from GitHub on every run (vetting rule 4); impeccable `critique`/`audit` cover UI review. |
| security-guidance (until pinned) | SessionStart installs an unpinned dependency at run time (see Decisions). |
| Probity / tdd-guard | Cannot observe subagent test runs. |
| Personal or team skill packs without published evals (e.g. company-internal review/implement skills) | Unverified; the repo owner can whitelist one explicitly in `docs/quality/policy.md`. |
| Duplicates of a core job (second TDD, planning, review or debugging skill) | Loaded-but-unused skills still degrade output. |
| Anything from ClawHub or other unvetted registries | Confirmed malicious skills (Snyk ToxicSkills). |

## Blocked identifiers

Write these as `enabledPlugins: false` in every repo, installed here or not, so the block also holds on other machines. Extend the list when a review finds another competing pack.

| Identifier | Why |
| ---------- | --- |
| `code-review@claude-plugins-official` | Silent false negatives (anthropics/claude-code#100401); use built-in `/code-review`. |
| `frontend-design@claude-plugins-official` | Competes with impeccable. |
| `mattpocock-skills@mattpocock`, `mattpocock-skills@claude-plugins-official` | Only two skills wanted — vendored instead. |
| `comprehensive-review@claude-code-workflows`, `code-review-ai@claude-code-workflows`, `code-refactoring@claude-code-workflows`, `codebase-cleanup@claude-code-workflows` | Generic overlapping reviewers. |
| `compound-engineering@every-marketplace` | Second process framework. |
| `semgrep@claude-plugins-official` | No native Windows; sends files to Semgrep. |
| `security-guidance@claude-plugins-official` | Unpinned run-time `pip install` (see Decisions); unblock when the decision is revisited. |

Company-internal or personal packs (e.g. `7c@7c-plugins`, `7c-work-DEV@7c-plugins`, `wsbaser@wsbaser-plugins`) are blocked when present unless `docs/quality/policy.md` whitelists them; add their identifiers to the repo's block list once seen so other machines inherit the block. Setup tooling is never in this group, even from the same marketplace (`quality-bootstrap@wsbaser-plugins` stays approved while `wsbaser@wsbaser-plugins` is blocked).


## Neutral (keep; report)

Language servers (`*-lsp`), documentation lookup (context7, microsoft-docs), integrations (Slack, Figma, Atlassian, GitHub), output-style or session plugins (e.g. caveman, statusline), `commit-commands`, `claude-md-management`, `playground`. They do not compete with a catalog job. List them in the report; block only if the repo policy says so.

## Gates (deterministic tools)

| Tool | Job | Stack |
| ---- | --- | ----- |
| ESLint + typescript-eslint (+ react-hooks, jsx-a11y for React) | lint | TS/JS |
| `tsc --noEmit` per workspace | typecheck | TS |
| dependency-cruiser | import boundaries, no cycles, no deep imports | TS/JS |
| knip | unused files/exports/dependencies (report first) | TS/JS |
| `scripts/quality/test-guard.mjs` | test-tamper guard (Stop hook) | any |
| `scripts/quality/task-diff-check.mjs` | per-task diff check | any git repo |
| `impeccable detect` via `scripts/quality/impeccable-gate.mjs` | UI anti-patterns, report-only then ratchet (`web-ui-gates.md`) | web UI |
| `designmd lint` | DESIGN.md errors, contrast | web UI with DESIGN.md |
| Playwright + `@axe-core/playwright` + `toHaveScreenshot` | accessibility and visual regressions per theme | web UI |
| StrykerJS (later, not in this skill) | mutation testing on changed lines | TS/JS |

## Decisions

| Date | Item | Decision | Revisit if |
| ---- | ---- | -------- | ---------- |
| 2026-10-12 | security-guidance 2.0.13 (claude-plugins-official, commit f359d43b; upstream unchanged through 2bba6069) | **Not adopted.** Its SessionStart hook (`ensure_agent_sdk.py`) still runs `pip install claude-agent-sdk` with no version pin or hashes (and a `--upgrade` fallback) into `~/.claude/security/agent-sdk-venv` — what runs is not what was vetted (vetting.md rule 4). Coverage comes from Trail of Bits (`insecure-defaults`, `sharp-edges`, `differential-review`) and built-in `/security-review`. | The plugin pins the SDK (`==` with hashes) or vendors it. Then adopt; it needs Python 3.10+ on PATH and sends diffs to the Anthropic API. |
| 2026-10-12 | Socket `socket-gate` hook (@socketsecurity/mcp 0.2.1) | **Adopted through a wrapper** (`assets/socket-gate-hook.mjs`): upstream emits `permissionDecision: "allow"` for every non-blocked Bash command, which would disable permission prompts. | Upstream stops emitting "allow" — then register it directly. |
| 2026-10-12 | Socket Firewall Free (`sfw`) | Not adopted by default: telemetry cannot be disabled (machine id, package names, git remote org). | The repo policy accepts that telemetry. |
