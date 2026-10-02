---
name: wsbaser:explain
description: Explains how something actually works — where a value is computed, which layer owns a decision, how data flows end to end, and why a bug appeared. Sizes the answer to the question and publishes the longer ones as a Claude artifact with diagrams. Use whenever the user asks how or where something works, says a flow is a black box, asks whether logic lives in the frontend or the backend, wants a data flow or pipeline traced, asks why a bug appeared or what changed, or says "explain", "walk me through" or "help me understand" — even when they frame it as a quick question rather than a request for a document.
---

# Explain

Explain how something actually works, to someone who did not write it.

## Size the answer to the question

Two judgements, and the request itself carries both.

**How much.** A question with a one-line answer deserves one line. Publish an artifact when the explanation is worth returning to, is meant for someone else, or carries enough structure that prose alone would lose it.

**How deep.** The words someone chooses reveal what they already hold. "It's a black box" asks for the ground up, including what the pieces are and where each one lives. A precise symptom from someone already naming the right files asks only for the piece they are missing — re-explaining the rest wastes their time and buries the answer in it.

When the request is genuinely ambiguous, pick a level, say which one you picked, and offer the other.

## Answer what was asked

Lead with the answer, in their terms, including when the honest answer rejects the premise. "Is it the frontend or the backend" is often answered by "neither", and nothing else lands until that does.

## Follow the mechanism

Wherever it goes, including other repositories, services and packages. A trace that stops at the working directory is the one that misleads.

Separate the code that computes from the code that decides what to compute. Where one is shared and the other is not, that gap is usually the whole answer.

For anything regression-shaped, establish what changed and when — and check the versions of shared dependencies, not only the repo's own history. Behaviour moves because a library shipped at least as often as because the code did.

## Ground it

Every claim traces to something you read. Plausible-sounding architecture is the failure mode of this task, and it is indistinguishable from the real thing until someone acts on it. Where you could not confirm something, say so rather than smoothing over it.

## When you publish

The artifact is the deliverable: reply with the link and the finding, not a second copy of the explanation. A new artifact is visible only to its author, and these are usually written for other people, so say so when handing over the link.

Use diagrams where structure or sequence is the point, and confirm they render — a broken one fails silently and takes the explanation with it.
