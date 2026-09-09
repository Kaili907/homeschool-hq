# W4-R9 validation

Execution subject: `875f53ce3d7a38bafa25233cabde0f18a67bbf90`.

Certification results executed while `HEAD` remained that exact commit:

- Wave 4 executable hard gates: 13/13 PASS.
- D04 current replay/crash: 31/31 PASS, including 15/15 crash windows.
- D07 current privacy certification: PASS; 14 canary categories, 41 surfaces,
  zero direct, normalized, or encoded leaks, and valid projection accepted.
- Implementation mutations: 13 qualifying, 13 compile-valid, 13 killed, zero
  survived, zero invalid, zero inconclusive, zero baseline-blocked.
- M04: replay-crash TypeScript project included the mutated state machine,
  compile exit 0, D04 reached 31 assertions, and the physical execution count
  failed with `2 !== 1`.
- M06: compile-valid; D06 reached 27 assertions and failed semantically.
- M07: compile-valid; D07 reached its fail-fast assertion and rejected the
  transcript-contaminated durable projection.
- Historical blocker closure: 38/38.
- R1-R5 repair aggregate: 86/86.
- Wave 3: 18/18 hard gates and 33/33 convergence tests.
- Wave 2: 288/288.
- Wave 1 accepted hard boundaries: 253/253.
- Study Tutor bridge: 209/209.
- Foundation corpus: 128/128, `FOUNDATION_GATE_PASS`, `releaseReady=false`.
- Tutor Core: 21/21; strict typecheck, build, and smoke PASS.
- Study Core Bridge: 35/36 PASS with one exact external-archive checksum test
  skipped because the four Session 6 archives are not mounted.
- Current Wave 4 schemas: 10 serialized schemas and zero internal-port schemas.
- Repository and Tutor strict typechecks and production builds: PASS.

The Wave 1 aggregate wrapper still reports its accepted historical 18/19 broad
validator finding and obsolete pre-Wave-2 path-ownership failure after all
current executable suites pass. Those inherited wrapper findings do not replace
or weaken the direct current results above.

No permanent source changes were made under `src/**`, `netlify/**`, or
`supabase/**`; no credentials, live provider, browser AI, deployment, or master
merge were used.
