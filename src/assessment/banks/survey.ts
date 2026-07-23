import type { FixedTest } from '../types'

// Transcribed VERBATIM from HS-English-Reading-Placement.md, Part 4 (5 free-text
// items). Ungraded — "honest answers only".

export const HS_READING_SURVEY: FixedTest = {
  id: 'hs-reading-survey',
  title: 'Reading Habits Survey',
  forGrades: ['10', '12'],
  ungraded: true,
  intro:
    "This isn't graded — it's how Dad builds a book list you'll actually want to read. Honest " +
    'answers only.',
  sections: [
    {
      name: 'Reading Habits Survey',
      items: [
        { id: 's1', kind: 'text', prompt: 'Last book you finished, and roughly when?' },
        { id: 's2', kind: 'text', prompt: 'What do you actually read most days (books, fanfic, articles, nothing, other)?' },
        { id: 's3', kind: 'text', prompt: 'A book you loved, ever — and why?' },
        { id: 's4', kind: 'text', prompt: 'Minutes per day you\'d guess you read anything longer than a text message?' },
        { id: 's5', kind: 'text', prompt: 'If you could pick the novels for your own English class, name one or two you\'d actually want to read.' },
      ],
    },
  ],
}
