#!/usr/bin/env bash
# Ask Jenny worktree init — runs once per new feature worktree (set up by jenny-workflow-setup).
# Installs dependencies inside the worktree so builds and tests use the worktree's own code,
# not packages resolved from the main checkout.
set -euo pipefail

target="${ASK_JENNY_WORKTREE_PATH:-$(pwd)}"
# Refuse anything that is not a git worktree of this repository.
common_target="$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
common_self="$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ ! -e "$target/.git" ] || [ -z "$common_target" ] || [ "$common_target" != "$common_self" ]; then
  echo "[worktree-init] refusing: $target is not a worktree of this repository" >&2
  exit 1
fi
cd "$target"
echo "[worktree-init] $(pwd) on ${ASK_JENNY_BRANCH:-unknown branch}"

# 1. Dependencies (frozen lockfile). Replace with the project's package manager:
#    npm ci | pnpm install --frozen-lockfile | yarn install --immutable | bun install --frozen-lockfile
{{INSTALL_COMMAND}}

# 2. Shared packages consumed through build output (monorepos). Remove if the repo has none.
{{BUILD_SHARED_COMMAND}}

echo "[worktree-init] done"
