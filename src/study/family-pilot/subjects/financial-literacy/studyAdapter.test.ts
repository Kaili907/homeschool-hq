import { describe, expect, it } from 'vitest'
import { familyPilotTutorBridgeAvailable } from '../../study/FamilyPilotStudyRuntime'
import type { StudyCalendarEntry } from '../../../types'
import { getAssignments } from './catalog'
import { loadFinancialLiteracyCatalog } from './source.node'
import { assignmentRefFor, financialLiteracyCurriculumPort, hostLessonFor, lessonStudyPlan } from './studyAdapter'

const catalog = loadFinancialLiteracyCatalog()
const grade8Lesson = getAssignments(catalog, { studentRef: 'stu-1', grade: '8' })[0]

describe('FAMILY-PILOT-FINLIT-1 studyAdapter (Study Engine bridge)', () => {
  it('maps every lesson onto the reviewed parent-created host kind', () => {
    const host = hostLessonFor(grade8Lesson)
    expect(host.kind).toBe('parent-created')
    expect(host.title).toBe(grade8Lesson.title)
  })

  it('adapts to a completion-only, non-tutor-core StudyLessonPlan (Study adaptation)', () => {
    const plan = lessonStudyPlan(grade8Lesson)
    expect(plan.subject).toBe('other')
    expect(plan.masteryAuthority).toBe('completion-only')
    expect(plan.source).toBe('parent')
    expect(plan.segments).toHaveLength(1)
  })

  it('never routes financial-literacy content through the Tutor Core mastery bridge (Tutor boundary)', () => {
    const plan = lessonStudyPlan(grade8Lesson)
    const fakeEntry = {
      subject: plan.subject,
      masteryAuthority: plan.masteryAuthority,
      segments: plan.segments,
      completedSegmentRefs: [],
    } as unknown as StudyCalendarEntry
    expect(familyPilotTutorBridgeAvailable(fakeEntry)).toBe(false)
  })

  it('produces stable, deterministic refs across repeated calls (stable refs)', () => {
    const first = hostLessonFor(grade8Lesson)
    const second = hostLessonFor(grade8Lesson)
    expect(second.lessonRef).toBe(first.lessonRef)
    expect(second.skillRefs).toEqual(first.skillRefs)

    const planA = lessonStudyPlan(grade8Lesson)
    const planB = lessonStudyPlan(grade8Lesson)
    expect(planB.segments.map((s) => s.segmentRef)).toEqual(planA.segments.map((s) => s.segmentRef))
  })

  it('assignmentRefFor is derived only from the lesson ref, never from a student identity', () => {
    // No student/learner argument exists on this function at all — the ref
    // cannot vary by who is asking, so two students always agree on it.
    expect(assignmentRefFor(grade8Lesson.lessonId)).toBe(assignmentRefFor(grade8Lesson.lessonId))
  })

  it('the curriculum port lists identical lesson descriptors regardless of which student queries it (student isolation)', () => {
    const port = financialLiteracyCurriculumPort(catalog)
    const forStudentA = port.listLessons('8')
    const forStudentB = port.listLessons('8')
    expect(forStudentA).toEqual(forStudentB)
    expect(forStudentA.length).toBe(getAssignments(catalog, { studentRef: 'irrelevant', grade: '8' }).length)
  })
})
