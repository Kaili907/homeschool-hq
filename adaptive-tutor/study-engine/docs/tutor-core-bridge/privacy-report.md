# Privacy Report

## Projection method

All persistence-bound payloads are constructed from exact allowlists. The
bridge never clones an input and deletes a few known bad keys.

## Excluded data

- raw answers and learner responses;
- raw transcripts and Core snapshots;
- names, email addresses, phone numbers, and addresses;
- credentials, tokens, secrets, and credential-bearing URLs;
- diagnosis language;
- adult-private note bodies and author details;
- matched safety text;
- unknown or unapproved fields.

Contamination fields used to test the boundary produce structured removal
actions. Credentials and diagnosis language quarantine the event. Unknown
fields quarantine the complete untrusted event. Quarantine records have fixed
messages and `payloadStored:false` / `rawTextStored:false`.

Low-level accepted validation returns a newly constructed structured event. It
drops contamination, media, narration, transcript, and visual payloads. It
never returns the caller-owned input. Persistence projection additionally
requires the immutable result registered in a module-private `WeakSet` by
`adaptFrozenTutorCoreResult`; a copied, mutated, unregistered, or forged DTO is
quarantined as an invalid authority claim. The canonical event is revalidated
immediately before Study projection.

## Learner media

Caption and narration text may be shown transiently for accessibility.
Contact details are replaced in learner-facing text. Transcript arrays are
never copied into evidence, recommendations, checkpoints, outbox events, or
quarantine metadata.

The verified authority wrapper connects actual Core `spokenTurn` and
`boardCommands` to a sanitized transient `learnerMedia` projection. That
projection is deeply frozen and deliberately remains outside canonical Study
evidence.

## Adult projection

Adult projection contains stable references, bounded confidence, structured
misconception provenance, and review reason codes. It explicitly records:

```text
rawTextIncluded: false
transcriptIncluded: false
directIdentifiersIncluded: false
privateNoteBodyIncluded: false
```

An adult-private record is never a learner projection and is never authored by
the bridge.

## Defense in depth

`inspectPersistenceProjection` and `assertPersistenceProjectionSafe` scan
constructed payloads for forbidden keys, direct contact patterns, credential
patterns, diagnosis language, cycles, and non-JSON values. These checks are
assertions, not a substitute for allowlist construction.
