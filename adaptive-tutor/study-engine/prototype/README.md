# Manuel Academy study-session prototype

This is a standalone local React/Vite prototype for the grades 4–6
mathematics and reading study flows. It uses only browser `localStorage` for
mock persistence and does not connect to authentication, Supabase, a database,
or a deployment.

## Run locally

From this directory:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validate

```powershell
npm run typecheck
npm test
npm run test:ui
npm run build
```

The Playwright suite starts its own local server when one is not already
running. Browser reports and failure artifacts are written only under
`../docs/ui/`.

## Prototype reset

Open **Comfort & access** and choose **Reset local prototype data**, or clear
the `manuel-academy.study-ux.prototype.v1` local-storage entry.

## Source layout

- `src/App.tsx` — the working learner flow and local speech fallbacks
- `src/content.ts` — math and reading sample-session content
- `src/sessionStore.ts` — reducer, timer, break, event ledger, and local recovery
- `../ui/` — reusable study-session components
- `../tests/ui/` — unit, interaction, accessibility, and browser tests
- `../docs/ui/` — UX, accessibility, adapter, screenshots, and validation
