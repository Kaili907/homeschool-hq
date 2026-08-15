import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CURRICULUM_GRADES,
  CurriculumSourceError,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
} from './contracts'
import { CurriculumBrowserView, type CurriculumBrowserLocation } from './CurriculumBrowser'
import { createFilesystemCurriculumSource } from './filesystemSource.node'
import { createAdminCurriculumHttpSource } from './httpSource'
import { deriveCurriculumCatalogTotals, searchCurriculum } from './readModel'

const courseId = 'fixture-grade-10-mathematics'
const unitId = 'fixture-unit-without-an-id-grade-parser'
const lessonId = 'fixture-grade-10-lesson-1'
let fixtureRoot = ''
let catalog: CurriculumCatalog
let lesson: CurriculumLessonDetail

async function writeFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'admin-curriculum-expanded-'))
  const courseRoot = join(root, 'grades', 'grade-10', 'courses', 'mathematics')
  await mkdir(join(root, 'validation'), { recursive: true })
  await mkdir(courseRoot, { recursive: true })
  await Promise.all([
    writeFile(join(root, 'curriculum-manifest.json'), JSON.stringify({
      package_id: 'expanded-curriculum-fixture',
      version: 'test',
      authored_on: '2026-08-15',
      status: 'test-fixture',
      grades: CURRICULUM_GRADES,
      counts: { courses: 1, units: 1, lessons: 1 },
    })),
    writeFile(join(root, 'course-index.json'), JSON.stringify([{
      course_id: courseId,
      grade: 10,
      subject: 'mathematics',
      title: 'Grade 10 mathematics fixture',
      days: 1,
    }])),
    writeFile(join(root, 'unit-index.json'), JSON.stringify([{
      unit_id: unitId,
      course_id: courseId,
      grade: 10,
      subject: 'mathematics',
      unit_number: 1,
      title: 'Loaded unit fixture',
      days: 1,
      standards: [],
      topics: [],
      lesson_ids: [lessonId],
    }])),
    writeFile(join(root, 'lesson-index.csv'), [
      'lesson_id,course_id,grade,subject,course_day,unit_number,unit_title,day_in_unit,title,phase,focus,standards',
      `${lessonId},${courseId},10,mathematics,1,1,Loaded unit fixture,1,Loaded lesson fixture,,,`,
    ].join('\n')),
    writeFile(join(root, 'validation', 'validation.json'), JSON.stringify({ overall: 'PASS' })),
    writeFile(join(courseRoot, 'assessments.json'), '[]'),
    writeFile(join(courseRoot, 'lessons.jsonl'), JSON.stringify({
      schema_version: '1.0',
      lesson_id: lessonId,
      course_id: courseId,
      grade: 10,
      unit_number: 1,
      learning_objectives: [],
      lesson_flow: [],
      formative_check: 'Fixture check',
      accessibility_and_accommodations: [],
      safety_and_privacy: [],
    })),
  ])
  return root
}

function render(location: CurriculumBrowserLocation, detail: CurriculumLessonDetail | null = null): string {
  return renderToStaticMarkup(
    <CurriculumBrowserView
      catalog={catalog}
      location={location}
      lesson={detail}
      lessonError={null}
      filters={{}}
      onLocationChange={() => {}}
      onFiltersChange={() => {}}
    />,
  )
}

beforeAll(async () => {
  fixtureRoot = await writeFixture()
  const source = createFilesystemCurriculumSource(fixtureRoot)
  catalog = await source.loadCatalog()
  lesson = await source.loadLesson(lessonId)
})

afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
})

describe('expanded Admin curriculum grades', () => {
  it('uses the canonical grade set in canonical order', () => {
    expect(CURRICULUM_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(catalog.grades).toEqual(CURRICULUM_GRADES)
    const markup = render({ mode: 'hierarchy' })
    for (const grade of CURRICULUM_GRADES) expect(markup).toContain(`Grade ${grade}`)
  })

  it('loads Grade 10 filesystem paths and browses course, unit, and lesson identities without single-digit parsing', () => {
    expect(lesson).toMatchObject({ lessonId, courseId, grade: 10, unitNumber: 1 })
    expect(render({ mode: 'hierarchy', grade: 10 })).toContain('Grade 10 mathematics fixture')
    expect(render({ mode: 'hierarchy', grade: 10, courseId })).toContain('Unit 1: Loaded unit fixture')
    expect(render({ mode: 'hierarchy', grade: 10, courseId, unitNumber: 1 })).toContain('Loaded lesson fixture')
    expect(render({ mode: 'hierarchy', grade: 10, courseId, unitNumber: 1, lessonId }, lesson)).toContain('Grade 10')
  })

  it('filters Grade 10 as a numeric grade and keeps empty canonical grades explicit', () => {
    expect(searchCurriculum(catalog, { grade: 10 })).toMatchObject({ totalMatches: 1, limited: false })
    expect(searchCurriculum(catalog, { grade: 11 })).toMatchObject({ totalMatches: 0, lessons: [] })
    expect(render({ mode: 'hierarchy', grade: 12 })).toContain('No published courses are available for Grade 12.')
  })

  it('derives every displayed total from loaded arrays', () => {
    expect(deriveCurriculumCatalogTotals(catalog)).toEqual({
      grades: catalog.grades.length,
      courses: catalog.courses.length,
      units: catalog.units.length,
      lessons: catalog.lessons.length,
      assessments: catalog.assessments.length,
    })
    const emptyCatalog: CurriculumCatalog = {
      ...catalog,
      grades: [],
      courses: [],
      units: [],
      lessons: [],
      assessments: [],
    }
    const markup = renderToStaticMarkup(
      <CurriculumBrowserView
        catalog={emptyCatalog}
        location={{ mode: 'hierarchy' }}
        lesson={null}
        lessonError={null}
        filters={{}}
        onLocationChange={() => {}}
        onFiltersChange={() => {}}
      />,
    )
    expect(deriveCurriculumCatalogTotals(emptyCatalog)).toEqual({ grades: 0, courses: 0, units: 0, lessons: 0, assessments: 0 })
    expect(markup).toContain('No published curriculum records are available in this source.')
  })

  it('accepts the expanded catalog through the strict HTTP projection and rejects non-canonical grades', async () => {
    const source = createAdminCurriculumHttpSource(
      vi.fn(async () => ({ ok: true, status: 200, json: async () => catalog })),
      '/api/admin/curriculum',
      async () => 'test-access-token',
    )
    await expect(source.loadCatalog()).resolves.toMatchObject({ grades: CURRICULUM_GRADES })

    const invalidSource = createAdminCurriculumHttpSource(
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ...catalog, grades: [...catalog.grades, 6] }),
      })),
      '/api/admin/curriculum',
      async () => 'test-access-token',
    )
    await expect(invalidSource.loadCatalog()).rejects.toBeInstanceOf(CurriculumSourceError)
  })
})
