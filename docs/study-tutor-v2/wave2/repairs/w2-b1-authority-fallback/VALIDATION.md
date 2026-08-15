# W2-B1 validation

Validation date: 2026-08-14

Branch: `mac/tutor-v2-w2-authority-fallback-repair-r1`

Starting SHA: `8d618502a16a3d4d169143b539286a3b6fb5b925`

## Repair reproductions

The owned `adaptive/orchestrator.test.ts` suite passed 9/9. It covers:

- Study held plus capability admitted fails closed.
- A fully bound Study hold invokes zero adaptive subsystem dependencies.
- Capability and intervention safety duplicates are reconciled.
- Held binding conflicts and replay unavailability remain non-academic.
- Replay duplicate and collision protection still applies to held requests.
- `return-to-lesson` plus `escalate` invokes no hint, repair, or reteach
  subsystem and emits only authorized intervention action `escalate`.
- Hint, prerequisite repair, and reteach are each denied independently.
- Invalid attacker event, fallback, and content refs are replaced by canonical
  trusted constants.
- Extra nested fields, getters, and hostile proxies cannot influence invalid
  fallback selection.

## Regression results

| Check | Result |
| --- | --- |
| Strict Tutor V2 TypeScript | PASS |
| Root strict TypeScript | PASS |
| W2-B1 owned repair suite | 9/9 PASS |
| Wave 2 adaptive composition and schema parity | 17/17 PASS |
| Wave 2 lane regression | 164/164 PASS |
| Wave 1 hard gate | 253/253 PASS |
| Study bridge TypeScript | PASS |
| Study bridge regression | 209/209 PASS |
| Tutor Core regression | 21/21 PASS |
| Wave 2 schema check | PASS, 2 schemas plus inventory exact |
| Wave 1 schema check | PASS, 23 schemas plus inventory exact |
| Wave 1 release check | PASS, 10 artifacts exact |
| Tutor Core build | PASS |
| Tutor Core static prototype smoke | PASS |

No production, Netlify, or Supabase command was run. Build outputs and installed
dependencies remained ignored; no out-of-scope tracked file changed.
