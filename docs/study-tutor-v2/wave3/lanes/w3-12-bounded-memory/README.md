# W3-12 — bounded privacy-safe instructional memory

`BoundedInstructionalMemoryStore` is an in-process continuity aid, not a
conversation archive. Its closed schema accepts only opaque scope and content
references, assistance and hint enums, Study-approved instructional state
references, and bounded action reason codes.

## Privacy and scope boundary

Every access carries the original learner, session, context, and opportunity
scope. All four references must match. A cross-child or other scope mismatch is
rejected with `tutorMayUseMemory: false`; memory is never partially returned or
silently re-scoped.

There is no schema field for learner or Tutor text, audio, images, emotion,
personality, diagnosis, provider traffic, or credentials. Unknown fields are
rejected. Reference and reason-code formats disallow whitespace and impose
short maximum lengths, so the contract has no unrestricted prose carrier.

## Bounds and lifecycle

- At most 24 active entries exist in one store.
- Concept references are capped at 8, reviewed content references at 12, and
  recent action reason codes at 8.
- When capacity is reached, the entry with the oldest successful write is
  evicted. The internal write sequence makes eviction deterministic even when
  timestamps are equal; reads do not change eviction order.
- Entries default to a 30-minute TTL with a four-hour hard ceiling. The TTL
  boundary is exclusive: an entry is expired when `now >= expiresAt`.
- Every entry is opportunity-bound. `expireOpportunity` deletes only entries
  matching the full learner/session/context/opportunity scope.
- `clear` deletes one fully scoped entry, and `resetScope` deletes all entries
  in one exact scope.

The store has no persistence adapter and new instances begin empty. Entry and
snapshot contracts fix `persistenceAllowed` to `false`.

## Authority boundary

Tutor memory has no official mastery authority and cannot mutate Study state,
grade, or working level. Those capabilities are literal `false` in both the
live entry and minimized snapshot. Study-approved state is represented only by
an opaque state reference plus its opaque Study approval reference.

## Minimized snapshot

`snapshot` returns only the exact scope, structured instructional continuity
content, capture time, and fixed boundary flags. It omits the memory identifier
and entry lifecycle timestamps. The snapshot remains explicitly ephemeral and
non-authoritative.
