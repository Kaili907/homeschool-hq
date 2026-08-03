# Household time-zone strategy

The runtime accepts a validated household or learner IANA time-zone identifier.
It never derives the zone from the host computer. `America/New_York` remains
the Manuel Academy sample default, not a permanent runtime constant.

Malformed or unsupported identifiers are rejected before session mutation.
The accepted identifier is preserved exactly in learner-local review
recommendations and recovery checkpoints. Local review dates are calculated in
that zone, while instants remain ISO date-times. This separation keeps results
deterministic across host time zones.

Validation covers:

- the sample `America/New_York` zone;
- a non-DST zone;
- a DST spring-forward or fall-back boundary;
- missing and invalid identifiers;
- equivalent execution under different host time zones.

The checkpoint integrity digest covers the time-zone field so a restored
checkpoint cannot silently change learner-local date semantics.
