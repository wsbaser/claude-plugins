---
description: Generate a bug verification HTML report from current conversation context
---

Dispatch the `bug-report-generator` agent to produce a self-contained HTML report based on the bug details, test results, network findings, code snippets, and screenshots discussed in this conversation.

The agent extracts all context automatically and saves the report to `.reports/{slug}.html`.
