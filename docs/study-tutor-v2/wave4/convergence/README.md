# Wave 4 adversarial certification and repair reconvergence

This directory records the convergence-owned adjudication for
`STUDY-TUTOR-V2-W4-14`. The candidate starts from the independently accepted
Wave 3 SHA `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`, imports each of the thirteen
Wave 4 lanes and each R1-R5 repair delta exactly once, and preserves the
original RED evidence for W4-03, W4-05, W4-06, W4-08, and W4-10.

The current repaired replay closes all 38 historical blocker assertions. The
thirteen Wave 4 hard-gate families are non-compensable, and each has a
deterministic negative control. The accepted eighteen Wave 3 hard gates remain
mandatory. Current runtime/generated schema parity covers ten serialized
boundaries and zero internal-port schemas.

This is a deterministic offline foundation candidate for final independent
Wave 4 rereview. It is not a production authorization, a master-merge
authorization, or a live-provider/model certification. `WAVE_4_COMPLETE`
remains `false`.

Canonical evidence is generated in
`adaptive-tutor/tutor-v2-wave4-release/`. Historical lane and repair evidence
remains in its original Wave 4 directories and is not rewritten.
