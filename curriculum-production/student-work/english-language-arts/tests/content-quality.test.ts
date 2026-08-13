import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  hasPlaceholder,
  isActionlessTask,
  learnerPackageAdultLeak,
  sha256,
} from '../src/contentRepair.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function loadCorpus() {
  return GRADES.flatMap((grade) => {
    const gradeName = `grade-${String(grade).padStart(2, '0')}`
    const packageDir = path.join(ROOT, 'packages', gradeName)
    return fs.readdirSync(packageDir)
      .filter((file) => file.endsWith('.package.json'))
      .sort()
      .map((file) => {
        const pkg = readJson(path.join(packageDir, file))
        const guide = readJson(path.join(ROOT, 'scoring-guides', gradeName, `${pkg.lessonRef.lessonId}.scoring.json`))
        return { grade, pkg, guide }
      })
  })
}

const corpus = loadCorpus()

describe('canonical ELA content/source repair corpus', () => {
  it('preserves nine 180-day courses and all 1,620 lesson identities', () => {
    expect(corpus).toHaveLength(1620)
    expect(new Set(corpus.map(({ pkg }) => pkg.lessonRef.lessonId)).size).toBe(1620)
    for (const grade of GRADES) {
      const lessons = corpus.filter((row) => row.grade === grade)
      expect(lessons).toHaveLength(180)
      expect(lessons.map(({ pkg }) => pkg.lessonRef.courseDay).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 180 }, (_, index) => index + 1),
      )
    }
  })

  it('has zero actionless tasks, empty required writing, placeholders, or exact cross-grade task copies', () => {
    expect(corpus.filter(({ pkg }) => isActionlessTask(pkg.independentEvidenceTask.text))).toHaveLength(0)
    expect(corpus.filter(({ pkg }) => pkg.writingTask.required && (!pkg.writingTask.prompt.trim() || !pkg.writingTask.deliverable.trim()))).toHaveLength(0)
    expect(corpus.filter(({ pkg }) => hasPlaceholder(JSON.stringify(pkg)))).toHaveLength(0)

    const byTask = new Map<string, Set<number>>()
    for (const { grade, pkg } of corpus) {
      const task = pkg.independentEvidenceTask.text.trim()
      const grades = byTask.get(task) ?? new Set<number>()
      grades.add(grade)
      byTask.set(task, grades)
    }
    expect([...byTask.values()].filter((grades) => grades.size > 1)).toHaveLength(0)
  })

  it('delivers every required reading inline under a truthful Academy-original source record', () => {
    for (const { pkg } of corpus) {
      const ref = pkg.sourceReference.refs[0]
      const text = pkg.sourceReference.text
      expect(pkg.sourceReference.mode).toBe('academy-original-inline')
      expect(text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(80)
      expect(ref).toMatchObject({
        author: 'Manuel Academy',
        rightsCategory: 'original',
        deliveryMode: 'inline_full_text',
        learnerAvailable: true,
        fullTextIncluded: true,
      })
      expect(ref.rightsStatement).toMatch(/Original Manuel Academy/)
      expect(ref.wordCount).toBe(text.trim().split(/\s+/).length)
      expect(ref.sha256).toBe(sha256(text))
    }
  })

  it('uses no exact reading body across grades', () => {
    const byReading = new Map<string, Set<number>>()
    for (const { grade, pkg } of corpus) {
      const digest = pkg.sourceReference.refs[0].sha256
      const grades = byReading.get(digest) ?? new Set<number>()
      grades.add(grade)
      byReading.set(digest, grades)
    }
    expect([...byReading.values()].filter((grades) => grades.size > 1)).toHaveLength(0)
  })

  it('keeps adult scoring guides paired and excludes scoring keys and model answers from learner packages', () => {
    for (const { pkg, guide } of corpus) {
      expect(guide.lessonRef.lessonId).toBe(pkg.lessonRef.lessonId)
      expect(guide.scoringAuthority.kind).toBe('RUBRIC')
      expect(guide.scoringAuthority.rubric.length).toBeGreaterThan(0)
      expect(learnerPackageAdultLeak(pkg)).toBe(false)
      expect(JSON.stringify(pkg)).not.toMatch(/"(?:modelAnswer|correctAnswer|answerKey)"\s*:/i)
      expect(pkg.lesson_success_criteria.length).toBeGreaterThanOrEqual(3)
      expect(pkg.task_steps).toHaveLength(3)
      expect(pkg.deliverable.trim().length).toBeGreaterThan(20)
    }
  })

  it('matches every generated checksum', () => {
    const lines = fs.readFileSync(path.join(ROOT, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(3246)
    for (const line of lines) {
      const match = line.match(/^([a-f0-9]{64})  (.+)$/)
      expect(match).not.toBeNull()
      const [, expected, relative] = match!
      const actual = createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex')
      expect(actual, relative).toBe(expected)
    }
  })
})
