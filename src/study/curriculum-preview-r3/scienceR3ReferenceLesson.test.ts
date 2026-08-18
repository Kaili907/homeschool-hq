import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LearnerResponseRuntime,
  MemoryLearnerResponseStore,
  mapLearnerMaterialToStudySegments,
  type LearnerMaterialDto,
  type LearnerMaterialSectionDto,
  type LearnerResponseAttemptContext,
  type LearnerResponseItem,
} from '../family-pilot/final-app/learner-response'
import { createRichLessonRenderModel } from '../family-pilot/lesson-player'
import { SCIENCE_R3_PREVIEW_LESSONS, SCIENCE_R3_PREVIEW_PATH } from './registry'

const REVIEW_TITLES = [
  'WHAT YOU LEARNED',
  'EVIDENCE YOU USED',
  'HOW YOU DID',
  'WHAT TO PRACTICE',
  'REVIEW THIS LESSON',
  'COURSE PROGRESS',
  'NEXT ACTION',
]
const RHYTHM = ['NOTICE', 'LEARN', 'MODEL', 'YOUR TURN', 'FEEDBACK', 'APPLY']
const FROZEN_SAMPLE = 'ma-g3-science-u02-l03'

const canonical = new Map(
  readFileSync(resolve(process.cwd(), 'curriculum-production/final/science/packages/ma-g3-science/work-packages.jsonl'), 'utf8')
    .trim().split('\n').map((line) => JSON.parse(line) as Record<string, never>)
    .map((record) => [record.lesson_id as unknown as string, record]),
)

/** The lesson file as authored, including the Science fields the player DTO does not model. */
interface RawSection extends LearnerMaterialSectionDto {
  readonly feedbackFor?: string
  readonly data?: { readonly tableLabel: string; readonly columns: readonly string[]; readonly rows: readonly string[] }
}
type RawLesson = Omit<LearnerMaterialDto, 'sections'> & {
  readonly grade: number
  readonly courseId: string
  readonly standards: readonly string[]
  readonly instructionalRhythm: readonly string[]
  readonly sections: readonly RawSection[]
}

const [lesson] = SCIENCE_R3_PREVIEW_LESSONS
const material = lesson!.material
const raw = JSON.parse(readFileSync(resolve(process.cwd(), lesson!.lessonPath), 'utf8')) as RawLesson

function attemptContext(): LearnerResponseAttemptContext {
  return {
    lessonRef: material.lessonRef,
    studentRef: 'test:reviewer',
    assignmentRef: 'test:no-assignment',
    attemptRef: 'test:attempt',
  }
}

function responseFor(item: LearnerResponseItem): string {
  if (item.responseType === 'CHOICE') return item.choices[0]!.choiceRef
  if (item.responseType === 'NUMERIC') return '31'
  return 'About 31 degrees, using the 2023, 2024, and 2025 Januarys.'
}

describe('Science R3 Wave 1 reference lesson', () => {
  it('is exactly one authored lesson, and not the frozen Director sample', () => {
    expect(SCIENCE_R3_PREVIEW_LESSONS).toHaveLength(1)
    expect(lesson!.lessonRef).toBe('ma-g3-science-u08-l03')
    expect(lesson!.lessonRef).not.toBe(FROZEN_SAMPLE)
    expect(SCIENCE_R3_PREVIEW_PATH).toBe('/curriculum-preview/science-r3')
  })

  it('carries its course, standards, and lesson id from the canonical sequence', () => {
    const authority = canonical.get(material.lessonRef) as unknown as Record<string, unknown>
    expect(authority).toBeDefined()
    expect(raw.title).toBe(authority.title)
    expect(raw.courseId).toBe(authority.course_id)
    expect(raw.grade).toBe(authority.grade)
    expect(raw.standards).toEqual(authority.standards)
    expect(lesson!.standards).toEqual(authority.standards)
    expect(raw.instructionalRhythm).toEqual([...RHYTHM, 'REVIEW'])
  })

  it('states only science the canonical correctness authority supports', () => {
    const authority = canonical.get(material.lessonRef) as unknown as {
      scientific_correctness_authority: { fixed_facts: string[]; relationships: string[]; out_of_scope: string }
    }
    const text = JSON.stringify(raw).toLowerCase()
    // The canonical authority puts the mechanism of seasons out of scope at Grade 3.
    expect(authority.scientific_correctness_authority.out_of_scope).toMatch(/tilt of earth's axis/i)
    expect(text).not.toMatch(/tilt/)
    // It names "closer to the Sun in summer" as a disqualifying error, so the lesson may
    // only carry that idea as a claim the learner rules out with evidence.
    expect(text).toMatch(/closer to the sun/)
    expect(text).toMatch(/one distance cannot make one town warm and one cool/)
    // Opposite hemispheres at the same time is a canonical fixed fact.
    expect(authority.scientific_correctness_authority.fixed_facts.join(' ')).toMatch(/northern hemisphere it is winter/i)
    expect(text).toMatch(/opposite seasons/)
  })

  it('keeps its two data tables internally consistent', () => {
    const notice = raw.sections.find((section) => section.sectionRef === 'g3-seasons:notice-data')!
    const apply = raw.sections.find((section) => section.sectionRef === 'g3-seasons:apply')!
    const noticeRows = notice.data!.rows.map((row) => row.split('|').map((cell) => cell.trim()))
    const applyRows = apply.data!.rows.map((row) => row.split('|').map((cell) => cell.trim()))
    const notice2025 = new Map(noticeRows.map((row) => [row[0]!, row[3]!]))
    for (const [month, riverbend] of applyRows.map((row) => [row[0]!, row[1]!] as const)) {
      expect(notice2025.get(month)).toBe(riverbend)
    }
  })

  it('runs the approved NOTICE to REVIEW rhythm and ends in the seven-part review', () => {
    const titles = raw.sections.map((section) => section.title)
    expect(titles.slice(-REVIEW_TITLES.length)).toEqual(REVIEW_TITLES)
    let cursor = -1
    for (const beat of RHYTHM) {
      const index = titles.findIndex((title, position) => position > cursor && title.startsWith(beat))
      expect(index, `${beat} beat is missing or out of order`).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  it('asks no question without a response control', () => {
    const prompts = new Set(raw.sections.flatMap((section) => (section.items ?? []).map((item) => item.prompt)))
    const questionBearing = (value: unknown): string[] =>
      typeof value === 'string' ? (value.includes('?') ? [value] : [])
        : Array.isArray(value) ? value.flatMap(questionBearing)
          : value && typeof value === 'object' ? Object.values(value).flatMap(questionBearing) : []
    for (const text of questionBearing(raw)) expect(prompts.has(text)).toBe(true)
  })

  it('projects into the rich player with TAUGHT distinct from PRACTICED', () => {
    const renderModel = createRichLessonRenderModel(material)
    expect(renderModel.mode).toBe('rich')
    expect(renderModel.subject.subject).toBe('science')
    expect(renderModel.pages.map((page) => page.kind)).toEqual(
      expect.arrayContaining(['data', 'worked-example', 'guided-practice', 'independent-practice', 'remediation', 'mastery-check', 'reflection']),
    )
    expect(renderModel.pages.every((page) => page.pageRef && page.progressRef)).toBe(true)

    const projection = mapLearnerMaterialToStudySegments(material)
    const learn = projection.segments.find((segment) => segment.role === 'LEARN')!
    expect(learn.items.length).toBeGreaterThan(0)
    expect(learn.items.every((item) => item.instructionalExample && !item.required)).toBe(true)
    const practice = projection.segments.find((segment) => segment.role === 'PRACTICE')!
    expect(practice.items.filter((item) => item.required).length).toBe(5)
    const reflect = projection.segments.find((segment) => segment.role === 'REFLECT')!
    expect(reflect.items.filter((item) => item.required).length).toBe(1)
  })

  it('gates every feedback section behind the response it answers', () => {
    const feedback = raw.sections.filter((section) => section.feedbackFor)
    expect(feedback.length).toBeGreaterThanOrEqual(3)
    for (const section of feedback) {
      expect(section.sectionKind).toBe('remediation')
      expect(section.items ?? []).toHaveLength(0)
      const targetIndex = raw.sections.findIndex((candidate) => (candidate.items ?? []).some((item) => item.itemRef === section.feedbackFor))
      expect(targetIndex).toBeGreaterThanOrEqual(0)
      expect(raw.sections.indexOf(section)).toBeGreaterThan(targetIndex)
    }
  })

  it('collects real learner-response evidence through the real runtime, all pending assessment', async () => {
    const store = new MemoryLearnerResponseStore()
    const context = attemptContext()
    const runtime = new LearnerResponseRuntime(material, context, store)
    const saved: string[] = []

    for (const ordinal of [1, 2, 3]) {
      const segmentRef = `${material.lessonRef}:segment:${ordinal}`
      let view = await runtime.open(ordinal, segmentRef)
      while (view.item && !view.canCompleteSegment) {
        const result = await runtime.submit({
          lessonRef: material.lessonRef,
          sectionRef: view.item.sectionRef,
          itemRef: view.item.itemRef,
          segmentRef,
          value: responseFor(view.item),
        })
        expect(result.status).toBe('saved')
        if (result.status === 'saved') expect(result.assessmentStatus).toBe('PENDING_ASSESSMENT')
        saved.push(view.item.responseType)
        view = await runtime.open(ordinal, segmentRef)
      }
      expect(view.canCompleteSegment).toBe(true)
    }

    expect(saved).toHaveLength(6)
    expect([...new Set(saved)].sort()).toEqual(['CHOICE', 'NUMERIC', 'TEXT'])
    const records = await store.list(context)
    expect(records).toHaveLength(6)
    expect(records.every((record) => record.status === 'PENDING_ASSESSMENT' && record.assessment === null)).toBe(true)
    expect(records.some((record) => record.evidenceMode === 'MASTERY')).toBe(true)
  })

  it('refuses a response the learner never gave, and a worked example as evidence', async () => {
    const runtime = new LearnerResponseRuntime(material, attemptContext(), new MemoryLearnerResponseStore())
    const empty = await runtime.submit({
      lessonRef: material.lessonRef,
      sectionRef: 'g3-seasons:your-turn',
      itemRef: 'g3-seasons:your-turn:2',
      segmentRef: 'segment',
      value: '   ',
    })
    expect(empty.status).toBe('rejected')

    const workedExample = await runtime.submit({
      lessonRef: material.lessonRef,
      sectionRef: 'g3-seasons:model',
      itemRef: 'g3-seasons:model:1',
      segmentRef: 'segment',
      value: 'about 83 degrees',
    })
    expect(workedExample.status).toBe('rejected')
    if (workedExample.status === 'rejected') expect(workedExample.reason).toBe('wrong-response-kind')
  })

  it('gives the player a real seven-part review rather than a completion message', () => {
    const review = createRichLessonRenderModel(material).review!
    expect(review.whatYouLearned.length).toBeGreaterThan(1)
    expect(review.whatYouLearned.join(' ')).toMatch(/several years of records/i)
    expect(review.courseProgress).toMatch(/checked before this lesson counts as done/)
    expect(review.nextAction).toBe('Continue required work')
    expect(review.reviewActionLabel).toBe('Review this lesson')
    for (const title of REVIEW_TITLES) {
      expect(raw.sections.some((section) => section.title === title)).toBe(true)
    }
  })

  it('speaks only to the learner, never to the Director or the build system', () => {
    const learnerProse = raw.sections.flatMap((section) => [
      section.title, section.body, section.directions,
      ...(section.items ?? []).flatMap((item) => [item.prompt, ...(item.choices ?? []).map((choice) => typeof choice === 'string' ? choice : choice.label), ...(item.workedSolution?.steps ?? [])]),
      ...(section.data ? [section.data.tableLabel, (section.data as { note?: string }).note] : []),
    ]).filter(Boolean).join(' ')
    for (const phrase of [/wave 1/i, /director/i, /approval/i, /approved assessor/i, /reference lesson/i, /released lesson/i, /not published measurements/i, /pending assessment/i]) {
      expect(learnerProse, `learner prose contains ${phrase}`).not.toMatch(phrase)
    }
    // The mastery boundary survives the rewrite in child-facing words.
    const howYouDid = raw.sections.at(-5)!.body!
    expect(howYouDid).toMatch(/waiting to be checked/)
    expect(howYouDid).toMatch(/does not show that you can do it/)
  })

  it('matches the frozen Grade 3 sample for density', () => {
    const count = (text?: string) => text?.match(/[A-Za-z0-9°']+/g)?.length ?? 0
    const frozen = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/curriculum-quality/science/director-samples-r2/samples/grade-03-patterns-in-motion.json'), 'utf8')) as RawLesson
    const bodyWords = (lesson: RawLesson) => lesson.sections.map((section) => count(section.body))
    const feedbackWords = (lesson: RawLesson) => lesson.sections.filter((section) => section.feedbackFor).map((section) => count(section.body))
    const mean = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length

    // Frozen Grade 3: avg body 20.4, max body 51, feedback bodies 28-34 words.
    expect(mean(bodyWords(raw))).toBeLessThanOrEqual(mean(bodyWords(frozen)) * 1.25)
    expect(Math.max(...bodyWords(raw))).toBeLessThanOrEqual(Math.max(...bodyWords(frozen)))
    expect(Math.max(...feedbackWords(raw))).toBeLessThanOrEqual(Math.max(...feedbackWords(frozen)) + 2)
    expect(mean(feedbackWords(raw))).toBeLessThanOrEqual(mean(feedbackWords(frozen)) * 1.15)
  })

  it('gives the numeric item a step a Grade 3 can execute, and a tolerance in the feedback', () => {
    const yourTurn = raw.sections.find((section) => section.sectionRef === 'g3-seasons:your-turn')!
    const numeric = yourTurn.items!.find((item) => item.responseKind === 'NUMERIC')!
    // The prompt names the procedure, not a judgement call about what is "near the middle".
    expect(numeric.prompt).toMatch(/in order/i)
    expect(numeric.prompt).toMatch(/middle/i)
    // The same procedure is taught in LEARN and shown end to end in MODEL.
    expect(raw.sections.find((section) => section.sectionRef === 'g3-seasons:learn')!.body).toMatch(/in order and take the middle one/i)
    const steps = raw.sections.find((section) => section.sectionRef === 'g3-seasons:model')!.items![0]!.workedSolution!.steps!
    expect(steps.join(' ')).toMatch(/in order: 81, 83, 86/)
    expect(steps.join(' ')).toMatch(/middle/i)
    // The feedback states the accepted range instead of leaving a near-miss unscored.
    const feedback = raw.sections.find((section) => section.feedbackFor === numeric.itemRef)!.body!
    expect(feedback).toMatch(/28, 31, 34/)
    expect(feedback).toMatch(/from 30 to 32/)
  })

  it('exposes no answer authority to the browser', () => {
    const serialized = JSON.stringify(raw)
    expect(serialized).not.toMatch(/correctAnswer|answerKey|answerIndex|expectedAnswer|acceptedAnswers|solutionKey|scoringKey|rubricKey/i)
    expect(serialized).not.toMatch(/ACTIVITY_EVIDENCE/)
    expect(raw.format).toBe('structured')
  })
})
