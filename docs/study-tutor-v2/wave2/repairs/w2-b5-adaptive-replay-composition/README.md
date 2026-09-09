# W2-B5 Adaptive Replay and Composition Repair

## Scope

This repair changes only the Wave 2 adaptive composition boundary. Individual
admission, concept graph, misconception, hint, intervention, mastery,
prerequisite repair, reteach, and Parent Why lane implementations remain
unchanged.

## Replay lifecycle and privacy

Replay claiming now occurs at the computation commit boundary. A reviewed
static fallback is returned without claiming the event, so a transient lane
failure cannot permanently poison an exact retry. A schema-valid pending Study
decision (or the non-actionable safety-held packet) is claimed immediately
before it is returned. The ledger's atomic claim remains the concurrency gate:
one exact concurrent request can return the pending packet and the others are
duplicate-ignored.

The ledger port receives exactly two values:

- the opaque `eventRef`;
- a `sha256:<64 lowercase hex characters>` digest.

The digest is calculated over a deterministic canonical representation inside
the adaptive boundary. Object key order is ignored. Only established set-like
collections are sorted: Study allowed actions, intervention allowed actions,
adaptive capabilities and their action families, and reviewed-content
admissions. Evidence, intervention history, reteach steps, and other genuine
sequences retain their original order.

Ledger returns are closed to `claimed`, `duplicate`, and `collision`. Throws,
rejections, and unknown return values are replay dependency failures. They are
never reclassified as collisions.

## Closed runtime result boundaries

Every invoked lane result is checked before projection. Existing exported
runtime schemas are used for misconception, hint, intervention, mastery, and
Parent Why results. The adaptive contract adds closed schemas for admission,
graph-query, prerequisite-repair, and reteach results. Accepted concept graphs
must be genuine validated `ConceptPrerequisiteGraph` instances, and registry
wrappers are checked for exact data properties and the canonical registry
version before use.

Contextual validation additionally binds result identifiers and reviewed
content to the current request. In particular, repair/reteach authority effects
must remain literal `none`, repair concepts must remain route-compatible, and
reviewed content references must originate in the Study-issued policy input.
No result field is projected before those checks pass.

The completed pending packet is validated against
`Wave2StudyDecisionPacketSchema` before the replay claim. A validation failure
returns the composition's reviewed static fallback and leaves replay unclaimed.

## Coherent adaptive action

Composition now selects the intervention result before invoking an
action-emitting lane:

- `hint` may invoke and project the hint lane;
- `check-prerequisite` may invoke and project prerequisite repair;
- `reteach` may invoke and project reteach;
- `return-to-lesson`, `suggest-break`, `escalate`, or a blocked intervention
  withhold all three unrelated proposal lanes.

This produces one coherent primary next action. Parent Why derives its reason
from that selected action, not from whichever independent projection happened
to be present.

## Evidence and route scope

Graph membership remains topology, not learner-deficiency evidence. A
prerequisite signal is created only when trusted academic misconception
evidence identifies a prerequisite and the graph confirms it on the current
compatible route. A no-signal misconception result cannot become a suspected
missing prerequisite merely because the graph has an edge.

Every graph prerequisite used by intervention or repair is filtered through
the Study-authorized subject, grade/working-placement boundary, and curriculum
binding. A foreign-scope node is omitted from the current route and cannot
select or populate prerequisite repair.

## Pending packet provenance

Pending packets include `opportunityProvenance` with only structured opaque
scope references and assistance state:

- learner scope;
- session;
- instructional context;
- current opportunity;
- effective current assistance level.

It contains no name or raw prose and grants no Study mutation authority.

## Verification

The adaptive test set covers transient recovery, exact duplicate protection,
payload collision, concurrent duplicate protection, semantic admission/action
reordering, digest-only ledger input, malformed ledger values, malformed
intervention and repair results, graph-without-evidence behavior, coherent
return-to-lesson/hint/repair/reteach routing, Parent Why alignment, foreign-grade
route exclusion, final runtime schema conformance, and minimized opportunity
provenance.

The prior synchronous/rejected-Promise exception-containment matrix remains in
place and now selects the relevant primary action before exercising conditional
hint, repair, or reteach boundaries.

The session ownership boundary excludes generated Wave 2 JSON schema artifacts
and convergence tests outside `adaptive/**`. Those artifacts must be regenerated
and the older multi-proposal expectations replaced by the owning release session
after this runtime contract change is integrated.
