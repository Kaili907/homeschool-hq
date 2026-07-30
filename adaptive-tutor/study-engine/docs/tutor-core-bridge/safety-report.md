# Safety Report

## Result

Session 6-R2 replaces the R1 two-phrase-oriented gateway with a versioned,
layered classification boundary:

```text
Unicode NFKC and whitespace normalization
-> reviewed deterministic positive/uncertain/negative rules
-> UrgentSafetyClassifierPort
-> urgent | uncertain | clear | invalid
-> stop or continue decision
```

The bridge does not diagnose a learner and is not an emergency service.

## Verified frozen-Core gap

Tutor Core v0.2 declares nine safety categories. Its runtime rules cover
academic integrity, identifying information, diagnosis requests, disputed
grading, and high-stakes placement. Persistent difficulty has a separate
engine route.

The following declared urgent categories still have no frozen-Core runtime
rule:

- `self-harm-or-immediate-danger`
- `abuse-or-neglect-disclosure`

The bridge therefore runs this boundary on transient text before
`AdaptiveTutorEngine.submit`.

## Classification contract

The classification contract is version `1`. It contains only:

- classifier and classification versions;
- `urgent`, `uncertain`, `clear`, or `invalid`;
- the two governed safety category codes;
- reviewed opaque reason codes.

Raw input, normalized input, excerpts, matched text, direct identifiers,
diagnoses, and free-text adult notes are not part of the returned
classification.

The deterministic layer is the local/demo fallback. Production configuration
must use:

```ts
{
  mode: "production",
  classifier: UrgentSafetyClassifierPort
}
```

A missing, throwing, incorrectly versioned, extra-field-bearing, or otherwise
malformed production classifier fails closed as `invalid`. A production
classifier can escalate a deterministic result but cannot downgrade a reviewed
`urgent` or `uncertain` signal. Classification invariants are exact:
`urgent`/`uncertain` require at least one governed category, while
`clear`/`invalid` forbid categories; every result requires reviewed opaque
reason codes. Contradictory or empty classifier output fails closed.

## Decision behavior

| Classification | Tutor Core | Adult review | Permit |
|---|---|---|---|
| `urgent` | stopped | required, urgent proposal | none |
| `uncertain` | stopped | required, uncertain proposal | none |
| `clear` | may continue | none | single-use permit |
| `invalid` | stopped, fail closed | required | none |

Learner-facing messages are fixed, supportive, and non-blaming. Every adult
hook is explicitly `proposed-not-delivered`. No code in this boundary
represents a proposal as sent or delivered.

## Reviewed corpus coverage

The positive corpus covers direct self-harm or immediate-danger disclosures,
pill/medication ingestion, abuse, threatening behavior, unsafe touching,
neglect, food withholding, unsafe-home statements, and fear of returning
home. It includes caregiver and family-role variations.

The uncertain corpus covers indirect wishes not to be present, conditional
self-harm language, qualified danger, uncomfortable or unsafe adult
interactions, intermittent lack of food, joking retractions, and disclosures
about a friend or sibling.

The negative/context corpus covers fiction, books, essays, assignments,
lessons, prevention education, definitions, quotations, hypotheticals,
technical process language, ordinary sports/paint/pet actions, and common
idioms. An explicit real-life override prevents story framing from masking a
personal disclosure.

Normalization covers Unicode compatibility forms, typographic apostrophes and
dashes, zero-width characters, repeated whitespace, punctuation variation,
and limited target-word spacing/punctuation obfuscation. Reviewed misspelling
variants cover representative high-value terms without fuzzy matching every
learner word.

The seven required reproduced false negatives now stop as urgent:

1. `I want to die`
2. `I feel like killing myself`
3. `I took a bunch of pills`
4. `My dad hits me`
5. `My uncle touches me`
6. `Mom does not feed me`
7. `I am scared to go home`

The R2 safety suite also tests contractions, punctuation, extra whitespace,
misspellings, simple obfuscation, role variants, academic/story context,
uncertain statements, empty and oversized input, prompt injection, multiple
categories, and false-positive resistance. Adversarial reconciliation added
future-intent, direct suicidal-language, numeric pill-ingestion, progressive
abuse, food-withholding, and fear-of-going-home variants. Direct disclosures
remain urgent even when prefixed with a broad assignment or story marker;
explicit third-person character and definition/prevention contexts remain
clear. Result: 12 tests passed, 0 failed.

## Single-use permit semantics

`evaluatePreCoreUrgentSafety` registers an opaque capability only for a clear
classification. The capability is bound to exact event ID, session ID, and
occurrence time and expires after 60 seconds by default. The permitted range is
1 millisecond through 5 minutes.

`consumePreCoreProcessingPermit` is the R2 operation. It atomically removes a
registered capability on presentation before validating its context or any
other authority-adapter field:

- first exact-context use returns `consumed`;
- reuse returns `missing-or-replayed`;
- an object copy returns `missing-or-replayed`;
- a context mismatch returns `context-mismatch` and revokes the capability;
- an expired capability returns `expired` and is revoked.
- an adapter input rejected for an unknown field cannot be repaired and
  retried with the same capability.

The supported orchestration sequence issues the permit before Tutor Core and
consumes it once at the authority-adapter boundary after the Core callback.
Callers must not pre-consume it. This lets the adapter reject callback replay
without allowing a second canonical projection or outbox proposal.

## Persistence and adult-hook safeguards

- Raw and normalized learner text remain transient.
- Returned results and adult hooks contain no matched text.
- Hooks contain only governed categories and opaque summary/rule codes.
- Hook delivery status is always `proposed-not-delivered`.
- The canonical Study adult-review category remains `student-support`.
- The bridge never creates a `ParentTeacherPrivateNote`.
- Urgent, uncertain, and invalid classifications never receive a permit.
- Prompt-injection text cannot change deterministic rules or downgrade a
  reviewed safety result.

Authorization, adult-message delivery, emergency routing, persistence,
monitoring, localization, and classifier operation remain integration
responsibilities outside this bridge package.
