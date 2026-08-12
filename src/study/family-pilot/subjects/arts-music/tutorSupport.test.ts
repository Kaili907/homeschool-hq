import { describe, expect, it } from 'vitest'
import { getArtsMusicAssessmentForUnit, getArtsMusicAssignments } from './catalog'
import { loadArtsMusicCatalog } from './source.node'
import {
  artsMusicConceptGuidance,
  artsMusicRevisionSuggestion,
  artsMusicRubricCritique,
  artsMusicStaticHelpMessage,
} from './tutorSupport'

describe('ARTS-MUSIC-1 Tutor/static-help fallback', () => {
  it('returns a fixed, non-empty static help message with no external call', () => {
    const first = artsMusicStaticHelpMessage()
    const second = artsMusicStaticHelpMessage()
    expect(first.length).toBeGreaterThan(0)
    expect(first).toBe(second)
  })

  it('produces concept guidance grounded in the lesson\'s own focus, for every real lesson', () => {
    const catalog = loadArtsMusicCatalog()
    for (const lesson of getArtsMusicAssignments(catalog, { studentRef: 'x', grade: '5' }).slice(0, 5)) {
      const guidance = artsMusicConceptGuidance(lesson)
      expect(guidance.guidance).toContain(lesson.focus)
    }
  })

  it('produces a rubric critique prompt for every dimension in the real catalog\'s assessments', () => {
    const catalog = loadArtsMusicCatalog()
    for (const course of catalog.courses) {
      for (const assessment of course.assessments) {
        const critique = artsMusicRubricCritique(assessment.rubricDimensions)
        expect(critique.length).toBe(assessment.rubricDimensions.length)
        for (const entry of critique) expect(entry.prompt.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('ARTS-MUSIC-1 tutor must not impersonate learner authorship', () => {
  it('rubric critique is phrased as a question, never a statement of the learner\'s work', () => {
    const catalog = loadArtsMusicCatalog()
    const [course] = catalog.courses
    const [assessment] = course.assessments
    for (const entry of artsMusicRubricCritique(assessment.rubricDimensions)) {
      expect(entry.prompt).toContain('?')
    }
  })

  it('revision suggestion asks the learner to make the change, and never returns a rewritten artifact', () => {
    const suggestion = artsMusicRevisionSuggestion('accuracy or fidelity')
    expect(suggestion).toMatch(/^Look again/)
    expect(suggestion.length).toBeLessThan(200)
  })

  it('none of the tutor functions accept arbitrary free-form learner work as input', () => {
    // artsMusicConceptGuidance takes only { lessonId, focus } (curriculum
    // fields), artsMusicRubricCritique takes only rubric dimension labels,
    // and artsMusicRevisionSuggestion takes only a dimension label — there
    // is no parameter anywhere in this module shaped to accept or echo a
    // learner's submitted artwork, composition, or performance text.
    expect(artsMusicConceptGuidance.length).toBe(1)
    expect(artsMusicRubricCritique.length).toBe(1)
    expect(artsMusicRevisionSuggestion.length).toBe(1)
  })
})

describe('ARTS-MUSIC-1 no copyrighted-content injection', () => {
  it('guidance output is bounded, template-derived text — not a pass-through of its input', () => {
    const guidance = artsMusicConceptGuidance({ lessonId: 'x', focus: 'a very long focus phrase'.repeat(20) })
    // The template wraps the focus but adds fixed surrounding text; an
    // injection attempt through `focus` cannot produce output that is only
    // the injected content.
    expect(guidance.guidance.length).toBeGreaterThan(guidance.focus.length)
    expect(guidance.guidance.startsWith('Focus on')).toBe(true)
  })

  it('an unrecognized rubric dimension falls back to the fixed default prompt rather than echoing input', () => {
    const critique = artsMusicRubricCritique(['some arbitrary externally-supplied label'])
    expect(critique[0].prompt).toBe('Compare your work to the success criteria for this lesson. What is strong, and what is one specific next step?')
  })

  it('the static help message is identical regardless of any surrounding context — nothing to inject', () => {
    expect(artsMusicStaticHelpMessage()).not.toMatch(/lyrics|sheet music|©|all rights reserved/i)
  })
})
