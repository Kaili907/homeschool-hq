# Validation

Runtime: Node 22.23.2.

Current convergence results:

- R1/R2/R4/R5 repaired replay: 64/64 TAP assertions.
- R3 Parent/guardian repaired replay: 22/22 TAP assertions.
- Aggregate repaired replay: 86/86 TAP assertions.
- Historical blocker closure: 38/38.
- Wave 4 hard gates: 13/13.
- Wave 4 negative controls: 13/13 detected.
- Wave 3 hard gates: 18/18.
- Wave 3 convergence: 33/33.
- Wave 2 convergence: 288/288.
- Study Tutor bridge: 209/209.
- Foundation corpus: 128/128 with `releaseReady=false`.
- Tutor Core: 21/21; build and smoke pass.
- Study Core bridge: 35 pass, 1 skipped because the four external Session 6
  archives are not mounted.
- Wave 4 schemas: 10 serialized boundaries, 0 internal-port schemas; generation,
  recursive closure, runtime parity, and reproduction pass.
- Wave 4 release evidence: 17 deterministic artifacts reproduce exactly.

Historical lane replay remains distinct from repaired replay. W4-03 reproduced
its historical RED state (36 pass, 22 fail across 58 tests, representing the 19
recorded blocker assertions); W4-05 preserved its 16/21 matrix with five
blockers; W4-06 preserved two explicit blocker cases; W4-08 reproduced 5 pass
and 10 fail across 15 tests, covering seven blocker categories; W4-10 reproduced
25 pass and five fail across 30 tests. Convergence-owned tests require the
repaired safe outcomes and close 19/19, 5/5, 2/2, 7/7, and 5/5 respectively.

The inherited Wave 2 and Wave 1 broad wrappers are not current convergence
ownership gates. Their obsolete path allowlists reject the later Wave 3/4 files.
The Wave 1 wrapper additionally cannot resolve the locally shared dependency
tree inside its isolated temporary copies. Its security suites still pass
253/253 and its Study bridge passes 209/209. Current-root typechecks, builds,
smoke, schema/release checks, and bridge suites pass independently. The accepted
broad platform validator remains the separately classified 18/19 inherited
finding.

Also unchanged and separately classified: three inherited high dependency
advisories; four unavailable Session 6 archives; production persistence,
provider credentials/transports and pricing feeds; Parent Hub UI; browser media
capture; vendor TTS/STT; production curriculum adapter; deployment/security
convergence; and live stochastic model certification.
