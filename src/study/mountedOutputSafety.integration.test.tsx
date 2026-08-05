import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdaptiveTutorEngine, type TutorResponse } from '../../adaptive-tutor/core/index.ts'
import {
  StudyTutorSafetySurface,
  STUDY_TUTOR_OUTPUT_PENDING_MESSAGE,
  studyAccessibilityProjection,
} from '../components/study/StudySessionContainer'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime, type StudyTutorTurnResult } from './runtimeFacade'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudySafetyRequest, StudySafetyResult } from './types'

const UNCLASSIFIED_MODEL_OUTPUT = 'UNCLASSIFIED MODEL OUTPUT MUST NEVER RENDER'
const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
const INVALID: StudySafetyResult = { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }

function renderedTutorSurface(input: {
  visibleText: string
  checking?: boolean
  stopped?: boolean
}): string {
  return renderToStaticMarkup(
    <StudyTutorSafetySurface
      busy={input.checking ?? false}
      checkingTutorSafety={input.checking ?? false}
      stopped={input.stopped ?? false}
      visibleText={input.visibleText}
      accessibility={studyAccessibilityProjection(syntheticGrade5StudyContext('math').accessibility)}
      transcriptOpen={false}
    />,
  )
}

function outputPort(
  classifyOutput: (request: StudySafetyRequest) => StudySafetyResult | Promise<StudySafetyResult>,
): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'test-mounted-http-output-v1',
    evaluate: (request) => request.contentKind === 'learner-input' ? CLEAR : classifyOutput(request),
  }
}

async function mountedTurn(safety: StudySafetyPort) {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety }
  const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: `output-${Date.now()}` })
  const sessionRef = `session:mounted-output:${Date.now()}`
  const runtime = new AcceptedRc1HostRuntime(ports)
  runtime.launch(context, entry, sessionRef)
  return {
    runtime,
    submit: () => runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef: `request:mounted-output:${Date.now()}`,
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
    }),
  }
}

function stoppedSurface(result: StudyTutorTurnResult): string {
  expect(result.status).toBe('stopped')
  if (result.status !== 'stopped') throw new Error('expected stopped Tutor result')
  return renderedTutorSurface({ visibleText: result.studentMessage, stopped: true })
}

describe('mounted Tutor output safety gate', () => {
  afterEach(() => vi.restoreAllMocks())

  function replaceTutorOutputWithCanary() {
    const original = AdaptiveTutorEngine.prototype.submit
    vi.spyOn(AdaptiveTutorEngine.prototype, 'submit').mockImplementation(function (
      this: AdaptiveTutorEngine,
      input: Parameters<AdaptiveTutorEngine['submit']>[0],
    ): TutorResponse {
      const response = original.call(this, input)
      return {
        ...response,
        learnerMessage: UNCLASSIFIED_MODEL_OUTPUT,
        spokenTurn: {
          ...response.spokenTurn,
          text: UNCLASSIFIED_MODEL_OUTPUT,
          fallbackText: UNCLASSIFIED_MODEL_OUTPUT,
        },
      }
    })
  }

  it('blocks flagged Tutor output and proves the unclassified canary never reaches the rendered student surface', async () => {
    replaceTutorOutputWithCanary()
    let classifiedText = ''
    const { submit } = await mountedTurn(outputPort((request) => {
      classifiedText = request.transientText
      return { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }
    }))
    const result = await submit()
    expect(classifiedText).toContain(UNCLASSIFIED_MODEL_OUTPUT)
    const html = stoppedSurface(result)
    expect(html).toContain('Please go get your dad so he can sit with you')
    expect(html).not.toContain(UNCLASSIFIED_MODEL_OUTPUT)
  })

  it.each([
    ['unavailable', async () => { throw new Error('classifier unavailable') }],
    ['timeout', async () => { throw new DOMException('timed out', 'AbortError') }],
    ['error', async () => INVALID],
    ['malformed response', async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-confirmed' }) as StudySafetyResult],
  ])('fails closed for classifier %s and renders only the fixed pause message', async (_label, classifyOutput) => {
    replaceTutorOutputWithCanary()
    const { submit } = await mountedTurn(outputPort(classifyOutput))
    const result = await submit()
    const html = stoppedSurface(result)
    expect(result).toMatchObject({
      status: 'stopped',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
      coreSubmitInvocations: 1,
    })
    expect(html).toContain('Please go get your dad so he can sit with you')
    expect(html).not.toContain(UNCLASSIFIED_MODEL_OUTPUT)
  })

  it('keeps the student on a fixed checking surface until output classification resolves', async () => {
    replaceTutorOutputWithCanary()
    let release!: (value: StudySafetyResult) => void
    let started!: () => void
    const outputStarted = new Promise<void>((resolve) => { started = resolve })
    const deferred = new Promise<StudySafetyResult>((resolve) => { release = resolve })
    const { submit } = await mountedTurn(outputPort((request) => {
      expect(request.transientText).toContain(UNCLASSIFIED_MODEL_OUTPUT)
      started()
      return deferred
    }))
    let settled = false
    const pending = submit().finally(() => { settled = true })
    await outputStarted

    const pendingHtml = renderedTutorSurface({
      visibleText: UNCLASSIFIED_MODEL_OUTPUT,
      checking: true,
    })
    expect(settled).toBe(false)
    expect(pendingHtml).toContain(STUDY_TUTOR_OUTPUT_PENDING_MESSAGE)
    expect(pendingHtml).toContain('Checking safely')
    expect(pendingHtml).not.toContain(UNCLASSIFIED_MODEL_OUTPUT)

    release(CLEAR)
    const result = await pending
    expect(result.status).toBe('accepted')
    if (result.status === 'accepted') {
      const acceptedHtml = renderedTutorSurface({ visibleText: result.presentation.visibleText })
      expect(acceptedHtml).not.toContain(UNCLASSIFIED_MODEL_OUTPUT)
    }
  })
})
