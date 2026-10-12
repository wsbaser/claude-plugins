# Where Ask Jenny reads project configuration (workflow path)

Facts from Ask Jenny's source (2026-10). Paths are relative to the project Jenny runs on.

| Point | File | How Jenny uses it |
| ----- | ---- | ----------------- |
| Project workflows | `.ask-jenny/workflows/*.yaml` | Loaded next to Jenny's bundled workflows; a project workflow with the same `id` replaces the bundled one. A stage invokes a skill by starting `stagePrompt` with its slash command (e.g. `/superpowers:writing-plans …`). Stage keys: `id`, `label`, `category` (SPEC/BUILD/TEST…), `position`, `stagePrompt`, `stageSystemPrompt`, `description`, `required`, `defaultEnabled`, `maxRetries`, `retryTarget`, `continueOnLoopExhausted`, `skipFinalVerification`, `outputs`, `inputs` (`as`, `from`, `fallback`, `required`), `when`, `model`, `timeoutMs`, `pauseBefore`. Stages end by calling the `StageComplete` MCP tool with `status` success / loop / abort. Default stage timeout is 12 h. |
| Worktree init | `.ask-jenny/worktree-init.sh` | Run once per new feature worktree (tracked in worktree metadata), fire-and-forget, with env `ASK_JENNY_PROJECT_PATH`, `ASK_JENNY_WORKTREE_PATH`, `ASK_JENNY_BRANCH`, `PATH`, `HOME`, `USER`, `TMPDIR`, `SHELL`, `LANG`, plus `NUGET_PACKAGES`, `DOTNET_CLI_HOME`, `DOTNET_BUILD_BASE_PATH`, `ADO_PAT`, `VSS_NUGET_EXTERNAL_FEED_ENDPOINTS`, `CLAUDE_CODE_OAUTH_TOKEN` when set on the server (Windows also `USERPROFILE`, `APPDATA`). |
| Dev server | `.ask-jenny/run-script.json` | `scriptPath`, `runCommand`, `portMode` (env/arg/fixed), `portEnvVar`, `fixedPort`, `basePathMode`, `basePathEnvVar`. Ports allocated from 3001–3099; the allocator force-kills a process on a candidate port. Livereload 35729–35731 cleaned on stop. |
| Stage hooks | Jenny's hooks plugin via `--plugin-dir` | `PreToolUse`/`PostToolUse` on `AskUserQuestion` and a `Stop` hook; scripts copied to `.ask-jenny/*.sh`. Project hooks from `.claude/settings.json` run alongside (Claude Code merges them). |
| Settings and skills | `.claude/settings.json`, `.claude/skills/`, `CLAUDE.md`, `.mcp.json` | Stages run the `claude` CLI in the worktree without `--setting-sources`, so user + project + local settings, project skills and CLAUDE.md all apply. |
| Permissions | — | Stages always run with `--dangerously-skip-permissions`; there is no per-project permission mode. |
| Deployed container | `/mnt/claude` → `~/.claude` | User-level plugins, skills and settings in the container; seeded at boot. Projects are marked trusted at boot. Repo `.claude/` config is honoured. |

Behaviour worth knowing:

- The init script is fire-and-forget: a stage can start before it finishes, and some worktree-creation paths skip it — hence the `ensure-deps` SessionStart safety net.
- Feature worktrees live inside the repo at `.worktrees/<branch>`; anything that walks the tree must ignore that folder.
- Project workflows are loaded when the Jenny server starts (for the project open then); restart Jenny after adding or changing one.
- Bundled workflows invoke skills by slash command; a repo that disables those plugins/skills breaks those workflows (see `scripts/workflow-compat.mjs`).

Not configured by this skill (obsolete Agent-SDK path): `autoLoadClaudeMd`, `.ask-jenny/context/` injection, SDK `settingSources`.
