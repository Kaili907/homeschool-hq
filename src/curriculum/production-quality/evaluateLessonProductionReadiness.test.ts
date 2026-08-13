import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from './evaluateLessonProductionReadiness'
import type { LessonContentBlock, ScoringAuthorityVerification } from './types'
import {
  readyArtsLesson,
  readyElaLesson,
  readyMathLesson,
  readyScienceLesson,
} from './productionReadinessFixtures.testSupport'

describe('evaluateLessonProductionReadiness — subject-appropriate READY paths', () => {
  it('passes a fixed-answer math/FinLit lesson', () => {
    const result = evaluateLessonProductionReadiness(readyMathLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('passes an ELA/Social Studies lesson scored by rubric', () => {
    const result = evaluateLessonProductionReadiness(readyElaLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('passes a science investigation lesson', () => {
    const result = evaluateLessonProductionReadiness(readyScienceLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('passes an arts/project performance-task lesson without demanding a fixed answer key', () => {
    const result = evaluateLessonProductionReadiness(readyArtsLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('does not flag genuinely rich, unique instruction as needing human review', () => {
    const result = evaluateLessonProductionReadiness(readyMathLesson())
    expect(result.notes.some((note) => note.includes('insufficiently specific'))).toBe(false)
  })
})

describe('evaluateLessonProductionReadiness — structural gaps', () => {
  it('flags a missing worksheet (independent work) even when guided practice exists', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ independentWork: { present: false } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_INDEPENDENT_WORK')
    expect(result.codes).not.toContain('MISSING_STUDENT_WORK')
  })

  it('flags MISSING_STUDENT_WORK when neither guided nor independent work exists', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        guidedPractice: { present: false },
        independentWork: { present: false },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_STUDENT_WORK')
    expect(result.codes).not.toContain('MISSING_GUIDED_PRACTICE')
    expect(result.codes).not.toContain('MISSING_INDEPENDENT_WORK')
  })

  it('flags MISSING_GUIDED_PRACTICE for math/FinLit lessons only', () => {
    const mathResult = evaluateLessonProductionReadiness(
      readyMathLesson({ guidedPractice: { present: false } }),
    )
    expect(mathResult.codes).toContain('MISSING_GUIDED_PRACTICE')

    const elaResult = evaluateLessonProductionReadiness(readyElaLesson())
    expect(elaResult.codes).not.toContain('MISSING_GUIDED_PRACTICE')
  })

  it('flags MISSING_INSTRUCTION when instruction is absent', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ instruction: { present: false } }),
    )
    expect(result.codes).toContain('MISSING_INSTRUCTION')
  })

  it('does not require instruction for arts/RFL/PE/project lessons', () => {
    const result = evaluateLessonProductionReadiness(readyArtsLesson())
    expect(result.codes).not.toContain('MISSING_INSTRUCTION')
  })

  it('flags MISSING_INSTRUCTION when instruction exists but the required worked example is absent', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ workedExample: { present: false } }),
    )
    expect(result.codes).toContain('MISSING_INSTRUCTION')
  })

  it('flags a missing rubric for ELA/Social Studies when acceptable-answer criteria is explicitly tracked and absent', () => {
    const result = evaluateLessonProductionReadiness(
      readyElaLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: { present: true, text: 'Four-point analytic rubric scoring textual evidence.' },
          acceptableAnswerCriteria: { present: false },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_RUBRIC')
  })

  it('does not flag a rubric for missing acceptable-answer criteria when the field is simply not tracked', () => {
    const result = evaluateLessonProductionReadiness(
      readyScienceLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: { present: true, text: 'Rubric scoring data-table completeness and reasoning quality.' },
        },
      }),
    )
    expect(result.codes).not.toContain('MISSING_RUBRIC')
  })

  it('flags MISSING_SCORING_AUTHORITY when no scoring authority is declared', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ scoringAuthority: null }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_SCORING_AUTHORITY')
  })

  it('flags a missing answer key for math/FinLit even when a rubric is present instead', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        scoringAuthority: {
          kind: 'RUBRIC',
          content: { present: true, text: 'A rubric was substituted for a fixed answer key.' },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('flags a missing rubric for ELA/Social Studies when the rubric is declared but empty', () => {
    const result = evaluateLessonProductionReadiness(
      readyElaLesson({
        scoringAuthority: { kind: 'RUBRIC', content: { present: false } },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_RUBRIC')
  })

  it('does not require a fixed answer key where the subject legitimately uses a rubric', () => {
    const elaResult = evaluateLessonProductionReadiness(readyElaLesson())
    expect(elaResult.codes).not.toContain('MISSING_ANSWER_KEY')

    const scienceResult = evaluateLessonProductionReadiness(readyScienceLesson())
    expect(scienceResult.codes).not.toContain('MISSING_ANSWER_KEY')

    const artsResult = evaluateLessonProductionReadiness(readyArtsLesson())
    expect(artsResult.codes).not.toContain('MISSING_ANSWER_KEY')
  })

  it('flags a missing remediation path', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ remediation: { present: false } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_REMEDIATION')
  })

  it('flags a missing extension path', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ extension: { present: false } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_EXTENSION')
  })

  it('flags ASSESSMENT_NOT_ALIGNED when alignment is explicitly declared misaligned', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ assessmentAlignment: 'NOT_ALIGNED' }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('ASSESSMENT_NOT_ALIGNED')
  })

  it('flags SOURCE_INTEGRITY_GAP for a source-dependent lesson with a declared gap', () => {
    const result = evaluateLessonProductionReadiness(
      readyElaLesson({ sourceIntegrityStatus: 'GAP' }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('SOURCE_INTEGRITY_GAP')
  })

  it('flags SAFETY_OR_PRIVACY_GAP for a flagged lesson with a declared gap', () => {
    const result = evaluateLessonProductionReadiness(
      readyScienceLesson({ safetyOrPrivacyStatus: 'GAP' }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('SAFETY_OR_PRIVACY_GAP')
  })

  it('flags SAFETY_OR_PRIVACY_GAP when a flagged lesson has no safe alternative', () => {
    const result = evaluateLessonProductionReadiness(
      readyScienceLesson({ safeAlternative: { present: false } }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('SAFETY_OR_PRIVACY_GAP')
  })

  it('surfaces every applicable gap at once for a lesson missing several components', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        remediation: { present: false },
        extension: { present: false },
        assessmentAlignment: 'NOT_ALIGNED',
      }),
    )
    expect(result.codes).toEqual(
      expect.arrayContaining(['MISSING_REMEDIATION', 'MISSING_EXTENSION', 'ASSESSMENT_NOT_ALIGNED']),
    )
  })
})

describe('evaluateLessonProductionReadiness — NEEDS_HUMAN_REVIEW', () => {
  it('flags a templated scaffold that just interpolates the title into generic text', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        instruction: {
          present: true,
          text:
            'In this lesson, students will learn about Comparing Multi-Digit Numbers Using ' +
            'Place Value. Complete the Comparing Multi-Digit Numbers Using Place Value worksheet.',
        },
      }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('NEEDS_HUMAN_REVIEW')
    expect(result.codes).not.toContain('MISSING_INSTRUCTION')
  })

  it('flags a very short instruction block regardless of boilerplate phrasing', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ instruction: { present: true, text: 'Compare the numbers.' } }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
  })

  it('flags an omitted assessment alignment for human review, same as an explicit UNKNOWN', () => {
    const withoutAlignment = readyMathLesson()
    const { assessmentAlignment: _omit, ...lessonWithoutAlignment } = withoutAlignment
    const result = evaluateLessonProductionReadiness(lessonWithoutAlignment)
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).not.toContain('ASSESSMENT_NOT_ALIGNED')
  })

  it('flags unverified assessment alignment for human review rather than auto-failing', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ assessmentAlignment: 'UNKNOWN' }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).not.toContain('ASSESSMENT_NOT_ALIGNED')
  })

  it('flags unverified source integrity for human review rather than auto-failing', () => {
    const result = evaluateLessonProductionReadiness(
      readyElaLesson({ sourceIntegrityStatus: 'UNKNOWN' }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).not.toContain('SOURCE_INTEGRITY_GAP')
  })

  it('flags unverified safety/privacy review for human review rather than auto-failing', () => {
    const result = evaluateLessonProductionReadiness(
      readyScienceLesson({ safetyOrPrivacyStatus: 'UNKNOWN' }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).not.toContain('SAFETY_OR_PRIVACY_GAP')
  })

  it('lets a structural gap take priority over a human-review flag', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        remediation: { present: false },
        assessmentAlignment: 'UNKNOWN',
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_REMEDIATION')
    expect(result.codes).not.toContain('NEEDS_HUMAN_REVIEW')
  })
})

describe('evaluateLessonProductionReadiness — answer-key scoring authority', () => {
  const withKey = (content: LessonContentBlock, verification?: ScoringAuthorityVerification) =>
    evaluateLessonProductionReadiness(
      readyMathLesson({ scoringAuthority: { kind: 'ANSWER_KEY', content, verification } }),
    )

  const VERIFIED: ScoringAuthorityVerification = {
    method: 'INDEPENDENT_ORACLE',
    evidence:
      'Recomputed from each item\'s own stated digits by the build\'s place-value comparison checker, independently of the authored key.',
  }

  it('does not call an empty answer-key block READY', () => {
    const result = withKey({ present: false }, VERIFIED)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('MISSING_ANSWER_KEY')
  })

  it('does not call a text-less answer key READY', () => {
    const result = withKey({ present: true }, VERIFIED)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('ANSWER_KEY_NOT_SUBSTANTIVE')
  })

  it('does not call a TODO answer key READY', () => {
    const result = withKey({ present: true, text: 'TODO: write the answer key before release.' }, VERIFIED)
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('ANSWER_KEY_NOT_SUBSTANTIVE')
  })

  it('does not call a generic boilerplate answer key READY', () => {
    const result = withKey(
      {
        present: true,
        text: 'Answer key: answers will vary. See the teacher guide for the full worked solutions.',
      },
      VERIFIED,
    )
    expect(result.status).not.toBe('READY')
    expect(result.codes).toContain('ANSWER_KEY_CONTENT_UNCERTAIN')
  })

  it('does not call a wrong-arithmetic key with no verified authority READY', () => {
    // The gate does not claim to have caught the arithmetic error — it refuses
    // READY because nothing establishes the key's correctness at all.
    const result = withKey({
      present: true,
      text:
        'Item 1: 2 + 2 = 5, because carrying the ones column adds an extra unit before the tens are ' +
        'combined. Item 2: 14 + 7 = 22, applying that same carry rule to the ones column first and ' +
        'then reading off the tens.',
    })
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('ANSWER_KEY_UNVERIFIED')
    expect(result.notes.some((note) => note.includes('not established'))).toBe(true)
  })

  it('does not call a short wrong-arithmetic key READY either', () => {
    const result = withKey({ present: true, text: '2 + 2 = 5' })
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toEqual(
      expect.arrayContaining(['ANSWER_KEY_CONTENT_UNCERTAIN', 'ANSWER_KEY_UNVERIFIED']),
    )
  })

  it('does not call an explicitly UNVERIFIED authority READY', () => {
    const result = withKey(
      {
        present: true,
        text:
          'Item 1: 48,352 is greater than 48,325 because the tens place decides at 5 versus 2, and ' +
          'items 2 through 14 each name the first place value where the two numbers differ.',
      },
      { method: 'UNVERIFIED', evidence: VERIFIED.evidence },
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('ANSWER_KEY_UNVERIFIED')
  })

  it('does not accept a declared method with no evidence behind it', () => {
    const result = withKey(
      {
        present: true,
        text:
          'Item 1: 48,352 is greater than 48,325 because the tens place decides at 5 versus 2, and ' +
          'items 2 through 14 each name the first place value where the two numbers differ.',
      },
      { method: 'HUMAN_VERIFIED' },
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('ANSWER_KEY_UNVERIFIED')
  })

  it('passes a substantive, oracle-verified answer key', () => {
    const result = evaluateLessonProductionReadiness(readyMathLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it.each(['SOURCE_AUTHORITY', 'HUMAN_VERIFIED', 'OTHER_VERIFIED_METHOD'] as const)(
    'accepts %s as a defensible verified method when evidence is recorded',
    (method) => {
      const result = withKey(
        {
          present: true,
          text:
            'Item 1: 48,352 is greater than 48,325 because the tens place decides at 5 versus 2, and ' +
            'items 2 through 14 each name the first place value where the two numbers differ.',
        },
        {
          method,
          evidence:
            'Each item was checked against the grade-5 place-value reference set by the reviewing teacher before release.',
        },
      )
      expect(result.status).toBe('READY')
    },
  )

  it('holds an unverified answer key back from READY without failing the lesson outright', () => {
    const result = withKey({
      present: true,
      text:
        'Item 1: 48,352 is greater than 48,325 because the tens place decides at 5 versus 2, and ' +
        'items 2 through 14 each name the first place value where the two numbers differ.',
    })
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toEqual(['ANSWER_KEY_UNVERIFIED', 'NEEDS_HUMAN_REVIEW'])
  })
})

describe('evaluateLessonProductionReadiness — open-ended scoring is unchanged', () => {
  it('passes a rubric-scored open response with no answer-key verification recorded', () => {
    const result = evaluateLessonProductionReadiness(readyElaLesson())
    expect(result.status).toBe('READY')
    expect(result.codes).toEqual(['READY'])
  })

  it('does not demand answer-key verification of a rubric or scoring judgment', () => {
    for (const lesson of [readyElaLesson(), readyScienceLesson(), readyArtsLesson()]) {
      const result = evaluateLessonProductionReadiness(lesson)
      expect(result.codes).not.toContain('ANSWER_KEY_UNVERIFIED')
      expect(result.codes).not.toContain('ANSWER_KEY_NOT_SUBSTANTIVE')
      expect(result.codes).not.toContain('ANSWER_KEY_CONTENT_UNCERTAIN')
    }
  })

  it('does not run answer-key substance checks on a terse rubric', () => {
    const result = evaluateLessonProductionReadiness(
      readyScienceLesson({
        scoringAuthority: { kind: 'RUBRIC', content: { present: true, text: 'Answers will vary.' } },
      }),
    )
    expect(result.status).toBe('READY')
  })
})

describe('evaluateLessonProductionReadiness — credential requests', () => {
  const QUOTED_SCAM_TASK =
    'Fictional scam message to analyze: \'Enter your password and type your account number to unlock ' +
    'the prize\'. Explain to a partner which two details in that message reveal it is a scam, then ' +
    'write the safer reply you would send instead of sharing anything personal.'

  it('fails a lesson whose own text asks the student for a real credential', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        independentWork: {
          present: true,
          text:
            'To unlock the family budget worksheet, enter your password and type your account number ' +
            'on the sign-in screen, then complete the ten comparison problems that follow using ' +
            'place-value reasoning for each pair.',
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CREDENTIAL_REQUEST')
  })

  it('still sees a credential request that only appears inside quotation marks', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({ independentWork: { present: true, text: QUOTED_SCAM_TASK } }),
    )
    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
    expect(result.codes).toContain('CREDENTIAL_REQUEST_QUOTED')
    expect(result.notes.some((note) => note.includes('quotation marks'))).toBe(true)
  })

  it('scans scoring-authority text for credential requests too', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        scoringAuthority: {
          kind: 'ANSWER_KEY',
          content: {
            present: true,
            text:
              'Item 1: 48,352 is greater than 48,325 at the tens place. To reveal items 2 through 14, ' +
              'enter your password on the answer portal and type your account number when prompted.',
          },
          verification: {
            method: 'INDEPENDENT_ORACLE',
            evidence: 'Recomputed from the stated digits by the build\'s comparison checker before release.',
          },
        },
      }),
    )
    expect(result.status).toBe('NOT_READY')
    expect(result.codes).toContain('CREDENTIAL_REQUEST')
  })

  it('leaves clean lessons untouched by the credential scan', () => {
    for (const lesson of [readyMathLesson(), readyElaLesson(), readyScienceLesson(), readyArtsLesson()]) {
      const result = evaluateLessonProductionReadiness(lesson)
      expect(result.codes).not.toContain('CREDENTIAL_REQUEST')
      expect(result.codes).not.toContain('CREDENTIAL_REQUEST_QUOTED')
    }
  })
})

describe('evaluateLessonProductionReadiness — safety text is not a credential request', () => {
  it('leaves a scam-refusal lesson READY rather than failing the curriculum that teaches refusal', () => {
    const result = evaluateLessonProductionReadiness(
      readyMathLesson({
        independentWork: {
          present: true,
          text:
            'Remember the rule from this unit: never enter your password or account number into a ' +
            'link that arrives by text, and never share your PIN with anyone who calls you. For each ' +
            'of the ten fictional messages, decide whether it is a scam and name the detail that gave it away.',
        },
      }),
    )
    expect(result.status).toBe('READY')
    expect(result.codes).not.toContain('CREDENTIAL_REQUEST')
    expect(result.codes).not.toContain('CREDENTIAL_REQUEST_QUOTED')
  })

  it('records how a passing answer key was accepted rather than implying the gate checked it', () => {
    const result = evaluateLessonProductionReadiness(readyMathLesson())
    expect(result.status).toBe('READY')
    expect(
      result.notes.some(
        (note) => note.includes('INDEPENDENT_ORACLE') && note.includes('not on anything this gate proved'),
      ),
    ).toBe(true)
  })
})
