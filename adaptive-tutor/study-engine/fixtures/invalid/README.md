# Invalid fixture model

`mutations.json` defines invalid payloads as a valid fixture plus one focused
mutation (or one conceptually atomic pair of mutations). This mirrors the
Academy validator convention: keep a known-good baseline and make each rejected
case identify its expected stable issue code and JSON-style path.

The automated fixture test deep-clones the valid base, applies the JSON Pointer
operations, validates it, and asserts the declared issue. No mutation writes to
the checked-in valid fixture.

