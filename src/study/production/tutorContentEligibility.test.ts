/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — the decision, against the real
 * frozen content.
 *
 * The first describe block is the DEFECT, run rather than described. A green
 * suite proves nothing about a bug unless the bug can be shown to be real, and
 * the mutation campaign's first mutant restores exactly the line it exercises.
 *
 * The rest is the card's five named cases plus the pin the card asks for: the
 * legacy selector and the production one are driven over ONE unmatched input in
 * one test, and required to disagree.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
  type TutorProgramRegistration,
  type TutorSubjectRegistration,
} from '../../../adaptive-tutor/study-engine/runtime/src/subject-registry.ts'
import {
  STUDY_TUTOR_ELIGIBILITY_TASK_TYPES,
  STUDY_TUTOR_INELIGIBLE_REASONS,
  parseStudyTutorEligibility,
  parseStudyTutorEligibilityRequest,
  type StudyTutorEligibilityRequest,
} from '../contracts/tutor/eligibility'
import { REVIEWED_TUTOR_MATH_SKILL_REF } from '../testing/syntheticStudyFixtures'
import {
  STUDY_TUTOR_V1_GRADE_BAND,
  STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE,
  evaluateReviewedTutorContent,
  evaluateStudyTutorContentEligibility,
  reviewedContentDecision,
  reviewedTutorSubject,
  selectEligibleTutorProgram,
  tutorTeachableTaskType,
} from './tutorContentEligibility'

/**
 * The ids the mounted preview host actually sends. subject-registry.ts:22-27
 * says the Study namespace is deliberately unmapped, and these are that
 * namespace — so they are the real shape of the defect, not a contrived one.
 */
const UNMATCHED = Object.freeze({
  lessonRef: 'lesson:fractions-week-3',
  skillRef: 'skill:equivalent-fractions',
})

/** A routing id the frozen content declares: sequence 03, equivalent fractions. */
const FRACTIONS_LEGACY_SKILL = 'fracUnit'

function request(overrides: Partial<Record<string, unknown>> = {}): StudyTutorEligibilityRequest {
  const parsed = parseStudyTutorEligibilityRequest({
    subject: 'math',
    lessonRef: UNMATCHED.lessonRef,
    skillRefs: [REVIEWED_TUTOR_MATH_SKILL_REF],
    taskTypes: ['guided-practice'],
    ...overrides,
  })
  if (parsed === null) throw new Error('fixture request did not parse')
  return parsed
}

/** A registration carrying one program, with its declared band rewritten. */
function registrationWithBand(min: number, max: number): TutorSubjectRegistration {
  const base = selectEligibleTutorProgram(
    resolveTutorSubjectRegistration('math'),
    REVIEWED_TUTOR_MATH_SKILL_REF,
  )!
  const entry: TutorProgramRegistration = {
    program: { ...base.program, gradeBand: { min, max, label: `Grades ${min}–${max}` } },
    routingIds: base.routingIds,
  }
  return { subject: 'math', programs: [entry], hooks: {} }
}

describe('the defect: an unmatched routing id is answered with the subject default', () => {
  it('reproduces it, against the real frozen registry', () => {
    /**
     * A girl sits down to fractions. Her block's lesson and skill references
     * are Study-namespace ids, so nothing in the frozen content declares them.
     *
     * `selectTutorProgram` does not refuse. It returns
     * `registration.programs[0]` — sequence 01, place value and regrouping —
     * and the program it returns is reviewed, schema-valid and inside the
     * reviewed grade band, so every later check answers correctly about a
     * lesson she is not doing.
     */
    const registration = resolveTutorSubjectRegistration('math')
    const answered = selectTutorProgram(registration, UNMATCHED.skillRef, UNMATCHED.lessonRef)

    expect(answered).toBe(registration.programs[0]?.program)
    expect(answered.title).toBe('Place Value and Regrouping')
    expect(answered.targetSkillId).toBe('math-skill-pv-value-v1')
    // Not a broken program it would be easy to notice downstream — a perfectly
    // good one for the wrong lesson. That is what made it silent.
    expect(answered.gradeBand.min).toBeGreaterThanOrEqual(STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.minimumGrade)
    expect(answered.gradeBand.max).toBeLessThanOrEqual(STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.maximumGrade)

    // And the request really was for something else the content DOES have:
    // fractions is registered, under ids nobody mapped to it.
    expect(selectTutorProgram(registration, FRACTIONS_LEGACY_SKILL).title)
      .toBe('Equivalent Fractions and Common Denominators')
  })

  it('pins the difference: legacy still falls back, production refuses', () => {
    /**
     * THE PIN the card asks for. One input, two selectors, one test.
     *
     * Legacy semantics are UNCHANGED on purpose. The mounted preview host sends
     * exactly these ids and works only because of the fallback, and the frozen
     * tree's own suite pins it by name
     * (adaptive-tutor/study-engine/tests/final-assembly/subject-registry.test.ts).
     * Changing `selectTutorProgram` would take the preview surface dark. So the
     * production path gets its own selector, and the difference is a tested
     * fact rather than a comment that can rot.
     */
    const registration = resolveTutorSubjectRegistration('math')
    const legacy = selectTutorProgram(registration, UNMATCHED.skillRef, UNMATCHED.lessonRef)
    const production = selectEligibleTutorProgram(registration, UNMATCHED.skillRef, UNMATCHED.lessonRef)

    expect(legacy).toBe(registration.programs[0]?.program)
    expect(production).toBeNull()

    // They agree everywhere a routing id DOES match, so the difference is
    // exactly the fallback and not a second, quieter divergence.
    for (const id of [FRACTIONS_LEGACY_SKILL, REVIEWED_TUTOR_MATH_SKILL_REF, 'math-lesson-01-place-value-regrouping']) {
      expect(selectEligibleTutorProgram(registration, id)?.program)
        .toBe(selectTutorProgram(registration, id))
    }
  })
})

describe('supported reviewed content is eligible', () => {
  it('names the program it routed to, and the band that program declares', () => {
    const decision = evaluateStudyTutorContentEligibility(request())
    expect(decision).toEqual({
      eligible: true,
      programRef: 'math-seq-mult-div-rel-v1',
      gradeBand: STUDY_TUTOR_V1_GRADE_BAND,
    })
    // The decision is admissible to the host as it stands, so the evaluator and
    // the transport parser cannot disagree about what a YES looks like.
    expect(parseStudyTutorEligibility(decision)).toEqual(decision)
  })

  it('routes on the skill reference or the lesson reference, whichever matches', () => {
    expect(evaluateStudyTutorContentEligibility(request({
      lessonRef: 'math-lesson-03-equivalent-fractions-common-denominators',
      skillRefs: [UNMATCHED.skillRef],
    }))).toMatchObject({ eligible: true, programRef: 'math-seq-equivalent-fractions-v1' })

    expect(evaluateStudyTutorContentEligibility(request({
      skillRefs: [FRACTIONS_LEGACY_SKILL],
    }))).toMatchObject({ eligible: true, programRef: 'math-seq-equivalent-fractions-v1' })
  })

  it('is eligible for every program the frozen registry can return', () => {
    // Derived rather than asserted: the registrations are asked what they
    // declare, so a later card registering content the envelope does not cover
    // fails HERE as well as at the gate.
    for (const subject of ['math', 'english'] as const) {
      for (const entry of resolveTutorSubjectRegistration(subject).programs) {
        for (const routingId of entry.routingIds) {
          expect(evaluateReviewedTutorContent(subject, [routingId]))
            .toEqual({ eligible: true, programRef: entry.program.id, gradeBand: STUDY_TUTOR_V1_GRADE_BAND })
        }
      }
    }
  })
})

describe('unsupported subject is ineligible', () => {
  it('refuses `other`, where the completion-only block kinds land', () => {
    // `parent-created` and `romeo-virtual-academy` map to subject `other` in
    // HOST_STUDY_MAPPING, and their mastery authority is `completion-only`.
    // Those are precisely the blocks a Tutor must not teach.
    expect(evaluateStudyTutorContentEligibility(request({ subject: 'other' })))
      .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject })
  })

  it('maps exactly the three host subjects that have a reviewed registration', () => {
    expect(reviewedTutorSubject('math')).toBe('math')
    expect(reviewedTutorSubject('reading')).toBe('english')
    expect(reviewedTutorSubject('writing')).toBe('english')
    expect(reviewedTutorSubject('other')).toBeNull()
  })

  it('refuses before touching the registry, so a subject cannot be rescued by a routing id', () => {
    // A routing id the content really does declare, on a subject that has no
    // reviewed registration. The subject decides, and it decides first.
    expect(evaluateStudyTutorContentEligibility(request({
      subject: 'other',
      skillRefs: [FRACTIONS_LEGACY_SKILL],
    }))).toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedSubject })
  })
})

describe('unsupported task type is ineligible', () => {
  it('refuses a custom segment: a parent-created or Romeo activity', () => {
    expect(evaluateStudyTutorContentEligibility(request({ taskTypes: ['custom'] })))
      .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedTaskType })
  })

  it('refuses a block where ONE segment is unteachable, not just where all are', () => {
    // `.every` and not `.some`. A block whose mastery-check the Tutor can run
    // but whose other segment is completion-only is not a block it can run.
    expect(evaluateStudyTutorContentEligibility(request({
      taskTypes: ['mastery-check', 'guided-practice', 'custom'],
    }))).toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedTaskType })

    // The whole of the math block kind's segment set, which IS teachable.
    expect(evaluateStudyTutorContentEligibility(request({
      taskTypes: ['retrieval-practice', 'direct-instruction', 'guided-practice', 'independent-practice', 'mastery-check'],
    }))).toMatchObject({ eligible: true })
  })

  it('takes the supported set from the bridge rather than from a list kept here', () => {
    /**
     * `TASK_PHASES` in the bridge's mappings.ts is a PARTIAL record: seven of
     * the fourteen study task types map to a teaching phase. Asking the bridge
     * is what makes this incapable of drifting from it. The split is asserted
     * as a whole so that a task type gaining or losing a phase shows up here.
     */
    const teachable = STUDY_TUTOR_ELIGIBILITY_TASK_TYPES.filter(tutorTeachableTaskType)
    expect([...teachable].sort()).toEqual([
      'direct-instruction',
      'guided-practice',
      'independent-practice',
      'mastery-check',
      'prerequisite-remediation',
      'retrieval-practice',
      'worked-example',
    ])
    const refused = STUDY_TUTOR_ELIGIBILITY_TASK_TYPES.filter((t) => !tutorTeachableTaskType(t))
    expect([...refused].sort()).toEqual([
      'custom',
      'discussion',
      'problem-solving',
      'project-work',
      'reading',
      'reflection',
      'writing',
    ])
  })

  it('is stricter than the per-turn mapping, and that difference is intended', () => {
    // `bridgeTaskType` in ./tutorRuntime.ts casts `reading` and `writing` to
    // `guided-practice` and passes `reflection` through, because it is asked
    // what phase a segment becomes in a block that is already running. A
    // pre-launch check is asked whether the block should run at all, and where
    // the two disagree this one refuses. Pinned so a later card can see the
    // asymmetry rather than trip over it.
    for (const taskType of ['reading', 'writing', 'reflection'] as const) {
      expect(tutorTeachableTaskType(taskType)).toBe(false)
      expect(evaluateStudyTutorContentEligibility(request({ taskTypes: [taskType] })))
        .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unsupportedTaskType })
    }
  })
})

describe('an unmatched lesson reference is ineligible', () => {
  it('refuses rather than teaching the subject default', () => {
    // The card's central case, and the one the defect above answered YES.
    expect(evaluateStudyTutorContentEligibility(request({
      lessonRef: UNMATCHED.lessonRef,
      skillRefs: [UNMATCHED.skillRef],
    }))).toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson })
  })

  it('refuses every Study-namespace reference the mounted host actually sends', () => {
    for (const ref of [
      'lesson:fractions-week-3',
      'skill:equivalent-fractions',
      'synthetic:grade5:math:multiplication',
      'synthetic:grade5:math:main',
    ]) {
      expect(evaluateStudyTutorContentEligibility(request({ lessonRef: ref, skillRefs: [ref] })))
        .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson })
    }
  })

  it('matches exactly, and transforms no id on the way', () => {
    // A selector that normalised, prefixed or fuzzy-matched would be inventing
    // the curriculum mapping subject-registry.ts calls a curriculum decision,
    // in the place least able to review it.
    for (const nearMiss of [
      'MATH-SKILL-MD-EQUAL-GROUPS-V1',
      'math-skill-md-equal-groups',
      'math-skill-md-equal-groups-v2',
      'math-skill-md-equal-groups-v11',
      'skill:math-skill-md-equal-groups-v1',
      'math-skill-md-equal-groups-v1.',
    ]) {
      expect(evaluateStudyTutorContentEligibility(request({ skillRefs: [nearMiss] })))
        .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson })
    }
    // A near-miss the REFERENCE parser refuses outright rather than passing on
    // as an unmatched id — trailing whitespace is not a Tutor reference at all.
    expect(parseStudyTutorEligibilityRequest({
      subject: 'math',
      lessonRef: UNMATCHED.lessonRef,
      skillRefs: ['math-skill-md-equal-groups-v1 '],
      taskTypes: ['guided-practice'],
    })).toBeNull()
  })

  it('carries no program on the refusal, because there is no program', () => {
    const decision = evaluateStudyTutorContentEligibility(request({ skillRefs: [UNMATCHED.skillRef] }))
    expect(decision.eligible).toBe(false)
    expect(Object.hasOwn(decision, 'programRef')).toBe(false)
    expect(Object.hasOwn(decision, 'gradeBand')).toBe(false)
  })
})

describe('a program outside the reviewed V1 grade band is ineligible', () => {
  it('refuses Grade 7/8 content rather than relabelling it elementary', () => {
    /**
     * `middle-6-8` content sent as `elementary-3-5` would be a false statement
     * about what a child is being taught, folded into a durable event digest.
     *
     * Forced through a registration whose program declares the band, because
     * every program the real registry returns is inside the envelope — which is
     * what makes the envelope right, and what would otherwise leave this branch
     * unforceable and free for a mutation to delete.
     */
    for (const [min, max] of [[7, 8], [6, 7], [9, 12], [1, 2], [2, 5]] as const) {
      expect(reviewedContentDecision(registrationWithBand(min, max), [REVIEWED_TUTOR_MATH_SKILL_REF]))
        .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unreviewedGradeBand })
    }
  })

  it('refuses a nonsense band rather than coercing it', () => {
    for (const [min, max] of [[Number.NaN, 5], [3, Number.POSITIVE_INFINITY], [3.5, 5]] as const) {
      expect(reviewedContentDecision(registrationWithBand(min, max), [REVIEWED_TUTOR_MATH_SKILL_REF]).eligible)
        .toBe(false)
    }
  })

  it('admits a program at each edge of the envelope, so the refusals are a bound', () => {
    const { minimumGrade, maximumGrade } = STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE
    for (const [min, max] of [[minimumGrade, maximumGrade], [4, 6], [5, 5]] as const) {
      expect(reviewedContentDecision(registrationWithBand(min, max), [REVIEWED_TUTOR_MATH_SKILL_REF]))
        .toMatchObject({ eligible: true, gradeBand: STUDY_TUTOR_V1_GRADE_BAND })
    }
  })

  it('reads the band of the MATCHED program, not of the first one', () => {
    /**
     * The ordering that made the base defect silent. Two programs: the first is
     * out of band, the second is in band and is the one the routing id names.
     * A check that ran before the match — or that read `programs[0]` — would
     * refuse this, and a fallback selector would ACCEPT the out-of-band one.
     */
    const outOfBand = registrationWithBand(7, 8).programs[0]!
    const inBand = selectEligibleTutorProgram(
      resolveTutorSubjectRegistration('math'),
      FRACTIONS_LEGACY_SKILL,
    )!
    const registration: TutorSubjectRegistration = {
      subject: 'math',
      programs: [{ program: outOfBand.program, routingIds: new Set(['some-other-id']) }, inBand],
      hooks: {},
    }
    expect(reviewedContentDecision(registration, [FRACTIONS_LEGACY_SKILL]))
      .toEqual({
        eligible: true,
        programRef: 'math-seq-equivalent-fractions-v1',
        gradeBand: STUDY_TUTOR_V1_GRADE_BAND,
      })
    // And the out-of-band program is genuinely reachable in this registration,
    // so the assertion above is about ordering rather than about an empty set.
    expect(reviewedContentDecision(registration, ['some-other-id']))
      .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unreviewedGradeBand })
  })
})

describe('the decision is total and uses no learner authority', () => {
  it('answers rather than throws when the registry itself refuses', () => {
    // Destined for a server surface, where a throw is a fault and not a
    // refusal. An unregistered subject reaches the registry's own throw.
    expect(() => evaluateReviewedTutorContent('science' as 'math', ['anything'])).not.toThrow()
    expect(evaluateReviewedTutorContent('science' as 'math', ['anything']))
      .toEqual({ eligible: false, reason: STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision })
  })

  it('gives the same answer for the same content, whoever is sitting in front of it', () => {
    // Eligibility is a property of a LESSON. There is no learner input, so
    // there is nothing that could make two children get different answers —
    // which is the structural form of "no learner grade, no working level".
    const first = evaluateStudyTutorContentEligibility(request())
    const second = evaluateStudyTutorContentEligibility(request())
    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
  })
})
