# Chronicle V2 — code boundaries

Three zones. Nothing outside `src/v2/` may import from inside it, and nothing
inside `src/v2/` may import production data code.

## 1. Existing production app (V1, live)

- Routes: everything mounted in `src/App.tsx` except `/v2/*`.
- Screens: `src/pages/**`
- Components: `src/components/chronicle/**`
- Data: `src/local/**` (Dexie `chronicle_local`), `src/hooks/useIncidents.ts`,
  `useEvidence.ts`, `useFollowUpNotes.ts`, `useEditHistory.ts`
- Export/summaries: `src/lib/**`
- Backend: `supabase/functions/**`

## 2. V2 candidate

- Route: `/v2/*` (`src/App.tsx` → `src/v2/V2App.tsx`).
  `/prototype/*` redirects to `/v2/notebook`.
- Everything under `src/v2/`:
  - `routes.ts` — route map (`V2_BASE`)
  - `db.ts` — isolated Dexie database `chronicle_prototype` (name kept so
    existing preview data survives the rename; see route-transition.md)
  - `screens/` — Capture, Review, Notebook, Entry, Dossier
  - `components/` — FilterSheet, MonthView, DossierPreview, Dialog
  - `media/` — voice capture, attachment picker, evidence section, limits
  - `dossier/` — document model, PDF, DOCX, image preparation
  - `model/` — **design only**: target production schema and migration
    contract. Not wired to anything yet.

## 3. Shared infrastructure

- `src/main.tsx`, `src/App.tsx` routing shell
- Router, React Query, theme class on `<html>`
- `src/integrations/supabase/client.ts` (V2 does not import it yet)
- Build tooling, Tailwind config, global `src/index.css`

V2 deliberately does **not** share the Tailwind/shadcn design system; it is
styled by `src/v2/styles.css`, scoped under `.proto-root`.

## Documents

- [capability-matrix.md](./capability-matrix.md) — V1 → V2 gap audit
- [data-model.md](./data-model.md) — production schema design
- [migration-strategy.md](./migration-strategy.md) — V1 data → V2
- [auth-and-sync.md](./auth-and-sync.md) — auth, offline, sync, deletion
- [route-transition.md](./route-transition.md) — cutover plan
- [release-gates.md](./release-gates.md) — gates before V2 replaces V1
