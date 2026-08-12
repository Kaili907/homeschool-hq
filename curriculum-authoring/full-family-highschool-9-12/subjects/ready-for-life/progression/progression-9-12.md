# Ready for Life 9-12 — Progression

## The shape of the four years

Ready for Life has no external standards body, so the progression is a Manuel Academy
curricular decision throughout. It is recorded here rather than implied, and the competency
framework it draws on is declared `LOCAL_COMPOSITION` with `jurisdiction: null`.

| Grade | Theme | The move that defines the year |
| --- | --- | --- |
| 9 | Systems for Independence | Turn Grade 8 routines into durable systems the learner runs themselves. |
| 10 | Work, Documents, and Community | Move outward: career, job readiness, professional communication, consumer and civic tasks. |
| 11 | Postsecondary and Adult Systems | Plan the transition: pathways, deadlines, health, housing, decisions under constraint. |
| 12 | Transition to Adulthood | Operate adult systems end to end; close with the senior capstone. |

Each year is 6 units × 6 lessons = 36 lessons on a 36-week, one-day-a-week schedule, matching
the published Grade 8 course exactly.

## Why this order

The sequence moves along two axes at once: **outward** (self → household → community → adult
institutions) and **forward in time** (this week → this year → after graduation → adult life).

- Grade 9 is inward and immediate because a learner who cannot run their own week cannot run
  an application cycle.
- Grade 10 introduces audiences other than family — employers, offices, counterparties — which
  is where professional communication and consumer literacy become distinguishable from
  ordinary communication.
- Grade 11 is where the transition is actually planned, while there is still time to change
  the plan.
- Grade 12 operates the plan and defends it.

## The lesson arc inside every unit

| Day | Phase | Guardian sign-off |
| --- | --- | --- |
| 1 | Launch and planning | not required |
| 2 | Skill model | not required |
| 3 | Guided practice | not required |
| 4 | Supervised application | **required** |
| 5 | Independent application | not required |
| 6 | Unit performance task | **required** |

Days 4 and 6 are the two days whose evidence depends on a real-world action, so those are the
two days that require an adult attestation. That is 12 of the 36 lessons in every course, 48
across the progression.

## A click cannot certify a real-world adult-supervised task

This is the load-bearing safety rule of the lane, and it is implemented rather than asserted.

Every sign-off lesson carries an `adult_attestation` object requiring three fields — the
observing adult's role, what the adult actually observed, and the date — plus
`click_alone_is_insufficient: true`. A learner-side completion toggle records only that the
learner reports having finished; it never satisfies the attestation. Every sign-off lesson also
carries a tutor route for the case where a learner reports a real-world task complete without
one: the tutor asks who supervised, records the attestation fields, and leaves the evidence
open until they are present.

`click_alone_is_insufficient` is set on **every** lesson, including non-sign-off lessons, so
the property cannot be lost by a lesson being reclassified later.

## Where supervision is not available

Every lesson carries a `simulated_alternative`: a walkthrough, checklist, or role-play that
carries **equal credit** and is never recorded as a lesser result. A household without a
particular appliance, a vehicle, or an available supervising adult never produces a lower
score. The validator asserts the equal-credit language on all 144 lessons.

## Mastery

Practice generation never directly awards mastery. Mastery requires accurate independent
evidence plus the learner's own explanation on at least two separate occasions, at least one
transferred to a situation the learner has not rehearsed. A guardian-attested real-world
performance counts as one occasion **only when the attestation is present** — an unattested
claim is incomplete evidence, not mastery.

An adult attestation records observation. It never replaces the learner's own explanation.

## The Grade 12 senior capstone

Grade 12 unit 6 is the **Transition-to-Adulthood Capstone**, the culminating unit of the whole
9-12 progression: assemble and defend a complete transition portfolio — pathway and next
steps, adult-life systems, independent-living evidence, work readiness, civic and legal
checklist, health self-management, and a support-and-contingency plan — with guardian
attestation of every real-world component.

It explicitly requires an honest statement of what still needs support, and naming a remaining
support need scores full marks. The capstone is a plan a learner can actually use, not a
certificate of competence: the framework states plainly that it confers no credential, credit,
licence, or declaration that a learner is safe to perform any task unsupervised.

## Limits

Nothing in this lane is medical, legal, financial, employment, or immigration advice. Local
rules on driving, working age, curfew, tenancy, identification, and majority vary by
jurisdiction, and lessons direct the learner to verify against a current local source rather
than asserting a rule.
