# Study integrations privacy report

**Assessment date:** July 28, 2026
**Scope:** `study-engine/integrations/**`, `study-engine/parent/**`, their
integration tests, and mock data

**Assessment type:** provisional contract, static-source, and executable
demonstration review

**Result:** Pass for the in-memory demonstration boundary, subject to the
production integration conditions below

## Executive finding

The calendar, review queue, Romeo Virtual Academy, and parent-insights
demonstrations meet the session privacy rules within their stated provisional
scope. They do not access a camera, microphone, browser sensor, network,
database, authentication provider, production calendar, or persistent storage.
No webcam, eye-tracking, diagnosis, hidden behavior score, or permanent learner
label is part of a public data contract.

The demonstrations use opaque references, explicit scheduling/progress values,
small parent-visible evidence records, and supportive learner-facing messages.
The Romeo adapter has no credential field and rejects runtime objects or URLs
that contain common credential material. Parent-only notes stay in the control
state and are not rendered into the dashboard snapshot.

This is not a production privacy approval. Authorization, retention, access
control, deletion, external-host allowlisting, and persistence remain with the
owners of the existing production systems.

## Rule-by-rule assessment

| Privacy rule | Implementation evidence | Automated evidence | Result |
| --- | --- | --- | --- |
| No webcam monitoring | No media field or media API; parent controls reject webcam-monitoring requests | Static public-field/API scan and unsafe-control tests | Pass |
| No eye tracking | No gaze/eye data field, browser sensor, or inference | Static public-field/API scan | Pass |
| No medical diagnosis | No diagnosis field; parent free text rejects diagnosis collection language | Privacy audit and unsafe-control tests | Pass |
| No hidden behavior scoring | No behavior-score contract or computation; review priority applies to a specific tutor directive, not a child | Static field scan and review contract tests | Pass |
| No permanent child labels | Work-block guidance is described as a current observed range; learner messages are temporary and actionable | Exact-language and supportive-language tests | Pass |
| Clear parent-visible evidence | Review holds explain their limits; dashboard learning/habit inferences require visible evidence | Review-overload tests and dashboard privacy audit | Pass |
| Minimal data collection | Demonstrations store only scheduling, explicit progress, evidence, and opaque references needed for the feature | Runtime payload-key scan and boundary test | Pass |
| Supportive student language | Resume, review, and accommodation messages reject known harmful or trait-labeling phrases | Supportive-language tests | Pass |
| No Romeo credentials | No credential field; nested credential keys, URL credentials, and credential query keys are rejected | External-assignment and privacy tests | Pass |
| Parent-private note isolation | Notes have `parent_only` visibility and are absent from the snapshot/rendered dashboard | Private-note isolation tests | Pass |

## Minimized data inventory

### Calendar

Allowed by the provisional contract:

- Opaque learner, entry, source-item, segment, and continuation references
- Visible activity title, optional subject, and block type
- Offset-bearing scheduled start and IANA time-zone name
- Estimated and actual active-work minutes
- Segment completion timestamps
- Approved break/interruption reason and a small visible event trail

Explicitly absent:

- Direct identity or contact details
- Raw answers, content transcripts, or keystroke history
- Webcam, audio, eye, gaze, biometric, or device-fingerprint data
- Inferred attention, diagnosis, or behavior score

### Review queue

Allowed:

- Opaque review and skill references
- Short curricular title
- Tutor-supplied review kind and item priority
- Calendar dates, estimated minutes, completion state, and explicit deferral
- Parent-visible scheduling/limit evidence

The queue does not determine a learner trait. It schedules a specific
instructional directive inside explicit daily item and minute limits.

### Romeo Virtual Academy

Allowed:

- Opaque external assignment reference
- Assignment title and course
- Calendar-only due date and estimated duration
- Explicit completion state
- Parent-entered and student-entered unit progress, kept separately
- Opaque Manuel Academy tutoring-support reference
- Short resume note
- HTTPS external URL reference

Disallowed:

- Username, password, passcode, login, credential, secret, API key, access
  token, refresh token, or session cookie fields
- Embedded URL username/password
- Credential-like URL query parameters

The adapter does not sign in, scrape, fetch, or store an external session.

### Parent insights and controls

Allowed:

- Pseudonymous student reference and generic learner label
- Today, learning, and study-habit projections
- Small observable evidence records with opaque references and timestamps
- Explicit parent settings and decisions
- Parent-only note text inside the isolated control state

The required observational wording is used:

> Current effective math work-block range: 18–22 minutes

The prohibited trait claim “Attention span: 18 minutes” is not used.

## Evidence and explainability

Parent-visible evidence is a contract requirement for reviewed skills, mastered
and developing skills, prerequisite gaps, repeated misconceptions,
best-performing task lengths, shorter-section suggestions, and the study-habit
recommendation. The privacy audit reports `missing_evidence` when an
evidence-bearing inference is empty.

Review overload behavior is also explainable. Every scheduled item includes its
priority, date relationship, and estimate. Every held item includes a visible
reason such as the daily item cap, daily minute cap, or preservation of a
higher-priority item. Reviews are held rather than silently discarded.

## Student-facing language

Student messages are limited to resume guidance, review readiness, manageable
daily limits, and actionable accommodations. Tests reject or scan for phrases
such as “lazy,” “bad student,” “failed again,” “cannot focus,” and permanent or
diagnostic claims.

The language guard is a defense in depth, not a complete natural-language
moderation system. Production content still requires product/editorial review.

## Static and executable controls

`privacy-contract.test.ts` verifies:

- No prohibited surveillance, diagnostic, credential, raw-response, or hidden
  score field appears in a public TypeScript contract
- No camera/media, network, browser persistence, database, or authentication
  API is called by these provisional packages
- Mock outputs contain no direct-identity, credential, raw-response, or
  surveillance property
- The safe dashboard passes its privacy audit
- Unsafe fields, missing evidence, and harmful learner language are reported
- Parent-only notes are isolated
- Unsafe accommodation requests are rejected

`external-assignment-adapter.test.ts`, `parent-dashboard.test.tsx`,
`parent-overrides.test.ts`, and `review-queue.test.ts` add focused negative and
behavioral coverage.

## Production integration conditions

Before any production connection, the owning teams must:

1. Authorize every read and parent/student command with existing identity and
   household rules. These provisional contracts do not perform authorization.
2. Define field-level retention and deletion. No persistence policy is implied
   by the mock.
3. Keep `studentRef`, `learnerRef`, and `learnerLabel` pseudonymous at this
   boundary; do not substitute contact details.
4. Restrict Romeo external URLs to an approved host/path policy and decide
   whether nonessential query parameters must be stripped.
5. Apply content policy and length limits to free-form resume notes, evidence
   descriptions, support reasons, and private notes. Keyword checks are not a
   general data-loss-prevention system.
6. Enforce `parent_only` note access outside the student projection, logs, and
   analytics.
7. Render all recommendation evidence and parent override state; do not replace
   it with an undisclosed score.
8. Complete security, accessibility, privacy, and data-governance review before
   persistence or deployment.

## Residual limitations

- An arbitrary HTTPS Romeo host is valid in the mock. Host allowlisting belongs
  to a future approved intake adapter.
- Free-form text can contain sensitive information despite field minimization.
  The production owner must set policy, retention, and review controls.
- Static API scanning proves only that the reviewed source does not directly
  call the listed APIs. It does not replace review of future host adapters.
- The in-memory demo has no multi-user authorization boundary; it intentionally
  relies on the future host for authentication and authorization.

No production privacy gap was introduced because this session did not connect
the demonstrations to production code, storage, identity, or deployment.
