import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DirectorLessonSampleReviewHome } from '../src/study/family-pilot/director-review/DirectorLessonSampleReviewHome'
import {
  DIRECTOR_LESSON_SAMPLES,
  DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH,
  DIRECTOR_REVIEW_PROMPTS,
  findDirectorLessonSample,
} from '../src/study/family-pilot/director-review/registry'

const expectedSamples = [
  ['Arts/Music', 9, 'ma-g9-arts-and-music-u01-l02', '/__review/g9-visual-hierarchy'],
  ['Technology', 10, 'ma-g10-technology-u02-l05', '/__review/technology-algorithms'],
  ['Ready for Life', 3, 'ma-g3-ready-for-life-u01-l04', '/__review/ready-for-life'],
  ['Financial Literacy', 8, 'ma-g8-financial-literacy-u04-l03', '/__review/financial-literacy'],
  ['Health', 5, 'ma-g5-health-u01-l01', '/__review/health'],
  ['Physical Education', 12, 'ma-g12-physical-education-u08-l07', '/__review/physical-education'],
]

describe('Director lesson sample review hub R1', () => {
  it('registers all six canonical sample identities and source routes in comparison order', () => {
    expect(DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH).toBe('/__review/lesson-samples')
    expect(DIRECTOR_LESSON_SAMPLES.map(({ subject, grade, lessonRef, route }) => (
      [subject, grade, lessonRef, route]
    ))).toEqual(expectedSamples)
    expect(DIRECTOR_LESSON_SAMPLES.every((sample) => (
      sample.lessonTitle.length > 0 && sample.demonstrates.length > 40
    ))).toBe(true)
  })

  it('matches only exact canonical sample paths, with one optional trailing slash', () => {
    for (const sample of DIRECTOR_LESSON_SAMPLES) {
      expect(findDirectorLessonSample(sample.route)?.id).toBe(sample.id)
      expect(findDirectorLessonSample(`${sample.route}/`)?.id).toBe(sample.id)
      expect(findDirectorLessonSample(`${sample.route}/extra`)).toBeUndefined()
    }
  })

  it('renders the six cards, review prompts, and no automatic score controls', () => {
    const html = renderToStaticMarkup(createElement(DirectorLessonSampleReviewHome))
    for (const [subject, grade, lessonRef, route] of expectedSamples) {
      expect(html).toContain(subject)
      expect(html).toContain(`Grade ${grade}`)
      expect(html).toContain(lessonRef)
      expect(html).toContain(`href="${route}"`)
    }
    for (const prompt of DIRECTOR_REVIEW_PROMPTS) expect(html).toContain(prompt)
    expect(html).toContain('6 samples')
    expect(html).not.toMatch(/automatic score|score sample|rating/i)
  })

  it('keeps the review router behind the compile-time development boundary', () => {
    const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    expect(appSource).toMatch(/const DirectorReviewRouter = import\.meta\.env\.DEV/)
    expect(appSource).toMatch(/lazy\(\(\) => import\('\.\/study\/family-pilot\/director-review\/DirectorReviewRouter'\)/)
    expect(appSource).not.toMatch(/^import .*director-(?:review|preview)/m)
  })
})
