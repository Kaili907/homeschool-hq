# W2-B1 Study authority and trusted fallback repair

## Scope

This lane repairs only the Wave 2 adaptive composition boundary. It does not
change history provenance or mastery assistance binding, which remain assigned
to W2-B2 and W2-B3.

## Safety authority

`studyAuthority.safetyStatus` is the trusted Study state. The composition
boundary requires these duplicate representations to agree before replay or
adaptive computation:

| Study safety | Capability safety | Intervention restriction |
| --- | --- | --- |
| `academic-flow-admitted` | `admitted` | `none` |
| `academic-flow-held` | `restricted` | `academic-flow-held` |

Any contradiction returns the frozen Wave 2 wire contract's non-actionable
`quarantined` projection with reason `safety-representation-conflict`. A valid
Study hold returns the same non-actionable projection with reason
`study-safety-held`. This is the contract-compatible equivalent of an explicit
`safety-held` status: it contains no admissions, concept result, misconception,
hint, intervention, mastery result, repair, reteach, Parent explanation, or
reviewed content. Study remains the authority, a Study decision is required,
and Study mutation remains forbidden.

Other binding conflicts on a held request and replay-ledger unavailability also
remain non-actionable held projections. They never fall through to reviewed
academic fallback content.

## Replay and safety ordering

The order is deliberate:

1. Validate the closed request schema and clone the accepted value.
2. Reconcile all duplicated safety representations and other composition
   bindings. Contradictory or invalid bindings cannot reserve a replay key.
3. Claim the replay event and preserve duplicate/collision handling.
4. If Study safety is held, return the non-actionable held projection.
5. Only an admitted request may enter adaptive admissions and academic
   subsystems.

The replay claim is not an academic recommendation. Placing it immediately
before the held return preserves duplicate and event-collision protection while
ensuring a held request invokes zero adaptive academic dependencies.

## Study allowed actions

The composition boundary now treats `studyAuthority.allowedActions` as the
global action authority:

- Hint selection runs only when `hint` is present. Otherwise the projection is
  deterministically `no-hint`, with level `none` and no content reference.
- Prerequisite repair runs only when `check-prerequisite` is present. Otherwise
  it is `withheld`, has source `none`, and contains no concept or content refs.
- Reteach runs only when `reteach` is present. Otherwise it is `withheld`, has
  source `none`, zero steps, and no content refs.
- Intervention continues to receive the exact Study action list, and its
  existing first-authorized selection may emit only an action in that list.

No denied subsystem is executed and no alternative Tutor action is invented.
Analysis-only concept, misconception, and mastery processing may continue when
Study safety is admitted.

## Invalid-request fallback provenance

After schema rejection, the implementation passes no request object to the
fallback selector and reads no request property. The result is selected only
from trusted constants:

- event: `event:invalid-wave2-request`
- fallback: `fallback:reviewed-static-wave2`
- reviewed content: `content:reviewed-static-wave2`

Valid-looking attacker references, extra nested fields, accessors, and hostile
proxies cannot select identifiers or content in this result.
