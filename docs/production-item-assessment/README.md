# Production item assessment contract R1

## Outcome

This contract connects an admitted production learner item to a learner response,
trusted server authority, a minimized item-evidence receipt, and the existing Study
runtime. It is an adapter, not a Study Engine or a mastery engine.

The stable content key is `(releaseId, lessonRef, itemRef)`. `sectionRef` is also
required so an item cannot be rebound across sections. The attempt binding adds
`studentRef`, `assignmentRef`, and `attemptRef`; `studentRef` is derived by the
trusted Study session verifier and is never supplied by the browser.

## Existing seams inventoried

| Seam | Existing authority retained | R1 use |
|---|---|---|
| Lesson Player | `FamilyPilotLessonPlayer` is display-only and holds response prose only for one turn | R1 learner items use the same display/proposal principle; no scoring authority enters browser state. |
| Study runtime | Verified academic runtime and session lifecycle own session state, pacing, completion, and checkpoints | R1 emits item evidence through a narrow Study evidence port and makes no lifecycle or mastery transition itself. |
| Practice | Existing Family Pilot practice currently carries `answerIndex` and `correctAnswer` in browser-side types | R1 does not import or extend that seam; production scoring is server-side and answer text/index never enters its browser contract. |
| Evidence | Study event/checkpoint contracts require minimized records and literal `rawAnswerIncluded: false` | R1 trusted evidence has exact item bindings and `rawResponseIncluded: false`. |
| Completion | Study already distinguishes Tutor authority from completion-only work | R1 reports completion evidence only; it does not convert completion into correctness or mastery. |
| Rubric/adult review | Study adult-review operations and protected-work storage are the approved path for reviewable prose | R1 requires `adultReviewPort.submitProtectedResponse` before returning `pending-review`; rubric scoring is never fabricated. |
| Guardian attestation | Family Pilot already distinguishes learner authority from `GUARDIAN_ATTESTATION_REQUIRED` and records learner self-report as non-certifying | R1 returns `pending-guardian-attestation`; a learner request cannot certify the work. |
| Answer authority | Admitted release production bindings identify a server-only scoring authority per lesson | R1 resolves that locator only inside the Netlify trusted resolver and validates exact release, lesson, section, item, and package membership. |
| Offline | Study checkpoints intentionally exclude raw answers | R1 uses a separate device-local `PENDING_ASSESSMENT` queue; it never writes an offline correctness claim or a global Study checkpoint. |

## Trust boundary

The browser may send only:

- admitted release, assignment, lesson, section, item, and attempt references;
- one learner response (`choiceRef`, bounded text, or completion acknowledgement).

The browser cannot send `studentRef`, an expected answer, an answer index, a
score, a rubric decision, a guardian certification, or an authority locator.
Exact-object parsing rejects all extra fields.

The server:

1. verifies the opaque Study bearer for `student:attempts:create`;
2. resolves the exact Study assignment and lesson through the existing bound-content authority;
3. checks the configured hosted release UUID/version/digest against the admitted logical release;
4. resolves the exact production package and trusted scoring authority beneath the repository allow-list;
5. scores or routes the response according to the closed taxonomy;
6. offers a trusted, minimized evidence record to the existing Study evidence port;
7. returns only the browser-safe result, without `studentRef`, raw response, correct answer, index, rubric, or authority location.

The endpoint is disabled unless the existing Study feature gate is enabled. Its
default production authority also remains not-ready until these deploy-time
bindings are present:

- `ACADEMY_PRODUCTION_ITEM_BOUND_RELEASE_ID`
- `ACADEMY_PRODUCTION_ITEM_BOUND_MANIFEST_SHA256`
- optional admitted logical ID/version overrides (defaults: `family-pilot-r1`, `2.0.0`)

No hosted database was queried or modified in this work.

## Closed scoring taxonomy

| Mode | Trusted action | Browser result |
|---|---|---|
| Fixed multiple choice | Map opaque `choiceRef` to package choice and compare its text to trusted answer text; ignore `answerIndex` | `correct` or `incorrect` |
| Fixed numeric/short response | Bounded normalization then trusted fixed comparison | `correct` or `incorrect` |
| Deterministic/computational | Numeric normalization and comparison to independently verified authority output | `correct` or `incorrect` |
| Constructed/rubric review | Send raw response only to approved protected adult-review port; never evaluate rubric in this adapter | `review-required` |
| Guardian attestation | Record learner acknowledgement as non-certifying | `guardian-attestation-required` |
| Completion-only | Record completion evidence with no correctness or mastery implication | `completion-recorded` |
| Explicitly unsupported | Make no assessment claim | `unsupported` |

## Evidence contract

Trusted evidence binds:

`studentRef + assignmentRef + releaseId + lessonRef + sectionRef + itemRef + attemptRef + resultKind + evidenceKind`

It also carries a deterministic receipt reference and literal
`rawResponseIncluded: false`. The browser projection drops `studentRef` and
`releaseId`; it is presentation feedback, not a new client-side evidence
authority. The Study port remains responsible for canonical persistence and any
later mastery, remediation, review, or completion decision.

## Offline behavior

If the transport positively identifies an offline failure, `assessOrQueuePending` stores the request only in the
caller-provided device-local, learner-scoped pending store with state
`PENDING_ASSESSMENT`. Its return value has `resultKind: null` and
`evidenceKind: null`. The retry must go through the same server authority and
binding checks. Offline work is never called correct, reviewed, attested, or
complete. Server rejections and malformed server results are not relabelled as
offline work.

## Compatibility proof

Narrow tests read the admitted `family-pilot-r1` production bindings and prove
representative handling for Mathematics, English Language Arts, Science,
Social Studies, Health, Physical Education, Ready for Life, Financial Literacy,
Technology, and Arts/Music.

G5 Mathematics U1 L1 is the concrete auto-score proof. The learner projection
uses stable choice references, while the server compares the selected choice's
text with trusted authority text. A deliberately conflicting `answerIndex`
fixture proves the index has no authority.

G3 Mathematics U1 L1 is loaded only as a current-contract compatibility fixture.
No package, answer authority, prompt, choice, or curriculum source is changed by
this work.
