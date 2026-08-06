import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdaptiveTutorEngine, type TutorResponse } from '../../adaptive-tutor/core/index.ts'
import {
  StudyTutorSafetySurface,
  studyAccessibilityProjection,
} from '../components/study/StudySessionContainer'
import { syntheticGrade5StudyContext } from './demonstrations'
import { learnerSafeResult, STUDY_LEARNER_STOP_MESSAGE } from './safety/learnerSafe'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudySafetyRequest, StudySafetyResult } from './types'

// A6-5 — the student-facing half. When a safety flag fires the session stops
// and the learner is shown one neutral message that sends her to her dad. The
// message must be identical for every non-clear classification so the surface
// cannot disclose which check fired.

const FLAGGED_TUTOR_TEXT = 'FLAGGED TUTOR TEXT THAT MUST NEVER BE DESCRIBED TO THE STUDENT'
const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }

const NON_CLEAR: ReadonlyArray<readonly [string, StudySafetyResult]> = [
  ['urgent', { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }],
  ['uncertain', { outcome: 'uncertain', mayContinue: false, adultHelpState: 'proposed-not-delivered' }],
  ['invalid', { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }],
]

/** Wording the flag itself must never leak onto the student surface. */
const DISCLOSURE_TERMS = [
  FLAGGED_TUTOR_TEXT,
  'urgent',
  'uncertain',
  'invalid',
  'flagged',
  'classifier',
  'safety check',
  'reason',
]

function renderedStopSurface(studentMessage: string): string {
  return renderToStaticMarkup(
    <StudyTutorSafetySurface
      busy={false}
      checkingTutorSafety={false}
      stopped
      visibleText={studentMessage}
      accessibility={studyAccessibilityProjection(syntheticGrade5StudyContext('math').accessibility)}
      transcriptOpen={false}
    />,
  )
}

function outputPort(decision: StudySafetyResult): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'test-a6-5-student-stop-v1',
    evaluate: (request: StudySafetyRequest) =>
      request.contentKind === 'learner-input' ? CLEAR : decision,
  }
}

async function stoppedTurn(decision: StudySafetyResult) {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety: outputPort(decision) }
  const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: `stop-${decision.outcome}-${Date.now()}` })
  const sessionRef = `session:a6-5-stop:${decision.outcome}:${Date.now()}`
  const runtime = new AcceptedRc1HostRuntime(ports)
  runtime.launch(context, entry, sessionRef)
  return runtime.submit({
    context,
    entry,
    scope: { ...scope, sessionRef },
    requestRef: `request:a6-5-stop:${Date.now()}`,
    segmentRef: entry.segments[0]!.segmentRef,
    transientLearnerText: 'ready',
    expectedAnswer: 'ready',
    occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
  })
}

describe('A6-5 student-facing safety stop', () => {
  it('uses one byte-identical message for urgent, uncertain and invalid in both catalogs', () => {
    for (const classification of ['urgent', 'uncertain', 'invalid'] as const) {
      expect(learnerSafeResult(classification).message).toBe(STUDY_LEARNER_STOP_MESSAGE)
    }
    // The gateway rejects any learner block that differs from the browser's own
    // catalog, so the server copy has to be the same bytes.
    const serverCatalog = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..',
        'netlify', 'functions', '_shared', 'study-safety', 'learner-safe.js'),
      'utf8',
    )
    expect(serverCatalog).toContain(`'${STUDY_LEARNER_STOP_MESSAGE}'`)
    expect(serverCatalog.match(/message: STUDY_LEARNER_STOP_MESSAGE,/g)).toHaveLength(3)
  })

  afterEach(() => vi.restoreAllMocks())

  function replaceTutorOutputWithFlaggedText() {
    const original = AdaptiveTutorEngine.prototype.submit
    vi.spyOn(AdaptiveTutorEngine.prototype, 'submit').mockImplementation(function (
      this: AdaptiveTutorEngine,
      input: Parameters<AdaptiveTutorEngine['submit']>[0],
    ): TutorResponse {
      const response = original.call(this, input)
      return {
        ...response,
        learnerMessage: FLAGGED_TUTOR_TEXT,
        spokenTurn: { ...response.spokenTurn, text: FLAGGED_TUTOR_TEXT, fallbackText: FLAGGED_TUTOR_TEXT },
      }
    })
  }

  it.each(NON_CLEAR)('stops the session and sends the student to her dad for a %s flag', async (_label, decision) => {
    replaceTutorOutputWithFlaggedText()
    const result = await stoppedTurn(decision)
    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') throw new Error('expected a stopped Tutor result')

    const html = renderedStopSurface(result.studentMessage)
    expect(html).toContain('The lesson is paused for now.')
    expect(html).toContain('Please go get your dad so he can sit with you.')
    expect(html).toContain('You are not in trouble.')
    expect(html).toContain('Study paused safely')
  })

  it('renders one identical message for every non-clear flag, describing nothing about what fired', async () => {
    replaceTutorOutputWithFlaggedText()
    const rendered: string[] = []
    for (const [, decision] of NON_CLEAR) {
      const result = await stoppedTurn(decision)
      if (result.status !== 'stopped') throw new Error('expected a stopped Tutor result')
      rendered.push(renderedStopSurface(result.studentMessage))
    }

    // Identical rendered output means the surface cannot disclose which check fired.
    expect(new Set(rendered).size).toBe(1)
    for (const html of rendered) {
      for (const term of DISCLOSURE_TERMS) {
        expect(html.toLowerCase()).not.toContain(term.toLowerCase())
      }
    }
  })
})
