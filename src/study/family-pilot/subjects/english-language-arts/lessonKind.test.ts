import { describe, expect, it } from 'vitest'
import { classifyElaLessonKind, ElaPhaseError } from './lessonKind'

const READING_PHASES = [
  'Launch and diagnostic',
  'Concept model A',
  'Guided practice A',
  'Independent application A',
  'Investigation or close reading',
  'Reteach and varied practice',
  'Discussion or problem seminar',
  'Skill consolidation',
  'Transfer challenge',
  'Assessment preparation',
  'Unit assessment',
]

const WRITING_PHASES = [
  'Concept model B',
  'Guided practice B',
  'Concept model C',
  'Performance task planning',
  'Performance task build',
  'Targeted correction',
  'Publication, presentation, or reflection',
]

describe('classifyElaLessonKind', () => {
  it('classifies every reading-arc phase as reading', () => {
    for (const phase of READING_PHASES) expect(classifyElaLessonKind(phase)).toBe('reading')
  })

  it('classifies every writing-arc phase as writing', () => {
    for (const phase of WRITING_PHASES) expect(classifyElaLessonKind(phase)).toBe('writing')
  })

  it('covers every phase used across curriculum-content with no gaps', () => {
    expect(READING_PHASES.length + WRITING_PHASES.length).toBe(18)
  })

  it('fails closed on an unrecognized phase instead of guessing', () => {
    expect(() => classifyElaLessonKind('Not a real phase')).toThrow(ElaPhaseError)
  })
})
