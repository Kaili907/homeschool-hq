import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  ProductionReadinessCheck,
  ProductionReadinessProjection,
} from '../../admin/productionReadinessModel'
import { parseProductionReadinessProjection } from '../../admin/productionReadinessModel'
import { ProductionReadinessCenter } from './ProductionReadinessCenter'

const check = (
  id: string,
  title: string,
  status: 'READY' | 'UNVERIFIED',
  required = true,
): ProductionReadinessCheck => ({
  id, title, status, required,
  summary: status === 'READY' ? 'Authoritative evidence is available.' : 'Evidence is not authoritative.',
  action: status === 'READY' ? null : 'Supply approved read-only evidence.',
  evidence: { source: 'Bounded test source', status: status === 'READY' ? 'VERIFIED' : 'UNVERIFIED' },
  observations: id === 'deployment.environment'
    ? [{ label: 'Provider credential', status: 'present' as const }]
    : [],
})

const projection: ProductionReadinessProjection = {
  schemaVersion: 1,
  generatedAt: '2026-08-10T18:00:00.000Z',
  status: 'BLOCKED',
  requiredSummary: { total: 18, ready: 17, blocking: 1 },
  domains: [
    { id: 'application', label: 'Application', status: 'READY', summary: 'Application evidence.', checks: [check('application.build', 'Production build state', 'READY'), check('application.runtime_configuration', 'Effective runtime', 'READY')] },
    { id: 'database', label: 'Database', status: 'UNVERIFIED', summary: 'Database evidence.', checks: [check('database.repository_migrations', 'Repository migrations', 'READY'), check('database.hosted_migrations', 'Hosted migration state', 'UNVERIFIED')] },
    { id: 'authorization', label: 'Authorization', status: 'READY', summary: 'Authorization evidence.', checks: [check('authorization.foundation', 'Admin foundation', 'READY'), check('authorization.owner_bootstrap', 'Owner bootstrap', 'READY')] },
    { id: 'ai_tts', label: 'AI & TTS', status: 'READY', summary: 'Provider evidence.', checks: [check('ai_tts.ai_state', 'AI state', 'READY'), check('ai_tts.tts_state', 'TTS state', 'READY'), check('ai_tts.voice_catalog', 'Voice catalog', 'READY')] },
    { id: 'telemetry', label: 'Telemetry', status: 'READY', summary: 'Telemetry evidence.', checks: [check('telemetry.operational_aggregate', 'Operational aggregate', 'READY'), check('telemetry.provider_accounting', 'Provider accounting', 'READY'), check('telemetry.monthly_cost_alert', 'Monthly cost alert runtime', 'READY')] },
    { id: 'curriculum', label: 'Curriculum', status: 'READY', summary: 'Curriculum evidence.', checks: [check('curriculum.release_registry', 'Release registry', 'READY'), check('curriculum.active_validation', 'Active validation', 'READY'), check('curriculum.release_controls', 'Local curriculum release controls', 'READY')] },
    { id: 'study', label: 'Study', status: 'READY', summary: 'Study evidence.', checks: [check('study.mount', 'Study mount', 'READY'), check('study.readiness', 'Study readiness', 'READY')] },
    { id: 'deployment', label: 'Deployment', status: 'READY', summary: 'Deployment evidence.', checks: [check('deployment.environment', 'Environment presence', 'READY')] },
  ],
}

describe('Production Readiness Center presentation', () => {
  it('renders overall blocking state, required blockers first, evidence, and presence-only facts', () => {
    const markup = renderToStaticMarkup(<ProductionReadinessCenter state={{ status: 'ready', projection }} onRetry={() => {}} />)
    expect(markup).toContain('Overall readiness')
    expect(markup).toContain('Required blockers first')
    expect(markup.indexOf('Hosted migration state')).toBeLessThan(markup.indexOf('Production readiness domains'))
    expect(markup).toContain('Evidence source')
    expect(markup).toContain('Monthly cost alert runtime')
    expect(markup).toContain('Local curriculum release controls')
    expect(markup).toContain('Provider credential')
    expect(markup).toContain('Values are never returned')
    expect(markup).toContain('Refetch evidence')
    expect(markup).not.toContain('background:#')
  })

  it('has no mutation control and keeps retry as the only button', () => {
    const markup = renderToStaticMarkup(<ProductionReadinessCenter state={{ status: 'ready', projection }} onRetry={() => {}} />)
    expect(markup.match(/<button\b/g)).toHaveLength(1)
    expect(markup).not.toMatch(/>\s*(Deploy|Apply migrations|Bootstrap Owner|Activate curriculum|Publish release)\s*</i)
    expect(markup).toContain('cannot deploy, apply migrations, bootstrap an Owner')
  })

  it('provides accessible loading, error, and status names', () => {
    const loading = renderToStaticMarkup(<ProductionReadinessCenter state={{ status: 'loading' }} />)
    const error = renderToStaticMarkup(<ProductionReadinessCenter state={{ status: 'error', code: 'malformed' }} onRetry={() => {}} />)
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('aria-live="polite"')
    expect(error).toContain('role="alert"')
    expect(error).toContain('type="button"')
    expect(renderToStaticMarkup(<ProductionReadinessCenter state={{ status: 'ready', projection }} />))
      .toContain('aria-label="Overall readiness: Blocked"')
  })

  it('rejects malformed or internally inconsistent wire evidence', () => {
    expect(parseProductionReadinessProjection(projection)).not.toBeNull()
    expect(parseProductionReadinessProjection({ ...projection, secret: 'SECRET' })).toBeNull()
    expect(parseProductionReadinessProjection({ ...projection, status: 'READY' })).toBeNull()
    expect(parseProductionReadinessProjection({
      ...projection,
      domains: projection.domains.map((domain) => domain.id === 'database'
        ? { ...domain, checks: [{ ...domain.checks[0], status: 'READY', extra: 'raw' }, domain.checks[1]] }
        : domain),
    })).toBeNull()
    expect(parseProductionReadinessProjection({
      ...projection,
      domains: projection.domains.map((domain) => domain.id === 'application'
        ? {
            ...domain,
            checks: domain.checks.map((item, index) => index === 0
              ? { ...item, status: 'READY' as const, evidence: { ...item.evidence, status: 'UNVERIFIED' as const } }
              : item),
          }
        : domain),
    })).toBeNull()
    expect(parseProductionReadinessProjection({
      ...projection,
      domains: projection.domains.map((domain) => domain.id === 'database'
        ? { ...domain, status: 'READY' as const }
        : domain),
    })).toBeNull()
  })
})
