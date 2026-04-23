# PROJECT CHRONICLE — POLISH & TRUST PASS (REFINED)

---

GOAL

Improve perceived quality and credibility of Chronicle without changing its core philosophy.

Every change must:

- make the app feel calmer and more deliberate (polish), OR
- make integrity more visible to the user (trust)

Do NOT add interpretation, scoring, or behavioural insight.

---

GLOBAL CONSTRAINTS

- Do NOT redesign layout or navigation
- Do NOT modify capture, timeline, or export logic
- Do NOT add AI features
- Do NOT introduce legal or marketing language
- Keep tone neutral, factual, and restrained

---

A. TRUST-BUILDING IMPROVEMENTS (PRIMARY)

---

1. INTEGRITY FOOTER (REQUIRED)

Add a single-line integrity footer to every record card and detail view.

Format: Created [date] · Last modified [date or "—"] · v[version]

Rules:

- Always visible
- Use existing timestamps and version field
- No icons, no emphasis styling
- Keep tone neutral and factual

Purpose: Surface the DB-enforced lifecycle already in place.

---

2. VIEW EDIT HISTORY

Add a small, low-emphasis text link on record detail:

"View edit history"

Behaviour:

- Opens existing EditHistoryPanel in a sheet/modal
- Do NOT redesign the panel

Rules:

- Must feel secondary, not dominant
- Do NOT add summaries or interpretation

Purpose: Expose audit log already being written.

---

3. TRANSCRIPT PROVENANCE CHIP

Where narrative includes transcribed content, add a neutral chip:

Transcript · source attachment [short ID]

Behaviour:

- Tap → scroll to linked attachment
- If source file deleted: show: "Transcript source file removed"

Rules:

- Do NOT modify narrative text
- Do NOT infer or highlight transcript sections
- Chip must be subtle, not dominant

Purpose: Make transcript traceability explicit.

---

4. SETTINGS — "ABOUT YOUR DATA"

Add a read-only section in Settings:

Title: About your data

Content (exact tone):

Storage: Local-first, optional encrypted backup

Audit logging: Database-enforced

Sync conflicts: Detected and surfaced

Rules:

- No marketing tone
- No expansion or explanation
- Keep it concise and factual

Purpose: Expose system integrity model to users who care.

---

5. CONFLICT VISIBILITY (RECORD CARD LEVEL) — NEW

If a record has sync_state = "conflict":

Add a small neutral indicator on the record card:

Conflict detected

Behaviour:

- Visible directly on timeline/list (not just detail view)
- Tap still opens record as normal

Rules:

- Do NOT use warning colours (keep neutral)
- Do NOT block interaction
- Do NOT auto-resolve

Purpose: Ensure conflicts are visible before opening the record.

---

B. POLISH IMPROVEMENTS (SECONDARY)

---

6. CONSISTENT DESTRUCTIVE CONFIRMATION

Apply the same calm confirmation pattern across:

- Delete attachment
- Delete record
- Delete follow-up note
- Revoke rep access

Rules:

- Neutral tone
- Two actions only: Cancel / Confirm
- No aggressive styling

---

7. SYNC STATUS PILL (SETTINGS HEADER)

Replace scattered sync messaging with a single status pill:

States:

- Local only
- Backed up · [relative time]
- Conflict on [n] records (tappable)

Behaviour:

- Conflict state → navigates to affected records

Rules:

- Keep minimal
- No extra detail

---

8. RETROACTIVE RECORDING REFINEMENT

Update RecordAgeChip behaviour:

- Hide completely if gap < 1 hour
- Slightly increase prominence if gap ≥ 24 hours

Rules:

- Do NOT add new colours
- Do NOT exaggerate styling

Purpose: Reduce noise, highlight meaningful delays.

---

9. EMPTY STATES (SINGLE ACTION)

Where empty states exist (Timeline, Calendar, Attachments):

- Add one clear CTA: "Create your first record"

Rules:

- Only ONE action
- Keep descriptive text minimal

---

10. LOADING SKELETONS

Replace spinners with content-shaped skeletons for:

- Timeline
- Record detail

Rules:

- Match existing layout
- No animation beyond subtle shimmer

---

11. TYPOGRAPHY CONSISTENCY

Audit IncidentDetailScreen spacing:

- Standardise vertical rhythm
- Use existing Tailwind spacing scale only

Rules:

- No redesign
- No font changes

---

12. PRESS-STATE CONSISTENCY

Apply existing press behaviour (scale ~0.97) to:

- Record cards
- Attachment rows
- Calendar days

Rules:

- Match existing button behaviour exactly

---

DO NOT

- add new features
- introduce interpretation or insights
- change data structures
- modify export behaviour
- introduce gamification or “trust scoring”
- use legal or persuasive language

---

RESULT

Chronicle should feel:

- more deliberate
- more coherent
- more credible

Trust is communicated through visibility of real system behaviour, not decoration.

---

- END