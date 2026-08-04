import { useCallback, useState } from 'react'
import type { AnswerRecord, Profile, Question } from '../../types'
import { QuizSession } from '../QuizSession'
import { useTheme } from '../../theme'
import { encodeVoiceRef, speak } from '../../tutor/voice'
import { defaultRate, resolveSlotRef } from '../../tutor/tutorState'
import { ALL_HIRAGANA, HIRAGANA_GROUPS, JAPANESE_VOCAB } from '../../japanese/content'
import {
  JAPANESE_QUIZ_TOTAL,
  currentGroup,
  getJapaneseState,
  ladderComplete,
  makeJapaneseQuestion,
  targetForQuestion,
  unlockedCharacters,
  type JapaneseQuizMode,
} from '../../japanese/engine'
import {
  recordJapaneseAnswer,
  recordJapaneseSession,
} from '../../japanese/japaneseState'

type TrainerView = 'menu' | JapaneseQuizMode | 'vocab'

export interface HiraganaTrainerProps {
  profile: Profile
  muted: boolean
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onExit: () => void
}

export function HiraganaTrainer({
  profile,
  muted,
  onProfileChange,
  onExit,
}: HiraganaTrainerProps) {
  const t = useTheme()
  const [view, setView] = useState<TrainerView>('menu')
  const state = getJapaneseState(profile)
  const group = currentGroup(state)
  const mastered = Object.values(state.characters).filter((c) => c.mastered).length
  const complete = ladderComplete(state)
  const voiceURI = encodeVoiceRef(resolveSlotRef(profile, 'japanese'))
  const rate = defaultRate(profile.grade)

  const pronounce = useCallback(
    (text: string) => {
      if (!muted) speak(text, { voiceURI, rate })
    },
    [muted, rate, voiceURI],
  )

  if (view === 'character-to-sound' || view === 'sound-to-character') {
    const mode = view
    const getQuestion = (index: number, _history: AnswerRecord[]): Question => {
      const latest = getJapaneseState(profile)
      const frontier = currentGroup(latest).characters
      const target = frontier[index % frontier.length]
      return makeJapaneseQuestion(target, mode, unlockedCharacters(latest))
    }
    return (
      <QuizSession
        title={mode === 'character-to-sound' ? 'Hiragana Sounds' : 'Listen & Choose'}
        emoji="あ"
        total={JAPANESE_QUIZ_TOTAL}
        getQuestion={getQuestion}
        onQuestion={
          mode === 'sound-to-character'
            ? (question) => {
                const target = targetForQuestion(question, mode)
                if (target) pronounce(target.kana)
              }
            : undefined
        }
        onAnswer={(question, correct) => {
          const target = targetForQuestion(question, mode)
          if (target) onProfileChange((prev) => recordJapaneseAnswer(prev, target.id, correct))
        }}
        onFinish={() => {
          onProfileChange(recordJapaneseSession)
          setView('menu')
        }}
        onQuit={() => setView('menu')}
      />
    )
  }

  if (view === 'vocab') {
    return (
      <VocabFlashcards
        profile={profile}
        pronounce={pronounce}
        onProfileChange={onProfileChange}
        onBack={() => setView('menu')}
      />
    )
  }

  const playful = t.id === 'playful'
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className={`${t.heading} text-3xl font-extrabold`}>
            {playful ? '🌸 ' : ''}Hiragana
          </h1>
          <p className={`${t.sub} mt-1 font-semibold`}>
            {complete ? 'All kana mastered.' : `Learning now: ${group.label}`}
          </p>
        </div>
        <button type="button" onClick={onExit} className={`${t.secondaryBtn} px-4 py-2`}>
          Back home
        </button>
      </div>

      <div className={`${t.card} mb-5 p-5`}>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
          <span className={t.heading}>{mastered} / {ALL_HIRAGANA.length} mastered</span>
          <span className={t.sub}>3 in a row earns mastery</span>
        </div>
        <div className={`h-3 overflow-hidden rounded-full ${t.progressTrack}`}>
          <div
            className={`h-full rounded-full ${t.progressFill} transition-all`}
            style={{ width: `${Math.round((mastered / ALL_HIRAGANA.length) * 100)}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {HIRAGANA_GROUPS.map((item, index) => {
            const unlocked = index <= state.unlockedGroupIndex
            const done = item.characters.every((c) => state.characters[c.id]?.mastered)
            return (
              <span
                key={item.id}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  done
                    ? 'bg-emerald-100 text-emerald-700'
                    : unlocked
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? '✓ ' : unlocked ? '' : '🔒 '}
                {item.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ModeButton
          title="Character → sound"
          detail="See あ, choose “a”"
          icon="👀"
          playful={playful}
          onClick={() => setView('character-to-sound')}
        />
        <ModeButton
          title="Sound → character"
          detail="Hear the Japanese voice, choose あ"
          icon="🔊"
          playful={playful}
          onClick={() => setView('sound-to-character')}
        />
        <ModeButton
          title="Vocab cards"
          detail="Flip useful Japanese words"
          icon="🗂️"
          playful={playful}
          onClick={() => setView('vocab')}
        />
      </div>

      <p className={`${t.sub} mt-5 text-center text-xs`}>
        Mission hook: Japanese stays a Home activity only; mission auto-wiring is intentionally deferred.
      </p>
    </div>
  )
}

function ModeButton({
  title,
  detail,
  icon,
  playful,
  onClick,
}: {
  title: string
  detail: string
  icon: string
  playful: boolean
  onClick: () => void
}) {
  const t = useTheme()
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        playful
          ? 'rounded-3xl border-b-8 border-fuchsia-700 bg-gradient-to-br from-pink-400 to-fuchsia-600 p-5 text-left text-white shadow-xl transition-transform hover:scale-[1.02] active:translate-y-1 active:border-b-4'
          : `${t.card} p-5 text-left transition-colors hover:border-cyan-400`
      }
    >
      <span className="text-4xl">{icon}</span>
      <span className={`mt-3 block text-lg font-extrabold ${playful ? 'text-white' : t.heading}`}>
        {title}
      </span>
      <span className={`mt-1 block text-sm font-semibold ${playful ? 'text-pink-100' : t.sub}`}>
        {detail}
      </span>
    </button>
  )
}

function VocabFlashcards({
  profile,
  pronounce,
  onProfileChange,
  onBack,
}: {
  profile: Profile
  pronounce: (text: string) => void
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onBack: () => void
}) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const card = JAPANESE_VOCAB[index]

  const next = (correct: boolean) => {
    onProfileChange((prev) => recordJapaneseAnswer(prev, card.focusId, correct))
    setRevealed(false)
    setIndex((i) => (i + 1) % JAPANESE_VOCAB.length)
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className={`${t.heading} text-2xl font-extrabold`}>Vocab flashcards</h1>
          <p className={`${t.sub} text-sm`}>{index + 1} / {JAPANESE_VOCAB.length}</p>
        </div>
        <button type="button" onClick={onBack} className={`${t.secondaryBtn} px-4 py-2`}>
          Back
        </button>
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={`${t.card} min-h-72 w-full p-8 text-center`}
        aria-label={revealed ? `${card.romaji}, ${card.meaning}` : 'Reveal vocabulary card'}
      >
        <div className="text-5xl">{card.emoji}</div>
        <div className={`${t.heading} mt-5 text-6xl font-extrabold`}>{card.kana}</div>
        {revealed ? (
          <div className="mt-5">
            <div className={`${t.heading} text-2xl font-bold`}>{card.romaji}</div>
            <div className={`${t.sub} mt-1 text-xl font-semibold`}>{card.meaning}</div>
          </div>
        ) : (
          <div className={`${t.sub} mt-6 font-semibold`}>Tap to flip</div>
        )}
      </button>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => pronounce(card.kana)}
          className={`${t.secondaryBtn} px-5 py-3 font-bold`}
        >
          🔊 Hear it
        </button>
      </div>

      {revealed && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => next(false)} className={`${t.secondaryBtn} px-4 py-4 font-bold`}>
            Practice again
          </button>
          <button type="button" onClick={() => next(true)} className={`${t.primaryBtn} px-4 py-4 font-bold`}>
            Got it ✓
          </button>
        </div>
      )}

      <p className={`${t.sub} mt-4 text-center text-xs`}>
        Progress saves to {profile.name}&apos;s character mastery.
      </p>
    </div>
  )
}
