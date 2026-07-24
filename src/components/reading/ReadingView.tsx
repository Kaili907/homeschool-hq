import { useMemo, useState } from 'react'
import { useTheme } from '../../theme'
import { isoToday } from '../../appState'
import { getReadingState, recordReadingSession, selectPassage } from '../../reading/fluency'
import type { Passage, ReadingGrade } from '../../reading/passages'
import type { Profile, ReadingSessionLog } from '../../types'
import ReadingSession from './ReadingSession'
import ReadingSummary from './ReadingSummary'

/**
 * MR reading fluency — the entry orchestrator opened from Home.
 *
 * Picks today's passage (a FRESH unseen one on fluency-check Fridays, else the
 * least-recently-read so nothing repeats within the grade's spacing window),
 * runs the session, folds the result into `profile.reading` via a functional
 * update, then shows the gentle summary.
 */

const READING_GRADES: ReadingGrade[] = ['3', '4', '6']

function isFriday(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 5
}

export default function ReadingView({
  profile,
  muted,
  onProfileChange,
  onExit,
}: {
  profile: Profile
  muted: boolean
  /** functional profile writer (patchActive) — keeps writes composing per CLAUDE rule 6. */
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onExit: () => void
}) {
  const t = useTheme()
  const grade = profile.grade as ReadingGrade
  const fluencyCheck = isFriday(isoToday())

  // Pick a passage once per "attempt". `nonce` bumps to reroll on "Read another".
  const [nonce, setNonce] = useState(0)
  const [done, setDone] = useState<{ log: ReadingSessionLog; passage: Passage } | null>(null)

  const passage = useMemo(() => {
    const state = getReadingState(profile)
    return selectPassage(state, grade, { fluencyCheck })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, fluencyCheck, nonce])

  if (!READING_GRADES.includes(grade) || !passage) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <p className={`text-lg font-bold ${t.sub}`}>Reading passages aren&apos;t set up for this grade yet.</p>
        <button onClick={onExit} className={`${t.secondaryBtn} mt-4 px-6 py-3`}>
          Back home 🏠
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <ReadingSummary
        log={done.log}
        passage={done.passage}
        profile={profile}
        onAgain={() => {
          setDone(null)
          setNonce((n) => n + 1)
        }}
        onHome={onExit}
      />
    )
  }

  return (
    <ReadingSession
      passage={passage}
      profile={profile}
      muted={muted}
      fluencyCheck={fluencyCheck}
      onComplete={(log) => {
        onProfileChange((prev) => recordReadingSession(prev, log))
        setDone({ log, passage })
      }}
      onExit={onExit}
    />
  )
}
