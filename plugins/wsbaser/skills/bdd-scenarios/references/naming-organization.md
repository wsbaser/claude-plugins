# Naming & File Organization

File placement follows a capability map, not whatever already exists on disk — existing structure can itself be wrong.

1. **Map capabilities first.** List the distinct, independently-shippable behaviors the functionality provides, scoped to the requirement itself (not the ticket's triggering condition). Do this before naming or placing anything, using the target folder's existing `Feature:` titles and scope as input — not their scenario content.

2. **One file per capability.** Two capabilities share a file only when a scenario needs both to prove correctness (coupled state, a shared validation path). Otherwise they get separate files — even if one predates this task, even if the combined title would need "and".

3. **Resolve per capability, not per batch.** For each one: a correctly-scoped file already exists → add to it. No file exists → create one. A file exists but its scope is wrong → fix it (split, move, or rename) rather than appending beside a known mistake.

4. **Name the file after its `Feature:` title** — verb-led, compressed to the project's casing convention, folder name dropped. Folder + filename together must work as a lookup index: findable by capability alone, no need to open files to tell them apart.

5. **Recurse the capability map into folders, not just files.** Sibling capability-files that share a bigger grouping — same entity, same UI surface, same sub-flow — nest under one folder per grouping, as many levels deep as the domain genuinely has distinct groupings and no deeper. Name each folder after the real domain/UI concept it groups (the entity, the surface's actual component/page name, the sub-flow) — never a placeholder like `Component` or `Misc`. Stop nesting once a folder's file list is small enough to scan directly: a level that would hold only one file across the whole tree doesn't earn its keep. (Example: `Expenses/PurchaseInvoices/Dialog/Lines/`, `Expenses/PurchaseInvoices/Dialog/Haukur/`, `Expenses/PurchaseInvoices/Spreadsheet/BulkImport/` — entity, then surface, then sub-flow.)

6. **A name only carries what its ancestors don't already say.** A file's real identity is its full path, so strip from the filename anything any ancestor folder already states — module, entity, surface, sub-concern, all of it, not just the immediate parent (extends rule 4 beyond the immediate folder). `Expenses/PurchaseInvoices/Dialog/Lines/Split.feature`, not `SplitPurchaseInvoiceLine.feature`.

7. **The filename is a compressed label; the `Feature:` title is the complete description — let them diverge.** Compress the filename to the verb plus the one condition that distinguishes it from its siblings, mirroring the `Feature:` title's own casing style (Title Case for a noun-phrase title, sentence case for a verb-clause one) rather than trimming it verbatim — e.g. `Recompute Haukur account suggestions when purchase invoice vendor changes` becomes `Recompute after vendor change.feature`. The `Feature:` title itself always stays the full, accurate description of everything the file covers, even after the filename is compressed far past it, and even after sibling files later get carved out of it — file name plus parent folders only need to *approximate* the title for lookup purposes, never replace it or shrink to match it.

8. **Number files within a leaf folder (`N. Title.feature`) by priority** — most basic/critical capability first, down to the least-used/least-critical, never alphabetical or filesystem order. Numbering restarts in every folder; skip it entirely when a folder holds a single file.
