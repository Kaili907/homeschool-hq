import { readdir, readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FinalBrowserCoursePayload } from '../../../../curriculum/final-app-data'
import { mapLearnerMaterialToStudySegments } from './mapping'
import type { LearnerResponseType } from './types'

const root = process.cwd()
const browserRoot = join(root, 'public', 'family-pilot-final', '2.0.0')

beforeAll(async () => {
  try { await stat(join(browserRoot, 'manifest.json')) } catch {
    execFileSync(process.execPath, ['scripts/build-final-family-pilot-data.mjs'], { cwd: root, stdio: 'inherit' })
  }
})

describe('all admitted production lesson projections', () => {
  it('maps all 8,292 lessons to three real Study segments without NONE or browser answer keys', async () => {
    const files = (await readdir(join(browserRoot, 'courses'))).filter((file) => file.endsWith('.json'))
    const responseCounts = new Map<LearnerResponseType, number>()
    const subjects = new Set<string>()
    let lessonCount = 0
    let choiceCount = 0
    for (const file of files) {
      const raw = await readFile(join(browserRoot, 'courses', file), 'utf8')
      expect(raw).not.toMatch(/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer-keys|scoring-guide|teacher-guide/i)
      const payload = JSON.parse(raw) as FinalBrowserCoursePayload
      for (const material of Object.values(payload.materials)) {
        lessonCount += 1
        subjects.add(material.subject)
        const mapped = mapLearnerMaterialToStudySegments(material)
        expect(mapped.lessonRef).toBe(material.lessonRef)
        expect(mapped.segments.map((segment) => segment.role)).toEqual(['LEARN', 'PRACTICE', 'REFLECT'])
        const items = mapped.segments.flatMap((segment) => segment.items)
        expect(new Set(items.map((item) => item.itemRef)).size).toBe(items.length)
        expect(items.every((item) => item.lessonRef === material.lessonRef && item.sectionRef && item.itemRef)).toBe(true)
        expect(items.some((item) => item.required), material.lessonRef).toBe(true)
        for (const item of items) {
          expect(item.responseType).not.toBe('NONE')
          responseCounts.set(item.responseType, (responseCounts.get(item.responseType) ?? 0) + 1)
          if (item.responseType === 'CHOICE') {
            choiceCount += 1
            expect(item.choices.length).toBeGreaterThan(1)
            expect(item.prompt).not.toContain('\nChoices:')
          }
        }
      }
    }
    expect(files).toHaveLength(90)
    expect(lessonCount).toBe(8292)
    expect(subjects.size).toBe(10)
    expect(choiceCount).toBeGreaterThan(0)
    expect(responseCounts.get('ACTIVITY_EVIDENCE')).toBeGreaterThan(0)
    expect(responseCounts.get('CONSTRUCTED_RESPONSE')).toBeGreaterThan(0)
  }, 120_000)
})
