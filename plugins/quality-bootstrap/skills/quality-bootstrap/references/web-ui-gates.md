# Gates for web UIs

Apply when detection finds a web UI (React, Vue, Svelte, Angular, Blazor, plain HTML served by the repo). Agents produce UIs that compile and pass unit tests yet look generic, break contrast or regress visually; these gates catch that deterministically. Same rules as the other gates: green on today's code, baseline the rest by name, exact versions, one root script, CI.

These gates start a browser and a server, so they are **not** part of the fast `quality` script the Stop hook runs. They get their own root script `quality:ui` and their own CI job.

## 0. Inputs from the repo facts

- **UI root(s)** — source folders of each web UI (from detection).
- **Themes** — `docs/quality/toolchain.md` → "Repo facts" → UI themes. The DESIGN.md format has no theme key (2026-10), so the themes are what the owner confirmed from DESIGN.md's prose or the app's theme switcher. `none` → test the default appearance only.
- **How the app switches theme** — read the code: `prefers-color-scheme` only, a class or `data-theme` attribute on `<html>`, or a stored setting (localStorage key, cookie). The screenshot setup below depends on it.
- **Reserved ports** and **ports this repo binds** — the UI test server must use neither.

## 1. impeccable detect (anti-patterns)

- Dev dependency `impeccable` at an exact version (it needs Node ≥ 22.18). Its npm launcher runs a platform binary from an optional dependency; when that is missing it downloads a pinned, sha256-checked binary on first use — record that in the vetting note, and in CI install with optional dependencies so nothing is fetched at run time.
- Copy `<skill-dir>/assets/impeccable-gate.mjs` to `scripts/quality/impeccable-gate.mjs`. impeccable exits 0 clean, 2 on findings, 1 when a target cannot be scanned, and has no report-only switch; the wrapper owns the policy.
- **Report-only first:** root script `ui:detect` = `node scripts/quality/impeccable-gate.mjs --report <ui roots>`; run it, save today's findings with `--write-baseline` to `docs/quality/impeccable-baseline.json`, and list them in the report.
- **Then gating:** CI runs `--gate`, which fails only when an anti-pattern/file count grows beyond the baseline — existing debt does not block work, nothing new gets in. Shrinking the baseline is a human, reviewed change (add it to the protected files).

## 2. DESIGN.md lint

Only when `DESIGN.md` exists. Dev dependency `@google/design.md` at an exact version; root script `ui:design-lint` = `designmd lint DESIGN.md`. It exits 1 on errors, 0 with warnings; fix errors (they are usually broken token references or failing contrast pairs), list warnings in the report.

## 3. Accessibility and screenshots with Playwright

Dev dependencies at exact versions: `@playwright/test`, `@axe-core/playwright`. If the repo already has a Playwright config, add a project; never rewrite its existing E2E setup.

**Port.** Choose a port for the UI test server that is outside every reserved port or range and not bound by the repo (e.g. pick from 4100–4999 and check both lists). Pass it explicitly (Vite: `--port <p> --strictPort`; ASP.NET/Blazor: `--urls http://127.0.0.1:<p>`) and set `reuseExistingServer: false`, so a collision fails loudly instead of testing whatever else is listening there.

```ts
// playwright.ui.config.ts
import { defineConfig } from '@playwright/test';
const port = Number(process.env.UI_TEST_PORT ?? <chosen port>);
const themes = [<themes from repo facts, e.g. 'light', 'dark'>];
export default defineConfig({
  testDir: 'tests/ui',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  // Absolute pixels, not a ratio: on sparse pages 1% of the screen hides a changed text colour or a missing label.
  expect: { toHaveScreenshot: { maxDiffPixels: 50, threshold: 0.05 } },
  webServer: { command: '<build-and-serve command> --port ' + port, port, reuseExistingServer: false, timeout: 120_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: themes.map((theme) => ({ name: theme, use: { colorScheme: theme === 'dark' ? 'dark' : 'light', theme } })),
});
```

- **Theme switching.** If the app follows `prefers-color-scheme`, `colorScheme` is enough. If it uses a class, `data-theme` or a stored setting, add a `theme` fixture option that applies it before the page loads (`page.addInitScript` writing the attribute or the storage key), so every page renders in the project's theme from the first paint.
- **Pages.** One test file per concern under `tests/ui/`; cover the main routes or screens (ask the owner for the list when the router does not make it obvious; start with 3–8).
- **Accessibility:** for each page, `const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations).toEqual([]);`. Existing violations: record them per page and rule in `docs/quality/a11y-baseline.md` and exclude exactly those (`.disableRules([...])` per page, or `.exclude(<selector>)`), never whole pages.
- **Screenshots:** `await expect(page).toHaveScreenshot('<page>.png', { fullPage: true })` per page and theme. Mask volatile regions (clock, avatars, random ids) with `mask: [...]`; disable animations (`animations: 'disabled'`). Generate the baseline images in the same OS image CI uses (the official Playwright container), because fonts render differently per OS — commit them.
- Updating screenshot baselines (`--update-snapshots`) is a human decision on a reviewed diff: add `Bash(*--update-snapshots*)` to the deny list and the `__screenshots__` folder to the protected files.
- Root script `quality:ui` = `ui:detect` (gate mode once baselined), `ui:design-lint` when present, `playwright test -c playwright.ui.config.ts`.

## 4. CI

A separate `ui` job: install, `npx playwright install --with-deps chromium`, `npm run quality:ui`; upload the Playwright report on failure. Run it on pull requests that touch the UI roots, DESIGN.md or the UI tests.

## 5. Verify

Run `quality:ui` once green. Prove each gate bites, then revert: add a gradient-text heading (detect fails in gate mode), remove an `alt` or a form label (axe fails), change a colour token (screenshot diff fails in every theme it affects).
