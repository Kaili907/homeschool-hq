# Health Director Sample R1

Status: **READY FOR DIRECTOR REVIEW**

Lesson: `ma-g5-health-u01-l01`

Controlling baseline: `0518b817bae286707c28e800b3387d214ffbf61f`

Standard: `HEALTH_LESSON_STANDARD_R1`

## Canonical lesson audit before the sample

- Current title: **Launch and diagnostic: dimensions of health**
- Standards: **Michigan Health: Core Concepts** and **Accessing Information**
- Source phase: **Launch and diagnostic**
- Primary R1 lesson type: **`CONCEPT_VOCABULARY`**
- Secondary R1 lesson type: **`DECISION_REASONING`**

The original canonical task card had substantive topic facts and strong general
safety language, but it did not yet deliver the complete learner experience
required by the draft standard. It lacked a direct Grade 5 explanation, defined
lesson-critical vocabulary, a separate worked model, a real guided learner
turn, fresh independent and later-transfer cases, and a materially different
remediation route. Its materials and task directions were generic. Its scoring
guide did not enumerate fact-specific acceptable responses or misconception
boundaries. The mastery rule also named private reflection among possible
evidence, which made the private-reflection boundary ambiguous.

This lesson is representative because the Health depth audit placed it in the
252-lesson repair cohort and because its ordinary whole-person-health topic
exposes the cohort's recurring issues without relying on an unusual or
especially sensitive edge case. The lesson already had a real canonical ID,
standards, safety posture, fictional framing, and production pairing. That made
it a useful test of teaching quality instead of a test of missing infrastructure.

## What the sample supplies

The learner package now teaches a connected five-dimension model of health.
It distinguishes a dimension from a score or label, teaches fact-versus-guess
reasoning, and gives the learner a four-step rule: **Facts, Connect, Choose,
Ask**. A complete fictional library example shows how to use the rule. A
different guided case preserves a learner turn before cues and revision. Fresh
community-center and park cases collect independent concept and decision
evidence.

Remediation uses two genuinely different representations: the **five windows**
idea for partial views and the **camera test** for observable facts. It ends in
a fresh water-fountain case. The adult guide contains lesson-specific required
facts, acceptable variation, misconception boundaries, safety-critical errors,
and revision notes.

Required evidence is fictional and minimally disclosive. The optional private
reflection is learner-kept, unscored, excluded from completion, and excluded
from mastery. Mastery requires two independent evidence occasions, including a
later transfer. The advisory Tutor manifest is data only; it adds no runtime.

## Director preview

Development route: `/__review/health`

The route reads the real canonical learner package. It does not copy the lesson
into a preview-only fixture. The development route is guarded by
`import.meta.env.DEV`, and the production build test confirms that its route,
lesson ID, and learner copy do not ship in production JavaScript chunks.

The preview is designed for desktop and mobile, keeps one learner action visible
at a time, supports keyboard focus, and offers response alternatives without
exposing protected scoring authority.

## Scope boundary

This branch changes one Health lesson and its paired guide. It does not
regenerate the Health corpus, change PE, modify Study Engine, or implement Tutor
V2.
