# Session 7 artifact verification

Verified on 2026-07-29 from the local workspace. All source packages were
opened read-only. No package was reconstructed from a summary.

| Package | Expected SHA-256 | Actual SHA-256 | Archive | Workspace tree parity |
| --- | --- | --- | --- | --- |
| Card 1 canonical study contracts | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | PASS | 70/70 files byte-identical |
| Session 2 Study Engine | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | PASS | 58/58 files byte-identical |
| Session 3 Study UX | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | PASS | 64/64 files byte-identical |
| Card 5 reconciliation audit | `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7` | `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7` | PASS | 36/36 files byte-identical |

The archive hashes were computed directly with SHA-256. Workspace parity was
checked by streaming every non-directory ZIP entry, hashing it independently,
and comparing it with the corresponding extracted workspace file. There were
zero missing or mismatched files.

## Optional package search

The workspace archive inventory, package manifests, accessible attachment
folder, Session 5 reconciliation records, and Session 7 owned roots were
searched for:

- Manuel Academy Adaptive Tutor Core v0.2;
- an actual Session 6 bridge archive or manifest.

Neither package is present. The prior Session 5 machine-readable verification
also records Tutor Core as unavailable. Legacy tutor application code was not
substituted. No Tutor Core or Session 6 symbols were inferred from handoff
summaries.

Session 7 therefore uses the explicitly temporary, local-only
`student-runtime.session6-bridge.v2` boundary in its owned source root. Each
receipt binds the canonical session and SegmentId task identity, draft
reference, submission revision, unique request, occurrence time, directive,
and reason code. Mastery and misconception authority remain withheld pending a
verified Tutor Core package. Exact replacement steps are maintained in
`provisional-adapter-retirement-report.md`.

## Card 5 policy use

Card 5 is available and verified, so Session 7 applies decision `DEC-012`
rather than the older provisional first-wins chain:

1. validate version, integrity/idempotency, and authorization gates;
2. compose safety and required-accommodation constraints;
3. apply the most restrictive authorized adult hard maximum;
4. compute the feasible interval and require manual review if it is empty;
5. select a valid manual target, otherwise an accepted evidence-sufficient
   engine recommendation, otherwise an established target, otherwise the
   grade-band default;
6. clamp to the feasible interval and retain reason-coded provenance.

Required breaks and presentation accommodations remain obligations, not
numeric duration candidates.
