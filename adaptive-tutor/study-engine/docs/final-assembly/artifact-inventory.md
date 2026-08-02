# Authoritative artifact inventory

All inputs were hashed before extraction. Raw central-directory parsing rejected absolute, drive-qualified, traversal, encrypted, symlink, duplicate, case-colliding, empty-segment, and personal-path entries. All 1,082 entries passed decompression/CRC checks.

| # | Accepted artifact | Bytes | SHA-256 | Entries | Ownership root |
|---:|---|---:|---|---:|---|
| 1 | `manuel-academy-adaptive-tutor-core-v0.2.zip` | 296,306 | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | 282 | `manuel-academy-adaptive-tutor-core-v0.2` |
| 2 | `CARD-1-STUDY-CONTRACTS.zip` | 110,827 | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | 73 | `adaptive-tutor` |
| 3 | `manuel-academy-session-2-study-engine.zip` | 110,524 | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | 62 | `adaptive-tutor` |
| 4 | `manuel-academy-study-ux-session-3.zip` | 5,735,334 | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | 79 | `adaptive-tutor` |
| 5 | `manuel-academy-session-4-study-integrations.zip` | 86,028 | `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B` | 38 | `adaptive-tutor` |
| 6 | `SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip` | 38,300 | `39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41` | 18 | `adaptive-tutor` |
| 7 | `SESSION-6-R2-STUDY-CORE-BRIDGE.zip` | 99,753 | `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571` | 37 | `adaptive-tutor` |
| 8 | `SESSION-7-R2-STUDY-STUDENT-RUNTIME-FINAL.zip` | 5,357,018 | `C78F612507BEDD1185D2B5B70D66A8E934CF29488813A9386C5E8D65BB590B8C` | 435 | `adaptive-tutor` |
| 9 | `SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip` | 1,170,672 | `604A924B13580AAC00ED5578C0B22F3EC9B8CF9CA5F20DC04DB4DB040E6B62E1` | 58 | `docs`, `integration-labs`, `tests` under `adaptive-tutor/study-engine` |

The final mapped assembly contains 1,028 unique accepted files. There were no exact or case-folded cross-package collisions. Every assembled accepted file was re-hashed against custody extraction and matched. No rejected historical checksum contributed source or generated output.

Tutor Core manifest verification: **248/248 matched**, zero missing/mismatched, zero unlisted.
