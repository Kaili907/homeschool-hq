# Session 6-R2 Validation Report

Validation was performed on Node 22.23.1. The four authoritative archives and
test-only tooling remained outside the repository package in isolated system
temporary directories. Tutor Core v0.2 was copied to a fresh temporary tree
for build validation and was not modified in place.

## Results

| Gate | Result | Evidence |
|---|---|---|
| Four authoritative archive checksums | PASS | 4/4 exact SHA-256 matches |
| Frozen Tutor Core manifest | PASS | 248/248 files, 0 mismatches, 0 unlisted files |
| Strict bridge TypeScript typecheck | PASS | 0 diagnostics |
| Owned Session 6 bridge suite | PASS | 4 files; 36 passed, 0 failed, 0 skipped |
| Layered safety and permit suite | PASS | 12/12 |
| Ledger/order/replay suite | PASS | 6/6 |
| Portable extracted-package suite | PASS | 3/3 |
| Frozen Tutor Core compatibility suite | PASS | 21 passed, 0 failed |
| Session 1 canonical contract suite | PASS | 7 files; 116 passed, 0 failed |
| Session 2 Study Engine suite | PASS | 21 files; 325 passed, 0 failed |
| Frozen Core static TypeScript build in isolated copy | PASS | declarations, JavaScript, source maps, prototype assets, and 14 schemas emitted |
| Frozen Core package validation in isolated copy | PASS | 19/19 checks |
| Independent frozen Core static-asset smoke | PASS | 7/7 required asset assertions |
| Sixteen machine-readable bridge traces | PASS | unique, complete, privacy-safe, deterministic |
| R2 adversarial reconciliation | PASS | five implementation findings corrected and regression-tested; release evidence refreshed |
| Bridge dependency audit | PASS | private local ESM package; zero runtime and development dependencies |
| Clean extracted ZIP TypeScript and Node import | PASS | no repository-root package, no `node_modules`; exact `tsc -p ... --noEmit` and Node 22 source-barrel import pass |
| Portable path model | PASS | Windows, Linux, and macOS path construction; drive, absolute, traversal, and backslash attacks rejected |
| Raw ZIP central-directory audit | PASS | forward slashes only; 0 absolute, drive-qualified, traversal, duplicate, case-colliding, symlink, or out-of-ownership entries |
| Windows extraction and packaged manifest replay | PASS | every packaged manifest entry rehashed successfully |

Executable test total: **498 passed, 0 failed, 0 skipped**.

## R2 correction evidence

The safety suite reproduces and stops all seven named false negatives plus
reviewed paraphrases covering direct suicidal language, future intent, numeric
pill ingestion, progressive abuse, food withholding, and fear of returning
home. It also covers caregiver roles, contractions, punctuation, whitespace,
misspellings, obfuscation, prompt injection, first-person versus attributed
story/academic context, simultaneous categories, six uncertain cases, eight
negative/idiom cases, empty and oversized input, classifier outages,
malformed/contradictory classifier results, and downgrade attempts.

Only `clear` produces a permit. Exact use consumes it; replay, copying, context
mismatch, expiry, and retry after a rejected adapter presentation all fail.
Urgent, uncertain, and invalid outcomes invoke neither Tutor Core nor the
event ledger.

`orchestrateStudyCoreBridge` is the sole supported end-to-end entry point.
Tests prove callback-once behavior and the required sequence:

```text
safety -> permit -> Tutor Core -> authority adapter -> accepted-event ledger
       -> canonical Study projection -> outbox proposals
```

Identical replay returns `duplicate-ignored`; modified content under the same
event ID returns a quarantined `event-id-collision`. Both stop before
projection and return zero outbox proposals. `null`, unknown, or extra-field
ledger acknowledgments also fail closed before projection. Unsupported package
and event versions and unknown event kinds quarantine without coercion.

## Adversarial-agent reconciliation

The fourth, read-only adversarial agent identified and the primary agent
corrected:

1. broad academic/story markers masking direct disclosures;
2. an R1 cycle helper that was still named as a supported production path;
3. malformed ledger acknowledgments falling through as accepted;
4. contradictory classifier category/outcome shapes;
5. permit reuse after an unknown-field adapter rejection.

The legacy helper is now explicitly named
`executeLocalDemoStudyCoreBridgeCycle`; production documentation and the
package manifest identify only `orchestrateStudyCoreBridge` as supported.

## Build smoke note

The frozen Core's provided `smoke-prototype.mjs` still does not complete on
Windows because it passes a URL pathname directly to `fs.stat`; the resulting
pathname has a leading slash before the drive letter. The frozen file was not
changed. An independent smoke over the emitted assets passed the same seven
content assertions: title, module and stylesheet references, speech fallback,
non-human identity disclosure, reduced-motion support, and Jarvis styling.
This is an upstream cross-platform smoke-runner limitation, not a bridge
runtime or build failure.

## Reproduction

Set `SESSION6_SOURCE_ROOT` to a verified extraction root; set the four
authoritative `SESSION6_*_ZIP` variables; and set `SESSION6_NODE22`,
`SESSION6_TSC`, and `SESSION6_R2_PACKAGE_ZIP` to the external Node 22 runtime,
TypeScript CLI, and corrected package:

```powershell
node --experimental-strip-types --test adaptive-tutor/study-engine/tests/tutor-core-bridge
node path/to/typescript/bin/tsc -p adaptive-tutor/study-engine/bridges/tutor-core/tsconfig.json --noEmit
```

The source verifier also accepts explicit `--tutor-zip`,
`--study-contracts-zip`, `--study-engine-zip`, `--reconciliation-zip`, and
`--tutor-root` arguments.
