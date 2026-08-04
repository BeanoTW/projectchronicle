# V2 route transition plan

Nothing is removed in this phase. V1 routes stay live and untouched.

## Current state

| Route | Serves |
|---|---|
| `/v2/*` | V2 candidate (new canonical preview path) |
| `/prototype/*` | Permanent-for-now redirect → `/v2/notebook` |
| all other routes | V1 production app, unchanged |

## Planned cutover mapping

| V1 route | V2 replacement | Redirect at cutover |
|---|---|---|
| `/timeline` | `/notebook` | 301-equivalent client redirect |
| `/calendar` | `/notebook` (month view) | redirect, month view preselected |
| `/record` | `/capture` | redirect |
| `/incident/:id` | `/entry/:id` | redirect, id preserved |
| `/export` | `/dossier` | redirect |
| `/my-record`, `/insights` | `/dossier` overview | redirect + notice |
| `/support`, `/settings`, auth, public marketing pages | unchanged | none |

At cutover `/v2/*` becomes the bare production paths (`/notebook`, `/capture`,
`/entry/:id`, `/dossier`), and `/v2/*` itself becomes a redirect.

## Behaviour

- **Deep links** — record ids are preserved by the migration, so
  `/incident/:id` maps cleanly to `/entry/:id`.
- **Browser back** — all compatibility redirects use `replace`, so back never
  bounces the user through a redirect loop.
- **Bookmarks** — old bookmarks resolve to the equivalent V2 screen with a
  one-time dismissible notice explaining the change.
- **Compatibility window** — redirects remain for at least 12 months after
  cutover; `/prototype/*` for 6 months after that.
- **Rollback** — V1 screens stay in the bundle behind `/v1/*` for the first
  release cycle so support can direct a user back to the old interface.
