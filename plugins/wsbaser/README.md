# wsbaser — Development Workflow Toolkit for Claude Code

A collection of commands and agents for Claude Code that streamline development workflows: multi-agent spec implementation, architecture and clean-code review, code simplification, requirements interviews, and more.

## Commands

| Command | Description |
|---------|-------------|
| `/wsbaser:implement-spec` | Coordinate a team of coding and review agents to implement features from spec files |
| `/wsbaser:implement-story` | Full development workflow from Jira story to implementation |
| `/wsbaser:interview` | Interview in detail about a feature requirement, then write the spec |
| `/wsbaser:review-architecture` | Review changed files for Clean Architecture, SOLID, and DRY violations |
| `/wsbaser:review-before-pr` | Run dynamic code review with auto-selected agents before PR |
| `/wsbaser:review-pr` | Code review a pull request and save results to local file |
| `/wsbaser:code-simplifier` | Simplify and refine code for clarity, consistency, and maintainability |
| `/wsbaser:learn` | Extract session learnings to CLAUDE.md files |
| `/wsbaser:thorough` | 3-pass verification checklist for correctness, edge cases, and maintainability |

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
/plugin install wsbaser@claude-plugins
```

## License

MIT
