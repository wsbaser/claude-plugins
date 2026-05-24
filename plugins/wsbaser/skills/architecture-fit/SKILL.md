---
name: wsbaser:architecture-fit
description: Architecture fit checker — evaluates a proposed implementation against SOLID, DRY, and Clean Architecture principles (Robert C. Martin; also known as Hexagonal / Onion / Ports & Adapters).
---

# Architecture Fit Check

Evaluate the proposed implementation against architectural principles — SOLID, DRY, Clean Architecture. If the codebase has debt, the implementation likely won't fit cleanly. Surface it.

## Steps

1. Understand what the implementation adds or changes
2. Read the relevant codebase area it touches
3. Check against: SRP, OCP, DRY, dependency direction, layer separation (Clean Architecture / Hexagonal)

## Verdict

**FITS** — Architecturally sound. Proceed.

**REFACTOR FIRST** — Name the specific violation and the concrete refactoring needed before implementing.

Under 150 words. Be specific.
