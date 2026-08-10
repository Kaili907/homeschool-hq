import { useEffect, useMemo, useRef, useState } from 'react'
import { isoToday } from '../../appState'
import {
  readAdminAuthorization,
  type AdminAuthorizationState,
} from '../../admin/authorization'
import { ADMIN_CONSOLE_PATH, type AdminCapability } from '../../admin/contracts'
import { isAdminConsolePath } from '../../admin/adminRoute'
import type {
  AdminSection,
  OverviewLoadState,
  OverviewRange,
  ServerResolvedAdminAuthorization,
} from '../../admin/overviewModel'
import { AdminOverviewReadError, readAdminOverview } from '../../admin/overviewHttpSource'
import { readAdminCosts, AdminCostsReadError } from '../../admin/costsHttpSource'
import type { AdminCostRangeSelection, AdminCostsReadState } from '../../admin/costsModel'
import { readAdminAuditPage, AdminAuditReadError } from '../../admin/auditHttpSource'
import type { AdminAuditFilters, AdminAuditReadState } from '../../admin/auditLogModel'
import { AdminIncidentReadError, readAdminIncidentPage } from '../../admin/incidentExplorerHttpSource'
import type { AdminIncidentFilters, AdminIncidentReadState } from '../../admin/incidentExplorerModel'
import { createAdminCurriculumHttpSource } from '../../admin/curriculum/httpSource'
import { createCurriculumStudioSource } from '../../admin/curriculum/studioModel'
import { readAdminSafetyOperations } from '../../admin/safetyOperationsHttpSource'
import type { SafetyOperationsReadState } from '../../admin/safetyOperationsModel'
import { CurriculumBrowser } from '../../admin/curriculum/CurriculumBrowser'
import { CurriculumStudio } from '../../admin/curriculum/CurriculumStudio'
import {
  CurriculumPreviewUnavailable,
  CurriculumWorkflowNav,
  type CurriculumWorkflowView,
} from '../../admin/curriculum/CurriculumWorkflowNav'
import {
  readAdminCurriculumValidation,
  type CurriculumValidationReadState,
} from '../../admin/curriculum-validation/httpSource'
import {
  loadLearnerAnalytics,
  type LearnerAnalyticsViewState,
} from '../../admin/learnerAnalyticsModel'
import { createAdminLearnerAnalyticsHttpSource } from '../../admin/learnerAnalyticsHttpSource'
import {
  readAdminEnginePerformance,
  type EnginePerformanceReadState,
} from '../../admin/engine-performance/httpSource'
import { ADMIN_ENGINE_IDS, type AdminEngineId } from '../../admin/contracts'
import type { EnginePerformanceWindowPreset } from '../../admin/enginePerformanceModel'
import { readSystemHealth, type SystemHealthReadState } from '../../admin/systemHealthClient'
import type { SystemHealthWindow } from '../../admin/systemHealth'
import { AdminConsole, AdminShell } from './AdminConsole'
import { AdminCostsDashboard } from './AdminCostsDashboard'
import { LearnerAnalytics } from './LearnerAnalytics'
import { AdminSafetyOperations } from './AdminSafetyOperations'
import { CurriculumValidationDashboard } from './CurriculumValidationDashboard'
import { EnginePerformanceDashboard } from './EnginePerformanceDashboard'
import { SystemHealthDashboard } from './SystemHealthDashboard'
import { AdminAuditLog } from './AdminAuditLog'
import { AdminCorrelationExplorer } from './AdminCorrelationExplorer'
import {
  AdminConfiguration,
  type AdminConfigurationReadState,
  type AdminVoiceCatalogReadState,
} from './AdminConfiguration'
import {
  AdminConfigurationError,
  createAdminConfigurationHttpSource,
  type AdminConfigurationCommitResult,
} from '../../admin/configurationHttpSource'
import { getVoiceCatalogAccess } from '../../tutor/voiceCatalog'
import { createAdminAccessHttpSource, AdminAccessError } from '../../admin/accessHttpSource'
import type { AdminAccessReadState } from '../../admin/accessModel'
import { AdminAccessPermissions } from './AdminAccessPermissions'
import {
  AdminProductionReadinessError,
  readAdminProductionReadiness,
} from '../../admin/productionReadinessHttpSource'
import {
  ProductionReadinessCenter,
  type ProductionReadinessReadState,
} from './ProductionReadinessCenter'
import { loadAdminAttentionCenter } from '../../admin/attentionLoader'
import {
  AdminAttentionCenter,
  type AdminAttentionReadState,
} from './AdminAttentionCenter'

export type AdminRouteSection = AdminSection
  | 'curriculum-studio'
  | 'curriculum-validation'
  | 'curriculum-preview'
  | 'unknown'

const ENGINE_PAGE_LABELS: Readonly<Record<AdminEngineId, string>> = {
  tutor: 'Tutor',
  study: 'Study',
  assessment: 'Assessment',
  curriculum: 'Curriculum',
  jarvis: 'Jarvis',
  tts: 'TTS',
  gateway: 'Gateway',
  sync: 'Sync',
}

export function adminRouteSection(pathname: string): AdminRouteSection | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (!suffix) return 'overview'
  if (suffix === 'attention') return 'attention'
  if (suffix === 'curriculum/studio') return 'curriculum-studio'
  if (suffix === 'curriculum/validation') return 'curriculum-validation'
  if (suffix === 'curriculum/preview') return 'curriculum-preview'
  if (suffix === 'learners' || adminRouteLearnerRef(pathname)) return 'learners'
  if (suffix.startsWith('learners/')) return 'unknown'
  if (suffix === 'health' || suffix.startsWith('health/')) return 'system-health'
  if (suffix === 'engines') return 'engines'
  if (suffix.startsWith('engines/')) return adminRouteEngine(pathname) ? 'engines' : 'unknown'
  if (suffix === 'production-readiness' || suffix === 'readiness') return 'releases'
  if (suffix === 'correlations') return 'incidents'
  const section = suffix.split('/')[0]
  return [
    'costs', 'curriculum', 'safety', 'system-health',
    'incidents', 'configuration', 'audit-log', 'access', 'releases',
  ].includes(section) ? section as AdminSection : 'unknown'
}

export function adminRouteLearnerRef(pathname: string): string | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  const segments = suffix.split('/')
  if (segments.length !== 2 || segments[0] !== 'learners') return null
  return /^p[1-5]$/.test(segments[1]) ? segments[1] : null
}

export function adminRouteEngine(pathname: string): AdminEngineId | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (suffix === 'engines') return 'tutor'
  const segments = suffix.split('/')
  if (segments.length !== 2 || segments[0] !== 'engines') return null
  return ADMIN_ENGINE_IDS.includes(segments[1] as AdminEngineId)
    ? segments[1] as AdminEngineId
    : null
}

export function configurationReadStateAfterCommit(): AdminConfigurationReadState {
  return { status: 'loading' }
}

export function configurationRetryAfterCommit(current: number): number {
  return current + 1
}

export function defaultIncidentFilters(now = new Date()): AdminIncidentFilters {
  const occurredTo = now.toISOString()
  return {
    occurredFrom: new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
    occurredTo,
    domain: 'all',
    limit: 50,
  }
}

export function presentationAuthorization(
  state: AdminAuthorizationState | { readonly status: 'resolving' },
): ServerResolvedAdminAuthorization {
  if (state.status === 'resolving') return { status: 'resolving' }
  if (state.status === 'authorized') {
    return { status: 'authorized', role: state.role, capabilities: state.capabilities }
  }
  return {
    status: 'unauthorized',
    reasonCode: state.status === 'unavailable'
      ? 'authorization_unavailable'
      : 'admin_assignment_required',
  }
}

function hasCapability(
  authorization: ServerResolvedAdminAuthorization,
  capability: AdminCapability,
): authorization is Extract<ServerResolvedAdminAuthorization, { status: 'authorized' }> {
  return authorization.status === 'authorized' && authorization.capabilities.includes(capability)
}

export function AdminConsoleRoute() {
  const [authorizationState, setAuthorizationState] = useState<AdminAuthorizationState | { status: 'resolving' }>({ status: 'resolving' })
  const [authorizationReload, setAuthorizationReload] = useState(0)
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [range, setRange] = useState<OverviewRange>({ kind: 'preset', preset: 'today' })
  const [overviewState, setOverviewState] = useState<OverviewLoadState>({ status: 'loading' })
  const [overviewReload, setOverviewReload] = useState(0)
  const [costRange, setCostRange] = useState<AdminCostRangeSelection>({ kind: 'preset', preset: 'today' })
  const [costsState, setCostsState] = useState<AdminCostsReadState>({ status: 'idle' })
  const [costsRefresh, setCostsRefresh] = useState(0)
  const [healthWindow, setHealthWindow] = useState<SystemHealthWindow>('1h')
  const [healthReload, setHealthReload] = useState(0)
  const [healthReadState, setHealthReadState] = useState<SystemHealthReadState>({ status: 'loading' })
  const [validationState, setValidationState] = useState<CurriculumValidationReadState>({ status: 'loading' })
  const [validationRetry, setValidationRetry] = useState(0)
  const [engineState, setEngineState] = useState<EnginePerformanceReadState>({ status: 'loading' })
  const [selectedEngine, setSelectedEngine] = useState<AdminEngineId>(() => adminRouteEngine(window.location.pathname) ?? 'tutor')
  const [engineWindow, setEngineWindow] = useState<EnginePerformanceWindowPreset>('30d')
  const [selectedEngineVersion, setSelectedEngineVersion] = useState<string | null>(null)
  const [engineRetry, setEngineRetry] = useState(0)
  const [learnerState, setLearnerState] = useState<LearnerAnalyticsViewState>({ status: 'resolving' })
  const [learnerRetry, setLearnerRetry] = useState(0)
  const [safetyReadState, setSafetyReadState] = useState<SafetyOperationsReadState>({ status: 'loading' })
  const [safetyRetry, setSafetyRetry] = useState(0)
  const [auditFilters, setAuditFilters] = useState<AdminAuditFilters>({ limit: 50 })
  const [auditCursors, setAuditCursors] = useState<readonly (string | null)[]>([null])
  const [auditReadState, setAuditReadState] = useState<AdminAuditReadState>({ status: 'loading' })
  const [auditRetry, setAuditRetry] = useState(0)
  const [incidentFilters, setIncidentFilters] = useState<AdminIncidentFilters>(() => defaultIncidentFilters())
  const [incidentCursors, setIncidentCursors] = useState<readonly (string | null)[]>([null])
  const [incidentReadState, setIncidentReadState] = useState<AdminIncidentReadState>({ status: 'loading' })
  const [incidentRetry, setIncidentRetry] = useState(0)
  const [configurationReadState, setConfigurationReadState] = useState<AdminConfigurationReadState>({ status: 'loading' })
  const [configurationRetry, setConfigurationRetry] = useState(0)
  const [voiceCatalogState, setVoiceCatalogState] = useState<AdminVoiceCatalogReadState>({ status: 'loading' })
  const [configurationDirty, setConfigurationDirty] = useState(false)
  const [accessReadState, setAccessReadState] = useState<AdminAccessReadState>({ status: 'loading' })
  const [accessRetry, setAccessRetry] = useState(0)
  const [readinessState, setReadinessState] = useState<ProductionReadinessReadState>({ status: 'loading' })
  const [readinessRetry, setReadinessRetry] = useState(0)
  const [attentionState, setAttentionState] = useState<AdminAttentionReadState>({ status: 'loading' })
  const [attentionRetry, setAttentionRetry] = useState(0)
  const curriculumSource = useMemo(() => createAdminCurriculumHttpSource(), [])
  const curriculumStudioSource = useMemo(
    () => createCurriculumStudioSource(curriculumSource),
    [curriculumSource],
  )
  const learnerSource = useMemo(() => createAdminLearnerAnalyticsHttpSource(), [])
  const configurationSource = useMemo(() => createAdminConfigurationHttpSource(), [])
  const voiceCatalogSource = useMemo(() => getVoiceCatalogAccess(), [])
  const accessSource = useMemo(() => createAdminAccessHttpSource(), [])
  const authorization = presentationAuthorization(authorizationState)
  const section = adminRouteSection(pathname) ?? 'unknown'
  const auditCursor = auditCursors.at(-1) ?? null
  const incidentCursor = incidentCursors.at(-1) ?? null
  const pathnameRef = useRef(pathname)
  const configurationDirtyRef = useRef(configurationDirty)

  pathnameRef.current = pathname
  configurationDirtyRef.current = configurationDirty

  useEffect(() => {
    const controller = new AbortController()
    void readAdminAuthorization({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setAuthorizationState(state)
    })
    return () => controller.abort()
  }, [authorizationReload])

  useEffect(() => {
    if (section !== 'attention') return
    if (!hasCapability(authorization, 'overview:read')) {
      setAttentionState({ status: 'error' })
      return
    }
    const controller = new AbortController()
    setAttentionState({ status: 'loading' })
    void loadAdminAttentionCenter(authorization.capabilities, {
      signal: controller.signal,
      today: isoToday(),
    }).then(
      (model) => {
        if (!controller.signal.aborted) setAttentionState({ status: 'ready', model })
      },
      () => {
        if (!controller.signal.aborted) setAttentionState({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [attentionRetry, authorizationState, section])

  useEffect(() => {
    if (section !== 'access') return
    if (!hasCapability(authorization, 'overview:read')) {
      setAccessReadState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setAccessReadState({ status: 'loading' })
    void accessSource.read({ signal: controller.signal }).then(
      (projection) => {
        if (!controller.signal.aborted) setAccessReadState({ status: 'ready', projection })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminAccessError && error.code === 'access_unauthorized') {
          setAccessReadState({ status: 'unauthorized' })
          return
        }
        setAccessReadState({
          status: 'error',
          code: error instanceof AdminAccessError && error.code === 'access_timeout'
            ? 'access_timeout'
            : error instanceof AdminAccessError && error.code === 'access_malformed'
              ? 'access_malformed' : 'access_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [accessRetry, accessSource, authorizationState, section])

  useEffect(() => {
    if (section !== 'overview') return
    if (!hasCapability(authorization, 'overview:read')) {
      setOverviewState({ status: 'error', code: 'overview_unavailable' })
      return
    }
    const controller = new AbortController()
    setOverviewState({ status: 'loading' })
    void readAdminOverview(range, { signal: controller.signal }).then(
      (model) => {
        if (!controller.signal.aborted) setOverviewState({ status: 'ready', model })
      },
      (error) => {
        if (controller.signal.aborted) return
        setOverviewState({
          status: 'error',
          code: error instanceof AdminOverviewReadError && error.code === 'overview_timeout'
            ? 'overview_timeout'
            : 'overview_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, overviewReload, range, section])

  useEffect(() => {
    if (!hasCapability(authorization, 'safety:read') || section !== 'safety') {
      setSafetyReadState({ status: 'loading' })
      return
    }
    const controller = new AbortController()
    setSafetyReadState({ status: 'loading' })
    void readAdminSafetyOperations({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setSafetyReadState(state)
    })
    return () => controller.abort()
  }, [authorizationState, safetyRetry, section])

  useEffect(() => {
    if (section !== 'audit-log') return
    if (!hasCapability(authorization, 'audit:read')) {
      setAuditReadState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setAuditReadState((current) => current.status === 'loading-page'
      ? current
      : { status: 'loading' })
    void readAdminAuditPage(auditFilters, auditCursor, { signal: controller.signal }).then(
      (page) => {
        if (controller.signal.aborted) return
        setAuditReadState(page.events.length === 0
          ? { status: 'empty' }
          : { status: 'ready', page })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminAuditReadError && error.code === 'audit_unauthorized') {
          setAuditReadState({ status: 'unauthorized' })
          return
        }
        setAuditReadState({
          status: 'error',
          code: error instanceof AdminAuditReadError && error.code === 'audit_timeout'
            ? 'audit_timeout'
            : error instanceof AdminAuditReadError && error.code === 'audit_malformed'
              ? 'audit_malformed'
              : 'audit_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, section, auditFilters, auditCursor, auditRetry])

  useEffect(() => {
    if (section !== 'incidents') return
    const canReadAnySource = authorization.status === 'authorized'
      && ['engines:read', 'audit:read', 'costs:read'].some((capability) =>
        authorization.capabilities.includes(capability as AdminCapability))
    if (!canReadAnySource) {
      setIncidentReadState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setIncidentReadState((current) => current.status === 'loading-page' ? current : { status: 'loading' })
    void readAdminIncidentPage(incidentFilters, incidentCursor, { signal: controller.signal }).then(
      (page) => {
        if (controller.signal.aborted) return
        setIncidentReadState(page.events.length === 0 ? { status: 'empty', page } : { status: 'ready', page })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminIncidentReadError && error.code === 'incident_unauthorized') {
          setIncidentReadState({ status: 'unauthorized' })
          return
        }
        setIncidentReadState({
          status: 'error',
          code: error instanceof AdminIncidentReadError && error.code !== 'incident_unauthorized'
            ? error.code
            : 'incident_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, section, incidentFilters, incidentCursor, incidentRetry])

  useEffect(() => {
    if (section !== 'configuration') return
    if (!hasCapability(authorization, 'configuration:read')) {
      setConfigurationReadState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setConfigurationReadState({ status: 'loading' })
    setVoiceCatalogState({ status: 'loading' })
    void configurationSource.read({ signal: controller.signal }).then(
      (projection) => {
        if (!controller.signal.aborted) setConfigurationReadState({ status: 'ready', projection })
      },
      (error) => {
        if (controller.signal.aborted) return
        setConfigurationReadState({
          status: 'error',
          code: error instanceof AdminConfigurationError && error.code === 'configuration_timeout'
            ? 'configuration_timeout' : 'configuration_unavailable',
        })
      },
    )
    void voiceCatalogSource.load().then((catalog) => {
      if (!controller.signal.aborted) setVoiceCatalogState({ status: 'ready', catalog })
    })
    return () => controller.abort()
  }, [authorizationState, configurationRetry, configurationSource, section, voiceCatalogSource])

  useEffect(() => {
    if (section !== 'curriculum-validation') {
      setValidationState({ status: 'loading' })
      return
    }
    if (!hasCapability(authorization, 'curriculum:read')) {
      setValidationState({ status: 'denied' })
      return
    }
    const controller = new AbortController()
    setValidationState({ status: 'loading' })
    void readAdminCurriculumValidation({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setValidationState(state)
    })
    return () => controller.abort()
  }, [authorizationState, section, validationRetry])

  useEffect(() => {
    if (section !== 'engines') return
    const requestedEngine = adminRouteEngine(pathname)
    if (!requestedEngine || requestedEngine === selectedEngine) return
    setSelectedEngine(requestedEngine)
    setSelectedEngineVersion(null)
  }, [pathname, section, selectedEngine])

  useEffect(() => {
    if (section !== 'engines') return
    if (
      authorizationState.status !== 'authorized'
      || !authorizationState.capabilities.includes('engines:read')
    ) {
      setEngineState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setEngineState({ status: 'loading' })
    void readAdminEnginePerformance({
      window: engineWindow,
      engine: selectedEngine,
      engineVersion: selectedEngineVersion,
      signal: controller.signal,
    }).then((state) => {
      if (!controller.signal.aborted) setEngineState(state)
    })
    return () => controller.abort()
  }, [authorizationState, section, selectedEngine, engineWindow, selectedEngineVersion, engineRetry])

  useEffect(() => {
    if (section !== 'learners') return
    const current = presentationAuthorization(authorizationState)
    if (current.status === 'resolving') {
      setLearnerState({ status: 'resolving' })
      return
    }
    if (current.status !== 'authorized' || !current.capabilities.includes('learners:read')) {
      setLearnerState({ status: 'unauthorized', reasonCode: current.status === 'unauthorized' ? current.reasonCode : 'learners_read_required' })
      return
    }
    let active = true
    setLearnerState({ status: 'loading' })
    void loadLearnerAnalytics(current, learnerSource, isoToday()).then((state) => {
      if (active) setLearnerState(state)
    })
    return () => { active = false }
  }, [authorizationState, learnerRetry, learnerSource, section])

  useEffect(() => {
    if (section !== 'costs') return
    if (!hasCapability(authorization, 'costs:read')) {
      setCostsState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    const retained = costsState.status === 'ready' && costRangeMatches(costsState.model.range, costRange)
      ? costsState
      : null
    if (!retained) setCostsState({ status: 'loading' })
    void readAdminCosts(costRange, { signal: controller.signal }).then(
      (model) => {
        if (!controller.signal.aborted) setCostsState({ status: 'ready', model, freshness: 'current' })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminCostsReadError && error.code === 'costs_unauthorized') {
          setCostsState({ status: 'unauthorized' })
          return
        }
        if (retained) setCostsState({ ...retained, freshness: 'stale' })
        else setCostsState({
          status: 'error',
          code: error instanceof AdminCostsReadError && error.code !== 'costs_unauthorized'
            ? error.code
            : 'costs_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, costRange, costsRefresh, section])

  useEffect(() => {
    if (section !== 'system-health' || !hasCapability(authorization, 'health:read')) {
      setHealthReadState(section === 'system-health' ? { status: 'denied' } : { status: 'loading' })
      return
    }
    const controller = new AbortController()
    setHealthReadState({ status: 'loading' })
    void readSystemHealth({ window: healthWindow, signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setHealthReadState(state)
    })
    return () => controller.abort()
  }, [authorizationState, section, healthWindow, healthReload])

  useEffect(() => {
    if (section !== 'releases') return
    if (!hasCapability(authorization, 'releases:read')) {
      setReadinessState({ status: 'denied' })
      return
    }
    const controller = new AbortController()
    setReadinessState({ status: 'loading' })
    void readAdminProductionReadiness({ signal: controller.signal }).then(
      (projection) => {
        if (!controller.signal.aborted) setReadinessState({ status: 'ready', projection })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminProductionReadinessError && error.code === 'unauthorized') {
          setReadinessState({ status: 'denied' })
          return
        }
        setReadinessState({
          status: 'error',
          code: error instanceof AdminProductionReadinessError
            && (error.code === 'timeout' || error.code === 'malformed')
            ? error.code : 'unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, readinessRetry, section])

  useEffect(() => {
    const onPopState = () => {
      if (adminRouteSection(pathnameRef.current) === 'configuration'
        && configurationDirtyRef.current
        && !window.confirm('Discard unsaved configuration changes?')) {
        window.history.pushState({}, '', pathnameRef.current)
        return
      }
      configurationDirtyRef.current = false
      setConfigurationDirty(false)
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(next: AdminSection) {
    if (section === 'configuration' && configurationDirty
      && !window.confirm('Discard unsaved configuration changes?')) return
    const nextPath = next === 'overview'
      ? ADMIN_CONSOLE_PATH
      : next === 'system-health'
        ? `${ADMIN_CONSOLE_PATH}/health`
        : next === 'releases'
          ? `${ADMIN_CONSOLE_PATH}/production-readiness`
        : `${ADMIN_CONSOLE_PATH}/${next}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
    setConfigurationDirty(false)
  }

  function navigateEngine(engine: AdminEngineId) {
    const nextPath = `${ADMIN_CONSOLE_PATH}/engines/${engine}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function navigateLearner(learnerRef: string | null) {
    const nextPath = learnerRef
      ? `${ADMIN_CONSOLE_PATH}/learners/${learnerRef}`
      : `${ADMIN_CONSOLE_PATH}/learners`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function navigateCurriculum(view: CurriculumWorkflowView) {
    const nextPath = view === 'published'
      ? `${ADMIN_CONSOLE_PATH}/curriculum`
      : `${ADMIN_CONSOLE_PATH}/curriculum/${view}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function applyAuditFilters(filters: AdminAuditFilters) {
    setAuditReadState({ status: 'loading' })
    setAuditFilters(filters)
    setAuditCursors([null])
  }

  function showOlderAuditEvents(cursor: string) {
    setAuditReadState((current) => current.status === 'ready'
      ? { status: 'loading-page', page: current.page, direction: 'older' }
      : current)
    setAuditCursors((current) => [...current, cursor])
  }

  function showNewerAuditEvents() {
    setAuditReadState((current) => current.status === 'ready'
      ? { status: 'loading-page', page: current.page, direction: 'newer' }
      : current)
    setAuditCursors((current) => current.length > 1 ? current.slice(0, -1) : current)
  }

  function applyIncidentFilters(filters: AdminIncidentFilters) {
    setIncidentReadState({ status: 'loading' })
    setIncidentFilters(filters)
    setIncidentCursors([null])
  }

  function showOlderIncidentEvents(cursor: string) {
    setIncidentReadState((current) => current.status === 'ready' || current.status === 'empty'
      ? { status: 'loading-page', page: current.page, direction: 'older' }
      : current)
    setIncidentCursors((current) => [...current, cursor])
  }

  function showNewerIncidentEvents() {
    setIncidentReadState((current) => current.status === 'ready' || current.status === 'empty'
      ? { status: 'loading-page', page: current.page, direction: 'newer' }
      : current)
    setIncidentCursors((current) => current.length > 1 ? current.slice(0, -1) : current)
  }

  function applyConfigurationCommit(_result: AdminConfigurationCommitResult) {
    setConfigurationReadState(configurationReadStateAfterCommit())
    setConfigurationRetry(configurationRetryAfterCommit)
  }

  if (authorization.status === 'resolving') return <AdminConsole authorization={authorization} />
  if (authorization.status === 'unauthorized') return <AdminConsole authorization={authorization} />

  if (section === 'overview') {
    return (
      <AdminConsole
        authorization={authorization}
        overview={overviewState}
        selectedRange={range}
        onRangeChange={setRange}
        onRetry={() => setOverviewReload((value) => value + 1)}
        onNavigate={navigate}
      />
    )
  }

  const activeSection: AdminSection = (
    section === 'curriculum-studio'
    || section === 'curriculum-validation'
    || section === 'curriculum-preview'
  )
    ? 'curriculum'
    : section === 'unknown' ? 'overview' : section
  const title = section === 'curriculum-studio'
    ? 'Curriculum Studio'
    : section === 'curriculum-validation'
    ? 'Curriculum validation'
    : section === 'curriculum-preview' ? 'Curriculum Preview / Diff'
    : section === 'attention' ? 'Admin Attention Center'
      : section === 'system-health' ? 'System Health'
      : section === 'engines' ? `${ENGINE_PAGE_LABELS[selectedEngine]} Engine Performance`
        : section === 'costs' ? 'AI & Costs'
          : section === 'learners' ? (adminRouteLearnerRef(pathname) ? 'Learner Detail' : 'Learner Operations')
            : section === 'safety' ? 'Safety Operations'
              : section === 'incidents' ? 'Incident Explorer'
              : section === 'audit-log' ? 'Audit Log'
                : section === 'access' ? 'Access & Permissions'
                : section === 'configuration' ? 'Configuration'
                : section === 'curriculum' ? 'Curriculum'
                  : section === 'releases' ? 'Production Readiness' : 'Admin section unavailable'

  return (
    <AdminShell
      authorization={authorization}
      activeSection={activeSection}
      title={title}
      onNavigate={navigate}
    >
        {section === 'attention' && (
          <AdminAttentionCenter
            state={attentionState}
            onRetry={() => setAttentionRetry((value) => value + 1)}
          />
        )}
        {section === 'learners' && (
          <LearnerAnalytics
            state={learnerState}
            selectedLearnerRef={adminRouteLearnerRef(pathname)}
            onLearnerSelect={navigateLearner}
            onRetry={() => setLearnerRetry((value) => value + 1)}
          />
        )}
        {section === 'engines' && (
          <EnginePerformanceDashboard
            state={hasCapability(authorization, 'engines:read') ? engineState : { status: 'unauthorized' }}
            selectedEngine={selectedEngine}
            selectedWindow={engineWindow}
            selectedVersion={selectedEngineVersion}
            onEngineChange={(engine) => {
              setSelectedEngine(engine)
              setSelectedEngineVersion(null)
              navigateEngine(engine)
            }}
            onWindowChange={(window) => {
              setEngineWindow(window)
              setSelectedEngineVersion(null)
            }}
            onVersionChange={setSelectedEngineVersion}
            onRetry={() => setEngineRetry((value) => value + 1)}
          />
        )}
        {section === 'costs' && (
          <AdminCostsDashboard
            authorized={hasCapability(authorization, 'costs:read')}
            state={costsState}
            range={costRange}
            onRangeChange={setCostRange}
            onRetry={() => setCostsRefresh((value) => value + 1)}
          />
        )}
        {section === 'safety' && (
          <AdminSafetyOperations
            authorization={hasCapability(authorization, 'safety:read')
              ? { status: 'authorized', role: authorization.role, capabilities: authorization.capabilities }
              : { status: 'denied', reasonCode: 'safety_read_required' }}
            readState={safetyReadState}
            onRetry={() => setSafetyRetry((value) => value + 1)}
          />
        )}
        {section === 'curriculum' && (
          <>
            <CurriculumWorkflowNav current="published" onNavigate={navigateCurriculum} />
            <CurriculumBrowser
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumSource}
            />
          </>
        )}
        {section === 'curriculum-studio' && (
          <>
            <CurriculumWorkflowNav current="studio" onNavigate={navigateCurriculum} />
            <CurriculumStudio
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumStudioSource}
            />
          </>
        )}
        {section === 'curriculum-validation' && (
          <>
            <CurriculumWorkflowNav current="validation" onNavigate={navigateCurriculum} />
            <CurriculumValidationDashboard
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { state: 'authorized', capability: 'curriculum:read' }
                : { state: 'denied' }}
              readState={validationState}
              onRetry={() => setValidationRetry((value) => value + 1)}
            />
          </>
        )}
        {section === 'curriculum-preview' && (
          <>
            <CurriculumWorkflowNav current="preview" onNavigate={navigateCurriculum} />
            <CurriculumPreviewUnavailable />
          </>
        )}
        {section === 'system-health' && (
          <SystemHealthDashboard
            authorization={authorization}
            readState={healthReadState}
            selectedWindow={healthWindow}
            onWindowChange={setHealthWindow}
            onRetry={() => setHealthReload((value) => value + 1)}
          />
        )}
        {section === 'audit-log' && (
          <AdminAuditLog
            authorized={hasCapability(authorization, 'audit:read')}
            state={auditReadState}
            filters={auditFilters}
            pageNumber={auditCursors.length}
            canGoBack={auditCursors.length > 1}
            onFiltersChange={applyAuditFilters}
            onNext={showOlderAuditEvents}
            onPrevious={showNewerAuditEvents}
            onRetry={() => setAuditRetry((value) => value + 1)}
          />
        )}
        {section === 'incidents' && (
          <AdminCorrelationExplorer
            authorized={['engines:read', 'audit:read', 'costs:read'].some((capability) =>
              hasCapability(authorization, capability as AdminCapability))}
            state={incidentReadState}
            filters={incidentFilters}
            pageNumber={incidentCursors.length}
            canGoBack={incidentCursors.length > 1}
            onFiltersChange={applyIncidentFilters}
            onNext={showOlderIncidentEvents}
            onPrevious={showNewerIncidentEvents}
            onRetry={() => setIncidentRetry((value) => value + 1)}
          />
        )}
        {section === 'configuration' && (
          <AdminConfiguration
            authorization={authorization}
            state={configurationReadState}
            voiceCatalog={voiceCatalogState}
            source={configurationSource}
            onCommitted={applyConfigurationCommit}
            onRetry={() => setConfigurationRetry((value) => value + 1)}
            onDirtyChange={setConfigurationDirty}
          />
        )}
        {section === 'access' && (
          <AdminAccessPermissions
            authorization={authorization}
            state={accessReadState}
            source={accessSource}
            onMutated={() => {
              setAccessRetry((value) => value + 1)
              setAuthorizationReload((value) => value + 1)
            }}
          />
        )}
        {section === 'releases' && (
          <ProductionReadinessCenter
            state={readinessState}
            onRetry={() => setReadinessRetry((value) => value + 1)}
          />
        )}
        {!['attention', 'learners', 'engines', 'costs', 'safety', 'curriculum', 'curriculum-studio', 'curriculum-validation', 'curriculum-preview', 'system-health', 'incidents', 'configuration', 'audit-log', 'access', 'releases'].includes(section) && (
          <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold">Admin section unavailable</h1>
            <p className="mt-3 text-slate-600">No authorized read projection is implemented for this section. No substitute data is shown.</p>
          </section>
        )}
    </AdminShell>
  )
}

function costRangeMatches(
  resolved: { readonly kind: string; readonly start: string; readonly end: string },
  selected: AdminCostRangeSelection,
): boolean {
  return selected.kind === 'preset'
    ? resolved.kind === selected.preset
    : resolved.kind === 'custom' && resolved.start === selected.start && resolved.end === selected.end
}
