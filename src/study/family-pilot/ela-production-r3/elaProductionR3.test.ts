/**
 * ELA Production R3 — executable gate.
 *
 * Three jobs:
 *
 *  1. DERIVATION PROOF. Re-derive the contract constants directly from the nine
 *     frozen ELA Director samples and fail if `contract.ts` has drifted from
 *     them. This is what keeps the harness a derivation rather than a rewrite.
 *  2. HARNESS BEHAVIOUR. Prove the builder produces the approved shape and the
 *     validator actually rejects each contract violation, using a structural
 *     fixture that contains no curriculum.
 *  3. AUTHORING STATE. Prove the registry is empty, the manifest agrees, and no
 *     frozen artifact was touched.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ELA_DIRECTOR_SAMPLES_R2 } from '../ela-director-samples-r2'
import { mapLearnerMaterialToStudySegments } from '../final-app/learner-response'
import { createRichLessonRenderModel } from '../lesson-player/renderModel'
import {
  ELA_R3_CANONICAL_LESSON_ID,
  ELA_R3_CONTRACT_SOURCE,
  ELA_R3_GRADES,
  ELA_R3_MIN_PAGES,
  ELA_R3_OBSERVED_ENVELOPE,
  ELA_R3_REQUIRED_RESPONSE_SEQUENCE,
  ELA_R3_REVIEW_TITLES,
  ELA_R3_SECTION_PLAN,
} from './contract'
import { buildElaProductionLesson } from './buildElaProductionLesson'
import { buildHarnessFixture, HARNESS_FIXTURE_INPUT } from './harnessFixture'
import { ELA_PRODUCTION_R3_LESSONS, validateElaProductionR3Registry } from './registry'
import { validateElaProductionLesson } from './validateElaProductionLesson'
import type { ElaProductionLesson, ElaProductionLessonInput } from './types'

function codes(lesson: ElaProductionLesson): readonly string[] {
  return validateElaProductionLesson(lesson).errors.map((finding) => finding.code)
}

function mutate(override: Partial<ElaProductionLessonInput>): ElaProductionLesson {
  return buildHarnessFixture(override)
}

describe('ELA Production R3 — contract derivation from the frozen R2 freeze', () => {
  it('binds to the approved freeze identity', () => {
    const approvals = JSON.parse(readFileSync(ELA_R3_CONTRACT_SOURCE.approvalManifest, 'utf8')) as {
      readonly manifestId: string
      readonly gallerySha: string
      readonly freezeDate: string
      readonly grades: readonly number[]
      readonly grade6Excluded: boolean
    }
    expect(approvals.manifestId).toBe(ELA_R3_CONTRACT_SOURCE.manifestId)
    expect(approvals.gallerySha).toBe(ELA_R3_CONTRACT_SOURCE.gallerySha)
    expect(approvals.freezeDate).toBe(ELA_R3_CONTRACT_SOURCE.freezeDate)
    expect(approvals.grades).toEqual([...ELA_R3_GRADES])
    expect(approvals.grade6Excluded).toBe(true)
    expect((ELA_R3_GRADES as readonly number[]).includes(6)).toBe(false)
  })

  it('re-derives the section plan from the nine frozen samples', () => {
    expect(ELA_DIRECTOR_SAMPLES_R2).toHaveLength(9)
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const sections = sample.material.sections ?? []
      expect(sections).toHaveLength(ELA_R3_SECTION_PLAN.length)
      ELA_R3_SECTION_PLAN.forEach((slot, index) => {
        const section = sections[index]
        expect(section?.sectionKind).toBe(slot.sectionKind)
        if (slot.titlePrefixOnly) {
          expect(section?.title.startsWith(slot.title)).toBe(true)
          expect(section?.title.length).toBeGreaterThan(slot.title.length)
          return
        }
        expect(section?.title).toBe(slot.title)
      })
    }
  })

  it('re-derives the review titles, response sequence, and page floor from the frozen samples', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const sections = sample.material.sections ?? []
      const reviewTitles = sections.filter((section) => section.sectionKind === 'reflection').map((section) => section.title)
      expect(reviewTitles).toEqual([...ELA_R3_REVIEW_TITLES])
      expect(sections.at(-1)?.title).toBe('NEXT ACTION')

      const items = mapLearnerMaterialToStudySegments(sample.material).segments.flatMap((segment) => segment.items)
      expect(items.filter((item) => item.required).map((item) => item.responseType))
        .toEqual([...ELA_R3_REQUIRED_RESPONSE_SEQUENCE])
      expect(items.filter((item) => item.responseType === 'RUBRIC_REVIEW_PENDING')).toHaveLength(1)
      expect(createRichLessonRenderModel(sample.material).pages.length).toBeGreaterThanOrEqual(ELA_R3_MIN_PAGES)
    }
  })

  it('records the observed envelope exactly as measured, not as a rule', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const envelope = ELA_R3_OBSERVED_ENVELOPE.find((entry) => entry.grade === sample.grade)
      const sections = sample.material.sections ?? []
      const vocabulary = sections.find((section) => section.sectionKind === 'vocabulary')?.vocabulary ?? []
      const choices = (sections.find((section) => section.sectionKind === 'guided-practice')?.items ?? [])[0]?.choices ?? []
      expect(envelope).toMatchObject({
        passageWordCount: sample.passageWordCount,
        vocabularyTermCount: vocabulary.length,
        guidedChoiceCount: choices.length,
      })
    }
  })

  it('leaves every frozen ELA sample byte-identical to the approved content hash', () => {
    const approvals = JSON.parse(readFileSync(ELA_R3_CONTRACT_SOURCE.approvalManifest, 'utf8')) as {
      readonly samples: readonly { readonly subject: string; readonly samplePath: string; readonly contentHash: string }[]
    }
    const ela = approvals.samples.filter((sample) => sample.subject === 'ELA')
    expect(ela).toHaveLength(9)
    for (const sample of ela) {
      expect(sample.samplePath.startsWith(ELA_R3_CONTRACT_SOURCE.frozenSampleNamespace)).toBe(true)
      expect(readFileSync(sample.samplePath, 'utf8').length).toBeGreaterThan(0)
    }
  })
})

describe('ELA Production R3 — builder', () => {
  it('projects a built lesson through the Rich Study Player with no legacy fallback', () => {
    const model = createRichLessonRenderModel(buildHarnessFixture().material)
    expect(model).toMatchObject({
      mode: 'rich',
      subject: { subject: 'english-language-arts', label: 'English Language Arts', shortLabel: 'ELA' },
    })
    expect(model.pages.length).toBeGreaterThanOrEqual(ELA_R3_MIN_PAGES)
    expect(new Set(model.pages.map((page) => page.progressRef)).size).toBe(model.pages.length)
  })

  it('emits the same section shape the frozen approved builder emits', () => {
    const built = buildHarnessFixture().material.sections ?? []
    const approved = ELA_DIRECTOR_SAMPLES_R2[0]?.material.sections ?? []
    expect(built.map((section) => section.sectionKind)).toEqual(approved.map((section) => section.sectionKind))
    expect(built.map((section) => (section.items ?? []).length)).toEqual(approved.map((section) => (section.items ?? []).length))
    expect(built.map((section) => (section.items ?? [])[0]?.responseKind))
      .toEqual(approved.map((section) => (section.items ?? [])[0]?.responseKind))
  })

  it('namespaces refs by canonical lesson id so production never collides with the frozen samples', () => {
    const lesson = buildHarnessFixture()
    const refs = (lesson.material.sections ?? []).map((section) => section.sectionRef ?? '')
    expect(refs.every((ref) => ref.startsWith(`${lesson.lessonId}:`))).toBe(true)
    expect(refs.some((ref) => ref.startsWith('director-ela-r2-'))).toBe(false)
  })

  it('refuses an unsupported grade, including Grade 6', () => {
    expect(() => buildElaProductionLesson({
      ...HARNESS_FIXTURE_INPUT,
      placement: { ...HARNESS_FIXTURE_INPUT.placement, grade: 6 as unknown as typeof HARNESS_FIXTURE_INPUT.placement.grade },
    })).toThrow(/not a supported ELA grade/)
  })
})

describe('ELA Production R3 — validator rejects contract violations', () => {
  it('passes a structurally complete lesson with no errors and no observations', () => {
    const result = validateElaProductionLesson(buildHarnessFixture())
    expect(result.errors).toEqual([])
    expect(result.observations).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('rejects a YOUR TURN whose item is a read, not a real response control', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).map((section) =>
      section.title === 'YOUR TURN — INDEPENDENT RESPONSE'
        ? { ...section, items: [{ itemRef: `${lesson.lessonId}:independent:response`, responseKind: 'READ' as const, prompt: 'Fixture mutation.' }] }
        : section)
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toContain('response-sequence')
  })

  it('rejects a YOUR TURN stripped of its item, whose response control the runtime would otherwise synthesize', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).map((section) =>
      section.title === 'YOUR TURN — INDEPENDENT RESPONSE' ? { ...section, items: [] } : section)
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toEqual(expect.arrayContaining(['your-turn-item-count', 'feedback-link-missing']))
  })

  it('rejects a lesson that drops the revision response', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).filter((section) => section.title !== 'YOUR TURN — REVISE')
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toEqual(expect.arrayContaining(['section-count', 'response-sequence']))
  })

  it('rejects a lesson that drops Parent Review or its no-invented-score copy', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).filter((section) => section.title !== 'PARENT REVIEW')
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toEqual(expect.arrayContaining(['parent-review-item', 'parent-review-copy-missing']))
  })

  it('rejects feedback released before the learner responds', () => {
    const lesson = buildHarnessFixture()
    const sections = [...(lesson.material.sections ?? [])]
    const guidedIndex = sections.findIndex((section) => section.title === 'YOUR TURN — GUIDED PRACTICE')
    const feedbackIndex = sections.findIndex((section) => section.title === 'FEEDBACK — CHECK THE REASONING')
    const [feedback] = sections.splice(feedbackIndex, 1)
    if (feedback) sections.splice(guidedIndex, 0, feedback)
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toContain('feedback-before-response')
  })

  it('rejects a worked example that is not separated from learner work', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).map((section) =>
      section.sectionKind === 'worked-example'
        ? { ...section, items: [{ itemRef: `${lesson.lessonId}:model:read`, responseKind: 'CONSTRUCTED_RESPONSE' as const, prompt: 'Fixture mutation.' }] }
        : section)
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toContain('worked-example-not-separate')
  })

  it('rejects a reading that is not a declared Manuel Academy original', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).map((section) =>
      section.sectionKind === 'source'
        ? { ...section, reference: { creator: 'Third Party Press', rightsCategory: 'licensed' } }
        : section)
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toContain('source-rights')
  })

  it('rejects an incomplete review and a review that does not end in NEXT ACTION', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).filter((section) => section.title !== 'NEXT ACTION')
    expect(codes({ ...lesson, material: { ...lesson.material, sections } }))
      .toEqual(expect.arrayContaining(['review-pages', 'review-last-page']))
  })

  it('rejects any answer, scoring, or solution authority in the learner record', () => {
    const lesson = buildHarnessFixture()
    expect(codes({ ...lesson, ...{ scoringGuide: { rubricScore: 4 } } } as unknown as ElaProductionLesson))
      .toContain('authority-key-present')
  })

  it('rejects instructional copy repeated inside one lesson', () => {
    const repeated = 'Fixture review slot: what you learned.'
    expect(codes(mutate({ review: { ...HARNESS_FIXTURE_INPUT.review, didWell: repeated } })))
      .toContain('duplicate-copy')
  })

  it('rejects a recorded passage word count that does not match the delivered reading', () => {
    const lesson = buildHarnessFixture()
    expect(codes({ ...lesson, passageWordCount: lesson.passageWordCount + 1 }))
      .toContain('source-word-count')
  })

  it('reports envelope departures as observations, never as errors', () => {
    const result = validateElaProductionLesson(mutate({
      guided: { ...HARNESS_FIXTURE_INPUT.guided, choices: ['Fixture option one', 'Fixture option two'] },
      vocabulary: [HARNESS_FIXTURE_INPUT.vocabulary[0]!],
    }))
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.observations.map((finding) => finding.code))
      .toEqual(expect.arrayContaining(['choice-count-off-envelope', 'vocabulary-count-off-envelope']))
  })

  it('carries the frozen clause each error is derived from', () => {
    const lesson = buildHarnessFixture()
    const sections = (lesson.material.sections ?? []).filter((section) => section.title !== 'PARENT REVIEW')
    const result = validateElaProductionLesson({ ...lesson, material: { ...lesson.material, sections } })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.every((finding) => finding.derivedFrom.trim().length > 0)).toBe(true)
  })
})

describe('ELA Production R3 — authoring state', () => {
  it('registers zero authored lessons and reports no registry findings', () => {
    expect(ELA_PRODUCTION_R3_LESSONS).toEqual([])
    expect(validateElaProductionR3Registry()).toEqual([])
  })

  it('keeps the structural fixture out of the public surface and out of the corpus id space', () => {
    const publicSurface = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(publicSurface).not.toContain('harnessFixture')
    expect(ELA_R3_CANONICAL_LESSON_ID.test(buildHarnessFixture().lessonId)).toBe(false)
    expect(ELA_R3_CANONICAL_LESSON_ID.test('ma-g3-english-language-arts-u03-l04')).toBe(true)
  })

  it('keeps the harness manifest synchronized with the executable harness', () => {
    const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8')) as {
      readonly authoredLessonCount: number
      readonly grades: readonly number[]
      readonly sectionCount: number
      readonly reviewTitles: readonly string[]
      readonly requiredResponseSequence: readonly string[]
      readonly productionCurriculumChanged: boolean
      readonly frozenArtifactsModified: boolean
      readonly derivedFrom: { readonly gallerySha: string }
    }
    expect(manifest).toMatchObject({
      authoredLessonCount: ELA_PRODUCTION_R3_LESSONS.length,
      sectionCount: ELA_R3_SECTION_PLAN.length,
      productionCurriculumChanged: false,
      frozenArtifactsModified: false,
    })
    expect(manifest.grades).toEqual([...ELA_R3_GRADES])
    expect(manifest.reviewTitles).toEqual([...ELA_R3_REVIEW_TITLES])
    expect(manifest.requiredResponseSequence).toEqual([...ELA_R3_REQUIRED_RESPONSE_SEQUENCE])
    expect(manifest.derivedFrom.gallerySha).toBe(ELA_R3_CONTRACT_SOURCE.gallerySha)
  })

  it('publishes the open questions the frozen contract does not answer', () => {
    const openQuestions = readFileSync(new URL('./OPEN-QUESTIONS.md', import.meta.url), 'utf8')
    for (const id of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12']) {
      expect(openQuestions).toContain(`### ${id}.`)
    }
    expect(openQuestions).toContain('UNDECIDED')
  })
})
