import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectJsonLearnerMaterial } from '../scripts/learner-projection/structured-projection-r1.mjs'
import { mapLearnerMaterialToStudySegments } from '../src/study/family-pilot/final-app/learner-response/mapping'
import { createElementaryMathPresentation } from '../src/study/family-pilot/elementary-math-sample-player/presentation'
import { isG3RoundingDirectorPreviewPath } from '../src/study/family-pilot/elementary-math-director-preview/route'
import {
  G3_ROUNDING_CANONICAL_TITLE,
  G3_ROUNDING_CHILD_DISPLAY_TITLE,
} from '../src/study/family-pilot/elementary-math-director-preview/G3RoundingDirectorPreview'

const LESSON_REF = 'ma-g3-mathematics-u01-l02'
const path = new URL('../curriculum-production/final/mathematics/active/packages/grade-03/ma-g3-mathematics-u01-l02.package.json', import.meta.url)
const canonical = JSON.parse(readFileSync(path, 'utf8'))
const binding = { lessonRef: LESSON_REF, subject: 'mathematics' }
const { material } = projectJsonLearnerMaterial(canonical, binding, canonical.lessonRef.title)

describe('Grade 3 rounding Director preview convergence', () => {
  it('projects the real canonical package into the exact learner flow without dropping authored work', () => {
    const counts = Object.fromEntries(canonical.sections.map((section) => [section.sectionId, section.items.length]))
    expect(canonical.lessonRef.lessonId).toBe(LESSON_REF)
    expect(material.title).toBe(G3_ROUNDING_CANONICAL_TITLE)
    expect(G3_ROUNDING_CHILD_DISPLAY_TITLE).toBe('Round Numbers to the Nearest 100')
    expect(counts).toMatchObject({ ex: 3, gp: 5, ip: 10, mc: 5, rm: 4, xt: 2 })
    expect(canonical.sections.filter((section) => section.sectionId.startsWith('learn-'))).toHaveLength(3)

    const flow = createElementaryMathPresentation(material)
    expect(flow.filter((step) => step.stage === 'LEARN')).toHaveLength(3)
    expect(flow.filter((step) => step.stage === 'EXAMPLE')).toHaveLength(3)
    expect(flow.filter((step) => step.stage === 'GUIDED')).toHaveLength(5)
    expect(flow.filter((step) => step.stage === 'INDEPENDENT')).toHaveLength(10)
    expect(flow.filter((step) => step.stage === 'MASTERY')).toHaveLength(5)
    expect(flow.filter((step) => step.stage === 'REMEDIATION')).toHaveLength(4)
    expect(flow.filter((step) => step.stage === 'CHALLENGE')).toHaveLength(2)
    expect(flow.map((step) => step.stage)).toEqual([...flow.map((step) => step.stage)].sort((a, b) =>
      ['LEARN', 'EXAMPLE', 'GUIDED', 'INDEPENDENT', 'MASTERY', 'REMEDIATION', 'CHALLENGE'].indexOf(a) -
      ['LEARN', 'EXAMPLE', 'GUIDED', 'INDEPENDENT', 'MASTERY', 'REMEDIATION', 'CHALLENGE'].indexOf(b)))
  })

  it('preserves every graded item key as a separate opaque learner item and leaks no answer authority', () => {
    const lesson = mapLearnerMaterialToStudySegments(material)
    const learnerItems = lesson.segments.flatMap((segment) => segment.items).filter((item) => item.required)
    expect(learnerItems).toHaveLength(26)
    expect(new Set(learnerItems.map((item) => item.itemRef)).size).toBe(26)
    expect(JSON.stringify(material)).not.toMatch(/answerKeyRef|correctAnswer|answerIndex|scoringAuthorityRef/i)
  })

  it('keeps the shortcut strictly development-only and exact-path', () => {
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding', true)).toBe(true)
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding/', true)).toBe(true)
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding', false)).toBe(false)
    expect(isG3RoundingDirectorPreviewPath('/family-pilot', true)).toBe(false)
  })
})
