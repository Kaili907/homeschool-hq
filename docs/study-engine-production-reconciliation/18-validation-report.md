# Validation report

All commands used Node `v22.23.1` and npm semantics unless a report explicitly describes a custody-only helper.

| Validation | Result |
|---|---|
| Root host tests | 70 files, 1010 tests passed |
| Root TypeScript check | passed |
| Provider/deploy regression | 4 files, 56 tests passed |
| Safety/adult-review suites | 6 files, 115 tests passed |
| Production contract/composition suites | included in root pass; focused suite passed |
| Study lifecycle/accessibility suites | 5 files, 40 tests passed |
| Academy profile DB | 55/55 passed |
| Academy CAS DB | 23/23 passed |
| Academy CAS PostgreSQL | 4/4 passed |
| Identity/foundation DB | 16/16 passed |
| Production reconciliation DB | 11/11 passed |
| Combined Study DB regression | 3 files, 26 tests passed |
| RC1 final assembly runtime | 44/44 passed |
| Session 6 bridge | 14 passed, 1 archive check skipped, 0 failed |
| Calendar/parent runtime | typecheck and build passed; 86 unit tests passed |
| Student runtime | typecheck and build passed; 77 unit and 14 browser tests passed |
| Study UX prototype | typecheck and build passed; 25 unit and 10 browser tests passed |
| Final assembly runtime package | typecheck and build passed; 44 unit and 10 browser tests passed |
| Production build | passed; chunk-size warning only |
| Production bundle forbidden-marker scan | zero matches for the recorded marker set |
| Production dependency audit | five package locks; zero vulnerabilities |

The archive test skip is a custody limitation: four external Session 6 ZIP archives were absent. The repository Playwright suites completed in desktop and mobile Chromium, including automated accessibility, keyboard, reduced-motion, large-text, recovery, and reflow cases. In-app browser control itself was unavailable, so no separate interactive inspection or manually captured screenshot set was produced.

An exploratory cross-package Vitest invocation was discarded as an invalid harness: it loaded 466 tests but could not resolve package-local aliases, globals, Playwright dependencies, or the five external reconciliation ZIPs for 38 suites. Each owned package was then installed and run with its own checked-in configuration, producing the passing results above. The prototype unit suite initially exhausted fork-worker startup under parallel load; its checked-in suite passed 25/25 with one worker. The prototype Playwright web server initially lacked `npm` on the sandbox PATH; the suite passed 10/10 against a temporary Node 22 localhost server, which was stopped afterward.
