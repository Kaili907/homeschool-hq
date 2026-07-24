import rawBank from '../curriculum/reading/Reading-Passages-Q1.md?raw'

/**
 * MR reading fluency — passage bank.
 *
 * Content lives as authored markdown in `src/curriculum/reading/` (original,
 * no imported/copyrighted text). This module parses that bank into typed
 * passages the session player and selector consume. The parser is PURE
 * (`parsePassageBank(md)`), so it is unit-tested directly and the count/word
 * checks in `passages.test.ts` guard the delivered content.
 *
 * Bank format (one section per passage):
 *
 *   ## <id> · <Title>
 *   grade: <3|4|6>
 *   words: <exact body word count>
 *
 *   <body paragraph one>
 *
 *   <body paragraph two>
 */

export type ReadingGrade = '3' | '4' | '6'

export interface Passage {
  id: string
  grade: ReadingGrade
  title: string
  /** body split into paragraphs (blank-line separated), for clean display. */
  paragraphs: string[]
  /** whole body as one string, paragraphs joined by a blank line. */
  text: string
  /** number of whitespace-separated words in the body. */
  wordCount: number
}

const HEADING = /^##\s+(\S+)\s+·\s+(.+?)\s*$/
const GRADE_LINE = /^grade:\s*([346])\s*$/
const WORDS_LINE = /^words:\s*(\d+)\s*$/

function countWords(body: string): number {
  const t = body.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/** Parse the passage-bank markdown. Throws on structural problems so the build/tests catch bad content. */
export function parsePassageBank(md: string): Passage[] {
  const lines = md.split(/\r?\n/)
  const passages: Passage[] = []

  let i = 0
  while (i < lines.length) {
    const h = HEADING.exec(lines[i])
    if (!h) {
      i++
      continue
    }
    const id = h[1]
    const title = h[2]

    const gradePrefix = /^g([346])-\d{2}$/.exec(id)
    if (!gradePrefix) throw new Error(`passage "${id}": id must look like g3-01 / g4-08 / g6-12`)

    // The next two non-blank lines must be grade: and words: (in that order).
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const gm = GRADE_LINE.exec(lines[j] ?? '')
    if (!gm) throw new Error(`passage "${id}": expected a "grade: N" line`)
    j++
    const wm = WORDS_LINE.exec(lines[j] ?? '')
    if (!wm) throw new Error(`passage "${id}": expected a "words: N" line`)
    j++

    if (gm[1] !== gradePrefix[1]) {
      throw new Error(`passage "${id}": grade ${gm[1]} does not match id prefix g${gradePrefix[1]}`)
    }

    // Body runs until the next heading (or EOF).
    const bodyLines: string[] = []
    while (j < lines.length && !HEADING.test(lines[j])) {
      bodyLines.push(lines[j])
      j++
    }
    const body = bodyLines.join('\n').trim()
    if (body === '') throw new Error(`passage "${id}": empty body`)

    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter((p) => p.length > 0)

    const declaredWords = Number(wm[1])
    const wordCount = countWords(body)
    if (wordCount !== declaredWords) {
      throw new Error(
        `passage "${id}": declared words: ${declaredWords} but body has ${wordCount} words`,
      )
    }

    passages.push({
      id,
      grade: gm[1] as ReadingGrade,
      title,
      paragraphs,
      text: paragraphs.join('\n\n'),
      wordCount,
    })

    i = j
  }

  return passages
}

/** The parsed Q1 bank. */
export const PASSAGES: Passage[] = parsePassageBank(rawBank)

export function passagesForGrade(grade: ReadingGrade): Passage[] {
  return PASSAGES.filter((p) => p.grade === grade)
}

export function passageById(id: string): Passage | undefined {
  return PASSAGES.find((p) => p.id === id)
}
