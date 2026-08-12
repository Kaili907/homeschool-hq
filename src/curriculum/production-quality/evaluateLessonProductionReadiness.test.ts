import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from './evaluateLessonProductionReadiness'
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
