import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  LEARNER_ANALYTICS_LIMITS,
  LEARNERS_READ_CAPABILITY,
  type LearnerAnalyticsReadSource,
  type LearnerAnalyticsSnapshot,
} from './learnerAnalyticsModel'

export const ADMIN_LEARNERS_ENDPOINT = '/api/admin/v1/learners'

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

const PROHIBITED_KEYS = new Set([
  'messages', 'conversation', 'transcript', 'tutorChats', 'assistant',
  'privateJournalText', 'journal', 'answers', 'startCode', 'correctAnswer',
  'herAnswer', 'problem', 'note', 'adultPrivateNotes', 'audio', 'rawAudio',
  'serviceRoleKey', 'credentials', 'tokens', 'costMicros', 'learnerCost',
])

function hasProhibitedKey(value: unknown, depth = 0): boolean {
  if (depth > 16 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => hasProhibitedKey(item, depth + 1))
  return Object.entries(value).some(([key, child]) => (
    PROHIBITED_KEYS.has(key) || hasProhibitedKey(child, depth + 1)
  ))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactSnapshot(value: unknown): value is LearnerAnalyticsSnapshot {
  if (!isRecord(value) || Object.keys(value).some((key) => !['observedAt', 'learners', 'details'].includes(key))) return false
  if (typeof value.observedAt !== 'string' || Number.isNaN(Date.parse(value.observedAt))) return false
  if (!Array.isArray(value.learners) || value.learners.length > LEARNER_ANALYTICS_LIMITS.learners || !isRecord(value.details)) return false
  const refs = new Set<string>()
  for (const learner of value.learners) {
    if (!isRecord(learner) || typeof learner.learnerRef !== 'string' || !/^p[1-5]$/.test(learner.learnerRef)) return false
    if (refs.has(learner.learnerRef) || typeof learner.displayName !== 'string' || learner.displayName.length > 120) return false
    refs.add(learner.learnerRef)
  }
  const detailRefs = Object.keys(value.details)
  if (detailRefs.length !== refs.size || detailRefs.some((ref) => !refs.has(ref))) return false
  for (const ref of detailRefs) {
    const detail = value.details[ref]
    if (!isRecord(detail) || detail.learnerRef !== ref || detail.displayName !== (value.learners as Record<string, unknown>[]).find((learner) => learner.learnerRef === ref)?.displayName) return false
    if (!Array.isArray(detail.assessments) || detail.assessments.length > LEARNER_ANALYTICS_LIMITS.assessments) return false
    if (!Array.isArray(detail.recentEvidence) || detail.recentEvidence.length > LEARNER_ANALYTICS_LIMITS.recentEvidence) return false
  }
  return !hasProhibitedKey(value)
}

/** Browser adapter. It sends only the verified bearer; no household, learner,
 * role, capability array, or service credential is placed in the request. */
export function createAdminLearnerAnalyticsHttpSource(options: {
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly endpoint?: string
} = {}): LearnerAnalyticsReadSource {
  const fetchImpl = options.fetchImpl ?? fetch
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const endpoint = options.endpoint ?? ADMIN_LEARNERS_ENDPOINT
  return {
    async read(request) {
      if (request.capability !== LEARNERS_READ_CAPABILITY) throw new Error('learner source unavailable')
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('learner source unavailable')
      let response: Awaited<ReturnType<FetchLike>>
      try {
        response = await fetchImpl(`${endpoint}?today=${encodeURIComponent(request.today)}`, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        })
      } catch {
        throw new Error('learner source unavailable')
      }
      if (response.status !== 200) throw new Error('learner source unavailable')
      const value = await response.json().catch(() => null)
      if (!exactSnapshot(value)) throw new Error('learner source unavailable')
      return value
    },
  }
}
