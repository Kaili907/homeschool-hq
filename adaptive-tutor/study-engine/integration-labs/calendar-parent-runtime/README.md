# Calendar and parent runtime lab

Local, in-memory Wave 2 integration of canonical review scheduling, the
13-type study calendar, parent controls/evidence, and a credential-free Romeo
Virtual Academy adapter.

This package does not connect to production calendar, Parent Hub, Student
Study-UX, Tutor Core, Supabase, database, authentication, identity, storage,
deployment, or GitHub.

## Run

From the repository root:

```powershell
npm install --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run typecheck --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm test --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run build --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run audit:node --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run preview --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
```

The preview listens only on `127.0.0.1:4189`.

## Demonstrations

The browser lab has six deterministic tabs:

1. Retrieval failure → reteaching → local same-day retry → queue/calendar →
   daily limit
2. Successful review → interval expansion → parent evidence
3. Three-of-six partial lesson → exact resume → one idempotent continuation
4. Parent rejects an increase → history retained → parent setting effective
5. Required accommodation → shorter maximum, longer break, hidden timer, all
   ten parent controls
6. Romeo manual assignment → tutoring link → progress/completion update →
   credential-free calendar block

## Module map

| Module | Purpose |
| --- | --- |
| `review-runtime.ts` | Session 2 recommendation → canonical review → bounded queue → canonical result feedback and idempotent return outbox |
| `calendar-runtime.ts` | All 13 mappings, segments/resume, timezones/DST, edits, interruptions, completion, dedupe |
| `card5-duration-policy.ts` / `parent-runtime.ts` | Card 5 DEC-012 constraint reduction, all ten controls, and complete winner/reason provenance |
| `privacy.ts` | DEC-019 minimized recommendation projection, parent-only isolation, and empty student-private projection |
| `romeo-runtime.ts` | DEC-018 credential-free versioned assignment normalization, public projection, update, and idempotent calendar projection |
| `demo-scenarios.ts` | Six deterministic integrated browser demonstrations |
| `app.ts` / `styles.css` | Mobile-first local review UI |

## Card 5 status

The observed Card 5 archive SHA-256 is pinned as
`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`, SHA-256
`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`.
Archive/workspace parity, 7 reconciliation probes, and 19 reconciliation tests
pass. This lab consumes DEC-009, DEC-012, DEC-014, DEC-017, DEC-018, and
DEC-019.

Card 5 itself is `PASS_WITH_BLOCKER`: Tutor Core v0.2 is unavailable, so
production integration and final assembly remain unauthorized. The exact
local reconciliation record is in
`docs/calendar-parent-runtime/CARD-5-REPLACEMENT.md`.

## Generated evidence

- `dist/` — browser-safe production build
- `traces/deterministic-traces.json` — reproducible scenario trace
- `traces/parent-precedence-traces.json` — reproducible DEC-012
  winner/reason and parent-control trace
- `screenshots/` — desktop and mobile browser QA captures plus manifest
- `scripts/verify-inputs.ps1` — package checksum and workspace parity audit
- `scripts/node-audit.mjs` — Node dependency and browser-bundle audit
