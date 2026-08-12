import { describe, expect, it } from 'vitest'
import { adaptHostLessonToStudyPlan } from '../../../curriculumAdapter'
import { canHelp } from '../../tutor/tutorBridge'
import type { FamilyPilotHelpContext } from '../../tutor/types'
import { assignmentRefFor, lessonSegments, toHostLessonDescriptor } from './studyAdapter'
import { listLessons } from './catalog'
import { loadSocialStudiesCatalog } from './source.node'

describe('FF-M3 social studies Study adapter', () => {
  const catalog = loadSocialStudiesCatalog()
  const allLessons = (['5', '7', '8'] as const).flatMap((grade) => listLessons(catalog, grade))

  it('projects every lesson through the existing curriculumAdapter without throwing', () => {
    for (const lesson of allLessons) {
      const descriptor = toHostLessonDescriptor(lesson)
      expect(() => adaptHostLessonToStudyPlan(descriptor)).not.toThrow()
    }
  })

  it('never labels a Social Studies lesson subject "math", so Tutor Core can never take a live turn on it', () => {
    for (const lesson of allLessons) {
      const plan = adaptHostLessonToStudyPlan(toHostLessonDescriptor(lesson))
      expect(plan.subject).not.toBe('math')
      expect(['reading', 'writing', 'other']).toContain(plan.subject)
    }
  })

  it('produces a deterministic segment order: same lesson in, same segments out, every call', () => {
    const lesson = allLessons[0]
    const a = lessonSegments(lesson)
    const b = lessonSegments(lesson)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
    expect(a.map((segment) => segment.segmentRef)).toEqual(b.map((segment) => segment.segmentRef))
  })

  it('gives the performance-task-build phase a writing shape, and never a live-Tutor-eligible one', () => {
    const performanceTaskLesson = allLessons.find((lesson) => lesson.phase === 'Performance task build')!
    const plan = adaptHostLessonToStudyPlan(toHostLessonDescriptor(performanceTaskLesson))
    expect(plan.subject).toBe('writing')
    expect(plan.masteryAuthority).toBe('tutor-core')
  })

  it('produces stable, opaque lesson refs and skill refs that satisfy the Study adapter SAFE_REF contract', () => {
    for (const lesson of allLessons.slice(0, 20)) {
      const descriptor = toHostLessonDescriptor(lesson)
      expect(descriptor.lessonRef).toBe(lesson.lessonId)
      for (const skillRef of descriptor.skillRefs) {
        expect(skillRef).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/)
      }
    }
  })

  it('produces a stable assignment ref that never changes for the same lesson', () => {
    const lesson = allLessons[0]
    expect(assignmentRefFor(lesson)).toBe(assignmentRefFor(lesson))
    expect(assignmentRefFor(lesson)).toBe(`assignment:${lesson.lessonId}`)
  })

  it('carries no field capable of holding raw learner text: only refs, titles, and counts', () => {
    for (const lesson of allLessons.slice(0, 5)) {
      const descriptor = toHostLessonDescriptor(lesson)
      const keys = Object.keys(descriptor)
      expect(keys).not.toContain('answer')
      expect(keys).not.toContain('response')
      expect(keys).not.toContain('draft')
      expect(keys).not.toContain('essay')
      expect(keys).not.toContain('transcript')
      for (const segment of lessonSegments(lesson)) {
        const segmentKeys = Object.keys(segment)
        expect(segmentKeys).not.toContain('answer')
        expect(segmentKeys).not.toContain('response')
        expect(segmentKeys).not.toContain('draft')
      }
    }
  })

  it('falls back to the static Tutor path for every Social Studies subject label (Tutor may analyze, never ghostwrite)', () => {
    for (const subject of ['reading', 'writing', 'other'] as const) {
      const context: FamilyPilotHelpContext = {
        scope: { householdRef: 'household-1', learnerRef: 'learner-1', sessionRef: 'session-1' },
        subject,
        grade: 5,
        noAudio: false,
        mediaAvailable: true,
      }
      const eligibility = canHelp(context)
      expect(eligibility.path).toBe('static-fallback')
      expect(eligibility.reason).toMatch(/math/i)
    }
  })
})
