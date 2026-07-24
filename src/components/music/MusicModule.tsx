import { useEffect, useState } from 'react'
import { isoToday } from '../../appState'
import { MUSIC_PIECES } from '../../music/content'
import {
  createNoteQuestion,
  getMusicProgress,
  recordProfileNoteAnswer,
  setPieceListened,
  setPieceNotice,
  staffY,
  TREBLE_NOTES,
  type NoteLetter,
  type NoteQuestion,
} from '../../music/engine'
import { useTheme } from '../../theme'
import { cancelSpeech, speak } from '../../tutor/voice'
import type { Profile } from '../../types'

interface MusicModuleProps {
  profile: Profile
  muted: boolean
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onExit: () => void
}

type Activity = 'menu' | 'notes' | 'listening'

export function MusicModule({
  profile,
  muted,
  onProfileChange,
  onExit,
}: MusicModuleProps) {
  const t = useTheme()
  const progress = getMusicProgress(profile)
  const [activity, setActivity] = useState<Activity>('menu')
  const [question, setQuestion] = useState<NoteQuestion>(() => createNoteQuestion(progress))
  const [answer, setAnswer] = useState<NoteLetter | null>(null)

  useEffect(() => () => cancelSpeech(), [])

  const nextQuestion = () => {
    setQuestion(createNoteQuestion(getMusicProgress(profile)))
    setAnswer(null)
  }

  const chooseAnswer = (choice: NoteLetter) => {
    if (answer !== null) return
    const correct = choice === question.note.letter
    setAnswer(choice)
    onProfileChange((prev) =>
      recordProfileNoteAnswer(prev, question.note.id, correct, isoToday()),
    )
    if (!muted) {
      speak(correct ? `Yes. This note is ${question.note.letter}.` : `This note is ${question.note.letter}.`)
    }
  }

  if (activity === 'notes') {
    const currentState = progress.noteReading.notes[question.note.id]
    const masteredCount = TREBLE_NOTES.filter(
      (note) => progress.noteReading.notes[note.id]?.mastered,
    ).length
    const correct = answer === question.note.letter
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <ModuleHeader title="Note reading" onBack={() => setActivity('menu')} />
        <div className={`${t.card} p-5 text-center`}>
          <p className={`${t.sub} text-sm font-bold`}>
            Treble clef · {masteredCount}/{TREBLE_NOTES.length} notes mastered
          </p>
          <p className={`${t.heading} mt-2 text-xl font-extrabold`}>What note is this?</p>
          <Staff note={question.note} />
          <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3">
            {question.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={answer !== null}
                onClick={() => chooseAnswer(choice)}
                className={`${t.secondaryBtn} min-h-14 px-5 py-3 text-xl font-extrabold disabled:cursor-default ${
                  answer !== null && choice === question.note.letter ? 'ring-4 ring-emerald-400' : ''
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div className="mt-5" aria-live="polite">
              <p className={`font-extrabold ${correct ? 'text-emerald-700' : 'text-amber-700'}`}>
                {correct
                  ? `Correct — ${question.note.letter}!`
                  : `Good try. That note is ${question.note.letter}.`}
              </p>
              <p className={`${t.sub} mt-1 text-sm`}>
                {currentState?.mastered
                  ? 'Mastered!'
                  : 'Three correct in a row masters each note.'}
              </p>
              <button type="button" onClick={nextQuestion} className={`${t.primaryBtn} mt-4 px-6 py-3`}>
                Next note
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (activity === 'listening') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <ModuleHeader title="Listening log" onBack={() => setActivity('menu')} />
        <p className={`${t.sub} mb-4 text-sm`}>
          These selections are placeholders. Recordings and final curriculum links will be added later.
        </p>
        <div className="space-y-4">
          {MUSIC_PIECES.map((piece) => {
            const entry = progress.listening[piece.id] ?? { listened: false, notice: '' }
            return (
              <article key={piece.id} className={`${t.card} p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className={`${t.heading} text-lg font-extrabold`}>{piece.title}</h2>
                    <p className={`${t.sub} text-sm`}>
                      {piece.composer} · {piece.era}
                    </p>
                  </div>
                  <label className={`${t.sub} flex items-center gap-2 text-sm font-bold`}>
                    <input
                      type="checkbox"
                      checked={entry.listened}
                      onChange={(event) =>
                        onProfileChange((prev) =>
                          setPieceListened(prev, piece.id, event.target.checked, isoToday()),
                        )
                      }
                      className="h-5 w-5"
                    />
                    Listened
                  </label>
                </div>
                <p className={`${t.sub} mt-3 text-sm`}>
                  <span className={`${t.heading} font-bold`}>What to listen for:</span>{' '}
                  {piece.listenFor}
                </p>
                {piece.media?.kind === 'audio' ? (
                  <audio className="mt-3 w-full" controls src={piece.media.url}>
                    Your browser does not support audio playback.
                  </audio>
                ) : piece.media?.kind === 'link' ? (
                  <a
                    className="mt-3 inline-block font-bold text-sky-700 underline"
                    href={piece.media.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open listening source
                  </a>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Listening source to be supplied with real curriculum content.
                  </p>
                )}
                <label className={`${t.heading} mt-4 block text-sm font-bold`}>
                  What did you notice?
                  <textarea
                    value={entry.notice}
                    onChange={(event) => {
                      const notice = event.target.value
                      onProfileChange((prev) => setPieceNotice(prev, piece.id, notice))
                    }}
                    placeholder="Write anything you heard or felt. This is not graded."
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal text-slate-900"
                  />
                </label>
              </article>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <ModuleHeader title="Music" onBack={onExit} />
      <p className={`${t.sub} mb-5`}>Practice reading notes, then keep a no-pressure listening log.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setQuestion(createNoteQuestion(progress))
            setAnswer(null)
            setActivity('notes')
          }}
          className={`${t.card} p-6 text-left transition-transform hover:scale-[1.01]`}
        >
          <span className="text-4xl" aria-hidden="true">🎼</span>
          <span className={`${t.heading} mt-3 block text-xl font-extrabold`}>Note reading</span>
          <span className={`${t.sub} mt-1 block text-sm`}>Name notes on a generated treble staff.</span>
        </button>
        <button
          type="button"
          onClick={() => setActivity('listening')}
          className={`${t.card} p-6 text-left transition-transform hover:scale-[1.01]`}
        >
          <span className="text-4xl" aria-hidden="true">🎧</span>
          <span className={`${t.heading} mt-3 block text-xl font-extrabold`}>Listening log</span>
          <span className={`${t.sub} mt-1 block text-sm`}>Listen, check it off, and notice what stands out.</span>
        </button>
      </div>
    </div>
  )
}

function ModuleHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme()
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <h1 className={`${t.heading} text-2xl font-extrabold`}>{title}</h1>
      <button type="button" onClick={onBack} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
        Back
      </button>
    </header>
  )
}

function Staff({ note }: { note: NoteQuestion['note'] }) {
  const lines = [46, 58, 70, 82, 94]
  const y = staffY(note)
  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="A note drawn on a five-line treble staff"
      className="mx-auto mt-4 w-full max-w-lg rounded-xl bg-amber-50"
    >
      {lines.map((lineY) => (
        <line key={lineY} x1="42" x2="288" y1={lineY} y2={lineY} stroke="#334155" strokeWidth="2" />
      ))}
      <text x="48" y="105" fontSize="74" fill="#334155" aria-hidden="true">𝄞</text>
      <ellipse cx="184" cy={y} rx="12" ry="8" fill="#0f172a" transform={`rotate(-18 184 ${y})`} />
      <line x1="194" x2="194" y1={y} y2={Math.max(30, y - 42)} stroke="#0f172a" strokeWidth="3" />
    </svg>
  )
}
