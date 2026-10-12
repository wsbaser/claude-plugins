# Agent toolchain and quality gates

Set up by the `quality-bootstrap` skill (version <plugin-version>) on <date>. Re-run the skill to upgrade.

## Repo facts

Detected or asked once at bootstrap; the planning skills, review stages and harness workflows read them from here. Change them here (reviewed commit), not in the skills.

| Fact | Value | Source |
| ---- | ----- | ------ |
| Glossary | <path or none> | detected / owner |
| Plans directory (plans, readiness reports, DECISIONS.md) | <path> | detected / default |
| ADR directory | <path> | detected / default |
| Security-sensitive paths | <globs, one per line> | derived; confirmed by owner on <date> / unconfirmed |
| Reserved ports (never bind or kill) | <ports and ranges, with who uses them> | owner |
| Ports this repo binds | <port — what> | detected |
| UI themes | <themes DESIGN.md declares, or none> | detected |

## Policy

<exclusions and whitelists from docs/quality/policy.md>

## Tools

| Tool | Job | Stage | Kind | Pinned version / SHA | Scope | Vetting | Update with |
| ---- | --- | ----- | ---- | -------------------- | ----- | ------- | ----------- |

## Blocked in this repo

| Item | Mechanism (`enabledPlugins` / `skillOverrides` / `Skill()` deny) | Reason |
| ---- | ---------------------------------------------------------------- | ------ |

## Gates

| Gate | Command | In CI | Baseline file |
| ---- | ------- | ----- | ------------- |

## Verification (<date>)

<output of the two fresh-session checks and the gate runs>

## Manual actions for the user

- <user-scoped MCP servers to remove with /mcp>
- <plugins to accept on first trust>
- <accounts or tokens a tool needs>
