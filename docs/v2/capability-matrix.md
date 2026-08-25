# Chronicle capability matrix — current unified app

The old V1/V2 split is no longer the product architecture: `/v2/*` and `/prototype/*` are retired redirects, while the production routes use the shared Chronicle surfaces and selectively route data through legacy or audited canonical authorities. This matrix records current capability evidence, not historical implementation labels.

Status values: **Complete**, **Partial**, **Retired**, **Acceptance pending**. `Complete` means the capability exists on the current production route; it does not by itself mean the whole release gate is complete.

| Capability | Current implementation evidence | Status | Remaining cutover / release work | Risk |
|---|---|---|---|---|
| Authentication | `AuthProvider`, protected/public routing, canonical signed-out `AuthShell`, Supabase session handling | **Complete** | Representative-device/auth-flow acceptance | Medium |
| Account scoping / local isolation | Owner-scoped legacy and canonical entities; account-boundary quarantine prevents another signed-in user reading unsynced local records | **Complete** | Exercise account switching during release acceptance | High |
| Local data storage | `chronicle_local` remains authoritative by default; parallel owner-scoped canonical tables and audited activation exist | **Partial** | Complete real-account migration/cutover acceptance before canonical-only authority | High |
| Cloud backup / sync | Existing production backup/sync context and conflict handling remain wired to the unified Settings/app shell | **Partial** | Prove the final canonical-authority cloud path and media behaviour before broad cutover | High |
| Offline use | Local-first capture/read paths, offline status and PWA shell are present | **Complete** | Real-device offline/reconnect acceptance | Medium |
| Capture — written | Production `/record` uses shared `CaptureView` and production adapter; exact wording is sealed before optional details | **Complete** | Acceptance | Low |
| Input Helper | Optional structure-only assistance; interaction provenance/count/version freeze at seal; no factual authorship | **Complete** | User acceptance of discoverability/copy | Medium |
| Voice capture | MediaRecorder capture and local sealed-media handling exist | **Partial** | Decide/verify transcript parity and cloud-media behaviour | High |
| Daily records | Canonical `kind: 'incident' | 'daily'`, Capture selector and Notebook/report labels are implemented; event date remains unknown unless recorded | **Complete** | Acceptance | Low |
| Incident records | Capture, Entry, Notebook and My Record paths implemented | **Complete** | Acceptance | Low |
| Categories | Category details are supported; historical taxonomy/AI-classification parity is not the canonical record authority | **Partial** | Decide which legacy taxonomy/classification behaviours are product requirements | Medium |
| People | Canonical person entities/relationships and production editors exist; migration normalises/merges legacy names deterministically | **Partial** | End-to-end identity/merge acceptance on migrated accounts | Medium |
| Attachments / evidence | Hashing, sealed-original IDs, legacy unresolved provenance, local canonical bytes, production evidence surfaces | **Partial** | Final canonical cloud-media path and migrated remote-file reachability | High |
| Clarifications / follow-ups | Append-only canonical clarification kinds plus shared Entry presentation | **Complete** | Acceptance | Low |
| Record history | Canonical immutable history events and plain-language Entry history are implemented | **Complete** | Acceptance | Medium |
| Search | Notebook searches production-normalised record content and facets | **Complete** | Scale/device acceptance | Low |
| Calendar / date browsing | Month view inside Notebook with accessible grid semantics | **Complete** | Screen-reader/device acceptance | Low |
| My Record / report | Configure, preview, deterministic chronology, PDF, DOCX and print are implemented | **Complete** | Large-media export/device acceptance | Medium |
| Report integrity methodology | Unknown dates stay unknown; deterministic tie-breaking; provenance/media uncertainty wording included in shared report model | **Complete** | Legal/product wording review if desired; no certification claim | Medium |
| RFC3161 / external timestamp authority | Legacy export timestamping is not part of the current shared report pipeline | **Partial** | Explicit product decision: port, replace or retire | Medium |
| Insights / patterns | Old `/insights` and `/patterns` routes redirect to My Record | **Retired** | Keep retired unless product decision changes | Low |
| Support resources | `/support`, guides, FAQ and public explanatory surfaces remain reachable | **Complete** | Content review | Low |
| Settings | Unified Settings includes appearance, Privacy Shield, app lock, backup, updates, sign-out and account controls | **Complete** | Device acceptance | Medium |
| Privacy Shield | Shared PrivacyContext masking and report-preview withholding are implemented | **Complete** | Device/screen-reader acceptance | High |
| App lock | PIN, biometric option, timeout and LockGate are wired through Settings/app shell | **Complete** | Device/browser acceptance | High |
| Account deletion | Settings invokes the existing authenticated `delete-account` function and clears user-scoped transient state | **Partial** | Verify canonical local-store deletion semantics on activated/migrated accounts | High |
| Data portability | User-facing report exports exist | **Partial** | Raw structured own-data export remains a separate portability decision | Low |
| Existing-user migration | Deterministic canonical projection, atomic non-destructive write, idempotency, conflict rollback and audited owner activation exist | **Partial** | Production-snapshot review and staged real-account cutover | High |
| Accessibility | Dialogs, focus/reduced motion plus FilterSheet, MonthView and My Record ARIA/keyboard semantics have regression coverage | **Partial** | Manual screen-reader and representative-device sign-off | Medium |
| Error recovery | Error boundaries, media retry, quota handling, export failure safety, account quarantine/restore and conflict protections exist | **Partial** | Representative failure/device testing; final cloud sync failure cases | Medium |
| Performance | Automated harness covers Notebook/search/filter/month/report at 100/1,000/5,000 records | **Partial** | Representative-device and large-media export measurements | Medium |
| Agent/MCP integration | Existing production MCP integration remains shared | **Partial** | Confirm canonical-authority reads after final cutover | Low |

## Headline blockers still requiring release evidence

1. **Canonical cloud authority:** prove backup/sync and remote media behaviour for accounts that move to canonical authority.
2. **Production migration:** run the non-destructive migration/audit process against a reviewed production snapshot and staged real accounts; synthetic/fixture proof is not enough.
3. **External timestamp decision:** explicitly port, replace or retire the legacy RFC3161-style export timestamp capability rather than losing it accidentally.
4. **Activated-account deletion:** prove account deletion clears the final canonical local/cloud footprint as intended.
5. **Manual acceptance:** complete representative-device, screen-reader, offline/reconnect, export and tester acceptance. Automated tests cannot close these by themselves.
