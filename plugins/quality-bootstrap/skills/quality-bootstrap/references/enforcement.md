# Installing and enforcing at project scope

Everything here goes into committed files so every clone, every agent session and every harness that loads project settings gets the same toolchain. A project can only switch off items it names; it cannot express "allow only these". So enforcement has four layers: name what is known, lock the gates, audit at every session start for what was not known, and offer a machine-wide allowlist to admins.

## Install

**Plugins** — declare, don't run `/plugin install` (that is user-scoped). In `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "trailofbits": { "source": { "source": "github", "repo": "trailofbits/skills" } }
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "trailofbits@trailofbits": true
  }
}
```

Claude Code asks each user to install declared plugins when they trust the folder. Use the exact `<plugin>@<marketplace>` names resolved during vetting.

**Big packs, few skills → vendor, don't deny.** When only one or two skills of a plugin are wanted (e.g. `codebase-design` and `domain-modeling` out of ~35 in mattpocock-skills), copy those skill folders into `.claude/skills/<name>/` at the pinned SHA and do **not** enable the plugin. Dozens or hundreds of `Skill()` deny rules are noise for every reviewer and every session; a vendored skill is one folder.

**Standalone skills** — vendor into `.claude/skills/<skill-name>/` at the pinned SHA. Do not edit vendored files; record provenance (repo, SHA, date) in `docs/quality/toolchain.md`. If a user-level skill with the same name exists in `~/.claude/skills`, it shadows the project copy — switch it off with `skillOverrides` and list it in the report.

**MCP servers** — `.mcp.json` at the repo root:

```json
{ "mcpServers": { "socket": { "type": "http", "url": "https://mcp.socket.dev/" } } }
```

**npm CLIs** (impeccable, @google/design.md, dependency-cruiser, knip …) — exact versions in `devDependencies` of the root package.

Merge with `node <skill-dir>/scripts/merge-json.mjs <file> <patch.json>`: objects merge, arrays are unioned, existing user keys are kept.

## Block — layer 1: everything we can name

Build the lists from **two sources**, so one run covers machines other than this one:

1. **The catalog's blocked identifiers** (`catalog.md` → "Blocked identifiers"), written whether or not they are installed here.
2. **What is installed on this machine** — `node <skill-dir>/scripts/list-installed.mjs` (follows symlinks, reads real skill names, finds nested plugin skills) — classified against the catalog: approved / competing / not adopted / unverified pack → block; neutral → keep and report.

Mechanisms:

- **Plugins** → `"enabledPlugins": { "<plugin>@<marketplace>": false }`. Project settings take precedence over user settings; a developer's `.claude/settings.local.json` can still turn one back on — the audit (layer 3) reports that.
- **User-level skills** (`~/.claude/skills/*`) → `"skillOverrides": { "<skill>": "off" }`. Plugin skills ignore `skillOverrides`.
- **Partial plugins** → only when vendoring is impossible: `"permissions": { "deny": ["Skill(<plugin>:<skill>)"] }`. Verify the plugin-namespaced form actually blocks in this Claude Code version.
- **User-level MCP servers** → `"permissions": { "deny": ["mcp__<server>"] }` blocks all their tools in this project (the server may still start; tell the user to remove it with `/mcp`). Project `.mcp.json` servers you don't want → `disabledMcpjsonServers`.

## Block — layer 2: lock the gates

Agents must not be able to weaken the gates they are judged by. Add to `permissions.deny`:

```json
[
  "Edit(scripts/quality/**)", "Write(scripts/quality/**)",
  "Edit(.claude/settings.json)", "Write(.claude/settings.json)",
  "Edit(docs/quality/approved.json)", "Write(docs/quality/approved.json)",
  "Edit(docs/quality/known-failures.md)", "Edit(<each gate config: eslint/tsconfig*/dependency-cruiser/knip/vitest/jest>)",
  "Edit(.github/workflows/**)",
  "Bash(git commit --no-verify*)", "Bash(git commit -n *)", "Bash(git push --force*)", "Bash(git push -f*)"
]
```

Deny rules may be ignored when a harness runs with permissions bypassed; the test-tamper guard, the diff check and CI are the backstops, so all three stay in place. Say in `CLAUDE.md` that humans change these files in reviewed commits.

## Block — layer 3: audit every session

Copy `<skill-dir>/assets/toolchain-audit.mjs` to `scripts/quality/toolchain-audit.mjs`, write `docs/quality/approved.json`:

```json
{
  "plugins": ["superpowers@claude-plugins-official", "..."],
  "neutralPlugins": ["context7@claude-plugins-official", "..."],
  "skills": ["codebase-design", "domain-modeling", "api-and-interface-design"],
  "neutralSkills": ["..."],
  "mcpServers": ["socket"],
  "neutralMcpServers": ["context7"]
}
```

and register it as a `SessionStart` hook (`node scripts/quality/toolchain-audit.mjs`). At the start of every session — any machine, any harness — it compares the active plugins, user skills and user MCP servers with `approved.json` and prints each unapproved item with the exact setting that blocks it. SessionStart output becomes context, so the agent knows not to use those items; it never blocks the session. `--strict` exits 1 for use in scripts.

## Block — layer 4: machine-wide allowlist (admins, manual)

Only managed settings can allow-list. Put a ready snippet in the report for the owner to deploy through their device management — never write it yourself:

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "anthropics/claude-plugins-official" },
    { "source": "github", "repo": "trailofbits/skills" }
  ],
  "allowedMcpServers": [{ "serverName": "socket" }]
}
```

List **only marketplaces you resolved and vetted in step 3**, with their real `source`/`repo` from `known_marketplaces.json` or the marketplace's own repo — never a guessed repo name; omit neutral tools whose marketplace you did not resolve and say so.

Location: `C:\Program Files\ClaudeCode\managed-settings.json` (Windows), `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS), `/etc/claude-code/managed-settings.json` (Linux). Check the current key names against the Claude Code settings docs before handing it over.

## Verify

From the repo root, in a fresh process (also with `--dangerously-skip-permissions` when a harness runs that way):

```
claude -p "List every skill and plugin available to you in this session, one per line." --output-format text
claude -p "Use the <blocked-skill> skill to review README.md." --output-format text
node scripts/quality/toolchain-audit.mjs --strict
```

The first must contain every approved item and none of the blocked ones; the second must be refused or must not load the skill; the audit must exit 0 on this machine. Paste the outputs into the report.

## Trust boundary of the hooks

The SessionStart and Stop hooks (`toolchain-audit`, `test-guard`, and `ensure-deps` when the Ask Jenny adapter is used) execute scripts committed in the repository, on every developer machine and in every harness that opens it. Whoever can change those files can run code there. That is the same trust you already give `package.json` scripts and git hooks, but it must be guarded explicitly:

- The hook scripts, `.claude/settings.json`, `.claude/skills/`, `.mcp.json`, CI and the Jenny init/workflow files are **protected files**: agents are denied edits (layer 2), the per-task diff check reports every change to them (`protected-file-changed`), and `CODEOWNERS` / branch protection should require a human reviewer for them.
- Deny rules can be bypassed by shell edits or by harnesses that skip permissions; the diff check and review are what actually hold.
- Hook scripts never fetch code, never execute files that were modified in the working tree (they run committed versions or nothing), and use `--ignore-scripts` for any package install they trigger themselves.
- Say this in the report so the owner can add `CODEOWNERS` for the protected paths.
