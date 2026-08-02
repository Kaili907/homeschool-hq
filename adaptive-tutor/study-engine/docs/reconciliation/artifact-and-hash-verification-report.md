# Artifact and Hash Verification Report

Verification date: 2026-07-28  
Hash algorithm: SHA-256  
Overall result: **BLOCKED only because Tutor Core v0.2 is unavailable**

## Wave 1 artifacts

| Artifact | Bytes | Required and observed SHA-256 | Result |
|---|---:|---|---|
| `CARD-1-STUDY-CONTRACTS.zip` | 110,827 | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | PASS |
| `manuel-academy-session-2-study-engine.zip` | 110,524 | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | PASS |
| `manuel-academy-study-ux-session-3.zip` | 5,735,334 | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | PASS |
| `manuel-academy-session-4-study-integrations.zip` | 86,028 | `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B` | PASS |

All 230 archived file entries are byte-identical to their corresponding on-disk Wave 1 files:

| Artifact | Compared | Missing | Different |
|---|---:|---:|---:|
| Contracts | 70 | 0 | 0 |
| Engine | 58 | 0 | 0 |
| Study UX | 64 | 0 | 0 |
| Integrations | 38 | 0 | 0 |

Archive safety checks found zero absolute paths, traversal paths, duplicate paths, case-insensitive duplicates, normalized duplicates, symlinks, or reserved-name hazards. Every entry is stream-readable. Maximum observed compression ratio was 9.31. The Contracts and Engine ZIPs use backslash separators; this is a `SAFE ADAPTER` portability issue for archive readers, not grounds to rewrite the verified files.

## Tutor Core v0.2

Result: **NOT ACCESSIBLE — BLOCKER**

The actual package was not present in the workspace, expected core path, remote attachments, incoming files, ordinary user download/document locations, local Git refs/worktrees, package manifests/lockfiles, or any Wave 1 ZIP. The accessible `src/tutor/**` tree is legacy application code and was rejected as a substitute. No handoff summary was used to reconstruct the package.

Required next step: attach the actual package, provide or verify its expected hash, then run the twenty compatibility probes listed in the Tutor Core matrix.

Machine evidence: [`artifact-verification.v1.json`](../../reconciliation/artifact-verification.v1.json).

