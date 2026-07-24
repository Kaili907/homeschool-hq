import type {
  ISODate,
  MusicListeningEntry,
  MusicProgress,
  MusicNoteState,
  Profile,
} from '../types'

export type NoteLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface TrebleStaffNote {
  id: string
  letter: NoteLetter
  octave: number
  /** Diatonic steps above the treble staff's bottom line (E4). */
  staffStep: number
}

/** Treble-clef staff notes only, bottom line E4 through top line F5. */
export const TREBLE_NOTES: readonly TrebleStaffNote[] = [
  { id: 'E4', letter: 'E', octave: 4, staffStep: 0 },
  { id: 'F4', letter: 'F', octave: 4, staffStep: 1 },
  { id: 'G4', letter: 'G', octave: 4, staffStep: 2 },
  { id: 'A4', letter: 'A', octave: 4, staffStep: 3 },
  { id: 'B4', letter: 'B', octave: 4, staffStep: 4 },
  { id: 'C5', letter: 'C', octave: 5, staffStep: 5 },
  { id: 'D5', letter: 'D', octave: 5, staffStep: 6 },
  { id: 'E5', letter: 'E', octave: 5, staffStep: 7 },
  { id: 'F5', letter: 'F', octave: 5, staffStep: 8 },
] as const

export const NOTE_MASTERY_STREAK = 3
export const STAFF_BOTTOM_Y = 94
export const STAFF_STEP_PX = 6

export function isValidStaffStep(step: number): boolean {
  return Number.isInteger(step) && step >= 0 && step <= 8
}

export function staffY(note: TrebleStaffNote): number {
  if (!isValidStaffStep(note.staffStep)) throw new Error(`Invalid staff step for ${note.id}.`)
  return STAFF_BOTTOM_Y - note.staffStep * STAFF_STEP_PX
}

export interface NoteQuestion {
  note: TrebleStaffNote
  choices: NoteLetter[]
}

export function defaultMusicProgress(): MusicProgress {
  return {
    noteReading: { unlockedIndex: 0, notes: {}, questionsAnswered: 0 },
    listening: {},
  }
}

export function getMusicProgress(profile: Profile): MusicProgress {
  return profile.music ?? defaultMusicProgress()
}

const clampUnlocked = (progress: MusicProgress) =>
  Math.max(0, Math.min(progress.noteReading.unlockedIndex, TREBLE_NOTES.length - 1))

/**
 * Pick from mastered review notes plus the current frontier. The optional picker
 * makes question generation deterministic in tests.
 */
export function createNoteQuestion(
  progress: MusicProgress,
  pick: (length: number) => number = (length) => Math.floor(Math.random() * length),
): NoteQuestion {
  const unlocked = clampUnlocked(progress)
  const pool = TREBLE_NOTES.slice(0, unlocked + 1)
  const note = pool[Math.max(0, Math.min(pool.length - 1, pick(pool.length)))]
  const distractors = TREBLE_NOTES
    .map((candidate) => candidate.letter)
    .filter((letter, index, all) => letter !== note.letter && all.indexOf(letter) === index)
    .slice(0, 3)
  return { note, choices: [note.letter, ...distractors].sort() }
}

export function recordNoteAnswer(
  prev: MusicProgress,
  noteId: string,
  correct: boolean,
  today: ISODate,
): MusicProgress {
  const index = TREBLE_NOTES.findIndex((note) => note.id === noteId)
  if (index < 0 || index > clampUnlocked(prev)) return prev

  const before: MusicNoteState = prev.noteReading.notes[noteId] ?? {
    attempts: 0,
    correct: 0,
    streak: 0,
    mastered: false,
  }
  const streak = correct ? before.streak + 1 : 0
  const mastered = before.mastered || streak >= NOTE_MASTERY_STREAK
  const unlockedIndex =
    mastered && index === clampUnlocked(prev)
      ? Math.min(index + 1, TREBLE_NOTES.length - 1)
      : clampUnlocked(prev)

  return {
    ...prev,
    noteReading: {
      ...prev.noteReading,
      unlockedIndex,
      questionsAnswered: prev.noteReading.questionsAnswered + 1,
      notes: {
        ...prev.noteReading.notes,
        [noteId]: {
          attempts: before.attempts + 1,
          correct: before.correct + (correct ? 1 : 0),
          streak,
          mastered,
          lastSeen: today,
        },
      },
    },
    lastActivityDate: today,
  }
}

export function recordProfileNoteAnswer(
  profile: Profile,
  noteId: string,
  correct: boolean,
  today: ISODate,
): Profile {
  return { ...profile, music: recordNoteAnswer(getMusicProgress(profile), noteId, correct, today) }
}

export function setPieceListened(
  profile: Profile,
  pieceId: string,
  listened: boolean,
  today: ISODate,
): Profile {
  const music = getMusicProgress(profile)
  const before: MusicListeningEntry = music.listening[pieceId] ?? { listened: false, notice: '' }
  return {
    ...profile,
    music: {
      ...music,
      listening: {
        ...music.listening,
        [pieceId]: {
          ...before,
          listened,
          ...(listened ? { listenedAt: today } : { listenedAt: undefined }),
        },
      },
      ...(listened ? { lastActivityDate: today } : {}),
    },
  }
}

export function setPieceNotice(profile: Profile, pieceId: string, notice: string): Profile {
  const music = getMusicProgress(profile)
  const before: MusicListeningEntry = music.listening[pieceId] ?? { listened: false, notice: '' }
  return {
    ...profile,
    music: {
      ...music,
      listening: {
        ...music.listening,
        [pieceId]: { ...before, notice },
      },
    },
  }
}

/**
 * Mission integration seam (intentionally NOT wired into src/missions.ts).
 * A future mission composer can read this result without knowing music internals.
 */
export function musicMissionHook(profile: Profile, today: ISODate) {
  return {
    id: 'music-practice' as const,
    label: 'Music: read notes or listen',
    done: getMusicProgress(profile).lastActivityDate === today,
  }
}
