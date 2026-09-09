# W3-04 curriculum-driven Tutor admission

## Outcome

This lane replaces Tutor-owned subject assumptions with a registry compiled
from accepted curriculum metadata plus one reviewed Tutor capability
declaration. The registry treats `subjectRef`, `courseRef`, `unitRef`, and
`lessonRef` as curriculum data. It has no math/English/science/general subject
enum and accepts future identifiers only when they are present in the supplied
trusted release metadata.

The public boundary is
`adaptive-tutor/core/v3/curriculum-admission/index.ts`:

- `buildCurriculumCapabilityRegistry(metadata)` validates and compiles an
  accepted release into exact course, subject/working-level, unit, and lesson
  lookups. Large canonical releases are validated in bounded per-course
  segments so the generic contract node limit is not bypassed or raised.
- `evaluateCurriculumAdmission(metadata, input)` is the fail-closed convenience
  boundary.
- `evaluateCurriculumAdmissionWithRegistry(registry, input)` reuses a compiled
  registry.

## Admission inputs

`CurriculumAdmissionInputSchema` closes the request boundary around:

- requested capability, course, subject, optional unit and lesson;
- nominal grade and official per-subject working level;
- assessment phase and requested action family;
- the Study-owned authority scope binding the same curriculum and learner
  context; and
- the reviewed capability declaration, or explicit `null` when missing.

The trusted curriculum release is a separate input. Its required source marker
is `accepted-curriculum-release`; its review and admission states remain data
that must both permit use.

Nominal grade is preserved for reporting but does not choose instructional
content. The requested course must match the official working level. This
allows, for example, a nominal Grade 8 learner with an official Grade 3 working
level in a subject without changing either value.

## Decision semantics

Every decision is exactly one of:

- `admitted`: the reviewed free-form capability, canonical curriculum binding,
  assessment phase, action family, and Study scope all intersect;
- `static-only`: canonical static curriculum remains available but no Tutor
  invocation or free-form instruction is allowed; or
- `refused`: neither Tutor invocation nor static curriculum is authorized by
  this admission decision.

The gate applies a deterministic precedence:

1. exact input and Study scope binding;
2. accepted release review/admission;
3. course, subject, official working level, unit, and lesson membership;
4. Study action-family authority;
5. reviewed capability declaration;
6. active-assessment restriction;
7. declared curriculum/phase/action capability coverage.

An unknown course therefore returns `unknown-course` even when Tutor capability
is absent. A known course at a working level the curriculum does not provide
returns `official-working-level-unavailable`. No adjacent grade is inferred.

For a reviewed but unsupported Tutor capability, the reviewed declaration's
`unsupportedOutcome` deterministically selects
`unsupported-tutor-capability-static-only` or
`unsupported-tutor-capability`. A missing or unreviewed declaration always
refuses. During `active-graded-or-mastery-check`, a free-form declaration always
becomes `active-assessment-static-only`.

## Authority boundary

All three outcomes carry or imply the same exclusions:

- Tutor cannot assign or mutate curriculum;
- Tutor cannot mutate nominal grade or official working level;
- Tutor cannot mutate Study authority; and
- static-only/refused decisions cannot invoke a Tutor or permit free-form
  instruction.

The Study scope itself must explicitly carry
`curriculumAssignmentAllowed: false` and
`officialWorkingLevelMutationAllowed: false`. Additional authority-bearing
request fields are rejected by the exact schema.

## Canonical evidence

The accepted repository inventory and checksums are recorded in
`COVERAGE.md`. This lane reads that metadata only; it creates or alters no
curriculum content.
