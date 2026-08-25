# Performance qualification — 25 August 2026

## Scope

This records a qualification run of the existing pure-data scale harness. No
benchmark infrastructure was rebuilt. The run used the architecture-amendment
working tree based on commit `076ac32c9a60b3e66e1f0180299381623396a876`.

Command:

```text
vitest run src/test/performance.test.ts --reporter=verbose
```

## Environment

- Windows NT 10.0.26200.0, 64-bit
- AMD64 Family 25 Model 68, 16 logical processors
- Node.js 24.19.0
- Vitest 4.1.11
- Synthetic deterministic datasets; no production content

## Acceptance criteria

- Notebook initial-load path: under 4,000 ms at each fixture size.
- Report preview model: under 8,000 ms at each fixture size.
- Report model containing 500 included records: under 8,000 ms with no loss.
- The 500-attachment Phase 0 baseline remains under 8,000 ms with no loss.

## Results

| Path | 100 | 1,000 | 5,000 |
|---|---:|---:|---:|
| Notebook initial load | 25.4 ms | 6.3 ms | 36.7 ms |
| Notebook search | 0.9 ms | 4.6 ms | 17.2 ms |
| Report preview build | 88.0 ms | 556.7 ms | 3,131.4 ms |
| Migration dry run | 3.9 ms | 20.8 ms | 74.3 ms |

The 500-record report model completed in 775.2 ms. The focused Phase 0 suite,
including its exact 500-attachment assertion, also passed in the same working
tree.

## Outcome

The existing pure-data harness passes its stated acceptance limits. This is
valid baseline evidence, not a claim that the entire Phase 9 performance gate
has passed. Browser rendering, representative mobile hardware, storage and
sync behaviour still require cutover qualification.
