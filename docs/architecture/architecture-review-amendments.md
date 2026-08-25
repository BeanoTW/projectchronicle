# Architecture review amendments

**Status:** Normative for the current 0–9 implementation roadmap  
**Applies from:** Phase 4 onward

## Phase 4 — suggestion provenance at seal

Input Helper proposals remain non-authoritative until accepted. In addition,
the immutable original may carry an optional, extensible seal-time provenance
object recording whether tracking was available, whether helper interaction
occurred, whether accepted suggestions entered the sealed wording, and the
helper/version metadata then available.

The object is optional for backwards compatibility. Its absence means
**provenance not recorded**. It must never be interpreted as proof that no
helper was used and must not be retrospectively inferred or backfilled.
Record-level provenance is sufficient initially; the shape must permit later
per-span information without redefining existing claims. Accepted-helper use
is surfaceable in plain-language Record History. Export snapshots must identify
the provenance regime used without adding warnings to every record.

## Phase 5 — event chronology and reproducible ordering

Event chronology and sealing chronology are separate. `sealed_at` remains the
immutable integrity timestamp. Human-facing chronology should use the user's
event-date expression when sufficient information exists.

The Phase 5 implementation must define and test:

- deterministic ordering for exact, approximate, ranged and unknown dates;
- explicit tie-breakers;
- explicit placement and wording for insufficient/unknown dates;
- range labels that do not invent precise endpoints; and
- an ordering policy identifier and version stored with each export snapshot.

Generated documents must describe the policy actually used. Until Phase 5
lands, existing seal-date ordering remains a documented compatibility policy;
it must not be described as event-date ordering.

## Media provenance

Production compatibility adapters may infer original/later only when the
required timestamps are valid. Missing or invalid timing maps to an explicit
unverified state. Documents use neutral wording: “Timing relative to sealing
could not be verified.” Canonical migration continues to use
`legacy_unresolved` where provenance cannot be proven.

## Phase 9 release gates

Performance and migration qualification are cutover gates, not feature phases.
Reuse the existing scale and migration harnesses. Record performance results
and the execution environment against acceptance limits. A production-snapshot
migration gate remains not passed until an appropriate authorised snapshot has
actually completed a dry run with zero unexplained loss.

## Presentation changes already isolated elsewhere

Attachment display naming, useful contents labels and duplicate Notebook
preview suppression are handled in draft PR #35. Those changes preserve source
filenames and stored record wording.
