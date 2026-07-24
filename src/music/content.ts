/**
 * Content contract for the elementary listening log.
 *
 * Real curriculum may replace MUSIC_PIECES without changing the player. Media is
 * deliberately optional: this repository ships no copyrighted recordings.
 */
export interface MusicPiece {
  id: string
  title: string
  composer: string
  era: string
  listenFor: string
  media?: {
    kind: 'audio' | 'link'
    url: string
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const requiredText = (row: Record<string, unknown>, key: keyof MusicPiece): string => {
  const value = row[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Music piece "${String(row.id ?? 'unknown')}" needs a non-empty ${key}.`)
  }
  return value.trim()
}

/** Parse and validate a content-bank payload at its loading boundary. */
export function parseMusicPieces(input: unknown): MusicPiece[] {
  if (!Array.isArray(input)) throw new Error('Music content must be an array.')

  const seen = new Set<string>()
  return input.map((value) => {
    if (!isRecord(value)) throw new Error('Each music piece must be an object.')
    const id = requiredText(value, 'id')
    if (seen.has(id)) throw new Error(`Duplicate music piece id: ${id}`)
    seen.add(id)

    let media: MusicPiece['media']
    if (value.media !== undefined) {
      if (!isRecord(value.media)) throw new Error(`Music piece "${id}" has invalid media.`)
      const kind = value.media.kind
      const url = value.media.url
      if ((kind !== 'audio' && kind !== 'link') || typeof url !== 'string' || !url.trim()) {
        throw new Error(`Music piece "${id}" has invalid media.`)
      }
      media = { kind, url: url.trim() }
    }

    return {
      id,
      title: requiredText(value, 'title'),
      composer: requiredText(value, 'composer'),
      era: requiredText(value, 'era'),
      listenFor: requiredText(value, 'listenFor'),
      ...(media ? { media } : {}),
    }
  })
}

/**
 * TODO(music-curriculum): Replace these placeholders with reviewed selections
 * and licensed/public listening URLs or audio supplied by the family.
 */
export const MUSIC_PIECES: MusicPiece[] = parseMusicPieces([
  {
    id: 'placeholder-1',
    title: 'Placeholder listening selection 1',
    composer: 'Composer to be selected',
    era: 'Era to be selected',
    listenFor: 'Listen for a repeating musical idea.',
  },
  {
    id: 'placeholder-2',
    title: 'Placeholder listening selection 2',
    composer: 'Composer to be selected',
    era: 'Era to be selected',
    listenFor: 'Notice when the music grows louder or softer.',
  },
  {
    id: 'placeholder-3',
    title: 'Placeholder listening selection 3',
    composer: 'Composer to be selected',
    era: 'Era to be selected',
    listenFor: 'Listen for changes in speed and mood.',
  },
  {
    id: 'placeholder-4',
    title: 'Placeholder listening selection 4',
    composer: 'Composer to be selected',
    era: 'Era to be selected',
    listenFor: 'Try to name the instrument groups you hear.',
  },
])
