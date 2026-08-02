# Validation report

All canonical validation used Node 22.23.2 and synthetic data. No hosted Supabase project or external notification/provider was called.

## Final green runs

| Surface | Result |
| --- | --- |
| Root host/Netlify tests | 95 files, 1,205 passed |
| Academy PGlite chain, including all prior base-migration cases | 4 files, 94 passed |
| Embedded PostgreSQL CAS | 1 file, 4 passed |
| Study DB/identity/adult/final/manifest suite | 7 files, 54 passed |
| Tutor Core compiled tests | 21 passed |
| Frozen RC1 runtime Vitest unit suites | 4 files, 44 passed |
| Student Runtime | 15 files, 77 passed |
| Calendar/Parent Runtime | 6 files, 86 passed |
| UX prototype unit suites | 8 files, 25 passed |
| UX browser/accessibility/mobile full warm rerun | 10 passed |

The non-overlapping canonical green suites total 1,620 passed and 0 assertion failures. Additional overlapping focused runs passed: policy/worker/adapter/final 43 tests and migration/manifest/preflight 16 tests. Root TypeScript, Tutor Core TypeScript, UX prototype TypeScript, the RC1 release audit, the 248-file Tutor Core manifest, and the root production build passed. The build emitted only the existing large-chunk warning.

## Every unsuccessful or incomplete attempt

- Final npm-wrapper/typecheck invocations initially could not resolve the pinned Node executable or a candidate-local TypeScript install from the isolated worktree. The same typecheck was run directly with Node 22 and the repository's locked TypeScript dependency and passed. Sandboxed host-test/build attempts could not let esbuild read the worktree Vite config; unchanged commands outside that filesystem restriction passed 1,205/1,205 and built successfully. These were invocation/environment failures, not excluded assertions.
- One database introspection assertion initially compared case-sensitively; production behavior was correct. The assertion was corrected to reflect PostgreSQL-normalized output and the complete 54-test suite reran green.
- Student Runtime initially had one suite-loader failure because React was not resolvable from the isolated worktree. With the existing locked dependency made locally resolvable, all 15 files/77 tests reran green.
- UX Vitest initially could not load its configuration in the isolated Windows environment. The supported runner config loader was used; all 25 tests passed without assertion changes.
- The first full UX browser run passed 8/10; two core flows reached their final 6/6 UI state but exceeded the cold 30-second timeout. Both unchanged tests passed on immediate rerun, followed by an unchanged full 10/10 warm run.
- The frozen RC1 runtime TypeScript command remains incomplete because immutable package-local `@playwright/test` and `@axe-core/playwright` installs are absent. Its direct Vitest unit suites pass 44/44. The frozen RC1 browser suite was not run for the same dependency-custody reason.
- The authenticated reconciled production host has no browser harness. The green browser suite covers the immutable UX prototype, not the missing full production composition. Firefox, WebKit, manual screen-reader, 200% zoom, high-contrast, and physical-device checks were not run.
- The deterministic hosted preflight exits blocked by design because the required hosted evidence/authorization fields are false.

## Security and dependency evidence

Root production, root full, prototype, Student Runtime, and Calendar/Parent Runtime audits are clean. Frozen RC1 has two high Playwright development-tool findings and no production reachability; see `playwright-advisory-classification.md`. Production bundle and server scans found no Playwright or credential literal. A source scan found one voice diagnostic that included speech text; Session 19 replaced it with provider and character-count metadata, after which the raw-content scan was clean.
