# Severity Tagging

Tag every scenario with what its failure would mean in production — this lets whoever triages a failing run tell "drop everything" apart from "file it and move on" without re-deriving the impact from scratch. Judge each scenario on its own; don't default from its coverage layer. A critical-path scenario for a rarely-used report can matter less than a boundary case in something load-bearing, so ask the question fresh each time: *if this exact scenario's expected behavior broke in production, would there be a workaround, and how much would it take down?*

| Tag | If this scenario's behavior broke... |
|-----|---------------|
| `@severity-blocker` | ...a system or major part of it goes down. No workaround. Nobody works. |
| `@severity-critical` | ...this one feature is 100% dead. No workaround. Rest of the system is fine. |
| `@severity-high` | ...the feature is broken, but a workaround exists (manual step, slower path) — painful, still usable. |
| `@severity-medium` | ...the feature is only degraded — a partial malfunction or wrong output on an edge case. Workaround is easy, or the impact is narrow. |
| `@severity-low` | ...it's cosmetic only. No function is lost, no workaround needed. |

Place the tag directly above the `Scenario:`/`Scenario Outline:` line, alongside any other tags already there:

```gherkin
@severity-critical
Scenario: Can post a purchase invoice
  Given I have a draft invoice with one line totaling 450.00
  When I click Complete
  Then the invoice status changes to Completed
```
