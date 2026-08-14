# Device round-trip proof

The real converged adapter and local DB/RPC emulator prove:

1. Device A exports current Family Pilot Core, final-app authority, and the
   minimized IndexedDB Study document into `hosted-study-sync-state.r2.v1`.
2. First link stores the exact checkpoint through
   `academy_study_sync_first_link_v2`.
3. Empty Device B hydrates it through `academy_study_sync_hydrate_v2` without a
   target template, invented timestamp, or reconstructed cursor.
4. B imports and re-exports byte-equivalent canonical authority.
5. B advances legitimate progress and performs an authority-checkpoint CAS.
6. Device A hydrates the result and obtains exact canonical equality.

The pre-repair matrix records 25 missing hosted representation families. The
final count is 0 missing and 0 ambiguous. Social's Web R3 `metadata` and
`adultAttestedAt` fields are carried exactly inside the existing Social family.

Absorbing/convergent authority is verified for completion, guardian
certification, Safety clear/open-hold protection, and accepted Social sources.
Lost acknowledgement, duplicate retry, idempotency collision, stale revision,
concurrent writes, and offline retry do not use timestamp-only authority.

