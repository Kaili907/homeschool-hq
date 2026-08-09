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
import { createAdminCurriculumHttpSource } from '../../admin/curriculum/httpSource'
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
import { AdminConsole } from './AdminConsole'
import { AdminCostsDashboard } from './AdminCostsDashboard'
import { LearnerAnalytics } from './LearnerAnalytics'
import { AdminSafetyOperations } from './AdminSafetyOperations'
import { CurriculumValidationDashboard } from './CurriculumValidationDashboard'
import { EnginePerformanceDashboard } from './EnginePerformanceDashboard'
import { SystemHealthDashboard } from './SystemHealthDashboard'

export type AdminRouteSection = AdminSection | 'curriculum-validation' | 'unknown'

export function adminRouteSection(pathname: string): AdminRouteSection | null {
  if (!isAdminConsolePath(pathname)) return null
  const suffix = pathname.slice(ADMIN_CONSOLE_PATH.length).replace(/^\/+|\/+$/g, '')
  if (!suffix) return 'overview'
  if (suffix === 'curriculum/validation') return 'curriculum-validation'
  if (suffix === 'health' || suffix.startsWith('health/')) return 'system-health'
  const section = suffix.split('/')[0]
  return [
    'learners', 'engines', 'costs', 'curriculum', 'safety', 'system-health',
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
  const [healthWindow, setHealthWindow] = useState<SystemHealthWindow>('1h')
  const [healthReload, setHealthReload] = useState(0)
  const [healthReadState, setHealthReadState] = useState<SystemHealthReadState>({ status: 'loading' })
  const [validationModel, setValidationModel] = useState<CurriculumValidationReadModel | null>(null)
  const [engineState, setEngineState] = useState<EnginePerformanceReadState>({ status: 'loading' })
  const [selectedEngine, setSelectedEngine] = useState<AdminEngineId>('tutor')
  const [engineWindow, setEngineWindow] = useState<EnginePerformanceWindowPreset>('30d')
  const [selectedEngineVersion, setSelectedEngineVersion] = useState<string | null>(null)
  const [engineRetry, setEngineRetry] = useState(0)
  const [learnerState, setLearnerState] = useState<LearnerAnalyticsViewState>({ status: 'resolving' })
  const curriculumSource = useMemo(() => createAdminCurriculumHttpSource(), [])
  const learnerSource = useMemo(() => createAdminLearnerAnalyticsHttpSource(), [])
  const authorization = presentationAuthorization(authorizationState)
  const section = adminRouteSection(pathname) ?? 'unknown'

  useEffect(() => {
    const controller = new AbortController()
    void readAdminAuthorization({ signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setAuthorizationState(state)
    })
    return () => controller.abort()
  }, [])

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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-slate-950 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div><strong>Manuel Academy Admin Console</strong><span className="ml-3 text-sm text-slate-300">{authorization.role}</span></div>
          <nav aria-label="Admin section navigation" className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => navigate('overview')}>Overview</button>
            <button type="button" onClick={() => navigate('learners')}>Learners</button>
            <button type="button" onClick={() => navigate('engines')}>Engines</button>
            <button type="button" onClick={() => navigate('costs')}>AI &amp; Costs</button>
            <button type="button" onClick={() => navigate('safety')}>Safety</button>
            <button type="button" onClick={() => navigate('curriculum')}>Curriculum</button>
            <button type="button" onClick={() => navigate('system-health')}>System Health</button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
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
          />
        )}
        {section === 'safety' && (
          <AdminSafetyOperations
            authorization={hasCapability(authorization, 'safety:read')
              ? { status: 'authorized', role: authorization.role, capabilities: authorization.capabilities }
              : { status: 'denied', reasonCode: 'safety_read_required' }}
            readState={{ status: 'unavailable', reasonCode: 'source_unavailable' }}
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
        {!['learners', 'engines', 'costs', 'safety', 'curriculum', 'curriculum-validation', 'system-health'].includes(section) && (
          <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold">Admin section unavailable</h1>
            <p className="mt-3 text-slate-600">No authorized read projection is implemented for this section. No substitute data is shown.</p>
          </section>
        )}
      </div>
    </div>
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
