# Verified Artifact, Raw ZIP, Ownership, and Collision Report

Audit date: 2026-07-29 (America/New_York)

| Artifact | Bytes | Expected/calculated SHA-256 | Entries (files/dirs) | Result |
|---|---:|---|---:|---|
| CARD-1-STUDY-CONTRACTS.zip | 110,827 | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | 73 (70/3) | PASS |
| manuel-academy-session-2-study-engine.zip | 110,524 | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | 62 (58/4) | PASS |
| manuel-academy-study-ux-session-3.zip | 5,735,334 | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | 79 (64/15) | PASS |
| manuel-academy-session-4-study-integrations.zip | 86,028 | `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B` | 38 (38/0) | PASS |
| manuel-academy-adaptive-tutor-core-v0.2 .zip | 296,306 | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | 282 (250/32) | PASS |

Every central directory was parsed directly without path normalization, ended exactly at its EOCD record, and every file stream decompressed successfully: 480/480 source files read, 0 errors. Across all five sources there are zero absolute paths, traversal paths, exact duplicates, case-colliding paths, NUL paths, or symlinks.

The frozen Session 1 and Session 2 source ZIPs use backslashes in all 73 and 62 raw member names respectively. This is a source portability defect, not a checksum failure. No source artifact was changed. The corrected R1 output is separately required and tested to contain forward slashes only.

## Embedded manifests

Session 1 includes a 70-file descriptive manifest and fixture/schema mapping, without per-file hashes. Sessions 2–4 contain no hash manifest. Tutor Core’s embedded `MANIFEST.json` declares 248 files, 1,133,026 bytes and SHA-256: 248/248 sizes and hashes passed. Its two unlisted files—`MANIFEST.json` and `docs/file-inventory.md`—are documented exclusions.

## Ownership

All payload files remain within their assigned roots:

- Session 1: contracts, schemas, contract docs and fixtures.
- Session 2: engine, engine docs, prompts and engine tests.
- Session 3: UI, prototype, UI docs and UI tests.
- Session 4: integrations, parent, integration docs and integration tests.
- Tutor Core: its frozen package root.
- Session 5-R1 authored output: reconciliation, reconciliation docs and reconciliation tests only.

Generated content is owned and declared in-package: seven Session 1 generated schemas, five Session 3 prototype distribution entries, and Tutor Core distribution artifacts. No payload file crosses ownership.

## Cross-package collisions

After comparison-only conversion of `\` to `/` and removal of package roots, there are four directory collision keys: root, `docs/`, `prototype/`, and `tests/`. They contain no colliding files. Cross-package file collisions: **0**. Final merge routing by assigned ownership cannot overwrite a payload file.
