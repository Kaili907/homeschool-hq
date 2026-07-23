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
  onPatch: (update: (prev: Profile) => Profile) => void
  onHome: () => void
}

/**
 * Orchestrates one assessment: start-code gate → player (or timed essay) → done.
 * All persistence flows through onPatch so the attempt survives reloads.
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

  // Derive the next assessment state from the LATEST committed profile, so a
  // per-answer save and the finish that follows it compose instead of both
  // starting from the same stale snapshot and the second clobbering the first.
  type AState = ReturnType<typeof getState>
  const patchState = (fn: (prev: AState) => AState) =>
    onPatch((prev) => ({ ...prev, assessments: fn(getState(prev.assessments)) }))

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
          patchState((s) => startAttempt(s, testId, profile.id, nowISO()).state)
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
          patchState((s) => recordAnswer(s, testId, essayItem.id, value, false, addMs))
        }
        onFinish={(value, addMs) => {
          patchState((s) =>
            finishAttempt(
              recordAnswer(s, testId, essayItem.id, value, false, addMs),
              test,
              nowISO(),
            ),
          )
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
        patchState((s) => recordAnswer(s, testId, itemId, value, skipped, addMs))
      }
      onFinish={(lastId, value, skipped, addMs) => {
        // record the last item AND finish in ONE functional update, deriving from
        // the latest committed state, so the final patch is never clobbered by a
        // stale-base finish (both would otherwise start from the same profile).
        patchState((s) =>
          finishAttempt(
            recordAnswer(s, testId, lastId, value, skipped, addMs),
            test,
            nowISO(),
          ),
        )
        setPhase('done')
      }}
      onExit={onHome}
    />
  )
}
