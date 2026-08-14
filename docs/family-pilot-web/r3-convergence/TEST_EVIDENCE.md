# R3 Convergence Test Evidence

All commands ran in the R3 convergence worktree on 2026-08-13 with Node
22.23.2. Browser tests used real Playwright Chromium 139.0.7258.5. Netlify
packaging used Netlify CLI 27.1.1 and `@netlify/build` 36.3.4 in offline mode.

| Proof | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS |
| Targeted convergence/source tests | focused root-app command covering route lifecycle, runtime isolation boundaries, production import boundaries, final acceptance, assessment, migration, response storage, answer boundary, and release config | PASS, 14 files / 79 tests |
| Targeted scorer/function tests | focused netlify-functions command for `production-item-assessment` and function surface | PASS, 2 files / 17 tests |
| Complete Family Pilot and assessment suite | `npx vitest run --project root-app src/study/family-pilot src/study/production-assessment src/assessment/assessment.test.ts src/curriculum/family-pilot` | PASS, 84 files / 899 tests |
| Complete Netlify suite | `npm run test:netlify` | PASS, 95 files / 1,845 tests |
| Permanent web-gate controls | `npm run test:web-release-gate` | PASS, 11/11 |
| Learner quality-gate controls | `npm run test:learner-release-gate` | PASS, 22/22 |
| Enabled graph isolation | `npm run audit:family-pilot-runtime-isolation` | PASS; legacy excluded, 105 Family Pilot static modules, 0 forbidden modules, 0 accepted legacy adapters |
| Learner quality | `npm run audit:learner-release` (inside web gate) | PASS; 90 courses, 8,292 lessons, 699 assessments; 8,292/0 and 699/0 ready/blocked |
| Final launch audit | `npm run audit:family-pilot-launch` (inside web gate) | PASS; 8,292 bindings/materials; 0 adult-only leaks |
| Web security gate | `npm run audit:web-release` | PASS / exit 0; 338 browser files scanned; 0 findings |
| Enabled production build | `VITE_FAMILY_PILOT_ENABLED=true VITE_USE_PROXY=true npm run build` (inside web gate and browser suite) | PASS; 556 modules; answer audit PASS; 0 source maps; 0 workers |
| Default-off production build | `VITE_FAMILY_PILOT_ENABLED=false npm run build` (browser web server) | PASS |
| Enabled persistent Chromium | `npm run test:family-pilot-browser` | PASS, 11/11; 90 cells, learner responses, assessment pending/rubric-review/guardian-authority paths, reload, process reopen, backup/restore, migration and failure proofs |
| Default-off Chromium | `npm run test:family-pilot-flag-default` | PASS, 1/1 |
| Exact Netlify branch build | `npx --yes netlify-cli@latest build --offline --context branch:mac/web-release-r3-convergence-r1` | PASS; exact custom context; 31 ZIPs; 31 manifest entries |
| Production dependency audit | `npm audit --omit=dev --json` | PASS; 0 vulnerabilities |

The browser network proof observed no external runtime request during the full
Family Pilot workflow. Scoring-unavailable behavior remained
`PENDING_ASSESSMENT` with no fabricated correctness. Trusted-scoring unit and
function tests covered correct, incorrect, constructed-rubric-review,
guardian-attestation, completion-only, unsupported, authorization, and
non-disclosure behavior. No hosted scorer, sync service, or Supabase project was
contacted.
