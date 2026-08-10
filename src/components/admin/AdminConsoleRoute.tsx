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
  OverviewRange,
  ServerResolvedAdminAuthorization,
} from '../../admin/overviewModel'
import { readAdminCosts, AdminCostsReadError } from '../../admin/costsHttpSource'
import type { AdminCostRangeSelection, AdminCostsReadState } from '../../admin/costsModel'
import {
  AdminProviderPricingHttpError,
  readAdminProviderPricing,
} from '../../admin/providerPricingHttpSource'
import type { ProviderPricingReadState } from '../../admin/providerPricingModel'
import { readAdminAuditPage, AdminAuditReadError } from '../../admin/auditHttpSource'
import type { AdminAuditFilters, AdminAuditReadState } from '../../admin/auditLogModel'
import { createAdminCurriculumHttpSource } from '../../admin/curriculum/httpSource'
import { readAdminSafetyOperations } from '../../admin/safetyOperationsHttpSource'
import type { SafetyOperationsReadState } from '../../admin/safetyOperationsModel'
import { CurriculumBrowser } from '../../admin/curriculum/CurriculumBrowser'
import {
  readAdminCurriculumValidation,
} from '../../admin/curriculum-validation/httpSource'
import {
  loadLearnerAnalytics,
  type LearnerAnalyticsViewState,
} from '../../admin/learnerAnalyticsModel'
import { createAdminLearnerAnalyticsHttpSource } from '../../admin/learnerAnalyticsHttpSource'
import type { CurriculumValidationReadModel } from '../../admin/curriculum-validation/model'
import {
  readAdminEnginePerformance,
  type EnginePerformanceReadState,
} from '../../admin/engine-performance/httpSource'
import type { AdminEngineId } from '../../admin/contracts'
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
import { EnginePerformanceDashboard } from './EnginePerformanceDashboard'
import { SystemHealthDashboard } from './SystemHealthDashboard'
import { AdminAuditLog } from './AdminAuditLog'
import { AdminStudyOperations } from './AdminStudyOperations'

export type AdminRouteSection = AdminSection | 'curriculum-validation' | 'provider-pricing' | 'unknown'

export function adminRouteSection(pathname: string): AdminRouteSection | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (!suffix) return 'overview'
  if (suffix === 'curriculum/validation') return 'curriculum-validation'
  if (suffix === 'costs/provider-pricing') return 'provider-pricing'
  if (suffix === 'health' || suffix.startsWith('health/')) return 'system-health'
  const section = suffix.split('/')[0]
  return [
    'learners', 'engines', 'costs', 'curriculum', 'safety', 'system-health', 'study-operations',
    'configuration', 'audit-log', 'releases',
  ].includes(section) ? section as AdminSection : 'unknown'
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
  const [costRange, setCostRange] = useState<AdminCostRangeSelection>({ kind: 'preset', preset: 'today' })
  const [costsState, setCostsState] = useState<AdminCostsReadState>({ status: 'idle' })
  const [costsRefresh, setCostsRefresh] = useState(0)
  const [pricingState, setPricingState] = useState<ProviderPricingReadState>({ status: 'idle' })
  const [pricingRefresh, setPricingRefresh] = useState(0)
  const [healthWindow, setHealthWindow] = useState<SystemHealthWindow>('1h')
  const [healthReload, setHealthReload] = useState(0)
  const [healthReadState, setHealthReadState] = useState<SystemHealthReadState>({ status: 'loading' })
  const [studyOperationsState, setStudyOperationsState] = useState<StudyOperationsReadState>({ status: 'loading' })
  const [studyOperationsRetry, setStudyOperationsRetry] = useState(0)
  const [validationModel, setValidationModel] = useState<CurriculumValidationReadModel | null>(null)
  const [engineState, setEngineState] = useState<EnginePerformanceReadState>({ status: 'loading' })
  const [selectedEngine, setSelectedEngine] = useState<AdminEngineId>('tutor')
  const [engineWindow, setEngineWindow] = useState<EnginePerformanceWindowPreset>('30d')
  const [selectedEngineVersion, setSelectedEngineVersion] = useState<string | null>(null)
  const [engineRetry, setEngineRetry] = useState(0)
  const [learnerState, setLearnerState] = useState<LearnerAnalyticsViewState>({ status: 'resolving' })
  const [safetyReadState, setSafetyReadState] = useState<SafetyOperationsReadState>({ status: 'loading' })
  const [auditFilters, setAuditFilters] = useState<AdminAuditFilters>({ limit: 50 })
  const [auditCursors, setAuditCursors] = useState<readonly (string | null)[]>([null])
  const [auditReadState, setAuditReadState] = useState<AdminAuditReadState>({ status: 'loading' })
  const [auditRetry, setAuditRetry] = useState(0)
  const curriculumSource = useMemo(() => createAdminCurriculumHttpSource(), [])
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
  }, [authorizationState, section])

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
    if (!hasCapability(authorization, 'curriculum:read') || section !== 'curriculum-validation') {
      setValidationModel(null)
      return
    }
    const controller = new AbortController()
    void readAdminCurriculumValidation({ signal: controller.signal }).then((model) => {
      if (!controller.signal.aborted) setValidationModel(model)
    })
    return () => controller.abort()
  }, [authorization, section])

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
  }, [authorizationState, learnerSource, section])

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
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(next: AdminSection) {
    const nextPath = next === 'overview'
      ? ADMIN_CONSOLE_PATH
      : next === 'system-health'
        ? `${ADMIN_CONSOLE_PATH}/health`
        : `${ADMIN_CONSOLE_PATH}/${next}`
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  function navigateToProviderPricing() {
    const nextPath = `${ADMIN_CONSOLE_PATH}/costs/provider-pricing`
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
        overview={{ status: 'error', code: 'overview_unavailable' }}
        selectedRange={range}
        onRangeChange={setRange}
        onNavigate={navigate}
      />
    )
  }

  const activeSection: AdminSection = section === 'curriculum-validation'
    ? 'curriculum'
    : section === 'provider-pricing' ? 'costs'
    : section === 'unknown' ? 'overview' : section
  const title = section === 'curriculum-validation'
    ? 'Curriculum validation'
    : section === 'system-health' ? 'System Health'
      : section === 'study-operations' ? 'Study Operations'
        : section === 'engines' ? 'Engine Performance'
          : section === 'costs' ? 'AI & Costs'
            : section === 'provider-pricing' ? 'Provider Pricing'
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
          <LearnerAnalytics state={learnerState} />
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
          />
        )}
        {section === 'curriculum' && (
          <CurriculumBrowser
            authorization={hasCapability(authorization, 'curriculum:read')
              ? { status: 'authorized', capabilities: authorization.capabilities }
              : { status: 'denied' }}
            source={curriculumSource}
          />
        )}
        {section === 'curriculum-validation' && (
          <CurriculumValidationDashboard
            authorization={hasCapability(authorization, 'curriculum:read')
              ? { state: 'authorized', capability: 'curriculum:read' }
              : { state: 'denied' }}
            model={validationModel}
          />
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
        {!['learners', 'engines', 'costs', 'provider-pricing', 'safety', 'curriculum', 'curriculum-validation', 'system-health', 'study-operations', 'audit-log'].includes(section) && (
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
