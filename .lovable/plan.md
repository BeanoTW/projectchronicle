## Export Screen — Copy + Structure Cleanup

Scope: copy, ordering, and availability changes only in `src/pages/ExportScreen.tsx`. No layout, no component restructure, no behavioural changes to the export pipeline.

---

### 1. Page header (unchanged structure, refined subtitle)

- Title: `Export` (unchanged)
- Subtitle: `Create structured records ready to share.` (unchanged — already aligned)

### 2. Primary block — "Structured Record"

Update the existing primary card (currently labelled "Structured record") to:

- **Title:** `Structured Record`
- **Description:** `A complete structured record of your saved entries.`
- **Supporting line (new, small muted text under description):** `Includes chronological entries, categories, people referenced, timestamps, follow-ups, and record integrity information.`
- **Button label:** `Generate structured record` (unchanged)

Behaviour, loading state, and "Regenerate" link all remain as-is.

### 3. Export Options — replace and reorder

Replace the current `exportTypes` array entirely with this ordered list. Available items render with their existing `Generate` button; coming-soon items render with the existing muted "Coming soon" pill (no button action).

1. **Issue-Based Record** — Available
   - Description: `A formal chronological record prepared around a selected issue or set of records.`
   - Supporting line: `Useful when sharing records with a union rep, adviser, solicitor, HR, or tribunal.`
   - Button: `Generate issue-based record`
   - Icon: `Briefcase` (unchanged)
   - Wires to existing `handleOpenBuilder` (no logic change)

2. **Single Incident Report** — Coming soon
   - Description: `A focused report for one selected incident.`
   - Supporting line: `Includes the original narrative, people involved, evidence references, timestamps, follow-ups, and integrity details.`
   - Icon: `FileText`

3. **Chronology** — Coming soon (renamed from "What happened over time")
   - Description: `A clear date-ordered timeline of selected records.`
   - Supporting line: `Useful for quickly showing what happened, when it happened, and when each entry was recorded.`
   - Icon: `Clock`

4. **Attachment Index** — Coming soon
   - Description: `A list of attachments and evidence references linked to saved records.`
   - Supporting line: `Includes attachment names, linked record IDs, upload/reference dates where available, and notes.`
   - Icon: `Paperclip`

5. **Full Case Bundle** — Coming soon (kept title, plainer description)
   - Description: `A complete export package combining records, chronology, attachments, and reference information.`
   - Supporting line: `Designed for later-stage review where a full structured pack is needed.`
   - Icon: `Package`

Implementation note: the existing card renderer already shows `description` and a smaller `includes` line. The new "Supporting line" maps to the existing `includes` field — no markup change needed. The "Coming soon" pill text remains as-is; we drop the secondary `"This feature is still being built"` line since each card now carries its own supporting line.

### 4. Footer text — replace

Replace the two existing footer paragraphs with:

> This export reflects records as entered and saved by the user. Each record may include an incident date, recorded timestamp, category, people referenced, attachments, and appended follow-ups.
>
> Chronicle supports structured record-keeping and organisation. It does not provide legal advice.

Same muted style and spacing as today.

### 5. Things explicitly NOT changing

- The "Export ready" result block (Print / Send / Download HTML / Open document) — untouched.
- `ExportBuilderModal` and the underlying export pipeline — untouched.
- All icons, card styling, spacing, and the Structured Record card layout — untouched.
- Toast copy and loading states — untouched.

### Files to edit

- `src/pages/ExportScreen.tsx` — only file changed.