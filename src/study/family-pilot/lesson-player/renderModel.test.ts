import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  RICH_MATH_LESSON_FIXTURE,
  RICH_PE_ACTIVITY_LESSON_FIXTURE,
  RICH_SCIENCE_DATA_LESSON_FIXTURE,
  RICH_SOCIAL_STUDIES_MAP_LESSON_FIXTURE,
  type LearnerMaterialDto,
} from '../final-app/learner-response'
import { classifyRichLessonSection, createRichLessonRenderModel } from './renderModel'
import { RICH_STUDY_SUBJECT_ADAPTERS, richLessonSubjectAdapter } from './subjectAdapters'

describe('subject-neutral rich Study render model', () => {
  it('projects deep math instruction without adding response or scoring authority', () => {
    const model = createRichLessonRenderModel(RICH_MATH_LESSON_FIXTURE)
    expect(model.mode).toBe('rich')
    expect(model.subject).toMatchObject({ label: 'Mathematics', shortLabel: 'Math' })
    expect(new Set(model.pages.map((page) => page.kind))).toEqual(new Set([
      'lesson-goal', 'teaching', 'vocabulary', 'worked-example', 'guided-practice',
      'independent-practice', 'remediation', 'challenge', 'mastery-check', 'reflection',
    ]))
    expect(model.pages.find((page) => page.kind === 'worked-example')?.item?.responseType).toBe('READ')
    expect(model.pages.find((page) => page.kind === 'guided-practice')?.item?.responseType).toBe('NUMERIC')
    expect(model.pages.find((page) => page.kind === 'mastery-check')?.item?.evidenceMode).toBe('MASTERY')
    expect(model.pages.every((page) => /^lesson-cursor:(?:learn|practice|reflect):\d+$/.test(page.progressRef))).toBe(true)
    expect(new Set(model.pages.map((page) => page.progressRef)).size).toBe(model.pages.length)
  })

  it('uses the same projection for science data, social-studies maps, and PE safety/activity evidence', () => {
    const science = createRichLessonRenderModel(RICH_SCIENCE_DATA_LESSON_FIXTURE)
    const social = createRichLessonRenderModel(RICH_SOCIAL_STUDIES_MAP_LESSON_FIXTURE)
    const pe = createRichLessonRenderModel(RICH_PE_ACTIVITY_LESSON_FIXTURE)
    expect(science.pages.map((page) => page.kind)).toEqual(expect.arrayContaining(['lesson-goal', 'materials-safety', 'source', 'data', 'guided-practice', 'reflection']))
    expect(social.pages.map((page) => page.kind)).toEqual(expect.arrayContaining(['lesson-goal', 'map', 'source', 'independent-practice']))
    expect(pe.pages.map((page) => page.kind)).toEqual(expect.arrayContaining(['materials-safety', 'guided-practice', 'independent-practice', 'reflection']))
    expect(pe.pages.find((page) => page.item?.responseType === 'ACTIVITY_EVIDENCE')).toBeDefined()
  })

  it('filters browser answer/scoring keys out of source and reference blocks', () => {
    const model = createRichLessonRenderModel(RICH_SOCIAL_STUDIES_MAP_LESSON_FIXTURE)
    const serialized = JSON.stringify(model)
    expect(serialized).not.toContain('must never render')
    expect(serialized).not.toMatch(/answerKey|scoring/i)
    expect(serialized).toContain('Learner practice map')
  })

  it('keeps plain existing material on the legacy presentation path', () => {
    const legacy: LearnerMaterialDto = {
      lessonRef: 'legacy:lesson:1', title: 'Existing lesson', format: 'structured',
      sections: [{ title: 'Read', body: 'Existing learner material.' }],
    }
    const model = createRichLessonRenderModel(legacy)
    expect(model.mode).toBe('legacy')
    expect(model.pages).toHaveLength(1)
    expect(model.pages[0]).toMatchObject({ kind: 'teaching', role: 'LEARN' })
  })

  it('classifies every reusable learner-facing section kind through data', () => {
    const rows = [
      ['Lesson objective', 'lesson-goal'], ['Teaching explanation', 'teaching'], ['Vocabulary', 'vocabulary'],
      ['Worked example', 'worked-example'], ['Guided practice', 'guided-practice'], ['Independent practice', 'independent-practice'],
      ['Mastery check', 'mastery-check'], ['Reteach', 'remediation'], ['Extension challenge', 'challenge'],
      ['Reflection', 'reflection'], ['Materials and safety', 'materials-safety'], ['Primary source', 'source'],
      ['Data table', 'data'], ['Map reference', 'map'], ['Image study', 'image'], ['Reference passage', 'reference'],
    ] as const
    for (const [title, expected] of rows) expect(classifyRichLessonSection({ title })).toBe(expected)
  })

  it('declares adapters for all supported subjects while sharing one renderer', () => {
    for (const key of ['mathematics', 'english-language-arts', 'science', 'social-studies', 'health', 'physical-education', 'financial-literacy', 'ready-for-life', 'technology', 'arts-and-music']) {
      expect(RICH_STUDY_SUBJECT_ADAPTERS[key]).toBeDefined()
      expect(richLessonSubjectAdapter(key).label).not.toBe('')
    }
    expect(richLessonSubjectAdapter('future-subject')).toMatchObject({ subject: 'future-subject', label: 'future-subject' })
  })

  it('ships mobile, keyboard, forced-color, and reduced-motion presentation safeguards', () => {
    const css = readFileSync(new URL('./rich-lesson-player.css', import.meta.url), 'utf8')
    expect(css).toContain('min-height: 3rem')
    expect(css).toContain('max-width: 100%')
    expect(css).toContain('touch-action: manipulation')
    expect(css).toContain('@media (min-width: 40rem)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('@media (forced-colors: active)')
    expect(css).toContain(':focus-visible')
  })
})
