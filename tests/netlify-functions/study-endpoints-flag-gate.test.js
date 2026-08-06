import { describe, expect, it } from 'vitest'
import { createStudyAcademicRuntimeHandler } from '../../netlify/functions/study-academic-runtime.js'
import { createStudyAdultReviewDeliverHandler } from '../../netlify/functions/study-adult-review-deliver.js'
import { createStudyAdultReviewHealthHandler } from '../../netlify/functions/study-adult-review-health.js'
import { createStudyAdultReviewWorkerHandler } from '../../netlify/functions/study-adult-review-worker.js'
import { createStudyAdultReviewHandler } from '../../netlify/functions/study-adult-review.js'
import { createStudyParentNotificationsHandler } from '../../netlify/functions/study-parent-notifications.js'
import { createStudyProductionReadinessHandler } from '../../netlify/functions/study-production-readiness.js'
import { createTestStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { createStudySessionIssueHandler } from '../../netlify/functions/study-session-issue.js'
import { createStudySessionVerifyHandler } from '../../netlify/functions/study-session-verify.js'

// ACADEMY_STUDY_ENABLED is deliberately absent: the default-DENY flag helper
// must fail closed before any path, method, auth, or readiness logic runs.
const ENV_WITHOUT_FLAG = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
})

const ENDPOINTS = [
  {
    name: 'study-academic-runtime',
    create: createStudyAcademicRuntimeHandler,
    event: { httpMethod: 'POST', path: '/api/study/academic-runtime' },
  },
  {
    name: 'study-adult-review',
    create: createStudyAdultReviewHandler,
    event: { httpMethod: 'POST', path: '/api/study/adult-review/process' },
  },
  {
    name: 'study-adult-review-deliver',
    create: createStudyAdultReviewDeliverHandler,
    event: { httpMethod: 'POST', path: '/api/study/adult-review/deliver' },
  },
  {
    name: 'study-adult-review-health',
    create: createStudyAdultReviewHealthHandler,
    event: { httpMethod: 'GET', path: '/api/study/adult-review/health' },
  },
  {
    name: 'study-adult-review-worker',
    create: createStudyAdultReviewWorkerHandler,
    event: { httpMethod: 'POST', path: '/api/study/adult-review/worker' },
  },
  {
    name: 'study-parent-notifications',
    create: createStudyParentNotificationsHandler,
    event: { httpMethod: 'GET', path: '/api/study/parent-notifications' },
  },
  {
    name: 'study-production-readiness',
    create: createStudyProductionReadinessHandler,
    event: { httpMethod: 'GET', path: '/api/study/production/readiness' },
  },
  {
    name: 'study-safety-classify',
    create: createTestStudySafetyHandler,
    event: { httpMethod: 'POST', path: '/api/study/safety/classify' },
  },
  {
    name: 'study-session-issue',
    create: createStudySessionIssueHandler,
    event: { httpMethod: 'POST', path: '/api/study/session/issue' },
  },
  {
    name: 'study-session-verify',
    create: createStudySessionVerifyHandler,
    event: { httpMethod: 'POST', path: '/api/study/session/verify' },
  },
]

describe('ACADEMY_STUDY_ENABLED containment gate (A3/R4)', () => {
  it.each(ENDPOINTS)('$name returns 503 gateway_disabled when the flag is unset', async ({ create, event }) => {
    const handler = create({ env: ENV_WITHOUT_FLAG })
    const result = await handler({
      headers: { authorization: 'Bearer header.payload.signature' },
      ...event,
    })
    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'gateway_disabled' } })
  })

  it.each(ENDPOINTS)('$name treats a non-truthy flag value as disabled', async ({ create, event }) => {
    const handler = create({ env: { ...ENV_WITHOUT_FLAG, ACADEMY_STUDY_ENABLED: 'no' } })
    const result = await handler({
      headers: { authorization: 'Bearer header.payload.signature' },
      ...event,
    })
    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'gateway_disabled' } })
  })
})
