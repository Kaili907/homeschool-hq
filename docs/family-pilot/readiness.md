# Family pilot readiness

Answers one question: **can Dad safely run the supervised one-child Grade 5
Math pilot locally/preview right now?**

This is a separate, narrower gate from the production Study readiness tooling
(`scripts/production-local-preflight.mjs`, `scripts/study-deployment-env-preflight.mjs`).
It never contacts a hosted service, a database, or the network — every check
reads the local filesystem or the local process environment only.

## Usage

```bash
node scripts/family-pilot/readiness.mjs
node scripts/family-pilot/readiness.mjs --format json
node scripts/family-pilot/readiness.mjs --root path/to/checkout
```

Exit code is `0` when ready, `2` when not ready, `1` on a usage/internal error.

## Tests

```bash
npx vitest run --project root-app scripts/family-pilot/readiness.test.ts
```

Every scenario builds a throwaway temp directory (`node:fs/promises` `mkdtemp`)
rather than touching the real repo tree.

## What it checks

| Check | What it looks at |
| --- | --- |
| Correct Node runtime | The running Node major version meets the floor the local toolchain (Vite 6 / Vitest 4) needs. If `netlify.toml` pins a different `NODE_VERSION` for hosted builds, that's reported for awareness — it does not block, since the pilot only ever runs locally. |
| Local repo/build availability | `package.json` and `node_modules` exist at the repo root (`npm ci` has been run). |
| Grade 5 Math static unit is present | The curriculum release registry resolves a `currentRelease`, and that release's `grades/grade-5/courses/mathematics` directory exists and is non-empty. |
| Student route/module exists | `src/curriculum/practice/grade5MathPracticeRoute.ts` and `src/components/curriculum/Grade5MathPractice.tsx` both exist. |
| Parent supervision surface exists | At least one of the known parent-facing surfaces exists (`src/components/GrownUps.tsx`, `src/components/hub/ParentHub.tsx`). |
| Local progress/session support exists | `src/appState.ts` exists and persists via `localStorage` (no hosted dependency). |
| No required pilot dependency is obviously missing | `react`, `react-dom`, and `vite` are declared in `package.json`. |
| Production Study remains dark | `ACADEMY_STUDY_ENABLED` is not set to an enabled value in the current environment. |
| Email/SMS are not required for the pilot | A design-invariant check: no check in this file may declare an email/SMS provider credential as required. Guards against regressions as new checks are added. |

## Extending as Mac branches land

Each check is one entry in the `PILOT_CHECKS` array in
`scripts/family-pilot/readiness.mjs` — `{ id, label, run(ctx) }`, where `ctx`
is `{ rootDirectory, env, nodeVersion }` and `run` returns
`{ pass, detail }`. The CLI, the JSON/operator formatters, and the test suite
all iterate `PILOT_CHECKS` directly, so adding a check is:

1. Append a new entry to `PILOT_CHECKS` (e.g. once a dedicated Family Pilot
   parent-review surface or a pilot-specific local session store lands on a
   Mac branch, either point an existing check's file-path candidates at it or
   add a new check for it).
2. Add fixture-directory test cases for the new pass/fail paths in
   `readiness.test.ts`.

No other file needs to change — `PILOT_CHECKS` is the single source of truth
for both the verdict and the report output.
