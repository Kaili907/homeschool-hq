import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LessonRef } from './types.ts'

/**
 * Reads the canonical Grade 3/4 lesson metadata already retained in the final
 * Mathematics corpus. This keeps the evidence generator executable in the
 * convergence worktree instead of depending on a source directory that only
 * existed on the historical authoring branch.
 */

/**
 * Walk up from the working directory to the repository root. Generation runs
 * through an esbuild bundle in a temporary directory, so import.meta.url is not
 * a usable anchor; the working directory always sits inside the repository for
 * both the generator script and the vitest suite.
 */
function findRepoRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(join(current, 'curriculum-content', 'manuel-academy'))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error(`Could not locate repository root from ${process.cwd()}`)
}

const repoRoot = findRepoRoot()

const FINAL_ROOT = join(
  repoRoot,
  'curriculum-production',
  'final',
  'mathematics',
)

export const ELIGIBLE_GRADES = [3, 4] as const

export type EligibleGrade = (typeof ELIGIBLE_GRADES)[number]

export interface SourceLesson {
  ref: LessonRef
  standards: readonly string[]
  masteryRule: string
  scoringGuidance: string
  extension: string
}

interface CanonicalPackage {
  lessonRef: LessonRef
  standards: string[]
}

interface CanonicalKey {
  masteryRule: string
  scoringGuidance: string
  extensionGuidance: string[]
}

const DAY_ONE_DIAGNOSTIC_STANDARDS: Readonly<Record<string, readonly string[]>> = {
  'ma-g3-mathematics-u01-l01': ['MP.1', 'MP.3', '3.NBT.1', '3.NBT.2'],
  'ma-g4-mathematics-u01-l01': ['MP.1', 'MP.3', '4.NBT.1', '4.NBT.2', '4.NBT.3'],
}

function toSourceLesson(materialPackage: CanonicalPackage, answerKey: CanonicalKey): SourceLesson {
  const lessonId = materialPackage.lessonRef.lessonId
  return {
    ref: materialPackage.lessonRef,
    standards: [...(DAY_ONE_DIAGNOSTIC_STANDARDS[lessonId] ?? materialPackage.standards)],
    masteryRule: answerKey.masteryRule,
    scoringGuidance: answerKey.scoringGuidance,
    extension: answerKey.extensionGuidance[0] ?? '',
  }
}

export function readLessons(grade: EligibleGrade): SourceLesson[] {
  const folder = `grade-${String(grade).padStart(2, '0')}`
  const packageRoot = join(FINAL_ROOT, 'active', 'packages', folder)
  const keyRoot = join(FINAL_ROOT, 'active', 'answer-keys', folder)
  return readdirSync(packageRoot)
    .filter((name) => name.endsWith('.package.json'))
    .map((name) => {
      const lessonId = name.slice(0, -'.package.json'.length)
      const materialPackage = JSON.parse(
        readFileSync(join(packageRoot, name), 'utf8'),
      ) as CanonicalPackage
      const answerKey = JSON.parse(
        readFileSync(join(keyRoot, `${lessonId}.key.json`), 'utf8'),
      ) as CanonicalKey
      return toSourceLesson(materialPackage, answerKey)
    })
    .sort((left, right) => left.ref.courseDay - right.ref.courseDay)
}

export function readAllLessons(): SourceLesson[] {
  return ELIGIBLE_GRADES.flatMap((grade) => readLessons(grade))
}
