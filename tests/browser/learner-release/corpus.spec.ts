import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { mapLearnerMaterialToStudySegments } from '../../../src/study/family-pilot/final-app/learner-response/mapping'

const PUBLIC_ROOT = 'family-pilot-final/2.0.0'
const FORBIDDEN_BROWSER_TEXT = /answerKeyRef|answerAuthorityRef|scoringAuthorityRef|scoringRef|correctAnswer|correctChoice|answerIndex|expectedAnswer|answer-keys|scoring-guide|teacher-guide/i
const CANONICAL_RESPONSE_TYPES = new Set([
  'NONE', 'READ', 'CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE',
  'ACTIVITY_EVIDENCE', 'RUBRIC_REVIEW_PENDING', 'GUARDIAN_ATTESTATION',
])

test('production browser lazily fetches and parses all 90 course payloads and all 8,292 learner DTOs', async ({ page }) => {
  const courseRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(`/${PUBLIC_ROOT}/courses/`)) courseRequests.push(request.url())
  })
  await page.goto('/family-pilot')
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()
  expect(courseRequests, 'course payloads must remain lazy before a course is requested').toEqual([])

  const audit = await page.evaluate(async ({ root, forbiddenSource }) => {
    const forbidden = new RegExp(forbiddenSource, 'i')
    const manifestResponse = await fetch(`/${root}/manifest.json`)
    if (!manifestResponse.ok) throw new Error(`manifest ${manifestResponse.status}`)
    const manifest = await manifestResponse.json()
    const cells = new Set<string>()
    let lessons = 0
    let bindings = 0
    let materials = 0
    let sections = 0
    const loadedCourses: string[] = []
    const browserLeaks: string[] = []
    for (const course of manifest.runtime.courses) {
      const response = await fetch(`/${root}/courses/${encodeURIComponent(course.courseRef)}.json`)
      if (!response.ok) throw new Error(`${course.courseRef} ${response.status}`)
      const raw = await response.text()
      if (forbidden.test(raw)) browserLeaks.push(course.courseRef)
      const payload = JSON.parse(raw)
      if (payload.courseRef !== course.courseRef) throw new Error(`wrong course payload ${course.courseRef}`)
      if (payload.lessons.length !== course.lessonCount) throw new Error(`lesson count ${course.courseRef}`)
      const materialValues = Object.values(payload.materials) as Array<any>
      if (materialValues.length !== course.lessonCount) throw new Error(`material count ${course.courseRef}`)
      for (const material of materialValues) {
        if (material.dtoVersion !== 'manuel-academy.learner-structured-projection.v1') throw new Error(`dto ${material.lessonRef}`)
        if (material.format !== 'structured' && material.format !== 'markdown') throw new Error(`format ${material.lessonRef}`)
        if (!Array.isArray(material.sections)) throw new Error(`sections ${material.lessonRef}`)
        sections += material.sections.length
      }
      cells.add(`${course.grade}:${course.subject}`)
      lessons += payload.lessons.length
      bindings += Object.keys(payload.bindings).length
      materials += materialValues.length
      loadedCourses.push(course.courseRef)
    }
    return {
      manifestCounts: manifest.counts,
      loadedCourses,
      lessons,
      bindings,
      materials,
      sections,
      cells: [...cells].sort(),
      browserLeaks,
    }
  }, { root: PUBLIC_ROOT, forbiddenSource: FORBIDDEN_BROWSER_TEXT.source })

  expect(audit.manifestCounts).toMatchObject({ courses: 90, lessons: 8292, assessments: 699 })
  expect(audit.loadedCourses).toHaveLength(90)
  expect(new Set(audit.loadedCourses).size).toBe(90)
  expect(audit.lessons).toBe(8292)
  expect(audit.bindings).toBe(8292)
  expect(audit.materials).toBe(8292)
  expect(audit.sections).toBeGreaterThan(8292)
  expect(audit.cells).toHaveLength(90)
  expect(audit.browserLeaks).toEqual([])
  expect(new Set(courseRequests.map((url) => decodeURIComponent(url.split('/').pop()!.replace(/\.json$/, '')))).size).toBe(90)
})

test('production network and browser artifacts contain no answer-key material', async ({ page }) => {
  await page.goto('/family-pilot')
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toBeVisible()

  const networkLeaks = await page.evaluate(async (forbiddenSource) => {
    const forbidden = new RegExp(forbiddenSource, 'i')
    const urls = [...new Set(performance.getEntriesByType('resource')
      .map((entry) => (entry as PerformanceResourceTiming).name)
      .filter((url) => new URL(url).origin === location.origin && /\.(?:js|json)(?:$|\?)/.test(url)))]
    const leaks: Array<{ url: string; token: string }> = []
    for (const url of urls) {
      const body = await (await fetch(url)).text()
      const match = body.match(forbidden)
      if (match) leaks.push({ url: new URL(url).pathname, token: match[0] })
    }
    return leaks
  }, FORBIDDEN_BROWSER_TEXT.source)

  const artifactLeaks: Array<{ file: string; token: string }> = []
  for (const file of (await readdir(join(process.cwd(), 'dist', 'assets'))).filter((name) => name.endsWith('.js')).sort()) {
    const body = await readFile(join(process.cwd(), 'dist', 'assets', file), 'utf8')
    const match = body.match(FORBIDDEN_BROWSER_TEXT)
    if (match) artifactLeaks.push({ file, token: match[0] })
  }
  test.info().attach('answer-material-artifact-leaks', {
    body: JSON.stringify({ networkLeaks, artifactLeaks }, null, 2),
    contentType: 'application/json',
  })
  expect({ networkLeaks, artifactLeaks }, 'answer material must not ship in browser-readable files').toEqual({
    networkLeaks: [],
    artifactLeaks: [],
  })
})

test('all projected DTOs enter the production response mapper with canonical response kinds', async () => {
  const courseRoot = join(process.cwd(), 'public', PUBLIC_ROOT, 'courses')
  const files = (await readdir(courseRoot)).filter((file) => file.endsWith('.json')).sort()
  const responseCounts = new Map<string, number>()
  const invalidRequired: Array<{ lessonRef: string; itemRef: string; responseType: string }> = []
  let lessons = 0
  for (const file of files) {
    const payload = JSON.parse(await readFile(join(courseRoot, file), 'utf8'))
    for (const material of Object.values(payload.materials) as Array<any>) {
      lessons += 1
      const mapped = mapLearnerMaterialToStudySegments(material)
      for (const item of mapped.segments.flatMap((segment) => segment.items)) {
        responseCounts.set(item.responseType, (responseCounts.get(item.responseType) ?? 0) + 1)
        if (item.required && !CANONICAL_RESPONSE_TYPES.has(item.responseType)) {
          invalidRequired.push({ lessonRef: item.lessonRef, itemRef: item.itemRef, responseType: item.responseType })
        }
        if (item.required) expect(item.responseType, `${item.lessonRef}/${item.itemRef}`).not.toBe('NONE')
      }
    }
  }
  test.info().attach('response-type-counts', {
    body: JSON.stringify(Object.fromEntries([...responseCounts].sort()), null, 2),
    contentType: 'application/json',
  })
  test.info().attach('invalid-required-response-types', {
    body: JSON.stringify({ count: invalidRequired.length, examples: invalidRequired.slice(0, 50) }, null, 2),
    contentType: 'application/json',
  })
  expect(files).toHaveLength(90)
  expect(lessons).toBe(8292)
  expect({ count: invalidRequired.length, examples: invalidRequired.slice(0, 20) },
    'answer-required items must use the canonical runtime vocabulary').toEqual({ count: 0, examples: [] })
  for (const kind of ['CHOICE', 'NUMERIC', 'TEXT', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE', 'RUBRIC_REVIEW_PENDING', 'GUARDIAN_ATTESTATION']) {
    expect(responseCounts.get(kind) ?? 0, `${kind} must be exercised by actual projected material`).toBeGreaterThan(0)
  }
})

test('negative control: a count-tampered manifest is rejected before setup', async ({ page }) => {
  await page.route(`**/${PUBLIC_ROOT}/manifest.json`, async (route) => {
    const response = await route.fetch()
    const manifest = await response.json()
    manifest.counts.lessons = 8291
    await route.fulfill({ response, json: manifest })
  })
  await page.goto('/family-pilot')
  await expect(page.getByRole('alert')).toContainText('admission identity check')
  await expect(page.getByRole('heading', { name: 'Set up your learners' })).toHaveCount(0)
})
