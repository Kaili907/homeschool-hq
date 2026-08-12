import type { AcademyGrade } from '../../../../types'
import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../../curriculumAdapter'
import type { StudyLessonPlan } from '../../../types'
import type { FamilyPilotCurriculumPort } from '../../integration/curriculum'
import { listElaLessons } from './catalog'
import type { ElaCatalog, ElaLessonRef } from './types'

/**
 * FAMILY-PILOT-SUBJECT-ELA — the one seam between an ELA catalog lesson and
 * the Study runtime. This does not define new segments, a new subject value,
 * or a new mastery authority: it builds the same HostLessonDescriptor shape
 * every other Family Pilot subject builds and hands it to the existing,
 * reviewed src/study/curriculumAdapter.ts#adaptHostLessonToStudyPlan. The
 * lesson's studyKind ('reading' | 'writing') was fixed once at catalog load
 * time by lessonKind.ts, so this function is a pure, total mapping.
 */

/** Refs are opaque and must satisfy the Study adapter's SAFE_REF. */
function sanitizeRef(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)
}

function toHostLessonDescriptor(lesson: ElaLessonRef): HostLessonDescriptor {
  return {
    lessonRef: sanitizeRef(lesson.lessonId),
    title: lesson.title,
    kind: lesson.studyKind,
    skillRefs: [sanitizeRef(`${lesson.courseId}:unit:${lesson.unitNumber}`)],
  }
}

/** Converts one ELA catalog lesson into the exact Study contract shape. */
export function adaptElaLessonToStudy(lesson: ElaLessonRef): StudyLessonPlan {
  return adaptHostLessonToStudyPlan(toHostLessonDescriptor(lesson))
}

/**
 * A FamilyPilotCurriculumPort for ELA, ready for a future host to compose
 * alongside the existing mathematics port (src/study/family-pilot/integration
 * /curriculum.ts#catalogCurriculumPort) when Full Family convergence wires
 * multiple subjects into one FamilyPilotController. Registering it is out of
 * this lane's scope — this only makes registration a one-line addition.
 */
export function elaCurriculumPort(catalog: ElaCatalog): FamilyPilotCurriculumPort {
  return {
    listLessons: (grade: AcademyGrade) => listElaLessons(catalog, grade).map(toHostLessonDescriptor),
  }
}
