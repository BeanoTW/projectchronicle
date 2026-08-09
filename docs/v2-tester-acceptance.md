# Chronicle V2 — Tester Acceptance Checklist

Product model: **Capture → Notebook → My Record** (generated output is a **Report**).

How to run: sign in on a tester build (any `*.lovable.app` host or local dev). V2 is
default-on there. Roll back per device with `?ff=v2All:0`, or one route at a time
(e.g. `?ff=v2Capture:0`). The public production domains stay on V1 until sign-off.

Mark each line Pass / Fail / N-A and note the device + browser used.

## A. Navigation and language
- [ ] Bottom nav (mobile) and side nav (desktop) show **Notebook, Capture, My Record**.
- [ ] No screen, button, tooltip or dialog uses the word "Dossier".
- [ ] No screen shows preview/prototype wording or a "Reset preview data" control.
- [ ] Old links still work: `/timeline`, `/record`, `/export`, `/incident/:id`.

## B. Capture
- [ ] Text capture: write an account, save, land on the saved record.
- [ ] Voice capture: record, transcript appears, wording is not silently altered.
- [ ] Add people, date, time, location, category; all persist after save.
- [ ] Attach a photo and a file; both appear on the saved record.
- [ ] Daily record: save one, and confirm it is labelled as a daily record.
- [ ] Kill the tab mid-capture, return: the draft is offered back, nothing is lost.
- [ ] Save twice quickly (double-tap): only one record is created.

## C. Notebook
- [ ] All existing records appear, newest first, with correct dates.
- [ ] Search by wording, by person, and by location returns the expected records.
- [ ] Filters: category, people, record type, date range, clarifications, In My Record.
- [ ] Month view shows the right counts and opens the right day.
- [ ] Clearing filters restores the full list.

## D. Entry
- [ ] Wording is shown exactly as written — no rewriting, no truncation.
- [ ] Both dates are visible: when it happened and when it was recorded.
- [ ] Clarifications can be added; the original wording stays unchanged.
- [ ] Record history reads as plain language and lists every change.
- [ ] Attachments open, and missing files show a clear message rather than failing.
- [ ] **Add to My Record** / **Remove from My Record** work and are reflected in Notebook.

## E. My Record and Report
- [ ] Counts are right: total included, hidden by filters, included in document.
- [ ] Scope filters (date range, category, people) change the included set.
- [ ] Preview renders as an A4 report titled **Chronological Record** by default.
- [ ] A custom report title is used in the preview and both exports.
- [ ] **Export PDF report** opens/saves a correct file; images are in proportion.
- [ ] **Export Word report** opens in Word/Docs with the same content and order.
- [ ] With nothing included, the empty state explains what to do next.

## F. Privacy Shield
- [ ] With the shield on, names are masked in Notebook, Entry and My Record.
- [ ] Report preview is withheld while the shield is on.
- [ ] Turning the shield off restores the real names everywhere immediately.
- [ ] Masking is display-only: exported reports made with the shield off are complete.

## G. Offline and failure
- [ ] Go offline: capture still saves and the record appears in the Notebook.
- [ ] Offline status is visible and honest about what is not yet backed up.
- [ ] Come back online: pending records and media sync without duplicates.
- [ ] Interrupt a media upload; on retry the file completes and is not duplicated.

## H. Theme and devices
- [ ] Light and dark follow the system setting; text stays readable in both.
- [ ] Mobile portrait, tablet and desktop layouts are all usable.
- [ ] On desktop the left nav stays fixed while content scrolls.

## Reporting a problem
Note the screen, what you did, what you expected, what happened, and whether
`?ff=v2All:0` (V1) behaves differently. Do not paste real record content into
bug reports — describe it instead.
