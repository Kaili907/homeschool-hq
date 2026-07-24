import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import { MUSIC_PIECES, parseMusicPieces } from './content'
import {
  NOTE_MASTERY_STREAK,
  TREBLE_NOTES,
  createNoteQuestion,
  defaultMusicProgress,
  musicMissionHook,
  recordNoteAnswer,
  staffY,
} from './engine'

const TODAY = '2026-07-24'

describe('treble note generation', () => {
  it('maps every bank note to a valid line or space within the five-line staff', () => {
    expect(TREBLE_NOTES).toHaveLength(9)
    for (const note of TREBLE_NOTES) {
      expect(Number.isInteger(note.staffStep)).toBe(true)
      expect(note.staffStep).toBeGreaterThanOrEqual(0)
      expect(note.staffStep).toBeLessThanOrEqual(8)
      expect(staffY(note)).toBeGreaterThanOrEqual(46)
      expect(staffY(note)).toBeLessThanOrEqual(94)
    }
  })

  it('generates four unique choices including the displayed note', () => {
    const question = createNoteQuestion(defaultMusicProgress(), () => 0)
    expect(question.note.id).toBe('E4')
    expect(question.choices).toHaveLength(4)
    expect(new Set(question.choices).size).toBe(4)
    expect(question.choices).toContain(question.note.letter)
  })
})

describe('note mastery', () => {
  it('advances after three consecutive correct answers on the frontier note', () => {
    let progress = defaultMusicProgress()
    for (let i = 0; i < NOTE_MASTERY_STREAK; i++) {
      progress = recordNoteAnswer(progress, 'E4', true, TODAY)
    }
    expect(progress.noteReading.notes.E4.mastered).toBe(true)
    expect(progress.noteReading.unlockedIndex).toBe(1)
    expect(progress.noteReading.questionsAnswered).toBe(NOTE_MASTERY_STREAK)
  })

  it('a miss resets the streak without removing earned mastery', () => {
    let progress = defaultMusicProgress()
    for (let i = 0; i < NOTE_MASTERY_STREAK; i++) {
      progress = recordNoteAnswer(progress, 'E4', true, TODAY)
    }
    progress = recordNoteAnswer(progress, 'E4', false, TODAY)
    expect(progress.noteReading.notes.E4.streak).toBe(0)
    expect(progress.noteReading.notes.E4.mastered).toBe(true)
  })

  it('exposes an unwired daily mission status from music progress', () => {
    const profile = emptyProfile('p1', 'Test Kid', '3')
    expect(musicMissionHook(profile, TODAY).done).toBe(false)
    const music = recordNoteAnswer(defaultMusicProgress(), 'E4', true, TODAY)
    expect(musicMissionHook({ ...profile, music }, TODAY).done).toBe(true)
  })
})

describe('listening content contract', () => {
  it('parses the placeholder bank through the documented interface', () => {
    expect(MUSIC_PIECES).toHaveLength(4)
    for (const piece of MUSIC_PIECES) {
      expect(piece.id).toMatch(/^placeholder-/)
      expect(piece.title.length).toBeGreaterThan(0)
      expect(piece.composer.length).toBeGreaterThan(0)
      expect(piece.era.length).toBeGreaterThan(0)
      expect(piece.listenFor.length).toBeGreaterThan(0)
      expect(piece.media).toBeUndefined()
    }
  })

  it('accepts optional supplied media and rejects incomplete or duplicate content', () => {
    const parsed = parseMusicPieces([
      {
        id: 'future-piece',
        title: 'Future selection',
        composer: 'Future composer',
        era: 'Future era',
        listenFor: 'Future listening prompt',
        media: { kind: 'link', url: 'https://example.test/listen' },
      },
    ])
    expect(parsed[0].media?.kind).toBe('link')
    expect(() => parseMusicPieces([{ id: 'broken' }])).toThrow(/title/)
    expect(() =>
      parseMusicPieces([
        { id: 'same', title: 'A', composer: 'B', era: 'C', listenFor: 'D' },
        { id: 'same', title: 'E', composer: 'F', era: 'G', listenFor: 'H' },
      ]),
    ).toThrow(/Duplicate/)
  })
})
