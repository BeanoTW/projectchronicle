## Goal

Extend the "feels like a website" treatment beyond the marketing/auth pages into the authenticated app screens. Keep mobile behaviour unchanged — only add desktop (md/lg) enhancements.

## Approach

Rather than redesign every screen, introduce one shared desktop shell and a few layout primitives, then apply them to each screen. This keeps the mobile UI identical while giving laptops a proper website feel.

### 1. Desktop app shell (new)

Create `src/components/chronicle/AppShell.tsx` used by all authenticated screens:

- Mobile (`<md`): renders children exactly as today with the existing floating `BottomNav` pill.
- Desktop (`≥md`): renders a two-column layout
  - Left: a slim persistent side rail (~240px) with the Chronicle wordmark, the 5 nav destinations (Timeline, Calendar, Record, My Record, Support), and Settings at the bottom. Uses the same iridescent glass treatment as the current pill so brand feel carries over.
  - Right: the page content in a centered `max-w-5xl` container with generous padding.
- Hide the floating `BottomNav` on desktop (side rail replaces it).

### 2. Content width primitive

Add a `PageContainer` wrapper so every screen gets consistent responsive gutters:
- Mobile: `px-5` (unchanged)
- Desktop: `max-w-5xl mx-auto px-8 py-6`

Screens currently use `px-5` directly on their root — swap those for `PageContainer`.

### 3. Per-screen desktop refinements

Small, targeted tweaks — no logic changes:

- **TimelineScreen**: on desktop, render incident cards in a 2-column grid (`md:grid-cols-2`) for the "list" view; keep single column for narrative/day view.
- **CalendarScreen**: widen the month grid, larger day cells on desktop, and show the selected-day detail panel side-by-side (calendar left, day details right) instead of stacked.
- **MyRecordScreen**: two-column layout on desktop — stats/summary left, action cards right.
- **SupportScreen / RightsScreen**: service cards in a responsive grid (`md:grid-cols-2 lg:grid-cols-3`).
- **SettingsScreen**: max-width narrower (`max-w-2xl`) and centered, with grouped sections in cards.
- **IncidentDetailScreen**: two-column on desktop — narrative/body left, metadata (dates, people, attachments, integrity) sticky right sidebar.
- **RecordScreen**: keep the orb centered but widen the ambient background and cap toggle/hint width so it doesn't stretch edge-to-edge.
- **HomeScreen** (already partly done): verify it uses the new shell.

### 4. PageHeader

Add a `md:` variant so the header title sits inside the content container with more breathing room, and the Home/Settings icons align to the shell rather than the page edge.

## Out of scope

- No changes to mobile layouts, navigation logic, data fetching, or business logic.
- No visual redesign of individual cards/components beyond grid placement.
- Bottom nav is retained as-is for mobile; only hidden on desktop.

## Technical notes

- Breakpoint: `md` (768px) to match the auth pages you already approved.
- Reuse existing `iridescent-nav` / `iridescent-bg` tokens for the side rail so dark/light modes work automatically.
- `AppShell` wraps children in `App.tsx` at the route level so we don't touch each screen's root.
