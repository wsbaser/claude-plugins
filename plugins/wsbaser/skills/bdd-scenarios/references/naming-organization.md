# Naming & File Organization

The scenarios tree is an index of the application: knowing where a feature lives in the app's UI means knowing the file's path — no file needs opening. Existing structure that breaks this is wrong, no matter who committed it.

## Rules

1. **Path mirrors the app.** Folders follow the app's navigation hierarchy — module → entity/page → surface (dialog, list, form) → sub-flow — named as the app names them, PascalCase, plural for entities (`Expenses/PurchaseInvoices/Dialog/Lines/`). Nest only as deep as the app distinguishes; never invent placeholders like `Misc/` or `Component/`.

2. **A file sits at the level of its subject.** Name what the file describes; it lives in the folder named for exactly that — no higher, no lower. Subject narrower than the folder → move it into its subject's folder (create it; one occupant is fine). Subject is the folder's own concept (whole-surface behavior) → a direct file is correct, even beside subfolders. `Finance/BankAccounts/Required fields.feature` — about the dialog, not Finance; `Auth/Onboarding/Shell.feature` beside `Account/` — the shell *is* the surface. Above its subject a file hides where lookup starts; below it, the tree gains a level the app lacks.

3. **One file per capability.** A correctly-scoped file exists → add to it; none → create one; wrong scope → split, move, or rename. Two capabilities share a file only when scenarios need both to prove correctness.

4. **The filename compresses; the `Feature:` title stays complete.** Sentence-style — spaced words, no Pascal/camel/kebab-case — keeping only what ancestors don't already say: the verb plus the one condition distinguishing it from siblings. `Dialog/Lines/Split.feature`, not `SplitPurchaseInvoiceLine.feature`. The title never shrinks to match the filename.

5. **2+ direct files → number by priority.** `N. Title.feature`, 1..N, no gaps, most critical first (severest scenarios, then how much core flow dies with the file). Subfolders neither count nor exempt. 0–1 direct files → no number.

## Edge cases

- **Feature spans surfaces** (shared component, column on many pages): file it where a user looks first or where its rules are strictest; cross-reference the other surfaces' files instead of duplicating scenarios.
- **Same word ≠ same thing:** group by domain object or surface, never by shared word — a voucher-series form and a voucher column on a query page share nothing.
- **Both its own surface and a sub-behavior of a sibling:** its own surface wins — the file stays at the sibling's level; nest only files with no standalone surface.
- **Priority tie:** either order passes; unnumbered never does.

## Mechanical check — run it, don't recall it

For every target folder (any folder this task adds, renames, or moves a file in or out of):

1. List its direct children fresh from disk — never from the draft or memory.
2. **Placement (rules 1–3).** Per file: subject narrower than the folder → move it down into its subject's folder; subject is the folder's concept → it stays. 2+ files sharing a concept the folder's name doesn't state → nest them together. Execute now (`git mv` when tracked), renaming per rule 4 as ancestors change. Every move makes its source and destination target folders — recheck until nothing moves.
3. **Numbering (rule 5)** on what now stands. Rename every failing file now — untouched, committed siblings included; keep existing numbers unless clearly wrong.
4. **Fix references.** Grep the scenarios root for every old filename; point cross-references at the new paths.
5. One row per direct file: `Final name | Was | Action` (`unchanged` / `renamed` / `moved` / `created`; renames and moves are already executed, never proposed; a moved file rows in its destination folder's table, `Was` = old path from the scenarios root). These are the Output's Folder audit tables.

Sparing a sibling to "keep the diff minimal" is the user's call, not yours — a half-organized folder is worse than diff noise.
