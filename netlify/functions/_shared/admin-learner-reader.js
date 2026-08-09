import { createClient } from '@supabase/supabase-js'
import { createFilesystemCurriculumSource } from '../../../src/admin/curriculum/filesystemSource.node.ts'
import { buildLearnerAnalyticsSnapshot, LEARNER_ANALYTICS_LIMITS } from '../../../src/admin/learnerAnalyticsModel.ts'
import { validateRemoteProfileRows } from '../../../src/sync/provenance.ts'

const READ_TIMEOUT_MS = 5_000

export class AdminLearnerProjectionError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminLearnerProjectionError'
    this.code = code
  }
}

function publicAuthConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !anonKey) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

function catalogsForProjection(catalog) {
  return catalog.grades.map((grade) => ({
    releaseVersion: catalog.source.version,
    grade: String(grade),
    courses: catalog.courses
      .filter((course) => course.grade === grade)
      .map((course) => {
        const units = catalog.units.filter((unit) => unit.courseId === course.courseId)
        return {
          courseId: course.courseId,
          subject: course.subject,
          lessonCount: units.reduce((total, unit) => total + unit.lessonIds.length, 0),
          units: units.map((unit) => ({
            unitId: unit.unitId,
            unitNumber: unit.unitNumber,
            title: unit.title,
            days: unit.days,
            essentialQuestion: unit.essentialQuestion ?? '',
            performanceTask: unit.performanceTask ?? '',
            lessonIds: [...unit.lessonIds],
            hasAssessment: Boolean(unit.assessmentId),
          })),
        }
      }),
  }))
}

/**
 * Reads only the verified Admin account's household. The bearer is pinned into
 * an authenticated Supabase client, so profiles_select_own derives household
 * scope from auth.uid(); no household selector is accepted here.
 */
export function createAdminLearnerReader({
  env,
  fetchImpl,
  clientFactory,
  catalogSource = createFilesystemCurriculumSource(),
  clock = () => new Date(),
} = {}) {
  function authenticatedClient(accessToken) {
    if (clientFactory) return clientFactory(accessToken)
    const config = publicAuthConfig(env)
    if (!config) throw new AdminLearnerProjectionError('learner_source_unavailable')
    return createClient(config.url, config.anonKey, {
      accessToken: async () => accessToken,
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }

  async function readRows(accessToken) {
    if (typeof accessToken !== 'string' || accessToken === '') {
      throw new AdminLearnerProjectionError('authorization_unavailable')
    }
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
    try {
      const { data, error } = await authenticatedClient(accessToken)
        .from('profiles')
        .select('profile_id,data,updated_at')
        .order('profile_id', { ascending: true })
        .limit(LEARNER_ANALYTICS_LIMITS.learners + 1)
        .abortSignal(signal)
      if (signal.aborted || error || !Array.isArray(data) || data.length > LEARNER_ANALYTICS_LIMITS.learners) {
        throw new AdminLearnerProjectionError('learner_source_unavailable')
      }
      const validation = validateRemoteProfileRows(data)
      if (!validation.ok) throw new AdminLearnerProjectionError('learner_source_unavailable')
      return validation.rows
    } catch (error) {
      if (error instanceof AdminLearnerProjectionError) throw error
      throw new AdminLearnerProjectionError('learner_source_unavailable')
    }
  }

  async function loadCatalogs() {
    try {
      return catalogsForProjection(await catalogSource.loadCatalog())
    } catch {
      // Profile evidence remains useful; Academy course evidence explicitly
      // reports catalog-not-integrated through the existing ADMIN-6 model.
      return []
    }
  }

  async function readSnapshot({ accessToken, today }) {
    const now = clock()
    if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
      throw new AdminLearnerProjectionError('learner_source_unavailable')
    }
    const localToday = today ?? now.toISOString().slice(0, 10)
    if (
      typeof localToday !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(localToday) ||
      Number.isNaN(Date.parse(`${localToday}T00:00:00.000Z`))
    ) {
      throw new AdminLearnerProjectionError('learner_source_unavailable')
    }
    const [rows, academyCatalogs] = await Promise.all([
      readRows(accessToken),
      loadCatalogs(),
    ])
    return buildLearnerAnalyticsSnapshot({
      profiles: rows.map((row) => row.data),
      today: localToday,
      observedAt: now.toISOString(),
      academyCatalogs,
      // No appropriate Admin-safe durable Study read boundary exists yet.
      studyByProfile: undefined,
    })
  }

  return Object.freeze({
    readSnapshot,
    async readDetail({ accessToken, learnerRef, today }) {
      if (typeof learnerRef !== 'string' || !/^p[1-5]$/.test(learnerRef)) {
        throw new AdminLearnerProjectionError('learner_not_found')
      }
      const snapshot = await readSnapshot({ accessToken, ...(today ? { today } : {}) })
      const detail = snapshot.details[learnerRef]
      if (!detail) throw new AdminLearnerProjectionError('learner_not_found')
      return { observedAt: snapshot.observedAt, detail }
    },
  })
}
