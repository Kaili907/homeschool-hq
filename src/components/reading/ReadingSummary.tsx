import { useTheme } from '../../theme'
import { Confetti } from '../Confetti'
import { syllableHyphenate } from '../../reading/syllable'
import { conqueredWords, getReadingState, readingStreak } from '../../reading/fluency'
import type { Passage } from '../../reading/passages'
import type { Profile, ReadingSessionLog } from '../../types'

/**
 * MR reading fluency — the after-session summary.
 *
 * GENTLE BY DESIGN: never a red "failure" screen. We celebrate what she read,
 * show the minutes and (clearly-labelled ESTIMATED) words-per-minute, and turn
 * stumbles into a friendly "words we practiced" row — tomorrow's warm-up, never
 * "words you got wrong."
 */
export default function ReadingSummary({
  log,
  passage,
  profile,
  onAgain,
  onHome,
}: {
  log: ReadingSessionLog
  passage: Passage
  profile: Profile
  onAgain: () => void
  onHome: () => void
}) {
  const t = useTheme()
  const bigEmoji = t.id === 'playful'
  const state = getReadingState(profile) // already includes this session
  const streak = readingStreak(state)
  const conquered = conqueredWords(state)
  const minutes = Math.max(1, Math.round(log.durationSec / 60))
  const estimated = log.mode === 'estimated'

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 text-center">
      {t.confetti && <Confetti burst={1} />}
      <div className={`${t.card} animate-pop p-6`}>
        {bigEmoji && <div className="text-5xl">📖✨</div>}
        <h1 className={`mt-2 text-3xl font-extrabold ${t.heading}`}>Great reading!</h1>
        <p className={`mt-1 font-bold ${t.sub}`}>
          You read <strong>{passage.title}</strong>
          {streak > 1 ? ` · 🔥 ${streak}-day reading streak!` : ''}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-extrabold">
          <span className={`${t.statPill} px-4 py-1 text-sky-600`}>
            ⏱ {log.durationSec < 90 ? `${log.durationSec}s` : `${minutes} min`}
          </span>
          <span className={`${t.statPill} px-4 py-1 text-emerald-600`}>
            {estimated ? '≈ ' : ''}
            {log.wcpm} words/min{' '}
            <span className="font-semibold opacity-70">{estimated ? '(estimated)' : '(counted)'}</span>
          </span>
        </div>

        {conquered.length > 0 && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3">
            <div className="text-sm font-extrabold text-emerald-700">🏆 Words you conquered!</div>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {conquered.slice(0, 12).map((w) => (
                <span key={w} className="rounded-full bg-emerald-200 px-3 py-1 text-sm font-bold text-emerald-900">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {log.wordsPracticed.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-3">
            <div className="text-sm font-extrabold text-amber-700">Words we practiced 🌱</div>
            <p className="text-xs font-semibold text-amber-600">
              We&apos;ll warm up with these next time — tap them anytime to hear them.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {log.wordsPracticed.slice(0, 12).map((w) => (
                <span
                  key={w}
                  title={syllableHyphenate(w)}
                  className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-900"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className={`mt-4 text-sm font-bold ${t.sub}`}>
            {estimated ? 'Smooth reading — no words to warm up on! 🎉' : 'Wonderful work today! 🎉'}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onAgain} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
          Read another 📖
        </button>
        <button onClick={onHome} className={`${t.secondaryBtn} px-6 py-4 text-xl`}>
          Back home 🏠
        </button>
      </div>
    </div>
  )
}
