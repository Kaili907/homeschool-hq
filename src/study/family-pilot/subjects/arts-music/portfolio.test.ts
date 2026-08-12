import { describe, expect, it } from 'vitest'
import { getArtsMusicAssessmentForUnit } from './catalog'
import {
  ARTS_MUSIC_PRESENTATION_MODES,
  artsMusicPresentationModeLabel,
  createArtsMusicPortfolioSubmission,
  DEFAULT_ARTS_MUSIC_PRESENTATION_MODE,
  portfolioTaskForUnit,
} from './portfolio'
import { loadArtsMusicCatalog } from './source.node'

const NOW = '2026-08-12T00:00:00.000Z'

describe('ARTS-MUSIC-1 portfolio task support', () => {
  const catalog = loadArtsMusicCatalog()

  it('every unit in the real catalog produces a non-empty portfolio task with rubric dimensions', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        const assessment = getArtsMusicAssessmentForUnit(catalog, unit.unitId)
        const task = portfolioTaskForUnit(unit, assessment?.rubricDimensions ?? [])
        expect(task.performanceTask.length).toBeGreaterThan(0)
        expect(task.rubricDimensions.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('ARTS-MUSIC-1 private-sharing path', () => {
  it('every available presentation mode is private — no public/broadcast mode exists', () => {
    expect(ARTS_MUSIC_PRESENTATION_MODES.length).toBeGreaterThan(0)
    for (const mode of ARTS_MUSIC_PRESENTATION_MODES) {
      expect(mode).not.toMatch(/public|broadcast|share.*everyone|upload.*social/i)
      expect(artsMusicPresentationModeLabel(mode).length).toBeGreaterThan(0)
    }
  })

  it('a submission is accepted for each private presentation mode', () => {
    for (const mode of ARTS_MUSIC_PRESENTATION_MODES) {
      const result = createArtsMusicPortfolioSubmission({
        unitId: 'ma-g5-arts-and-music-u01', presentationMode: mode,
        artifactRef: null, completedAt: NOW, parentConfirmed: true,
      })
      expect(result.status).toBe('accepted')
    }
  })
})

describe('ARTS-MUSIC-1 no-audio path', () => {
  it('the default mode is a written description — no audio production or narration required', () => {
    expect(DEFAULT_ARTS_MUSIC_PRESENTATION_MODE).toBe('written-description')
    expect(artsMusicPresentationModeLabel('written-description')).not.toMatch(/record|audio|voice/i)
  })

  it('no presentation mode label requires the learner to produce a voice recording', () => {
    for (const mode of ARTS_MUSIC_PRESENTATION_MODES) {
      expect(artsMusicPresentationModeLabel(mode)).not.toMatch(/voice recording|record.*audio/i)
    }
  })
})

describe('ARTS-MUSIC-1 no-camera path', () => {
  it('a submission with no artifact at all (no photo, no video) is a complete, valid submission', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'private-demonstration',
      artifactRef: null, completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('accepted')
    if (result.status === 'accepted') expect(result.submission.artifactRef).toBeNull()
  })

  it('no presentation mode label requires a photograph or video', () => {
    for (const mode of ARTS_MUSIC_PRESENTATION_MODES) {
      expect(artsMusicPresentationModeLabel(mode)).not.toMatch(/photo|video|camera/i)
    }
  })
})

describe('ARTS-MUSIC-1 no raw learner artifact persistence', () => {
  it('rejects an artifactRef that looks like inline free-text content rather than a reference', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'written-description',
      artifactRef: 'Here is my full essay about line and shape: once upon a time...',
      completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') expect(result.reason).toBe('invalid-artifact-ref')
  })

  it('rejects an artifactRef that exceeds the opaque-reference length bound', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'written-description',
      artifactRef: 'a'.repeat(500), completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') expect(result.reason).toBe('artifact-ref-too-long')
  })

  it('accepts a well-formed opaque artifactRef', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'written-description',
      artifactRef: 'family-storage:photo:8f2c1a', completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('accepted')
  })

  it('the submission type never carries a raw content field — only refs and metadata', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'written-description',
      artifactRef: 'family-storage:photo:8f2c1a', completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('accepted')
    if (result.status === 'accepted') {
      expect(Object.keys(result.submission).sort()).toEqual(
        ['artifactRef', 'completedAt', 'parentConfirmed', 'presentationMode', 'unitId'].sort(),
      )
    }
  })
})

describe('ARTS-MUSIC-1 tutor/completion authority boundaries', () => {
  it('rejects an unsupported presentation mode instead of guessing', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'public-livestream' as never,
      artifactRef: null, completedAt: NOW, parentConfirmed: true,
    })
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') expect(result.reason).toBe('unsupported-presentation-mode')
  })

  it('requires parent/teacher confirmation before a submission is accepted as complete', () => {
    const result = createArtsMusicPortfolioSubmission({
      unitId: 'ma-g5-arts-and-music-u01', presentationMode: 'written-description',
      artifactRef: null, completedAt: NOW, parentConfirmed: false,
    })
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') expect(result.reason).toBe('parent-confirmation-required')
  })
})
