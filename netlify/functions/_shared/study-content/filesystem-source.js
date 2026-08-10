import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve, sep } from 'node:path'
import { createFilesystemCurriculumSource } from '../../../../src/admin/curriculum/filesystemSource.node.ts'

const SOURCE_ROOT = /^curriculum-content\/manuel-academy\/([0-9]+\.[0-9]+\.[0-9]+)$/
const WEEKDAY = Object.freeze({ Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 })
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

function bounded(status, reasonCode) {
  return Object.freeze({ schemaVersion: 1, status, reasonCode })
}

function parseCsv(raw) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (quoted) {
      if (char === '"' && raw[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (quoted) throw new Error('curriculum_schedule_malformed')
  if (cell !== '' || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((values) => values.some((value) => value !== ''))
}

function scheduleDays(raw, grade, lessonById) {
  const rows = parseCsv(raw)
  const header = rows.shift()
  if (!header || header[0] !== 'week' || header[1] !== 'day' ||
      header.slice(2).some((value) => !/^period_[1-9][0-9]*$/.test(value))) {
    throw new Error('curriculum_schedule_malformed')
  }
  const days = new Map()
  for (const [index, values] of rows.entries()) {
    if (values.length > header.length) throw new Error('curriculum_schedule_malformed')
    const week = Number(values[0])
    const day = WEEKDAY[values[1]]
    if (!Number.isInteger(week) || week < 1 || week > 36 || !day) {
      throw new Error('curriculum_schedule_malformed')
    }
    const lessonRefs = values.slice(2).flatMap((value) => value ? value.split(';') : [])
      .map((value) => value.trim()).filter(Boolean)
    if (lessonRefs.length === 0 || new Set(lessonRefs).size !== lessonRefs.length) {
      throw new Error('curriculum_schedule_malformed')
    }
    for (const lessonRef of lessonRefs) {
      const lesson = lessonById.get(lessonRef)
      if (!lesson || lesson.grade !== grade) throw new Error('curriculum_schedule_inconsistent')
    }
    const key = `${week}:${day}`
    if (days.has(key)) throw new Error('curriculum_schedule_inconsistent')
    days.set(key, Object.freeze({
      lessonRef: `grade-${grade}:academy-week-${week}-day-${day}`,
      skillRefs: Object.freeze(lessonRefs),
      sourceRow: index + 2,
    }))
  }
  return days
}

function learnerLesson(detail) {
  const {
    scoringGuidance: _scoringGuidance,
    masteryRule: _masteryRule,
    adaptiveTutorRoutes: _adaptiveTutorRoutes,
    safetyAndPrivacy: _safetyAndPrivacy,
    parentVisibility: _parentVisibility,
    assessment: _assessment,
    source: _source,
    ...content
  } = detail
  return Object.freeze(content)
}

export function createFilesystemBoundCurriculumPackageSource(options = {}) {
  const repositoryRoot = resolve(options.repositoryRoot ?? REPOSITORY_ROOT)
  const cache = new Map()

  async function openUncached(binding) {
    const sourceMatch = SOURCE_ROOT.exec(binding.sourceRoot)
    if (!sourceMatch || sourceMatch[1] !== binding.releaseVersion) {
      return bounded('release_unavailable', 'bound-release-identity-mismatch')
    }
    const sourceRoot = resolve(repositoryRoot, ...binding.sourceRoot.split('/'))
    const repositoryPrefix = repositoryRoot.endsWith(sep) ? repositoryRoot : `${repositoryRoot}${sep}`
    if (!sourceRoot.startsWith(repositoryPrefix)) {
      return bounded('release_unavailable', 'bound-release-identity-mismatch')
    }

    let manifestBytes
    try {
      manifestBytes = await readFile(join(sourceRoot, 'curriculum-manifest.json'))
    } catch {
      return bounded('release_unavailable', 'bound-release-unavailable')
    }
    const digest = createHash('sha256').update(manifestBytes).digest('hex')
    if (digest !== binding.curriculumManifestSha256) {
      return bounded('manifest_mismatch', 'curriculum-manifest-mismatch')
    }
    let manifest
    try {
      manifest = JSON.parse(manifestBytes.toString('utf8'))
    } catch {
      return bounded('unavailable', 'curriculum-package-malformed')
    }
    if (manifest?.package_id !== binding.packageId || manifest?.version !== binding.releaseVersion) {
      return bounded('release_unavailable', 'bound-release-identity-mismatch')
    }

    let catalog
    const curriculum = createFilesystemCurriculumSource(sourceRoot)
    try {
      catalog = await curriculum.loadCatalog()
    } catch {
      return bounded('unavailable', 'curriculum-package-unavailable')
    }
    if (catalog.source.packageId !== binding.packageId ||
        catalog.source.version !== binding.releaseVersion ||
        catalog.source.validationStatus !== 'passed') {
      return bounded('release_unavailable', 'bound-release-identity-mismatch')
    }
    const lessonById = new Map(catalog.lessons.map((lesson) => [lesson.lessonId, lesson]))
    const scheduleByGrade = new Map()

    return Object.freeze({
      schemaVersion: 1,
      status: 'ready',
      binding,
      lessonSummary(lessonRef) {
        return lessonById.get(lessonRef) ?? null
      },
      async scheduleDay(grade, week, day) {
        let promise = scheduleByGrade.get(grade)
        if (!promise) {
          promise = readFile(
            join(sourceRoot, 'grades', `grade-${grade}`, 'daily-schedule.csv'),
            'utf8',
          ).then((raw) => scheduleDays(raw, grade, lessonById))
          scheduleByGrade.set(grade, promise)
          promise.catch(() => scheduleByGrade.delete(grade))
        }
        return (await promise).get(`${week}:${day}`) ?? null
      },
      async learnerLesson(lessonRef) {
        return learnerLesson(await curriculum.loadLesson(lessonRef))
      },
    })
  }

  return Object.freeze({
    isReady: () => true,
    async open(binding) {
      const key = [binding.releaseId, binding.packageId, binding.releaseVersion,
        binding.curriculumManifestSha256, binding.sourceRoot].join(':')
      let promise = cache.get(key)
      if (!promise) {
        promise = openUncached(binding)
        cache.set(key, promise)
        promise.then((result) => {
          if (result.status !== 'ready') cache.delete(key)
        }, () => cache.delete(key))
      }
      return promise
    },
  })
}
