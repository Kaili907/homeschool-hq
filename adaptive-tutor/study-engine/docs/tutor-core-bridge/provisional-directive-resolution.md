# Session 2 Provisional Directive Resolution

## Provisional shape

Session 2 guessed this Tutor-owned wire contract:

```text
provisional.tutor-core.instruction-outcome.v1
instructionDirective: correct | reteach
```

Tutor Core v0.2 exports neither that envelope nor that directive enum.

## Canonical replacement

The bridge owns `BridgeInstructionDisposition`:

```text
continue-core-cycle | advance | reteach | adult-review
```

`mapTutorPhaseToBridgeDisposition` maps only a validated Tutor Core phase:

| Verified Tutor phase | Bridge disposition |
|---|---|
| `advance` | `advance` |
| `reteach` | `reteach` |
| `escalated` | `adult-review` |
| every non-final phase | `continue-core-cycle` |

No score, Study timer, break, pacing flag, or local heuristic can populate the
disposition.

## Temporary Session 2 compatibility

`mapTutorPhaseToRetiringSession2Directive` can supply:

- `advance` → legacy `correct`
- `reteach` → legacy `reteach`

All other phases return `tutor-phase-not-final`. The result always carries
`retirementRequired:true`.

## Unsupported behavior

- No mapping from low accuracy to `reteach`.
- No mapping from fast work, a break, pause, or completion to `correct`.
- No mapping from Study recommendation to Tutor mastery.
- No guessed directive for unknown or unsupported Core events.

## Retirement plan

1. Update the Session 2 integration seam to consume the bridge disposition.
2. Run phase/authority parity tests.
3. Remove the legacy directive mapper only after all callers stop emitting or
   accepting the provisional version string.
4. Keep historical provisional payloads quarantined; do not migrate them by
   inference.
