# Phase 0 safety baseline

## Purpose

This pass records Chronicle's current safety boundaries before architecture work begins. It adds deterministic synthetic fixtures and regression tests only. **No production behaviour, schema, interface, route, adapter, migration, dependency, deployment, or published app was changed.**

## Protection already present

- Capture tests cover low-friction text and voice capture, idempotent creation, draft isolation, and failures that do not rewrite the original record.
- Dossier tests already protect canonical inclusion mapping, scope filters, separate clarifications, evidence configuration, preview/export model parity, and storage-independent exports.
- Evidence-linking tests cover local-first linking, retry/idempotency, account isolation, and safe failures.
- Migration and performance harnesses already exercise deterministic pure planning and 100/1,000/5,000-record data paths.
- Privacy Shield states and implements a UI-only display filter.

## Added by this pass

- `legacyArchaeologyFixtures.ts`: deterministic untouched, edited, incomplete-history, incident, daily, note-type, duplicate/same-name person, malformed-time, membership, orphan, evidence-timing, and missing-integrity cases.
- `architectureBaseline.test.ts`: migration accounting/determinism, history honesty, projection immutability, Privacy Shield/export isolation, the current five-minute media-role boundary, and an exact 500-attachment report baseline.

These fixtures are archaeological safety material. An assertion describing existing behaviour is not necessarily an endorsement of that behaviour.

## Baseline commands

Run from the repository root:

```text
npm test
npm run build
```

The existing performance suite prints comparable measurements for 100, 1,000, and 5,000 records. The Phase 0 suite adds a deliberately generous eight-second guard for a document model containing exactly 500 attachments; it is intended to catch order-of-magnitude regressions, not act as a micro-benchmark.

Observed results must be recorded in the pull request or handoff that runs these commands. This document does not invent results when the execution environment is unavailable.

## Current limitations exposed, not fixed

- Original-text immutability is a model and workflow rule; this pass does not prove a database-level write prohibition.
- Production media role is inferred from a five-minute upload window. The exact boundary counts as original; invalid dates count as later; a missing timestamp currently falls back to the Unix epoch and can count as original. This is a heuristic, not provenance.
- `V1Snapshot` edit-history rows do not carry old/new wording. The richer production history shape can retain those values, but incomplete legacy history must remain incomplete.
- People are still largely represented as name strings. Case-folded merging cannot distinguish two different people with the same name.
- Chronicle's current canonical date structure is primarily exact date/time or null. Approximate dates, ranges, dayparts, and explicit uncertainty are not yet first-class.
- Local/remote media storage state is not represented by the source-agnostic Dossier media type and was therefore documented rather than added.
- Clarification/follow-up/outcome/correction meanings exist in legacy note material, while the current Dossier projection presents these rows uniformly as clarifications.

## Gate for later phases

Later architecture work must keep this suite green or deliberately update the baseline with a reviewed decision. The product test remains: does the change make Chronicle more capable without making it feel harder to use?

