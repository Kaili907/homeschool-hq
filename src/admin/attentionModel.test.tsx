import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AdminRuntimeConfigurationProjection } from './configurationModel'
import type { AdminCostsModel } from './costsModel'
import type { LearnerAnalyticsSnapshot } from './learnerAnalyticsModel'
import type {
  ProductionReadinessCheck,
  ProductionReadinessProjection,
} from './productionReadinessModel'
import {
  SAFETY_OPERATIONS_SCHEMA_VERSION,
  type SafetyOperationsEventV1,
  type SafetyOperationsSnapshotV1,
} from './safetyOperationsModel'
import { buildSystemHealthProjection, type SystemHealthProjection } from './systemHealth'
import {
  buildAdminAttentionCenter,
  type AdminAttentionEvidence,
} from './attentionModel'
import { AdminAttentionCenter } from '../components/admin/AdminAttentionCenter'

const NOW = '2026-08-10T18:00:00.000Z'

function check(
  id: string,
  status: ProductionReadinessCheck['status'],
  required = true,
): ProductionReadinessCheck {
  return {
    id,
    title: 'UNTRUSTED TITLE',
    status,
    required,
    summary: 'UNTRUSTED SUMMARY',
    action: 'UNTRUSTED ACTION',
    evidence: {
      source: 'UNTRUSTED SOURCE',
      status: status === 'READY' ? 'VERIFIED' : 'UNVERIFIED',
    },
    observations: [],
  }
}

function readiness(...checks: ProductionReadinessCheck[]): ProductionReadinessProjection {
  const ready = checks.filter((item) => item.required && item.status === 'READY').length
  const total = checks.filter((item) => item.required).length
  return {
    schemaVersion: 1,
    generatedAt: NOW,
    status: ready === total ? 'READY' : 'BLOCKED',
    requiredSummary: { total, ready, blocking: total - ready },
    domains: [{ id: 'application', label: 'Application', status: ready === total ? 'READY' : 'BLOCKED', summary: 'UNTRUSTED', checks }],
  }
}

function health(overrides: Partial<SystemHealthProjection> = {}): SystemHealthProjection {
  return {
    ...buildSystemHealthProjection([], { now: new Date(NOW) }),
    overallHealth: 'healthy',
    overallReasonCodes: ['operating_normally'],
    observedAt: '2026-08-10T17:59:00.000Z',
    freshness: 'current',
    evidenceCompleteness: 'complete',
    ...overrides,
  }
}

function configuration(resolution: 'saved' | 'fallback' | 'error'): AdminRuntimeConfigurationProjection {
  return {
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    runtimeStatus: 'partial_runtime_enforcement',
    settings: [{
      key: 'runtime.ai.enabled',
      value: true,
      revision: '1',
      requiredCapability: 'configuration:manage',
      protectiveCapability: 'engines:operate',
      warningLevel: 'critical',
      bounds: null,
      allowlist: null,
      deploymentCeilingType: 'boolean_enablement',
      registryVersion: 1,
      integrationStatus: 'pending_runtime_integration',
      runtime: {
        classification: 'ENFORCEABLE_NOW',
        effectiveValue: resolution === 'saved',
        enforcement: 'enforced',
        resolution,
        reason: resolution === 'saved'
          ? 'saved_value_enforced'
          : resolution === 'fallback'
            ? 'safe_fallback_disabled'
            : 'configuration_resolution_failed',
        trustedConsumer: 'anthropic_gateway',
        studyStatus: 'unavailable',
      },
    }],
  }
}

function learnerSnapshot(openReviewCount: number, needsDadCount: number, secret = ''): LearnerAnalyticsSnapshot {
  return {
    observedAt: NOW,
    learners: [{
      learnerRef: 'p1',
      displayName: secret || 'Learner One',
      openReviewCount,
      needsDadCount,
      study: { status: 'available', value: { scheduled: 0, completed: 0, resumeNeeded: 0, active: 0, pendingReviews: openReviewCount } },
    }],
    details: {},
  } as unknown as LearnerAnalyticsSnapshot
}

function metric(value: number) {
  return { status: 'available' as const, value }
}

function safetyEvent(overrides: Partial<SafetyOperationsEventV1> = {}): SafetyOperationsEventV1 {
  return {
    schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
    eventRef: 'safety:event-1',
    source: 'study-safety-stops',
    occurredAt: '2026-08-10T17:58:00.000Z',
    engine: 'study',
    evidenceCategory: 'safety-stop',
    reasonCode: 'gateway-503',
    state: 'open',
    resolution: { state: 'unresolved' },
    history: [],
    ...overrides,
  }
}

function safety(events: readonly SafetyOperationsEventV1[] = [], partial = false): SafetyOperationsSnapshotV1 {
  return {
    schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
    observedAt: NOW,
    summary: {
      openSafetyStops: metric(events.length),
      resolvedSafetyStops: metric(0),
      adultReviewPending: metric(0),
      failClosedEvents: metric(0),
      safetyStopEvents: metric(events.length),
      fallbackRejectionEvents: metric(0),
      unresolvedSafetyConditions: metric(events.length),
    },
    sources: [
      { source: 'study-safety-stops', status: 'available' },
      { source: 'study-adult-review', status: partial ? 'unavailable' : 'available' },
      { source: 'study-safety-monitoring', status: 'available' },
    ],
    operationalTelemetry: { status: 'available' },
    events,
    page: { limit: 50, nextCursor: null },
  }
}

function partialCosts(): AdminCostsModel {
  return {
    generatedAt: NOW,
    source: { status: 'partial' },
    range: {
      startAt: '2026-08-01T00:00:00.000Z',
      endExclusive: '2026-09-01T00:00:00.000Z',
    },
    summary: {
      unavailableCostCount: 2,
      usageUnavailableCount: 1,
      calculatedCost: { status: 'partial' },
    },
  } as unknown as AdminCostsModel
}

describe('Admin Attention Center composition', () => {
  it('classifies a required readiness blocker as critical without rendering source prose', () => {
    const model = buildAdminAttentionCenter(['releases:read'], {
      readiness: { status: 'ready', projection: readiness(check('application.build', 'UNVERIFIED')) },
    })
    expect(model.items).toEqual([expect.objectContaining({
      itemType: 'production-readiness-gate',
      reference: 'application.build',
      severity: 'critical',
      status: 'blocked_unavailable',
      destination: '/academy/admin/production-readiness',
    })])
    expect(JSON.stringify(model)).not.toContain('UNTRUSTED')
  })

  it('surfaces system health degradation as high priority', () => {
    const model = buildAdminAttentionCenter(['health:read'], {
      health: { status: 'ready', projection: health({ overallHealth: 'degraded', overallReasonCodes: ['elevated_failure_rate'] }) },
    })
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemType: 'system-health-state', severity: 'high', status: 'needs_attention',
    }))
  })

  it('treats unavailable Configuration evidence as a critical blocker with retry support', () => {
    const model = buildAdminAttentionCenter(['configuration:read'], {
      configuration: { status: 'unavailable' },
    })
    expect(model.evidence.status).toBe('unavailable')
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemType: 'evidence-unavailable', domain: 'configuration', severity: 'critical',
      status: 'blocked_unavailable', retryable: true,
    }))
  })

  it('creates a privacy-minimized learner operational flag', () => {
    const model = buildAdminAttentionCenter(['learners:read'], {
      learners: { status: 'ready', projection: learnerSnapshot(2, 1, 'PRIVATE LEARNER NAME') },
    })
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemType: 'learner-operational-flag', reference: 'p1', severity: 'high',
      destination: '/academy/admin/learners/p1',
    }))
    expect(JSON.stringify(model)).not.toContain('PRIVATE LEARNER NAME')
  })

  it('uses the actual bounded cost-accounting completeness signal', () => {
    const model = buildAdminAttentionCenter(['costs:read'], {
      costs: { status: 'ready', projection: partialCosts() },
    })
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemType: 'cost-accounting-state', severity: 'medium', status: 'warning',
      destination: '/academy/admin/costs',
    }))
    expect(model.items[0].explanation).toContain('2 cost records and 1 usage record')
  })

  it('does not understate an open or unknown safety item', () => {
    const open = buildAdminAttentionCenter(['safety:read'], {
      safety: { status: 'ready', projection: safety([safetyEvent()]) },
    })
    const unknown = buildAdminAttentionCenter(['safety:read'], {
      safety: { status: 'ready', projection: safety([safetyEvent({ state: 'unknown', resolution: { state: 'unknown' } })]) },
    })
    expect(open.items[0]).toEqual(expect.objectContaining({ severity: 'critical', status: 'needs_attention' }))
    expect(unknown.items[0]).toEqual(expect.objectContaining({ severity: 'critical', status: 'blocked_unavailable' }))
  })

  it('deduplicates the same runtime issue across readiness and configuration while retaining attribution', () => {
    const model = buildAdminAttentionCenter(['releases:read', 'configuration:read'], {
      readiness: { status: 'ready', projection: readiness(check('application.runtime_configuration', 'BLOCKED')) },
      configuration: { status: 'ready', projection: configuration('fallback') },
    })
    expect(model.items).toHaveLength(1)
    expect(model.items[0].sourceAttribution.map((source) => source.id)).toEqual([
      'readiness', 'configuration',
    ])
  })

  it('marks partial source coverage and never emits the complete-evidence all-clear', () => {
    const model = buildAdminAttentionCenter(['safety:read'], {
      safety: { status: 'ready', projection: safety([], true) },
    })
    expect(model.evidence.status).toBe('partial')
    expect(model.evidence.incompleteDomains).toEqual(['safety'])
    const markup = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'ready', model }} />)
    expect(markup).toContain('Attention evidence is partial')
    expect(markup).not.toContain('No current actionable items')
    expect(markup).toContain('Unknown or unavailable evidence is never treated as healthy')
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemType: 'evidence-unavailable', severity: 'critical', status: 'blocked_unavailable',
    }))
  })

  it('turns no health evidence into an explicit unknown-state item instead of green', () => {
    const projection = buildSystemHealthProjection([], { now: new Date(NOW) })
    const model = buildAdminAttentionCenter(['health:read'], {
      health: { status: 'ready', projection },
    })
    expect(model.evidence.status).toBe('partial')
    expect(model.items[0]).toEqual(expect.objectContaining({
      status: 'blocked_unavailable', severity: 'medium',
    }))
    expect(model.items[0].explanation).toContain('no current operational evidence')
  })

  it('filters unauthorized domains before inspecting or representing their evidence', () => {
    const secret = 'PRIVATE SAFETY PAYLOAD'
    const unsafeSafety = safety([{
      ...safetyEvent({ reasonCode: secret }),
      conversation: secret,
      journal: secret,
      audio: secret,
      diagnosticInference: secret,
    } as SafetyOperationsEventV1])
    const model = buildAdminAttentionCenter(['health:read'], {
      health: { status: 'ready', projection: health() },
      safety: { status: 'ready', projection: unsafeSafety },
    })
    expect(model.visibleDomains).toEqual(['health'])
    expect(model.items).toEqual([])
    expect(JSON.stringify(model)).not.toContain('safety')
    expect(JSON.stringify(model)).not.toContain(secret)
    const markup = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'ready', model }} />)
    expect(markup).not.toContain('Safety')
    expect(markup).not.toContain(secret)
  })

  it('drops raw private fields and backend text from authorized items', () => {
    const secret = 'SECRET RAW BACKEND CHAT ANSWER JOURNAL AUDIO NOTE'
    const event = {
      ...safetyEvent({ reasonCode: secret }),
      learner: { reference: 'p1', displayName: secret },
      conversation: secret,
      answer: secret,
      journal: secret,
      audio: secret,
      privateNotes: secret,
      rawError: secret,
    } as SafetyOperationsEventV1
    const model = buildAdminAttentionCenter(['safety:read'], {
      safety: { status: 'ready', projection: safety([event]) },
    })
    const markup = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'ready', model }} />)
    expect(markup).toContain('Raw details are intentionally not shown')
    expect(markup).not.toContain(secret)
  })

  it('renders complete empty, navigation, filters, landmarks, and keyboard-focusable controls truthfully', () => {
    const empty = buildAdminAttentionCenter(['health:read'], {
      health: { status: 'ready', projection: health() },
    })
    const emptyMarkup = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'ready', model: empty }} onRetry={() => {}} />)
    expect(empty.evidence.status).toBe('complete')
    expect(emptyMarkup).toContain('No current actionable items')
    expect(emptyMarkup).toContain('<fieldset')
    expect(emptyMarkup).toContain('<legend>Filter attention items</legend>')
    expect(emptyMarkup).toContain('<select')
    expect(emptyMarkup).toContain('type="button"')
    expect(emptyMarkup).toContain('Read only')

    const withSafety = buildAdminAttentionCenter(['safety:read'], {
      safety: { status: 'ready', projection: safety([safetyEvent()]) },
    })
    const markup = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'ready', model: withSafety }} />)
    expect(markup).toContain('href="/academy/admin/safety#safety-event-safety%3Aevent-1"')
    for (const heading of ['Needs attention', 'Blocked / unavailable', 'Warnings', 'Informational']) {
      expect(markup).toContain(heading)
    }
    expect(markup).not.toMatch(/>\s*(Clear|Resolve|Apply|Activate|Migrate)\s*</i)

    const loading = renderToStaticMarkup(<AdminAttentionCenter state={{ status: 'loading' }} />)
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('aria-live="polite"')
  })

  it('includes visible focus treatment, mobile layout, and reduced-motion safeguards', () => {
    const css = readFileSync(new URL('../components/admin/admin-attention-center.css', import.meta.url), 'utf8')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (max-width: 620px)')
    expect(css).toContain('.attention-filters { align-items: stretch; flex-direction: column; }')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation: none')
  })
})
