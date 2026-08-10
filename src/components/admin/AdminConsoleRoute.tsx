import { useEffect, useMemo, useState } from 'react'
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
import { createAdminCurriculumHttpSource } from '../../admin/curriculum/httpSource'
import { createCurriculumDraftAuthoringHttpSource } from '../../admin/curriculum-authoring/httpSource'
import { createCurriculumApprovalHttpSource } from '../../admin/curriculum-approval/httpSource'
import { createCurriculumStagingHttpSource } from '../../admin/curriculum-staging/httpSource'
import { createCurriculumPublishingHttpSource } from '../../admin/curriculum-publishing/httpSource'
import {
  createCurriculumStudioSource,
  CURRICULUM_STUDIO_NAVIGATION_REQUEST,
} from '../../admin/curriculum/studioModel'
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
  if (suffix === 'curriculum/studio') return 'curriculum-studio'
  if (suffix === 'curriculum/validation') return 'curriculum-validation'
  if (suffix === 'curriculum/preview') return 'curriculum-preview'
  if (suffix === 'health' || suffix.startsWith('health/')) return 'system-health'
  if (suffix === 'engines') return 'engines'
  if (suffix.startsWith('engines/')) return adminRouteEngine(pathname) ? 'engines' : 'unknown'
  const section = suffix.split('/')[0]
  return [
    'learners', 'costs', 'curriculum', 'safety', 'system-health',
    'configuration', 'audit-log', 'releases',
  ].includes(section) ? section as AdminSection : 'unknown'
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
  const curriculumSource = useMemo(() => createAdminCurriculumHttpSource(), [])
  const curriculumAuthoringSource = useMemo(() => createCurriculumDraftAuthoringHttpSource(), [])
  const curriculumApprovalSource = useMemo(() => createCurriculumApprovalHttpSource(), [])
  const curriculumStagingSource = useMemo(() => createCurriculumStagingHttpSource(), [])
  const curriculumPublishingSource = useMemo(() => createCurriculumPublishingHttpSource(), [])
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
  const learnerSource = useMemo(() => createAdminLearnerAnalyticsHttpSource(), [])
  const authorization = presentationAuthorization(authorizationState)
  const section = adminRouteSection(pathname) ?? 'unknown'
  const auditCursor = auditCursors.at(-1) ?? null

  useEffect(() => {
    const controller = new AbortController()
    void readAdminAuthorization({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setAuthorizationState(state)
    })
    return () => controller.abort()
  }, [])

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
    setAuditReadState({ status: 'loading' })
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
            ? 'audit_timeout' : 'audit_unavailable',
        })
      },
    )
    return () => controller.abort()
  }, [authorizationState, section, auditFilters, auditCursor, auditRetry])

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
    const onPopState = () => {
      if (window.location.pathname === pathname) return
      if (!requestCurriculumStudioNavigation()) {
        window.history.pushState({}, '', pathname)
        return
      }
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [pathname])

  function navigate(next: AdminSection) {
    if (!requestCurriculumStudioNavigation()) return
    const nextPath = next === 'overview'
      ? ADMIN_CONSOLE_PATH
      : next === 'system-health'
        ? `${ADMIN_CONSOLE_PATH}/health`
        : `${ADMIN_CONSOLE_PATH}/${next}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function navigateEngine(engine: AdminEngineId) {
    if (!requestCurriculumStudioNavigation()) return
    const nextPath = `${ADMIN_CONSOLE_PATH}/engines/${engine}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function navigateCurriculum(view: CurriculumWorkflowView) {
    if (!requestCurriculumStudioNavigation()) return
    const nextPath = view === 'published'
      ? `${ADMIN_CONSOLE_PATH}/curriculum`
      : `${ADMIN_CONSOLE_PATH}/curriculum/${view}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function applyAuditFilters(filters: AdminAuditFilters) {
    setAuditFilters(filters)
    setAuditCursors([null])
  }

  function showOlderAuditEvents(cursor: string) {
    setAuditCursors((current) => [...current, cursor])
  }

  function showNewerAuditEvents() {
    setAuditCursors((current) => current.length > 1 ? current.slice(0, -1) : current)
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
    : section === 'curriculum-validation' ? 'Curriculum validation'
      : section === 'curriculum-preview' ? 'Curriculum Preview / Diff'
    : section === 'system-health' ? 'System Health'
      : section === 'engines' ? `${ENGINE_PAGE_LABELS[selectedEngine]} Engine Performance`
        : section === 'costs' ? 'AI & Costs'
          : section === 'learners' ? 'Learner Analytics'
            : section === 'safety' ? 'Safety Operations'
              : section === 'audit-log' ? 'Audit Log'
                : section === 'curriculum' ? 'Curriculum' : 'Admin section unavailable'

  return (
    <AdminShell
      authorization={authorization}
      activeSection={activeSection}
      title={title}
      onNavigate={navigate}
    >
        {section === 'learners' && (
          <LearnerAnalytics state={learnerState} onRetry={() => setLearnerRetry((value) => value + 1)} />
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
        {!['learners', 'engines', 'costs', 'safety', 'curriculum', 'curriculum-studio', 'curriculum-validation', 'curriculum-preview', 'system-health', 'audit-log'].includes(section) && (
          <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold">Admin section unavailable</h1>
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
