# Blocking evidence

## Production privacy gate absent

Security R2 reports `PROPOSED_R2_SERIALIZER_IS_TEST_ONLY_AND_NOT_YET_THE_PRODUCTION_PRE_NETWORK_GATE` together with existing legacy Profile-route privacy
risks. Security R2 is evidence only here. The convergence branch does not wire
its proposed serializer into runtime code.

`productionActivation.ts` is a constant closed gate and throws
`PRODUCTION_PRIVACY_SERIALIZER_REQUIRED`; configuration cannot override it.

## Canonical state / DB checkpoint mismatch

The canonical `DurableStudyDocumentV1` checkpoint has current Family Pilot
fields such as `checkpointRef`, `completedSegmentRefs`, and
`elapsedActiveSecondsInSegment`. The DB `study-core-bridge.recovery-checkpoint.v1`
requires additional authority including `safeInstructionalCursor`,
`perSegmentActiveTime`, `protectedTutorStateRef`, `tutorInteractionRef`, and
`technicalInterruption`. Conversely, one DB session hydrate cannot recreate the
full durable document's calendar, preferences, parent settings, reviews,
events, or outbox.

Inventing either side would violate the exact checkpoint requirement. A future
authoritative input must define and validate the missing lossless storage/wire
contract before this candidate can be reclassified.

## Activation ruling

`BLOCKED`. Family Pilot remains local-only. This is a safe architecture
candidate and evidence package, not an activation candidate.
