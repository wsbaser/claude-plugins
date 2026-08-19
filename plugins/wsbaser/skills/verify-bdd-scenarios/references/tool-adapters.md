# Tool Adapters

Once Step 2 of `SKILL.md` has picked a backend, bind these generic verbs to its concrete calls and use the verbs everywhere else. Exact MCP tool names vary by session config — if a name below doesn't resolve, `ToolSearch` a keyword search (e.g. `"playwright browser click"`) to find what actually connected, rather than guessing.

| Verb | Chrome DevTools MCP (`mcp__<server>__*` — prefix varies by session) | Playwright CLI (`playwright-cli -s=verify`) | Playwright MCP (`mcp__<server>__*` — prefix varies by session) |
|------|---|---|---|
| Open/start session | first call is any navigate | `open [url]` (must be the first command) | first call is any navigate |
| Navigate | `navigate_page(url)` | `goto <url>` | `browser_navigate(url)` |
| Resize viewport | `resize_page(1440, 900)` | `resize 1440 900` | `browser_resize(1440, 900)` |
| Snapshot (fresh refs + accessibility text) | `take_snapshot()` | `snapshot` | `browser_snapshot()` |
| Click | `click(ref)` | `click <ref>` | `browser_click(ref)` |
| Fill input | `fill(ref, text)` or `fill_form(...)` | `fill <ref> "<text>"` | `browser_fill_form(...)` or `browser_type(ref, text)` |
| Press key | `press_key(key)` | `press <key>` | `browser_press_key(key)` |
| Hover | `hover(ref)` | `hover <ref>` | `browser_hover(ref)` |
| Select dropdown option | `click` + option `click`, or `evaluate_script` | `select <ref> "<value>"` | `browser_select_option(ref, value)` |
| Screenshot to file | `take_screenshot(filePath)` | `screenshot --filename=<path>` | `browser_take_screenshot(filename)` |
| Read exact value (precise `Then` verification) | `evaluate_script("() => document.querySelector('…').textContent")` | `eval "document.querySelector('…').textContent"` | `browser_evaluate("() => …")` |
| Console messages | `list_console_messages()` | `console` | `browser_console_messages()` |
| Network requests (for root-cause, failed calls only) | `list_network_requests()` / `get_network_request(id)` | `network` | `browser_network_requests()` |
| Wait for element/condition | `wait_for(text/selector)` | element already required by `snapshot`+`click`; add a short pause if needed | `browser_wait_for(...)` |
| Close session | `close_page()` | `kill-all` (after all scenarios finish) | `browser_close()` |

## Notes

- **Chrome DevTools MCP**: pick one connected instance and stick to it for the whole run — scenarios execute sequentially, so there's never a need for more than one.
- **Playwright CLI**: use a single named session for the whole run (`-s=verify`); `open` must be the very first command issued in that session.
- **Playwright MCP**: tool names shown are the common naming for this server; confirm with `ToolSearch` since the exact names and prefix vary by how it's configured.
- **Precise `Then` verification**: prefer reading a specific value over eyeballing a snapshot's text dump whenever the assertion states a concrete value (a number, an exact label, a count) — `evaluate_script`/`eval`/`browser_evaluate` against a targeted selector is the reliable way to do that. Reserve the plain snapshot/screenshot for assertions about presence, layout, or visual state.
- **Screenshot workspace-root sandbox (MCP backends only)**: `take_screenshot`'s `filePath` is validated against the MCP server's own allowed roots, fixed at server launch — no path spelling (absolute, relative, `..`) escapes it, and this held true even after switching to an absolute path. If the target app repo isn't among those roots, capture to a path that *is* allowed (a scratch file under the current session's own root) and immediately `mv`/`cp` it into the target repo via Bash, which has no such restriction. Playwright CLI's `screenshot --filename=<path>` is a plain subprocess file write and isn't affected by this at all — if the MCP backend's screenshots keep failing to land in the target repo even via the scratch-then-move route, that's a signal to drop to the Playwright CLI backend for this run rather than losing evidence.
- **Custom grid/canvas components** (e.g. DevExpress-style spreadsheet grids) often expose no rows or cells in the accessibility snapshot at all — not just imprecise values, no ref to click. If a snapshot has no usable ref for a cell you need to interact with, fall back to a direct CSS-selector interaction via `evaluate_script`/`eval`/`browser_evaluate` (dispatch a click event, or focus + keyboard entry) instead of assuming the element is reachable by ref.
