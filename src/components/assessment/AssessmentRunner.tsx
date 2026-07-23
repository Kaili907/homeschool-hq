import { useState } from 'react'
import type { Profile } from '../../types'
import { TEST_BY_ID, allItems } from '../../assessment/banks'
import {
  finishAttempt,
  findAssignment,
  getState,
  inProgressAttempt,
  recordAnswer,
  startAttempt,
} from '../../assessment/attempts'
import { TestPlayer } from './TestPlayer'
import { EssayEditor } from './EssayEditor'
import { StartGate, AssessmentDone } from './StartGate'

interface AssessmentRunnerProps {
  profile: Profile
  testId: string
  nowISO: () => string
  onPatch: (p: Profile) => void
  onHome: () => void
}

/**
 * Orchestrates one assessment: start-code gate → player (or timed essay) → done.
 * All persistence flows through onPatch(profile) so the attempt survives reloads.
 */
export function AssessmentRunner({ profile, testId, nowISO, onPatch, onHome }: AssessmentRunnerProps) {
  const test = TEST_BY_ID[testId]
  const state = getState(profile.assessments)
  const assignment = findAssignment(state, testId)
  const resuming = !!inProgressAttempt(state, testId)
  const [phase, setPhase] = useState<'gate' | 'run' | 'done'>('gate')

  if (!test) {
    return <AssessmentDone onHome={onHome} />
  }

  const patchState = (next: ReturnType<typeof getState>) =>
    onPatch({ ...profile, assessments: next })

  const isEssay = allItems(test).every((i) => i.kind === 'longtext')
  const essayItem = allItems(test)[0]

  if (phase === 'gate') {
    return (
      <StartGate
        test={test}
        startCode={assignment?.startCode ?? ''}
        resuming={resuming}
        onCancel={onHome}
        onStart={() => {
          const started = startAttempt(state, testId, profile.id, nowISO())
          patchState(started.state)
          setPhase('run')
        }}
      />
    )
  }

  if (phase === 'done') {
    return <AssessmentDone onHome={onHome} />
  }

  // run
  const attempt = inProgressAttempt(getState(profile.assessments), testId)
  if (!attempt) {
    // defensive: nothing in progress (e.g. locked) → done screen
    return <AssessmentDone onHome={onHome} />
  }

  if (isEssay) {
    const initial = attempt.answers[essayItem.id]?.value ?? ''
    return (
      <EssayEditor
        test={test}
        prompt={essayItem.prompt}
        initialValue={initial}
        onSave={(value, addMs) =>
          patchState(recordAnswer(getState(profile.assessments), testId, essayItem.id, value, false, addMs))
        }
        onFinish={(value, addMs) => {
          let next = recordAnswer(getState(profile.assessments), testId, essayItem.id, value, false, addMs)
          next = finishAttempt(next, test, nowISO())
          patchState(next)
          setPhase('done')
        }}
        onExit={onHome}
      />
    )
  }

  return (
    <TestPlayer
      test={test}
      attempt={attempt}
      onRecord={(itemId, value, skipped, addMs) =>
        patchState(recordAnswer(getState(profile.assessments), testId, itemId, value, skipped, addMs))
      }
      onFinish={(lastId, value, skipped, addMs) => {
        // record the last item AND finish in ONE state update, so the final
        // patch is not clobbered by a stale-base finish (both would derive from
        // the same pre-record profile otherwise).
        let next = recordAnswer(getState(profile.assessments), testId, lastId, value, skipped, addMs)
        next = finishAttempt(next, test, nowISO())
        patchState(next)
        setPhase('done')
      }}
      onExit={onHome}
    />
  )
}
