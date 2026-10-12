# Stack support

| Stack | Toolchain (steps 2–5) | Gates (step 6) |
| ----- | --------------------- | -------------- |
| TypeScript / Node (npm, pnpm, yarn, bun; monorepos) | yes | `ts-node-gates.md` |
| .NET (C#, Blazor) | yes | planned — next version. Until then: report that gates are not set up, and list what the repo already has (analyzers, `dotnet format`, test projects). |
| Python, Go, Java, others | yes | not supported — report only |

Mixed repos (e.g. TS frontend + .NET backend): apply TS gates to the TS workspaces only and say which parts are uncovered.

Stack-independent: the planning toolchain (SKILL.md step 6b) applies to every repo, and `web-ui-gates.md` to every web UI whatever renders it (React, Blazor, server-rendered HTML). A repo without a root `package.json` keeps the UI test tooling in its own folder (`tests/ui/package.json` with exact versions and a lockfile).
