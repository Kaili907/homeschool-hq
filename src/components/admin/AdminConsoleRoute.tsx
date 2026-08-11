import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { withAdminDependencyTimeout } from '../../admin/adminDependencyTimeout'
import type { AdminCostRangeSelection, AdminCostsReadState } from '../../admin/costsModel'
import {
  AdminProviderPricingHttpError,
  readAdminProviderPricing,
} from '../../admin/providerPricingHttpSource'
import type { ProviderPricingReadState } from '../../admin/providerPricingModel'
import { readAdminAuditPage, AdminAuditReadError } from '../../admin/auditHttpSource'
import type { AdminAuditFilters, AdminAuditReadState } from '../../admin/auditLogModel'
import { AdminIncidentReadError, readAdminIncidentPage } from '../../admin/incidentExplorerHttpSource'
import type { AdminIncidentFilters, AdminIncidentReadState } from '../../admin/incidentExplorerModel'
import { createAdminCurriculumHttpSource } from '../../admin/curriculum/httpSource'
import { createCurriculumDraftAuthoringHttpSource } from '../../admin/curriculum-authoring/httpSource'
import { createCurriculumApprovalHttpSource } from '../../admin/curriculum-approval/httpSource'
import { createCurriculumStagingHttpSource } from '../../admin/curriculum-staging/httpSource'
import { createCurriculumIntegrityHttpSource } from '../../admin/curriculum-integrity/httpSource'
import { createCurriculumPublishingHttpSource } from '../../admin/curriculum-publishing/httpSource'
import { createCurriculumActivationHttpSource } from '../../admin/curriculum-activation/httpSource'
import { createCurriculumReleaseHistoryHttpSource } from '../../admin/curriculum-history/httpSource'
import {
  createCurriculumStudioSource,
  CURRICULUM_STUDIO_NAVIGATION_REQUEST,
} from '../../admin/curriculum/studioModel'
import {
  createCurriculumStandardsReviewHttpSource,
} from '../../admin/curriculum-standards-review/httpSource'
import {
  CurriculumStandardsReviewError,
  type CurriculumStandardsReviewDecision,
  type CurriculumStandardsReviewItem,
} from '../../admin/curriculum-standards-review/contracts'
import { readAdminSafetyOperations } from '../../admin/safetyOperationsHttpSource'
import type { SafetyOperationsReadState } from '../../admin/safetyOperationsModel'
import { CurriculumBrowser } from '../../admin/curriculum/CurriculumBrowser'
import { CurriculumStudio } from '../../admin/curriculum/CurriculumStudio'
import { CurriculumReleaseIntegrity } from '../../admin/curriculum/CurriculumReleaseIntegrity'
import { CurriculumActivationControl } from '../../admin/curriculum/CurriculumActivationControl'
import { CurriculumReleaseHistory } from '../../admin/curriculum/CurriculumReleaseHistory'
import {
  CurriculumWorkflowNav,
  type CurriculumWorkflowView,
} from '../../admin/curriculum/CurriculumWorkflowNav'
import { CurriculumPreview } from '../../admin/curriculum-preview/CurriculumPreview'
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
import { readAdminStudyOperations } from '../../admin/studyOperationsHttpSource'
import type { StudyOperationsReadState } from '../../admin/studyOperationsModel'
import { AdminConsole, AdminShell } from './AdminConsole'
import { AdminCostsDashboard } from './AdminCostsDashboard'
import { AdminProviderPricingDashboard } from './AdminProviderPricingDashboard'
import { LearnerAnalytics } from './LearnerAnalytics'
import { AdminSafetyOperations } from './AdminSafetyOperations'
import { CurriculumValidationDashboard } from './CurriculumValidationDashboard'
import {
  CurriculumStandardsReviewWorkspace,
  type CurriculumStandardsReviewReadState,
  type StandardsReviewFormValue,
} from './CurriculumStandardsReviewWorkspace'
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
import { createVoiceCatalogAccess } from '../../tutor/voiceCatalog'
import { createAdminAccessHttpSource, AdminAccessError } from '../../admin/accessHttpSource'
import { getSupabaseClient } from '../../sync/supabase'
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
import { AdminStudyOperations } from './AdminStudyOperations'

export type AdminRouteSection = AdminSection
  | 'curriculum-studio'
  | 'curriculum-integrity'
  | 'curriculum-validation'
  | 'curriculum-preview'
  | 'curriculum-standards-review'
  | 'curriculum-activation'
  | 'curriculum-history'
  | 'provider-pricing'
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

const CURRICULUM_DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function curriculumWorkflowIdentityFromSearch(search: string): {
  readonly draftId: string
  readonly draftRevision: number
} | null {
  const params = new URLSearchParams(search)
  const draftId = params.get('draft')
  const revision = params.get('revision')
  if (!draftId || !CURRICULUM_DRAFT_ID.test(draftId) || !revision || !/^[1-9][0-9]{0,14}$/.test(revision)) return null
  const draftRevision = Number(revision)
  return Number.isSafeInteger(draftRevision) ? { draftId: draftId.toLowerCase(), draftRevision } : null
}

export function adminRouteSection(pathname: string): AdminRouteSection | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (!suffix) return 'overview'
  if (suffix === 'attention') return 'attention'
  if (suffix === 'curriculum/studio') return 'curriculum-studio'
  if (suffix === 'curriculum/integrity') return 'curriculum-integrity'
  if (suffix === 'curriculum/validation') return 'curriculum-validation'
  if (suffix === 'curriculum/preview') return 'curriculum-preview'
  if (suffix === 'curriculum/standards-review') return 'curriculum-standards-review'
  if (suffix === 'learners' || adminRouteLearnerRef(pathname)) return 'learners'
  if (suffix.startsWith('learners/')) return 'unknown'
  if (suffix === 'curriculum/activation') return 'curriculum-activation'
  if (suffix === 'curriculum/history') return 'curriculum-history'
  if (suffix === 'costs/provider-pricing') return 'provider-pricing'
  if (suffix === 'health' || suffix.startsWith('health/')) return 'system-health'
  if (suffix === 'engines') return 'engines'
  if (suffix.startsWith('engines/')) return adminRouteEngine(pathname) ? 'engines' : 'unknown'
  if (suffix === 'production-readiness' || suffix === 'readiness') return 'releases'
  if (suffix === 'correlations') return 'incidents'
  const section = suffix.split('/')[0]
  return [
    'learners', 'engines', 'costs', 'curriculum', 'safety', 'system-health', 'study-operations',
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
  const [search, setSearch] = useState(() => window.location.search)
  const [range, setRange] = useState<OverviewRange>({ kind: 'preset', preset: 'today' })
  const [overviewState, setOverviewState] = useState<OverviewLoadState>({ status: 'loading' })
  const [overviewReload, setOverviewReload] = useState(0)
  const [costRange, setCostRange] = useState<AdminCostRangeSelection>({ kind: 'preset', preset: 'today' })
  const [costsState, setCostsState] = useState<AdminCostsReadState>({ status: 'idle' })
  const [costsRefresh, setCostsRefresh] = useState(0)
  const [pricingState, setPricingState] = useState<ProviderPricingReadState>({ status: 'idle' })
  const [pricingRefresh, setPricingRefresh] = useState(0)
  const [healthWindow, setHealthWindow] = useState<SystemHealthWindow>('1h')
  const [healthReload, setHealthReload] = useState(0)
  const [healthReadState, setHealthReadState] = useState<SystemHealthReadState>({ status: 'loading' })
  const [validationState, setValidationState] = useState<CurriculumValidationReadState>({ status: 'loading' })
  const [validationRetry, setValidationRetry] = useState(0)
  const [standardsReviewState, setStandardsReviewState] = useState<CurriculumStandardsReviewReadState>({ status: 'loading' })
  const [standardsReviewRetry, setStandardsReviewRetry] = useState(0)
  const [savingStandardsReviewKey, setSavingStandardsReviewKey] = useState<string | null>(null)
  const [standardsReviewSaveError, setStandardsReviewSaveError] = useState<'invalid' | 'conflict' | 'forbidden' | 'unavailable' | null>(null)
  const [studyOperationsState, setStudyOperationsState] = useState<StudyOperationsReadState>({ status: 'loading' })
  const [studyOperationsRetry, setStudyOperationsRetry] = useState(0)
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
  const curriculumAuthoringSource = useMemo(() => createCurriculumDraftAuthoringHttpSource(), [])
  const curriculumApprovalSource = useMemo(() => createCurriculumApprovalHttpSource(), [])
  const curriculumStagingSource = useMemo(() => createCurriculumStagingHttpSource(), [])
  const curriculumIntegritySource = useMemo(() => createCurriculumIntegrityHttpSource(), [])
  const curriculumPublishingSource = useMemo(() => createCurriculumPublishingHttpSource(), [])
  const curriculumActivationSource = useMemo(() => createCurriculumActivationHttpSource(), [])
  const curriculumReleaseHistorySource = useMemo(() => createCurriculumReleaseHistoryHttpSource(), [])
  const curriculumStudioSource = useMemo(
    () => createCurriculumStudioSource(
      curriculumSource,
      curriculumAuthoringSource,
      curriculumApprovalSource,
      curriculumStagingSource,
      curriculumPublishingSource,
    ),
    [curriculumApprovalSource, curriculumAuthoringSource, curriculumPublishingSource, curriculumSource, curriculumStagingSource],
  )
  const standardsReviewSource = useMemo(() => createCurriculumStandardsReviewHttpSource(), [])
  const learnerSource = useMemo(() => createAdminLearnerAnalyticsHttpSource(), [])
  const configurationSource = useMemo(() => createAdminConfigurationHttpSource(), [])
  const accessSource = useMemo(() => createAdminAccessHttpSource(), [])
  const authorization = presentationAuthorization(authorizationState)
  const section = adminRouteSection(pathname) ?? 'unknown'
  const curriculumWorkflowIdentity = curriculumWorkflowIdentityFromSearch(search)
  const auditCursor = auditCursors.at(-1) ?? null
  const incidentCursor = incidentCursors.at(-1) ?? null
  const pathnameRef = useRef(pathname)
  const configurationDirtyRef = useRef(configurationDirty)

  pathnameRef.current = pathname
  configurationDirtyRef.current = configurationDirty

  const beginAuthorizationRefresh = useCallback(() => {
    setAuthorizationState({ status: 'resolving' })
    setAuthorizationReload((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void readAdminAuthorization({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setAuthorizationState(state)
    })
    return () => controller.abort()
  }, [authorizationReload])

  useEffect(() => {
    const onOnline = () => beginAuthorizationRefresh()
    const onOffline = () => setAuthorizationState({ status: 'unavailable' })
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) beginAuthorizationRefresh()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') beginAuthorizationRefresh()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const subscription = getSupabaseClient()?.auth.onAuthStateChange((event) => {
      if (event !== 'INITIAL_SESSION') beginAuthorizationRefresh()
    }).data.subscription
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      subscription?.unsubscribe()
    }
  }, [beginAuthorizationRefresh])

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
    const voiceCatalogSource = createVoiceCatalogAccess({
      fetchImpl: (url, init) => fetch(url, init as RequestInit),
    })
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
    void withAdminDependencyTimeout(() => voiceCatalogSource.load()).then(
      (catalog) => {
        if (controller.signal.aborted) return
        setVoiceCatalogState(catalog.catalogVersion === 'unavailable'
          ? { status: 'unavailable' }
          : { status: 'ready', catalog })
      },
      () => {
        if (!controller.signal.aborted) setVoiceCatalogState({ status: 'unavailable' })
      },
    )
    return () => controller.abort()
  }, [authorizationState, configurationRetry, configurationSource, section])

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
    if (section !== 'curriculum-standards-review') {
      setStandardsReviewState({ status: 'loading' })
      return
    }
    if (!hasCapability(authorization, 'curriculum:read')) {
      setStandardsReviewState({ status: 'denied' })
      return
    }
    if (!curriculumWorkflowIdentity) {
      setStandardsReviewState({ status: 'missing-context' })
      return
    }
    let current = true
    setStandardsReviewState({ status: 'loading' })
    void standardsReviewSource.readDraftWorkspace(
      curriculumWorkflowIdentity.draftId,
      curriculumWorkflowIdentity.draftRevision,
    ).then(
      (value) => {
        if (current) setStandardsReviewState({
          status: 'ready',
          decisions: value.decisions,
          occurrences: value.occurrences,
          context: { kind: 'draft', ref: value.draftId },
          identity: {
            draftRevision: value.draftRevision,
            baseReleaseVersion: value.baseReleaseVersion,
            targetVersion: value.targetVersion,
          },
        })
      },
      (error) => {
        if (current) setStandardsReviewState(
          error instanceof CurriculumStandardsReviewError && error.code === 'conflict'
            ? { status: 'stale' }
            : { status: 'error' },
        )
      },
    )
    return () => { current = false }
  }, [authorizationState, curriculumWorkflowIdentity?.draftId, curriculumWorkflowIdentity?.draftRevision, section, standardsReviewRetry, standardsReviewSource])

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
    if (section !== 'provider-pricing') return
    if (!hasCapability(authorization, 'costs:read')) {
      setPricingState({ status: 'unauthorized' })
      return
    }
    const controller = new AbortController()
    setPricingState({ status: 'loading' })
    void readAdminProviderPricing({ signal: controller.signal }).then(
      (model) => {
        if (!controller.signal.aborted) setPricingState({ status: 'ready', model })
      },
      (error) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminProviderPricingHttpError && error.code === 'read_denied') {
          setPricingState({ status: 'unauthorized' })
          return
        }
        setPricingState({
          status: 'error',
          code: error instanceof AdminProviderPricingHttpError && error.code === 'source_timeout'
            ? 'source_timeout' : 'source_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, pricingRefresh, section])

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
    if (section !== 'study-operations' || !hasCapability(authorization, 'health:read')) {
      setStudyOperationsState(section === 'study-operations'
        ? { status: 'denied' }
        : { status: 'loading' })
      return
    }
    const controller = new AbortController()
    setStudyOperationsState({ status: 'loading' })
    void readAdminStudyOperations({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setStudyOperationsState(state)
    })
    return () => controller.abort()
  }, [authorizationState, section, studyOperationsRetry])

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname === pathnameRef.current && window.location.search === search) return
      if (adminRouteSection(pathnameRef.current) === 'configuration'
        && configurationDirtyRef.current
        && !window.confirm('Discard unsaved configuration changes?')) {
        window.history.pushState({}, '', `${pathnameRef.current}${search}`)
        return
      }
      if (!requestCurriculumStudioNavigation()) {
        window.history.pushState({}, '', `${pathnameRef.current}${search}`)
        return
      }
      configurationDirtyRef.current = false
      setConfigurationDirty(false)
      beginAuthorizationRefresh()
      setPathname(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [beginAuthorizationRefresh, pathname, search])

  function navigate(next: AdminSection) {
    if (section === 'configuration' && configurationDirty
      && !window.confirm('Discard unsaved configuration changes?')) return
    if (!requestCurriculumStudioNavigation()) return
    const nextPath = next === 'overview'
      ? ADMIN_CONSOLE_PATH
      : next === 'system-health'
        ? `${ADMIN_CONSOLE_PATH}/health`
        : next === 'releases'
          ? `${ADMIN_CONSOLE_PATH}/production-readiness`
        : `${ADMIN_CONSOLE_PATH}/${next}`
    window.history.pushState({}, '', nextPath)
    beginAuthorizationRefresh()
    setPathname(nextPath)
    setConfigurationDirty(false)
    setSearch('')
  }

  function navigateEngine(engine: AdminEngineId) {
    if (!requestCurriculumStudioNavigation()) return
    const nextPath = `${ADMIN_CONSOLE_PATH}/engines/${engine}`
    window.history.pushState({}, '', nextPath)
    beginAuthorizationRefresh()
    setPathname(nextPath)
    setSearch('')
  }

  function navigateLearner(learnerRef: string | null) {
    const nextPath = learnerRef
      ? `${ADMIN_CONSOLE_PATH}/learners/${learnerRef}`
      : `${ADMIN_CONSOLE_PATH}/learners`
    window.history.pushState({}, '', nextPath)
    beginAuthorizationRefresh()
    setPathname(nextPath)
  }

  function navigateCurriculum(_view: CurriculumWorkflowView, href: string) {
    if (!requestCurriculumStudioNavigation()) return
    const next = new URL(href, window.location.origin)
    window.history.pushState({}, '', `${next.pathname}${next.search}${next.hash}`)
    beginAuthorizationRefresh()
    setPathname(next.pathname)
    setSearch(next.search)
  }

  function navigateToProviderPricing() {
    const nextPath = `${ADMIN_CONSOLE_PATH}/costs/provider-pricing`
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

  async function updateStandardsReview(item: CurriculumStandardsReviewItem, value: StandardsReviewFormValue) {
    const { decision, status: _currentStatus, ...candidate } = item
    setSavingStandardsReviewKey(item.reviewKey)
    setStandardsReviewSaveError(null)
    try {
      const result = await standardsReviewSource.update({
        ...candidate,
        ...value,
        expectedRevision: decision?.revision ?? 0,
        idempotencyKey: crypto.randomUUID(),
      })
      setStandardsReviewState((current) => {
        if (current.status !== 'ready') return current
        const decisions: CurriculumStandardsReviewDecision[] = current.decisions
          .filter((currentDecision) => currentDecision.reviewKey !== result.decision.reviewKey)
          .concat(result.decision)
        return { ...current, decisions }
      })
    } catch (error) {
      const code = error instanceof CurriculumStandardsReviewError ? error.code : 'unavailable'
      setStandardsReviewSaveError(code === 'invalid' ? 'invalid'
        : code === 'conflict' ? 'conflict'
          : code === 'forbidden' || code === 'unauthenticated' ? 'forbidden' : 'unavailable')
    } finally {
      setSavingStandardsReviewKey(null)
    }
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
    || section === 'curriculum-integrity'
    || section === 'curriculum-validation'
    || section === 'curriculum-preview'
    || section === 'curriculum-standards-review'
    || section === 'curriculum-activation'
    || section === 'curriculum-history'
  )
    ? 'curriculum'
    : section === 'provider-pricing' ? 'costs'
    : section === 'unknown' ? 'overview' : section
  const title = section === 'curriculum-studio'
    ? 'Curriculum Studio'
    : section === 'curriculum-integrity' ? 'Curriculum Release Integrity / Provenance'
    : section === 'curriculum-validation' ? 'Curriculum validation'
      : section === 'curriculum-preview' ? 'Curriculum Preview / Diff'
        : section === 'curriculum-standards-review' ? 'Curriculum standards review'
          : section === 'curriculum-activation' ? 'Curriculum Activation & Rollback'
            : section === 'curriculum-history' ? 'Curriculum Release History & Governance'
              : section === 'attention' ? 'Admin Attention Center'
                : section === 'system-health' ? 'System Health'
                  : section === 'engines' ? `${ENGINE_PAGE_LABELS[selectedEngine]} Engine Performance`
                    : section === 'study-operations' ? 'Study Operations'
                      : section === 'costs' ? 'AI & Costs'
                        : section === 'provider-pricing' ? 'Provider Pricing'
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
            onOpenProviderPricing={navigateToProviderPricing}
          />
        )}
        {section === 'provider-pricing' && (
          <AdminProviderPricingDashboard
            readAuthorized={hasCapability(authorization, 'costs:read')}
            manageAuthorized={hasCapability(authorization, 'configuration:manage')}
            state={pricingState}
            onRetry={() => setPricingRefresh((value) => value + 1)}
            onUpdated={() => setPricingRefresh((value) => value + 1)}
            onBack={() => navigate('costs')}
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
          <CurriculumStudio
            authorization={hasCapability(authorization, 'curriculum:read')
              ? { status: 'authorized', capabilities: authorization.capabilities }
              : { status: 'denied' }}
            source={curriculumStudioSource}
          />
        )}
        {section === 'curriculum-integrity' && (
          <>
            <CurriculumWorkflowNav current="integrity" onNavigate={navigateCurriculum} />
            <CurriculumReleaseIntegrity
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumIntegritySource}
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
            <CurriculumWorkflowNav current="preview" identity={curriculumWorkflowIdentity} onNavigate={navigateCurriculum} />
            <CurriculumPreview
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumAuthoringSource}
            />
          </>
        )}
        {section === 'curriculum-standards-review' && (
          <>
            <CurriculumWorkflowNav current="standards-review" identity={curriculumWorkflowIdentity} onNavigate={navigateCurriculum} />
            <CurriculumStandardsReviewWorkspace
              readState={standardsReviewState}
              canManage={hasCapability(authorization, 'curriculum:drafts:write')}
              canApprove={hasCapability(authorization, 'curriculum:approve')}
              savingReviewKey={savingStandardsReviewKey}
              saveError={standardsReviewSaveError}
              onRetry={() => setStandardsReviewRetry((value) => value + 1)}
              onUpdate={updateStandardsReview}
            />
          </>
        )}
        {section === 'curriculum-activation' && (
          <>
            <CurriculumWorkflowNav current="activation" onNavigate={navigateCurriculum} />
            <CurriculumActivationControl
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumActivationSource}
            />
          </>
        )}
        {section === 'curriculum-history' && (
          <>
            <CurriculumWorkflowNav current="history" onNavigate={navigateCurriculum} />
            <CurriculumReleaseHistory
              authorization={hasCapability(authorization, 'curriculum:read')
                ? { status: 'authorized', capabilities: authorization.capabilities }
                : { status: 'denied' }}
              source={curriculumReleaseHistorySource}
            />
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
        {section === 'study-operations' && (
          <AdminStudyOperations
            authorized={hasCapability(authorization, 'health:read')}
            state={studyOperationsState}
            onRetry={() => setStudyOperationsRetry((value) => value + 1)}
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
              beginAuthorizationRefresh()
            }}
          />
        )}
        {section === 'releases' && (
          <ProductionReadinessCenter
            state={readinessState}
            onRetry={() => setReadinessRetry((value) => value + 1)}
          />
        )}
        {!['attention', 'learners', 'engines', 'costs', 'provider-pricing', 'safety', 'curriculum', 'curriculum-studio', 'curriculum-integrity', 'curriculum-validation', 'curriculum-standards-review', 'curriculum-preview', 'curriculum-activation', 'curriculum-history', 'system-health', 'study-operations', 'incidents', 'configuration', 'audit-log', 'access', 'releases'].includes(section) && (
          <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="text-2xl font-bold">Admin section unavailable</h2>
            <p className="mt-3 text-slate-600">No authorized read projection is implemented for this section. No substitute data is shown.</p>
          </section>
        )}
    </AdminShell>
  )
}

function requestCurriculumStudioNavigation(): boolean {
  return window.dispatchEvent(new Event(CURRICULUM_STUDIO_NAVIGATION_REQUEST, { cancelable: true }))
}

function costRangeMatches(
  resolved: { readonly kind: string; readonly start: string; readonly end: string },
  selected: AdminCostRangeSelection,
): boolean {
  return selected.kind === 'preset'
    ? resolved.kind === selected.preset
    : resolved.kind === 'custom' && resolved.start === selected.start && resolved.end === selected.end
}
