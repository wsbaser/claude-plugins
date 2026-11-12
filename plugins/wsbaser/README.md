# wsbaser — Development Workflow Toolkit for Claude Code

A collection of commands and agents for Claude Code that streamline development workflows: multi-agent spec implementation, architecture and clean-code review, code simplification, requirements interviews, and more.

## Commands

| Command | Description |
|---------|-------------|
| `/wsbaser:implement-spec` | Coordinate a team of coding and review agents to implement features from spec files |
| `/wsbaser:implement-story` | Full development workflow from Jira story to implementation |
| `/wsbaser:interview` | Interview in detail about a feature requirement, then write the spec; open points are researched, decided and settled on one review page |
| `/wsbaser:review` | Settle the open issues of a topic (PR comments, task questions) on one review page where you confirm or change each decision; returns the decision list, implements nothing |
| `/wsbaser:decide` | Decide open issues like a careful senior: sizes research per issue, consults the fitting skill, recommends with reasons, asks you only where truly needed |
| `/wsbaser:explain` | Explain how something actually works (where a value is computed, which layer owns a decision, how data flows, why a bug appeared); long answers become an artifact with diagrams |
| `/wsbaser:report-design` | House style for every report page a skill publishes: palette, type, components, folding rules and the fixed script for decision pages |
| `/wsbaser:review-architecture` | Review changed files for Clean Architecture, SOLID, and DRY violations |
| `/wsbaser:review-before-pr` | Run dynamic code review with auto-selected agents before PR |
| `/wsbaser:review-pr` | Code review a pull request and save results to local file |
| `/wsbaser:code-simplifier` | Simplify and refine code for clarity, consistency, and maintainability |
| `/wsbaser:learn` | Extract session learnings to CLAUDE.md files |
| `/wsbaser:thorough` | 3-pass verification checklist for correctness, edge cases, and maintainability |
| `/wsbaser:generate-test-report` | Generate a comprehensive Allure-style HTML test report from browser test results in conversation |

### Extending the review skills

Add a markdown file to `review/intake/` (where issues come from), `decide/kinds/` (how a kind of issue is decided) or `report-design/forms/` (how content is shown). The same folders under `.claude/review/` in a project add project-specific entries. Every file must start with a `when:` line saying when it applies. Then run `python plugins/wsbaser/skills/review/scripts/check_slots.py <folder>` on the folder you changed.

## Agents

| Agent | Model | Description |
|-------|-------|-------------|
| `wsbaser:architecture-reviewer` | Opus | Reviews code for Clean Architecture violations, SOLID principles, DDD boundary integrity |
| `wsbaser:clean-code-reviewer` | Opus | Reviews code for DRY violations, SOLID at method/class level, code smells |
| `wsbaser:code-simplifier` | Opus | Simplifies code for clarity, consistency, and maintainability |
| `wsbaser:devils-advocate` | Opus | Challenges assumptions and stress-tests decisions during implementation |
| `wsbaser:linebyline-reviewer` | Opus | Deep block-by-block analysis of code changes against spec requirements |
| `wsbaser:regression-reviewer` | Opus | Verifies modifications don't introduce breaking changes or regressions |

## Optional External Plugin Dependencies

Some commands can leverage agents from other plugins when available. If these plugins are not installed, the commands gracefully skip them and rely on the built-in wsbaser agents.

| External Plugin | Used By | Agents Used |
|----------------|---------|-------------|
| `pr-review-toolkit` | implement-spec, review-before-pr | pr-test-analyzer, silent-failure-hunter, type-design-analyzer, code-simplifier |
| `comprehensive-review` | implement-spec, implement-story | architect-review, security-auditor |
| `code-review-ai` | implement-story | architect-review |
| `codebase-cleanup` | implement-story | code-reviewer |
| `feature-dev` | implement-spec | code-reviewer |

## Platform-Specific Notes

- **`/wsbaser:review-pr`** requires Azure DevOps CLI (`az`) for PR metadata extraction. It also optionally uses Atlassian MCP for Jira story analysis.
- **`/wsbaser:implement-story`** requires Atlassian MCP tools for Jira story fetching.
- **`/wsbaser:code-simplifier`** and the `wsbaser:code-simplifier` agent are oriented toward Blazor/.NET projects (`.razor`, `.razor.cs`, `.razor.scss`) but the principles apply to any codebase.

## Installation

```
/plugin marketplace add github.com/wsbaser/claude-plugins
/plugin install wsbaser@wsbaser-plugins
```

## License

MIT
