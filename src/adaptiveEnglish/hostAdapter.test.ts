import { describe, expect, it } from 'vitest'
import {
  adaptiveEnglishClassification,
  adaptiveEnglishModules,
  boardCommandText,
  chooseEnglishOption,
  createEnglishAdultReview,
  createEnglishWorkspace,
  ENGLISH_MODE_LABELS,
  moduleById,
  openEnglishModule,
  requestEnglishSupport,
  saveLearnerWriting,
  submitEnglishChoice,
} from './hostAdapter'

const expectedLessonIds = [
  'english-decoding-multisyllable-words',
  'english-sentence-completeness',
  'english-main-idea-supporting-details',
  'english-organize-revise-clear-paragraph',
]

describe('Adaptive English host adapter', () => {
  it('loads the four frozen modules in stable order with the accepted classification', () => {
    expect(adaptiveEnglishModules.map((module) => module.lessonId)).toEqual(expectedLessonIds)
    expect(adaptiveEnglishClassification).toEqual({
      PASS_DIRECT_CORE_V0_2: 23,
      PASS_PROVISIONAL_ADAPTER: 10,
      BLOCKED_CORE_CHANGE: 0,
      NOT_TESTED: 0,
    })
  })

  it('starts each module through Tutor Core without replacing stable IDs', () => {
    for (const lessonId of expectedLessonIds) {
      const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
      const session = workspace.sessions[lessonId]
      expect(session.engine.program.id).toBe(lessonId)
      expect(session.coreResponse.phase).toBe('assessment')
      expect(session.coreResponse.assessmentItem?.id).toBe(
        moduleById(lessonId).coreProgram.diagnosticItems[0]?.id,
      )
    }
  })

  it('refuses an empty diagnostic choice without advancing or revealing reasoning', () => {
    const lessonId = expectedLessonIds[0]
    const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
    const module = moduleById(lessonId)
    const session = workspace.sessions[lessonId]
    const responseId = session.coreResponse.id
    const result = submitEnglishChoice(session, module)
    expect(result.coreResponse.id).toBe(responseId)
    expect(result.answerFeedback).toBe("Choose one response when you're ready.")
    expect(result.reasoningReveal).toBeNull()
    expect(result.engine.getSnapshot().observations).toHaveLength(0)
  })

  it('reveals item reasoning only after the learner submits a response', () => {
    const lessonId = expectedLessonIds[2]
    const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
    const module = moduleById(lessonId)
    const session = workspace.sessions[lessonId]
    expect(session.reasoningReveal).toBeNull()
    const item = session.coreResponse.assessmentItem
    if (!item || item.kind !== 'multiple-choice') throw new Error('Expected multiple choice')
    const selected = item.options.find((option) => !item.correctOptionIds.includes(option.id))?.id
    if (!selected) throw new Error('Expected an incorrect option')
    const result = submitEnglishChoice(chooseEnglishOption(session, selected), module)
    expect(result.reasoningReveal).toMatchObject({ itemId: item.id, correct: false })
    expect(result.reasoningReveal?.reasoning.length).toBeGreaterThan(10)
    expect(result.engine.getSnapshot().observations).toHaveLength(1)
  })

  it('maps all four support modes without mutating the Core lesson response', () => {
    const lessonId = expectedLessonIds[1]
    const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
    const session = workspace.sessions[lessonId]
    const originalResponse = session.coreResponse
    expect(ENGLISH_MODE_LABELS.map((mode) => mode.id)).toEqual([
      'show-me',
      'talk-me-through-it',
      'lets-do-one-together',
      'different-example',
    ])
    for (const mode of ENGLISH_MODE_LABELS) {
      const supported = requestEnglishSupport(session, mode.id)
      expect(supported.supportMode).toBe(mode.id)
      expect(supported.coreResponse).toBe(originalResponse)
    }
  })

  it('refuses blank writing and preserves learner-owned text through support changes', () => {
    const lessonId = expectedLessonIds[3]
    const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
    const session = workspace.sessions[lessonId]
    const blank = saveLearnerWriting({ ...session, writingDraft: '   ' })
    expect(blank.writingFeedback).toContain('will not complete it for you')

    const learnerDraft = 'The first sentence should move after the example.'
    const saved = saveLearnerWriting({ ...session, writingDraft: learnerDraft })
    const supported = requestEnglishSupport(saved, 'different-example')
    expect(supported.writingDraft).toBe(learnerDraft)
    expect(saved.writingFeedback).toContain('remains your wording')
  })

  it('creates a parent-gated review without learner draft or transcript content', () => {
    const lessonId = expectedLessonIds[3]
    const workspace = openEnglishModule(createEnglishWorkspace(), lessonId)
    const module = moduleById(lessonId)
    const session = {
      ...workspace.sessions[lessonId],
      writingDraft: 'PRIVATE LEARNER DRAFT CANARY',
    }
    const review = createEnglishAdultReview('profile-1', module, session)
    const serialized = JSON.stringify(review)
    expect(serialized).not.toContain('PRIVATE LEARNER DRAFT CANARY')
    expect(serialized).not.toContain('transcript')
    expect(review.coreReview.diagnosticClaimMade).toBe(false)
    expect(review.coreReview.highStakesPlacementDecisionMade).toBe(false)
  })

  it('renders known and future board commands through safe text fallbacks', () => {
    expect(
      boardCommandText({
        id: 'english-test-text',
        kind: 'add-text',
        text: 'Visible support',
        region: 'center',
        emphasis: 'normal',
        durationMs: 0,
        ariaLabel: 'Visible support',
      }),
    ).toBe('Visible support')
    expect(
      boardCommandText({
        id: 'english-test-clear',
        kind: 'clear-board',
        durationMs: 0,
        ariaLabel: 'Clear board',
      }),
    ).toBeNull()
  })
})
