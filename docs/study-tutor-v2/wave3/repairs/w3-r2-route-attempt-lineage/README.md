# W3 R2 canonical route-attempt lineage repair

Session: `STUDY-TUTOR-V2-W3-R2`

This repair assembles W3-01, W3-02, W3-08, and W3-09 behind one canonical
commercial-attempt snapshot in
`adaptive-tutor/core/v3/commercial-operation/`.

## Lineage

1. W3-08 evaluates host-owned evidence once per provider.
2. W3-01 admits only eligible providers into an immutable route catalog.
3. Routing constructs one primary and at most one failover attempt, pinning
   immutable model/capability/policy identity and per-attempt cost.
4. W3-02 reserves that plan without a catalog re-read and retains the complete
   physical-attempt snapshot in the reservation.
5. W3-09 derives lineage identity from the reserved attempt and accepts only
   allowlisted operational execution measurements.

The logical operation groups attempts; `physicalAttemptRef` distinguishes each
provider dispatch; `reservationRef` proves the cost slot; and `eventRef`
distinguishes telemetry observations. All money remains bounded canonical
decimal-string micros end to end.

## Fail-closed cases

- provider policy not evaluated or revision/evidence mismatch;
- catalog or mutable model-alias drift after plan construction;
- duplicate physical-attempt reference or non-contiguous role/index;
- unbudgeted or changed failover attempt;
- non-canonical, overflowing, or JS-number money; and
- telemetry lineage mismatch or forbidden learner/instructional prose.
