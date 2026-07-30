# Session 7 artifact verification

Verified on 2026-07-29 from the local workspace. All source packages were
opened read-only. No package was reconstructed from a summary.

| Package | Expected SHA-256 | Actual SHA-256 | Archive | Workspace tree parity |
| --- | --- | --- | --- | --- |
| Verified current Session 7 student runtime | `9448B7F91519FDF7213A8939ED5458B9749E58DBF8054F64A56E3F548482097D` | `9448B7F91519FDF7213A8939ED5458B9749E58DBF8054F64A56E3F548482097D` | PASS | Accepted correction baseline |
| Card 1 canonical study contracts | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | PASS | 70/70 files byte-identical |
| Session 2 Study Engine | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | PASS | 58/58 files byte-identical |
| Session 3 Study UX | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | PASS | 64/64 files byte-identical |
| Accepted Session 5-R2 portable reconciliation | `39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41` | `39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41` | PASS | Accepted archive verified directly |
| Accepted Session 6-R2 Study Core Bridge | `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571` | `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571` | PASS | Package `1.0.1`; bridge contract `1` |
| Frozen Tutor Core v0.2 | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | PASS | Frozen read-only input |

The archive hashes were computed directly with SHA-256. Workspace parity was
checked by streaming every non-directory ZIP entry, hashing it independently,
and comparing it with the corresponding extracted workspace file. There were
zero missing or mismatched files.

The prior `DF90BF...E66F` Session 7 copy was rejected and was not used as an
input, fallback, or packaging source.

## Corrected provenance

The previously reported value
`2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`
identifies the older `CARD-5-STUDY-RECON-AUDIT.zip`, version
`0.5.0-blocked.1`. It is not the accepted Session 5-R2 authority and is not
used as Session 7-R1 provenance.

The accepted inputs are
`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`,
`SESSION-6-R2-STUDY-CORE-BRIDGE.zip`, and the frozen
`manuel-academy-adaptive-tutor-core-v0.2.zip`. No missing package was
reconstructed from summaries, legacy Tutor code, or memory.

## Session 5-R2 policy use

Session 5-R2 is available and verified, so Session 7 applies `DEC-012`
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
