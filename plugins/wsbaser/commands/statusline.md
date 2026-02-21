---
description: Configure Claude Code status line with model, context bar, git branch, and project name
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Statusline Setup

Set up a richly formatted status line for Claude Code. This command generates a
platform-appropriate script and configures settings.json in one step.

## Step 1: Detect Platform

Determine the user's operating system:
- **Windows** (win32, MINGW, MSYS, Cygwin) → PowerShell script (`.ps1`)
- **macOS/Linux** → Bash script (`.sh`)

Set variables:
- `SCRIPT_EXT`: `.ps1` or `.sh`
- `SCRIPT_PATH`: `~/.claude/statusline{SCRIPT_EXT}`
- `INTERPRETER`: `powershell` or `bash`
- `SETTINGS_VALUE`: `"{INTERPRETER} {absolute_path_to_script}"`

## Step 2: Check for Existing Configuration

1. Check if `~/.claude/statusline.ps1` or `~/.claude/statusline.sh` exists
2. Read `~/.claude/settings.json` and check if a `statusline` key exists

If either exists, show the user what's currently configured and ask if they want
to replace it. If they decline, stop.

## Step 3: Generate the Script

Generate the statusline script at `SCRIPT_PATH` following these exact specifications.

### Status Line Layout

Display these segments left to right, separated by dark gray `|` dividers (ANSI 90):

| # | Segment | Color | Source |
|---|---------|-------|--------|
| 1 | Model display name | bright magenta (ANSI 95) | `model.modelDisplayName` from JSON input |
| 2 | Context progress bar | see below | Calculated from `usage` and `context_window` |
| 3 | Git branch | blue (ANSI 94) | `git branch --show-current` in project dir |
| 4 | Project name | dark red (ANSI 31) | Basename of `cwd` from JSON input |

### Progress Bar Details

- 20 block characters (`█` / U+2588)
- Filled blocks: cyan (ANSI 36)
- Empty blocks: dark gray (ANSI 90)
- After the bar: percentage in yellow (ANSI 93)
- Then a `|` separator
- Then `usedK/totalK` in green (ANSI 92)

### Context Calculation

```
current = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
percentage = floor(current * 100 / context_window_size)
filled = floor(percentage / 5)
empty = 20 - filled
usedK = floor((current + output_tokens) / 1000)
totalK = floor(context_window_size / 1000)
```

When no usage data exists, show all dark gray blocks at `0%`.

### PowerShell-Specific Requirements (Windows)

- Set console output encoding to UTF-8: `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`
- Use `[char]0x1b` for ESC character (compatible with PowerShell 5.x and 7+)
- Use `Push-Location`/`Pop-Location` for safe directory changes during git operations
- Read JSON from stdin: `$Input | Out-String | ConvertFrom-Json`
- Output the final line via `Write-Output`

### Bash-Specific Requirements (macOS/Linux)

- Use `printf` for output with `\033[XXm` ANSI escape codes
- For JSON parsing: try `jq` first, fall back to `python3 -c` if jq is unavailable
- Use `git -C "$project_dir" branch --show-current` for git branch
- Read JSON from stdin into a variable
- Must work with bash 3.2+ (macOS default)

### Graceful Fallbacks

- No usage data → all dark gray blocks, `0%`, `0K/0K`
- No git repo → omit the git branch segment
- No jq AND no python3 (bash only) → show `[no json parser]` instead of segments

## Step 4: Update Settings

1. Read `~/.claude/settings.json` (create if it doesn't exist with `{}`)
2. Set the `statusline` key to `"{INTERPRETER} {absolute_path_to_script}"`
3. Preserve all other existing settings
4. Write the updated JSON back

## Step 5: Verify

Tell the user the setup is complete:
- Script location
- Settings entry added
- Suggest they restart Claude Code or open a new session to see the status line
