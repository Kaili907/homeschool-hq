import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getHealthUnit, listHealthLessons } from './lookup'
import { projectHealthLessonForGuardian, projectHealthLessonForStudy } from './privacyProjection'
import { loadHealthCatalog } from './rawContent.node'
import { healthLessonStudyPlan, toFamilyPilotAssignment, toHostLessonDescriptor } from './studyAdapter'
import { healthStaticHelp } from './tutorHelp'

/**
 * No raw-response persistence: this subject module must never write a
 * learner's free-text response anywhere. Two independent checks —
 *  1. a static source scan for storage/network APIs across every
 *     non-test .ts file in this directory, and
 *  2. a runtime check that the objects this module actually returns never
 *     carry a free-text-shaped field.
 * Both must hold; either failing means the boundary broke.
 */

const HEALTH_DIR = __dirname

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /localStorage\s*\.\s*setItem/,
  /sessionStorage\s*\.\s*setItem/,
  /indexedDB/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /ports\.persistence/,
]

function sourceFiles(): readonly string[] {
  return readdirSync(HEALTH_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => join(HEALTH_DIR, name))
}

describe('no raw-response persistence — static source scan', () => {
  it('no file in subjects/health writes to storage or the network directly', () => {
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(pattern.test(text), `${file} matched forbidden pattern ${pattern}`).toBe(false)
      }
    }
  })
})

const FREE_TEXT_KEY_PATTERN = /rawAnswer|transcript|learnerText|responseText|studentResponse/i

/**
 * Keys ending in "Included" are the codebase's own canary convention for
 * declaring a category of data absent (e.g. rawAnswerIncluded: false,
 * transcriptIncluded: false, rawLearnerTextIncluded: false) — those are the
 * proof this boundary holds, not a violation of it, so they're exempt from
 * the name check as long as their value is literally `false`.
 */
function assertNoFreeTextKeys(value: unknown, label: string): void {
  if (!value || typeof value !== 'object') return
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith('Included') && fieldValue === false) continue
    expect(FREE_TEXT_KEY_PATTERN.test(key), `${label}.${key} looks like a free-text learner field`).toBe(false)
  }
}

describe('no raw-response persistence — runtime shape check', () => {
  const catalog = loadHealthCatalog()
  const lesson = listHealthLessons(catalog, '5')[0]
  const unit = getHealthUnit(catalog, '5', 1)!

  it('none of the module’s public return values carry a free-text-shaped field', () => {
    assertNoFreeTextKeys(toHostLessonDescriptor(lesson), 'toHostLessonDescriptor')
    assertNoFreeTextKeys(toFamilyPilotAssignment(lesson), 'toFamilyPilotAssignment')
    assertNoFreeTextKeys(healthLessonStudyPlan(lesson), 'healthLessonStudyPlan')
    assertNoFreeTextKeys(projectHealthLessonForStudy(lesson), 'projectHealthLessonForStudy')
    assertNoFreeTextKeys(projectHealthLessonForGuardian(lesson, unit), 'projectHealthLessonForGuardian')
    expect(typeof healthStaticHelp({ lesson, unit })).toBe('string')
  })
})
