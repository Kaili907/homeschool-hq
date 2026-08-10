# Study bound curriculum content runtime

## Authority flow

`POST /api/study/bound-content` accepts an opaque Study bearer plus advisory
`sessionId`, `lessonRef`, and `skillRefs`. It accepts no release UUID, package,
version, digest, active pointer, learner identity, or role assertion.

The service-only authority projection verifies the bearer, restricts the read
to that learner's exact stored Study session, and returns the session's
immutable release UUID/package/version/manifest digest and registry
`source_root`. It also projects the course refs from active enrollments that
cover the session's intended local date and bound version. Legacy sessions
without an authoritative binding return manual review and cannot load content.

The runtime then opens only that `source_root`. It hashes the exact
`curriculum-manifest.json` bytes and requires equality with the session digest,
then reuses the existing canonical filesystem curriculum read model. Missing,
malformed, mismatched, or unsupported content fails closed.

## Membership contract

The existing Academy-to-Study adapter defines a Study lesson context as
`grade-{5|7|8}:academy-week-{1..36}-day-{1..5}` and defines `skillRefs` as the
scheduled curriculum lesson IDs for that day. Resolution therefore proves:

1. the advisory lesson context equals the lesson ref stored on the session;
2. that schedule day exists in the bound package;
3. every requested skill ref exists in the bound package;
4. every requested skill is scheduled for that exact day and grade; and
5. every requested skill's course is in the server-derived learner course
   scope for the session date and bound version.

A skill that exists in another day, grade, course, or learner scope is a
membership mismatch rather than acceptable global package membership.

## Pointer, old release, and fallback behavior

The production active pointer selects only new session bindings. Content
resolution never reads it. A session bound to an older published release keeps
loading that exact release while its immutable artifact remains available. If
that artifact is absent or its manifest no longer matches, the result is
bounded unavailable/mismatch; no current, active, latest, demo, preview, or
public build output is substituted.

## Privacy boundary

Learner-facing projections omit the existing protected scoring guidance,
adaptive tutor routes, assessment relationship, and source custody fields.
Operational decision hooks receive only bounded status/reason codes and opaque
session/lesson/skill refs. Lesson text, questions, resources, answers, and raw
curriculum bodies are not logged or written to operational telemetry.

This card exposes the server content seam only. It does not mount the final
learner Study UI and does not apply any hosted migration.
