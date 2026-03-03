---
description: Configure VS Code terminal tab titles for multiple Claude Code sessions — shows project, branch, and live task status
allowed-tools: Read, Write, Edit, Bash, Glob
---

# VS Tab Title Setup

Configures VS Code terminal tabs to show live status for each Claude Code session.
Sets up Claude Code lifecycle hooks and VS Code settings in one step.

## Step 1: Detect Platform

Determine the user's operating system:
- **Windows** (win32, MINGW, MSYS, Cygwin) → PowerShell script (`.ps1`)
- **macOS/Linux** → Bash script (`.sh`)

Set variables:
- `SCRIPT_EXT`: `.ps1` or `.sh`
- `SCRIPT_PATH`: `~/.claude/hooks/vs-tab-title{SCRIPT_EXT}`
- `SCRIPT_ABS_PATH`: absolute resolved path (expand `~`)
- `INTERPRETER`: `powershell -NoProfile -NonInteractive -File` or `bash`

## Step 2: Check for Existing Configuration

1. Check if the hook script exists at `SCRIPT_PATH`
2. Read `~/.claude/settings.json` and check if any `hooks.SessionStart`,
   `hooks.UserPromptSubmit`, `hooks.Stop`, or `hooks.Notification` entries
   reference `vs-tab-title`

If either exists, display what's currently configured:

```
──────────────────────────────────────────────────────────
  VS TAB TITLE: existing configuration found
──────────────────────────────────────────────────────────
  Hook script : {SCRIPT_PATH}
  Hooks active: SessionStart, UserPromptSubmit, Stop, Notification
──────────────────────────────────────────────────────────
```

Then ask the user if they want to reconfigure. If they decline, stop.

## Step 3: Locate VS Code settings.json

Search for VS Code settings in the following order:
- **Windows**: `%APPDATA%\Code\User\settings.json`
- **Windows (Cursor)**: `%APPDATA%\Cursor\User\settings.json`
- **macOS**: `~/Library/Application Support/Code/User/settings.json`
- **Linux**: `~/.config/Code/User/settings.json`

Check which paths exist. If multiple exist (e.g. both VS Code and Cursor), ask the
user which one to update. If none exist, note this — you'll still set up the hooks,
and tell the user to add the setting manually.

Set `VSCODE_SETTINGS_PATH` to the resolved absolute path.

## Step 4: Generate the Hook Script

Create the `~/.claude/hooks/` directory if it doesn't exist.

### Windows PowerShell Script (`vs-tab-title.ps1`)

```powershell
param([string]$Event)

$e_start = [char]::ConvertFromUtf32(0x26A1)   # ⚡
$e_work  = [char]::ConvertFromUtf32(0x1F504)  # 🔄
$e_done  = [char]::ConvertFromUtf32(0x2705)   # ✅
$e_bell  = [char]::ConvertFromUtf32(0x1F514)  # 🔔
$e_dash  = [char]0x2014                        # —

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Read JSON from stdin
$json = $Input | Out-String | ConvertFrom-Json

$cwd = $json.cwd
if (-not $cwd) { $cwd = (Get-Location).Path }
$folder = Split-Path $cwd -Leaf

# Get git branch
$branch = ""
try {
    Push-Location $cwd
    $branch = (& git branch --show-current 2>$null) -join ""
    Pop-Location
} catch {}

switch ($Event) {
    "session_start" {
        $title = if ($branch) { "$e_start $folder ($branch)" } else { "$e_start $folder" }
    }
    "working" {
        $prompt = $json.prompt
        $stopWords = @("a","an","the","to","in","of","for","with","on","at","by","from",
                       "and","or","is","are","was","were","be","been","it","i","me","my",
                       "we","our","you","your","this","that","please","can","could","need",
                       "want","help","make","let","just","get","also","would","should")
        $words = ($prompt -replace "[^a-zA-Z0-9 ]", "") -split "\s+" |
                 Where-Object { $_ -ne "" -and $_.Length -gt 1 -and $_ -notin $stopWords } |
                 Select-Object -First 4
        $task = ($words | ForEach-Object { (Get-Culture).TextInfo.ToTitleCase($_.ToLower()) }) -join " "
        $title = "$e_work $folder $e_dash $task"
    }
    "done" {
        $title = if ($branch) { "$e_done $folder ($branch)" } else { "$e_done $folder" }
    }
    "needs_input" {
        $title = "$e_bell $folder $e_dash needs input"
    }
    default { exit 0 }
}

# Write escape sequence directly to console output (bypasses stdout capture)
$ESC = [char]0x1b
$BEL = [char]0x07
try {
    $stream = [System.IO.File]::Open(
        'CONOUT$',
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::ReadWrite
    )
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("${ESC}]0;${title}${BEL}")
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $stream.Close()
} catch {
    # Fallback: direct console write
    [Console]::Write("${ESC}]0;${title}${BEL}")
}

exit 0
```

### Bash Script (`vs-tab-title.sh`)

```bash
#!/bin/bash
EVENT="$1"
INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$CWD" ] && CWD=$(pwd)
FOLDER=$(basename "$CWD")
BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "")

case "$EVENT" in
  session_start)
    TITLE=$([ -n "$BRANCH" ] && echo "⚡ $FOLDER ($BRANCH)" || echo "⚡ $FOLDER")
    ;;
  working)
    PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)
    TASK=$(echo "$PROMPT" \
      | tr '[:upper:]' '[:lower:]' \
      | sed "s/\b\(a\|an\|the\|to\|in\|of\|for\|with\|on\|at\|by\|from\|and\|or\|is\|are\|was\|were\|be\|been\|it\|i\|me\|my\|we\|our\|you\|your\|this\|that\|please\|can\|could\|need\|want\|help\|make\|let\|just\|get\|also\|would\|should\)\b//gI" \
      | tr -s ' ' \
      | awk '{count=0;r="";for(i=1;i<=NF&&count<4;i++){if(length($i)>1){w=toupper(substr($i,1,1))substr($i,2);r=r(count>0?" ":"")w;count++}}print r}')
    TITLE="🔄 $FOLDER — $TASK"
    ;;
  done)
    TITLE=$([ -n "$BRANCH" ] && echo "✅ $FOLDER ($BRANCH)" || echo "✅ $FOLDER")
    ;;
  needs_input)
    TITLE="🔔 $FOLDER — needs input"
    ;;
  *)
    exit 0
    ;;
esac

# Write directly to terminal device (bypasses stdout capture by Claude Code)
printf '\033]0;%s\007' "$TITLE" > /dev/tty
exit 0
```

## Step 5: Update `~/.claude/settings.json`

1. Read `~/.claude/settings.json` (create `{}` if it doesn't exist)
2. Merge the hooks configuration below, **preserving all other existing settings**
3. If existing `hooks.SessionStart` / `UserPromptSubmit` / `Stop` / `Notification` arrays
   already exist, append (not replace) unless they already contain a `vs-tab-title` entry

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "{INTERPRETER} \"{SCRIPT_ABS_PATH}\" session_start"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "{INTERPRETER} \"{SCRIPT_ABS_PATH}\" working",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "{INTERPRETER} \"{SCRIPT_ABS_PATH}\" done"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "{INTERPRETER} \"{SCRIPT_ABS_PATH}\" needs_input"
          }
        ]
      }
    ]
  }
}
```

Note: `async: true` on `UserPromptSubmit` so the title update does not delay
Claude from processing the user's prompt.

## Step 6: Update VS Code settings.json

If `VSCODE_SETTINGS_PATH` was found:

1. Read the file (parse as JSON, tolerating comments and trailing commas if possible)
2. Add or update these keys, **preserving all other settings**:
   ```json
   "terminal.integrated.tabs.title": "${sequence}",
   "terminal.integrated.tabs.description": "${cwdFolder}"
   ```
3. Write the updated JSON back

If the file wasn't found, skip this step and include manual instructions in Step 7.

## Step 7: Report

Print a clear summary of every change made:

```
══════════════════════════════════════════════════════════════
  VS TAB TITLE — Setup Complete
══════════════════════════════════════════════════════════════

  ✅ Hook script created
     {SCRIPT_ABS_PATH}

  ✅ Claude Code hooks added (~/.claude/settings.json)
     • SessionStart  → shows ⚡ folder (branch) on session start
     • UserPromptSubmit (async) → shows 🔄 folder — Task Name while working
     • Stop          → shows ✅ folder (branch) when done
     • Notification  → shows 🔔 folder — needs input when waiting

  ✅ VS Code settings updated
     {VSCODE_SETTINGS_PATH}
     • terminal.integrated.tabs.title   = "${sequence}"
     • terminal.integrated.tabs.description = "${cwdFolder}"

  ℹ️  How it works
     The hook script extracts the first 4 meaningful words from each prompt
     to build a live task description. Example:
       "Fix the authentication bug in the login flow"
       → 🔄 frontend — Fix Authentication Bug Login

  ℹ️  Also works with /rename
     Type /rename my-task in any session to set a custom tab name.

  ℹ️  Next step
     Restart Claude Code (or open a new terminal) to activate the hooks.
══════════════════════════════════════════════════════════════
```

If VS Code settings weren't found, replace that section with:
```
  ⚠️  VS Code settings not found — add this manually:
     File: {common VS Code settings path for this OS}
     Setting: "terminal.integrated.tabs.title": "${sequence}"
```
