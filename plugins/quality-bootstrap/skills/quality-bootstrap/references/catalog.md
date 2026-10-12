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
| pr-review-toolkit | `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer` | Anthropic (claude-code plugins) | plugin | Specialist reviewers on top of superpowers' per-task and final reviews. |
| built-in `/code-review`, `/security-review` | branch review with confidence ≥ 80; security review | Claude Code built-in | built-in | Do **not** install the separate `code-review` plugin: on current Claude Code it can skip its reviewers and still report "no issues" (anthropics/claude-code#100401). |
| security-guidance | always-on: regex warnings on edit, AI pass per turn (injection, SSRF, IDOR, auth bypass, path traversal), review at commit | Anthropic `claude-plugins-official` | plugin | **Vet carefully:** as of 2026-10 its SessionStart hook runs an unpinned `pip install`, which fails rule 4 of vetting.md (what runs is not what was vetted). Adopt only once that is pinned; otherwise drop it and rely on Trail of Bits + `/security-review`. Needs Python on PATH. |
| trailofbits | `property-based-testing`, `differential-review`, `post-patch-validation`, `insecure-defaults`, `sharp-edges`, `spec-to-code-compliance`, `supply-chain-risk-auditor`, `fp-check` | `trailofbits/skills` marketplace | plugin | Enable only the listed skills; deny the rest. |
| socket-mcp | dependency risk score; optional hook that blocks installs of malicious/typosquatted packages | `SocketDev/socket-mcp` (hosted MCP) | MCP + hook | Cross-check with the package manager's own audit. |
| skill-creator | A/B-test any new skill against no-skill baseline before adoption | Anthropic `claude-plugins-official` | plugin | Used when the catalog grows. |

## Conditional

| Id | Condition (from detection) | Job | Source | Kind |
| -- | -------------------------- | --- | ------ | ---- |
| impeccable | any web UI | design context (PRODUCT.md, DESIGN.md), shape/critique/audit/polish/harden, deterministic `npx impeccable detect` | `pbakaus/impeccable` | skill + npm CLI |
| shadcn | `components.json` present or shadcn/ui used | component library usage, registry search/install | `shadcn-ui/ui` skill + shadcn MCP | skill + MCP |
| vercel-react | React | `react-best-practices`, `composition-patterns`; `web-design-guidelines` for UI review | `vercel-labs/agent-skills` | skills (vendor these three) |
| emil-design-eng | web UI | `break-ui` (worst-case data), `review-animations` | `emilkowalski/skills` | skills (vendor these two) |
| design-md | web UI | lint DESIGN.md, WCAG contrast, export tokens | `@google/design.md` (npm dev dependency) | CLI |
| dataviz | charts or dashboards in the UI | chart form, colour formula with validator, light/dark consistency | Claude built-in `dataviz` skill | built-in |
| azure | Azure infra (Bicep, `azure.yaml`, AKS manifests) | `azure-kubernetes`, `azure-diagnostics`, `azure-prepare` | `microsoft/github-copilot-for-azure`, `microsoft/azure-skills` | skills |
| postgres | Postgres (pg, Kysely, Prisma, Drizzle with postgres) | RLS, indexing, migrations | `supabase/agent-skills` → `supabase-postgres-best-practices` | skill |
| stripe | Stripe SDK | integration best practices | `stripe/ai` → `stripe-best-practices` (or `stripe@claude-plugins-official`) | skill/plugin |
| playwright | Playwright tests | E2E + `@axe-core/playwright` accessibility + `toHaveScreenshot` | npm | CLI |

## Not adopted (block if installed)

| Tool | Reason |
| ---- | ------ |
| Anthropic `frontend-design`, ui-ux-pro-max, taste-skill | Compete with impeccable as the style authority. |
| Compound Engineering, spec-kit, BMAD, GSD, Agent OS | Second process framework next to superpowers; ideas only. |
| `code-review` plugin | Silent false negatives (anthropics/claude-code#100401). |
| comprehensive-review, code-review-ai, code-refactoring, codebase-cleanup, wshobson agents | Generic, overlapping reviewers without evidence. |
| Semgrep plugin | No native Windows support; sends files to Semgrep. |
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

Company-internal or personal packs (e.g. `7c@7c-plugins`, `7c-work-DEV@7c-plugins`, `wsbaser@wsbaser-plugins`) are blocked when present unless `docs/quality/policy.md` whitelists them; add their identifiers to the repo's block list once seen so other machines inherit the block.


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
| StrykerJS (later, not in this skill) | mutation testing on changed lines | TS/JS |
