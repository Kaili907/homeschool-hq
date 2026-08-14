import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectJsonLearnerMaterial } from '../scripts/learner-projection/structured-projection-r1.mjs'
import { mapLearnerMaterialToStudySegments } from '../src/study/family-pilot/final-app/learner-response/mapping'
import {
  createElementaryMathPresentation,
  G3_ROUNDING_CANONICAL_TITLE,
  G3_ROUNDING_CHILD_TITLE,
  G3_ROUNDING_PRODUCTION_LESSON_REF,
  isG3RoundingProductionSample,
} from '../src/study/family-pilot/elementary-math-sample-player'
import { isG3RoundingDirectorPreviewPath } from '../src/study/family-pilot/elementary-math-director-preview/route'

const packagePath = new URL('../curriculum-production/final/mathematics/active/packages/grade-03/ma-g3-mathematics-u01-l02.package.json', import.meta.url)
const canonical = JSON.parse(readFileSync(packagePath, 'utf8'))
const { material } = projectJsonLearnerMaterial(
  canonical,
  { lessonRef: G3_ROUNDING_PRODUCTION_LESSON_REF, subject: 'mathematics' },
  canonical.lessonRef.title,
)

describe('Grade 3 math production sample R2', () => {
  it('projects the one real lesson into the exact child-facing sequence and counts', () => {
    const counts = Object.fromEntries(canonical.sections.map((section) => [section.sectionId, section.items.length]))
    expect(canonical.lessonRef.lessonId).toBe(G3_ROUNDING_PRODUCTION_LESSON_REF)
    expect(material.title).toBe(G3_ROUNDING_CANONICAL_TITLE)
    expect(G3_ROUNDING_CHILD_TITLE).toBe('Round Numbers to the Nearest 100')
    expect(counts).toMatchObject({ ex: 3, gp: 5, ip: 10, mc: 5, rm: 4, xt: 2 })
    expect(canonical.sections.filter((section) => section.sectionId.startsWith('learn-'))).toHaveLength(3)

    const flow = createElementaryMathPresentation(material)
    const count = (stage) => flow.filter((step) => step.stage === stage).length
    expect({
      learn: count('LEARN'),
      examples: count('EXAMPLE'),
      guided: count('GUIDED'),
      independent: count('INDEPENDENT'),
      mastery: count('MASTERY'),
      remediation: count('REMEDIATION'),
      challenge: count('CHALLENGE'),
    }).toEqual({ learn: 3, examples: 3, guided: 5, independent: 10, mastery: 5, remediation: 4, challenge: 2 })
    expect(flow.map((step) => step.stage)).toEqual([...flow.map((step) => step.stage)].sort((a, b) =>
      ['LEARN', 'EXAMPLE', 'GUIDED', 'INDEPENDENT', 'MASTERY', 'REMEDIATION', 'CHALLENGE'].indexOf(a) -
      ['LEARN', 'EXAMPLE', 'GUIDED', 'INDEPENDENT', 'MASTERY', 'REMEDIATION', 'CHALLENGE'].indexOf(b)))
  })

  it('keeps 26 graded items opaque and learner-safe', () => {
    const lesson = mapLearnerMaterialToStudySegments(material)
    const learnerItems = lesson.segments.flatMap((segment) => segment.items).filter((item) => item.required)
    expect(learnerItems).toHaveLength(26)
    expect(new Set(learnerItems.map((item) => item.itemRef)).size).toBe(26)
    expect(JSON.stringify(material)).not.toMatch(/answerKeyRef|correctAnswer|answerIndex|scoringAuthorityRef|expectedAnswer/i)
  })

  it('uses Grade 3 wording and keeps one prompt per presentation step', () => {
    const text = JSON.stringify(material)
    expect(text).not.toMatch(/runtime|segment|opaque|callback|response store|engineering/i)
    for (const step of createElementaryMathPresentation(material)) {
      expect(step.item.lessonRef).toBe(G3_ROUNDING_PRODUCTION_LESSON_REF)
      expect(step.item.prompt?.includes('\nChoices:')).not.toBe(true)
    }
  })

  it('routes only this lesson to the production sample player', () => {
    expect(isG3RoundingProductionSample(G3_ROUNDING_PRODUCTION_LESSON_REF)).toBe(true)
    expect(isG3RoundingProductionSample('ma-g3-mathematics-u01-l03')).toBe(false)
  })

  it('keeps the Director shortcut exact-path and development-only', () => {
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding', true)).toBe(true)
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding/', true)).toBe(true)
    expect(isG3RoundingDirectorPreviewPath('/__review/g3-rounding', false)).toBe(false)
    expect(isG3RoundingDirectorPreviewPath('/family-pilot', true)).toBe(false)
  })

  it('does not add browser answer authority or another response-store implementation', () => {
    const player = readFileSync(new URL('../src/study/family-pilot/elementary-math-sample-player/ElementaryMathSamplePlayer.tsx', import.meta.url), 'utf8')
    const preview = readFileSync(new URL('../src/study/family-pilot/elementary-math-director-preview/G3RoundingDirectorPreview.tsx', import.meta.url), 'utf8')
    const currentSurface = readFileSync(new URL('../src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx', import.meta.url), 'utf8')
    expect(player).toContain('runtime.submit')
    expect(player).not.toMatch(/correctAnswer|answerKey|expectedAnswer|scoringRule|isCorrect/)
    expect(player).not.toMatch(/class\s+\w*ResponseStore|new\s+(BrowserLearnerResponseStore|MemoryLearnerResponseStore)|localStorage|indexedDB/)
    expect(preview).toContain('MemoryLearnerResponseStore')
    expect(currentSurface).toContain('runtime={responseRuntime}')
    expect(currentSurface).toContain('material={result.material}')
    expect(currentSurface).toContain('Future Jarvis callback placeholder.')
  })
})
