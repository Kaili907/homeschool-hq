import { digestStudySessionReference } from '../study-identity/contracts.js'
import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const PACKAGE_ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const SOURCE_ROOT = /^curriculum-content\/manuel-academy\/[0-9]+\.[0-9]+\.[0-9]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export class StudyBoundContentAuthorityDeniedError extends Error {}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value, keys) {
  if (!record(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function unavailable(value) {
  if (!exact(value, ['schemaVersion', 'status', 'reasonCode']) || value.schemaVersion !== 1) return null
  if (!['unavailable', 'manual-review'].includes(value.status) || typeof value.reasonCode !== 'string') return null
  return Object.freeze({
    schemaVersion: 1,
    status: value.status,
    reasonCode: value.reasonCode,
  })
}

function ready(value) {
  if (!exact(value, ['schemaVersion', 'status', 'session', 'learnerScope', 'curriculumBinding']) ||
      value.schemaVersion !== 1 || value.status !== 'ready') return null
  const session = value.session
  const learnerScope = value.learnerScope
  const binding = value.curriculumBinding
  if (!exact(session, ['sessionRef', 'lessonRef', 'subjectRef', 'intendedLocalDate']) ||
      !SAFE_REF.test(session.sessionRef) || !SAFE_REF.test(session.lessonRef) ||
      !SAFE_REF.test(session.subjectRef) || !DATE.test(session.intendedLocalDate) ||
      !exact(learnerScope, ['eligibleCourseRefs']) ||
      !Array.isArray(learnerScope.eligibleCourseRefs) || learnerScope.eligibleCourseRefs.length > 100 ||
      learnerScope.eligibleCourseRefs.length === 0 ||
      learnerScope.eligibleCourseRefs.some((item) => typeof item !== 'string' || !SAFE_REF.test(item)) ||
      new Set(learnerScope.eligibleCourseRefs).size !== learnerScope.eligibleCourseRefs.length ||
      !exact(binding, [
        'schemaVersion', 'status', 'releaseId', 'packageId', 'releaseVersion',
        'curriculumManifestSha256', 'sourceRoot',
      ]) || binding.schemaVersion !== 1 || binding.status !== 'bound' ||
      typeof binding.releaseId !== 'string' || !UUID.test(binding.releaseId) ||
      typeof binding.packageId !== 'string' || !PACKAGE_ID.test(binding.packageId) ||
      typeof binding.releaseVersion !== 'string' || !VERSION.test(binding.releaseVersion) ||
      typeof binding.curriculumManifestSha256 !== 'string' || !HASH.test(binding.curriculumManifestSha256) ||
      typeof binding.sourceRoot !== 'string' || !SOURCE_ROOT.test(binding.sourceRoot) ||
      !binding.sourceRoot.endsWith(`/${binding.releaseVersion}`)) return null

  return Object.freeze({
    schemaVersion: 1,
    status: 'ready',
    session: Object.freeze({ ...session }),
    learnerScope: Object.freeze({
      eligibleCourseRefs: Object.freeze([...learnerScope.eligibleCourseRefs]),
    }),
    curriculumBinding: Object.freeze({ ...binding }),
  })
}

export function createStudyBoundContentAuthority(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  return Object.freeze({
    isReady: () => rpc?.isConfigured?.() === true,
    async read({ sessionReference, sessionId }) {
      const tokenDigest = digestStudySessionReference(sessionReference)
      if (!tokenDigest || typeof sessionId !== 'string' || !SAFE_REF.test(sessionId)) {
        throw new StudyBoundContentAuthorityDeniedError('student_session_invalid')
      }
      let result
      try {
        result = await rpc.call('academy_study_read_bound_content_authority_v1', {
          p_token_digest: tokenDigest,
          p_session_id: sessionId,
        })
      } catch {
        throw new Error('bound_content_authority_unavailable')
      }
      if (result?.schemaVersion === 1 && result?.status === 'denied') {
        throw new StudyBoundContentAuthorityDeniedError('student_session_invalid')
      }
      const adapted = result?.status === 'ready' ? ready(result) : unavailable(result)
      if (!adapted) throw new Error('bound_content_authority_contract')
      return adapted
    },
  })
}
