import { ADMIN_EXPANDED_RELEASE, type AdminReleaseReadModel } from '../releaseDataModel'
import {
  type CourseReconciliation,
  type HighSchoolCourse,
  type HighSchoolProgramSnapshot,
  type ReconciliationVerdict,
} from './contracts'
import { HIGH_SCHOOL_PROGRAM_SNAPSHOT } from './snapshot'

function reconciliationVerdict(
  idMatch: boolean,
  titleMatch: boolean,
  sessionsMatch: boolean,
): ReconciliationVerdict {
  if (idMatch && titleMatch && sessionsMatch) return 'MATCHES_CONTRACT'
  if (!idMatch && !titleMatch && !sessionsMatch) return 'DIVERGES_MULTIPLE'
  if (!idMatch) return 'DIVERGES_ID_SCHEME'
  if (!titleMatch && !sessionsMatch) return 'DIVERGES_TITLE_AND_SESSIONS'
  if (!titleMatch) return 'DIVERGES_TITLE'
  return 'DIVERGES_SESSIONS'
}

/** Binds the planning/requirements evidence to the admitted runtime catalog. */
export function bindHighSchoolProgramToRelease(
  snapshot: HighSchoolProgramSnapshot,
  release: AdminReleaseReadModel,
): HighSchoolProgramSnapshot {
  const sourceDoc = release.sourcePaths.find((path) => path.includes('browser-catalog-projection'))
  if (!sourceDoc) throw new Error('High School Program release catalog source is unavailable.')

  const sourceCourses = release.courses.filter((course) => snapshot.gradeSpan.some((grade) => grade === course.grade))
  const actualByContractId = new Map<string, string>()
  for (const contract of snapshot.courses) {
    const matches = sourceCourses.filter((course) => course.grade === contract.grade && course.subject === contract.subject)
    if (matches.length !== 1) throw new Error(`High School Program cannot bind ${contract.grade}/${contract.subject}.`)
    actualByContractId.set(contract.courseId, matches[0].courseRef)
  }

  const courses: HighSchoolCourse[] = snapshot.courses.map((contract) => {
    const actual = sourceCourses.find((course) => course.grade === contract.grade && course.subject === contract.subject)!
    return Object.freeze({
      ...contract,
      courseId: actual.courseRef,
      courseName: actual.title,
      sessions: actual.days,
      unitCount: actual.unitCount,
      lessonCount: actual.lessonCount,
      prerequisiteCourseIds: contract.prerequisiteCourseIds.map((courseId) => actualByContractId.get(courseId) ?? courseId),
      authoringStatus: 'ADMITTED_RELEASE' as const,
      sourceDoc,
    })
  })

  const contractByGradeSubject = new Map(snapshot.courses.map((course) => [`${course.grade}/${course.subject}`, course]))
  const reconciliations: CourseReconciliation[] = courses
    .filter((course) => course.grade >= 9)
    .map((course) => {
      const contract = contractByGradeSubject.get(`${course.grade}/${course.subject}`)!
      const idMatch = course.courseId === contract.courseId
      const titleMatch = course.courseName === contract.courseName
      const sessionsMatch = course.sessions === contract.sessions
      return Object.freeze({
        courseId: contract.courseId,
        grade: contract.grade,
        subject: contract.subject,
        contractTitle: contract.courseName,
        contractSessions: contract.sessions,
        contractCreditRecommendation: contract.creditRecommendation,
        subjectRef: release.releaseId,
        subjectSha: release.sourceCommit,
        subjectCourseId: course.courseId,
        subjectTitle: course.courseName,
        subjectSessions: course.sessions,
        subjectSourceDoc: sourceDoc,
        titleMatch,
        sessionsMatch,
        idMatch,
        verdict: reconciliationVerdict(idMatch, titleMatch, sessionsMatch),
        note: idMatch && titleMatch && sessionsMatch
          ? 'Admitted release aligns with the planning contract on id, title, and sessions.'
          : 'Admitted release value differs from the planning contract; both values remain visible.',
      })
    })

  const manifestPath = release.sourcePaths.find((path) => path.endsWith('/MANIFEST.json')) ?? release.sourcePaths[0]
  return Object.freeze({
    ...snapshot,
    contractStatus: 'ADMITTED_RELEASE_BOUND',
    courses: Object.freeze(courses),
    reconciliations: Object.freeze(reconciliations),
    delivery: Object.freeze([
      {
        fact: `Grades 9-12 are catalogued in admitted release ${release.releaseVersion}.`,
        servedInRelease: true,
        evidenceRef: release.releaseId,
        evidencePath: sourceDoc,
        note: 'Course refs, names, days, units, and lesson counts are read from the admitted browser catalog projection.',
      },
      {
        fact: 'The admitted release reports production bindings for its lesson population.',
        servedInRelease: true,
        evidenceRef: release.releaseId,
        evidencePath: manifestPath,
        note: 'Binding and population evidence comes from the admitted release manifest.',
      },
      {
        fact: 'Grades 9-12 retain active catalog entries in the admitted release.',
        servedInRelease: true,
        evidenceRef: release.releaseId,
        evidencePath: sourceDoc,
        note: 'Each high-school grade resolves ten named course refs from the source catalog.',
      },
    ]),
    release: Object.freeze({
      releaseId: release.releaseId,
      releaseVersion: release.releaseVersion,
      admissionStatus: release.admissionStatus,
      sourceCommit: release.sourceCommit,
      sourcePaths: release.sourcePaths,
      counts: release.counts,
    }),
  })
}

export const HIGH_SCHOOL_PROGRAM_RELEASE_SNAPSHOT = bindHighSchoolProgramToRelease(
  HIGH_SCHOOL_PROGRAM_SNAPSHOT,
  ADMIN_EXPANDED_RELEASE,
)
