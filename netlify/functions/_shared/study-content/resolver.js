import {
  createStudyBoundContentAuthority,
  StudyBoundContentAuthorityDeniedError,
} from './authority.js'
import { createFilesystemBoundCurriculumPackageSource } from './filesystem-source.js'
import { SUPPORTED_GRADE_ALTERNATION } from '../../../../src/curriculum/grade-authority/tokens.ts'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
// The grade token comes from the canonical authority (longest-first alternation,
// so `grade-12` can never be read as `grade-1`); week/day stay local to this ref
// shape.
const LESSON_CONTEXT = new RegExp(
  `^grade-(${SUPPORTED_GRADE_ALTERNATION}):academy-week-([1-9]|[12][0-9]|3[0-6])-day-([1-5])$`,
)

export { StudyBoundContentAuthorityDeniedError }

export function isStudyBoundContentRequest(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 3 &&
    Object.hasOwn(value, 'sessionId') && Object.hasOwn(value, 'lessonRef') &&
    Object.hasOwn(value, 'skillRefs') && typeof value.sessionId === 'string' &&
    SAFE_REF.test(value.sessionId) && typeof value.lessonRef === 'string' &&
    SAFE_REF.test(value.lessonRef) && Array.isArray(value.skillRefs) &&
    value.skillRefs.length > 0 && value.skillRefs.length <= 64 &&
    value.skillRefs.every((ref) => typeof ref === 'string' && SAFE_REF.test(ref)) &&
    new Set(value.skillRefs).size === value.skillRefs.length
}

function response(status, reasonCode, input, onDecision, extras = {}) {
  const result = Object.freeze({ schemaVersion: 1, status, reasonCode, ...extras })
  if (typeof onDecision === 'function') {
    try {
      const safeRef = (value) => typeof value === 'string' && SAFE_REF.test(value)
        ? value
        : 'invalid'
      onDecision(Object.freeze({
        schemaVersion: 1,
        status,
        reasonCode,
        sessionRef: safeRef(input.sessionId),
        lessonRef: safeRef(input.lessonRef),
        skillRefs: Object.freeze(Array.isArray(input.skillRefs)
          ? input.skillRefs.filter((ref) => typeof ref === 'string' && SAFE_REF.test(ref)).slice(0, 64)
          : []),
      }))
    } catch {
      // Operational reporting cannot change the fail-closed content decision.
    }
  }
  return result
}

function mapAuthorityFailure(authority, input, onDecision) {
  const reasonCode = authority.reasonCode || 'content-authority-unavailable'
  return response('unavailable', reasonCode, input, onDecision)
}

export function createStudyBoundContentResolver(options = {}) {
  const authority = options.authority ?? createStudyBoundContentAuthority(options)
  const packageSource = options.packageSource ?? createFilesystemBoundCurriculumPackageSource(options)
  const onDecision = options.onDecision

  return Object.freeze({
    isReady: () => authority?.isReady?.() === true && packageSource?.isReady?.() === true,
    async resolve({ sessionReference, ...input }) {
      if (!isStudyBoundContentRequest(input)) {
        return response('unsupported', 'content-request-unsupported', {
          sessionId: typeof input?.sessionId === 'string' ? input.sessionId : 'invalid',
          lessonRef: typeof input?.lessonRef === 'string' ? input.lessonRef : 'invalid',
          skillRefs: Array.isArray(input?.skillRefs) ? input.skillRefs.filter((ref) => typeof ref === 'string').slice(0, 64) : [],
        }, onDecision)
      }

      let trusted
      try {
        trusted = await authority.read({ sessionReference, sessionId: input.sessionId })
      } catch (error) {
        if (error instanceof StudyBoundContentAuthorityDeniedError) throw error
        return response('unavailable', 'content-authority-unavailable', input, onDecision)
      }
      if (trusted.status !== 'ready') return mapAuthorityFailure(trusted, input, onDecision)
      if (trusted.session.sessionRef !== input.sessionId ||
          trusted.session.lessonRef !== input.lessonRef) {
        return response('membership_mismatch', 'advisory-lesson-mismatch', input, onDecision)
      }

      const context = LESSON_CONTEXT.exec(input.lessonRef)
      if (!context) return response('unsupported', 'lesson-context-unsupported', input, onDecision)
      const grade = Number(context[1])
      const week = Number(context[2])
      const day = Number(context[3])

      let curriculumPackage
      try {
        curriculumPackage = await packageSource.open(trusted.curriculumBinding)
      } catch {
        return response('unavailable', 'curriculum-package-unavailable', input, onDecision)
      }
      if (curriculumPackage.status !== 'ready') {
        return response(curriculumPackage.status, curriculumPackage.reasonCode, input, onDecision)
      }

      let scheduled
      try {
        scheduled = await curriculumPackage.scheduleDay(grade, week, day)
      } catch {
        return response('unavailable', 'curriculum-schedule-unavailable', input, onDecision)
      }
      if (!scheduled || scheduled.lessonRef !== input.lessonRef) {
        return response('not_found', 'lesson-context-not-found', input, onDecision)
      }

      const scheduledSkills = new Set(scheduled.skillRefs)
      const eligibleCourses = new Set(trusted.learnerScope.eligibleCourseRefs)
      for (const skillRef of input.skillRefs) {
        const summary = curriculumPackage.lessonSummary(skillRef)
        if (!summary) {
          return response('not_found', 'skill-ref-not-found', input, onDecision, { rejectedSkillRef: skillRef })
        }
        if (!scheduledSkills.has(skillRef) || summary.grade !== grade) {
          return response('membership_mismatch', 'skill-not-eligible-for-lesson', input, onDecision, { rejectedSkillRef: skillRef })
        }
        if (!eligibleCourses.has(summary.courseId)) {
          return response('membership_mismatch', 'skill-not-eligible-for-learner', input, onDecision, { rejectedSkillRef: skillRef })
        }
      }

      let lessons
      try {
        lessons = await Promise.all(input.skillRefs.map((skillRef) =>
          curriculumPackage.learnerLesson(skillRef)))
      } catch {
        return response('unavailable', 'curriculum-content-unavailable', input, onDecision)
      }
      return response('ready', 'content-ready', input, onDecision, {
        sessionRef: trusted.session.sessionRef,
        lessonRef: input.lessonRef,
        skillRefs: Object.freeze([...input.skillRefs]),
        curriculumBinding: Object.freeze({
          schemaVersion: 1,
          releaseId: trusted.curriculumBinding.releaseId,
          packageId: trusted.curriculumBinding.packageId,
          releaseVersion: trusted.curriculumBinding.releaseVersion,
          curriculumManifestSha256: trusted.curriculumBinding.curriculumManifestSha256,
        }),
        lessons: Object.freeze(lessons),
      })
    },
  })
}
