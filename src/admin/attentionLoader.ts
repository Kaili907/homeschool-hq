import { createAdminConfigurationHttpSource } from './configurationHttpSource'
import { readAdminCosts } from './costsHttpSource'
import { createAdminLearnerAnalyticsHttpSource } from './learnerAnalyticsHttpSource'
import { LEARNERS_READ_CAPABILITY } from './learnerAnalyticsModel'
import { readAdminProductionReadiness } from './productionReadinessHttpSource'
import { readAdminSafetyOperations } from './safetyOperationsHttpSource'
import { readSystemHealth } from './systemHealthClient'
import {
  buildAdminAttentionCenter,
  type AdminAttentionCenterModel,
  type AdminAttentionEvidence,
} from './attentionModel'
import type { AdminCapability } from './contracts'
import type { AdminCostsModel } from './costsModel'
import type { AdminRuntimeConfigurationProjection } from './configurationModel'
import type { LearnerAnalyticsSnapshot } from './learnerAnalyticsModel'
import type { ProductionReadinessProjection } from './productionReadinessModel'
import type { SafetyOperationsReadState } from './safetyOperationsModel'
import type { SystemHealthReadState } from './systemHealthClient'

export interface AdminAttentionLoaderDependencies {
  readonly readReadiness: (signal: AbortSignal) => Promise<ProductionReadinessProjection>
  readonly readHealth: (signal: AbortSignal) => Promise<SystemHealthReadState>
  readonly readConfiguration: (signal: AbortSignal) => Promise<AdminRuntimeConfigurationProjection>
  readonly readLearners: (today: string) => Promise<LearnerAnalyticsSnapshot>
  readonly readSafety: (signal: AbortSignal) => Promise<SafetyOperationsReadState>
  readonly readCosts: (signal: AbortSignal) => Promise<AdminCostsModel>
}

function defaultDependencies(): AdminAttentionLoaderDependencies {
  const configuration = createAdminConfigurationHttpSource()
  const learners = createAdminLearnerAnalyticsHttpSource()
  return {
    readReadiness: (signal) => readAdminProductionReadiness({ signal }),
    readHealth: (signal) => readSystemHealth({ window: '1h', signal }),
    readConfiguration: (signal) => configuration.read({ signal }),
    readLearners: (today) => learners.read({ capability: LEARNERS_READ_CAPABILITY, today }),
    readSafety: (signal) => readAdminSafetyOperations({ signal, limit: 50 }),
    readCosts: (signal) => readAdminCosts({ kind: 'preset', preset: 'month' }, { signal }),
  }
}

/** Reads only the projections authorized for this caller, then drops them after
 * composing the bounded Attention Center model. Every endpoint reauthorizes. */
export async function loadAdminAttentionCenter(
  capabilities: readonly AdminCapability[],
  options: {
    readonly signal: AbortSignal
    readonly today: string
    readonly dependencies?: AdminAttentionLoaderDependencies
  },
): Promise<AdminAttentionCenterModel> {
  const dependencies = options.dependencies ?? defaultDependencies()
  let readiness: AdminAttentionEvidence['readiness']
  let health: AdminAttentionEvidence['health']
  let configuration: AdminAttentionEvidence['configuration']
  let learners: AdminAttentionEvidence['learners']
  let safety: AdminAttentionEvidence['safety']
  let costs: AdminAttentionEvidence['costs']
  const reads: Promise<void>[] = []

  if (capabilities.includes('releases:read')) reads.push(
    dependencies.readReadiness(options.signal).then(
      (projection) => { readiness = { status: 'ready', projection } },
      () => { readiness = { status: 'unavailable' } },
    ),
  )
  if (capabilities.includes('health:read')) reads.push(
    dependencies.readHealth(options.signal).then((state) => {
      health = state.status === 'ready'
        ? { status: 'ready', projection: state.projection }
        : { status: 'unavailable' }
    }, () => { health = { status: 'unavailable' } }),
  )
  if (capabilities.includes('configuration:read')) reads.push(
    dependencies.readConfiguration(options.signal).then(
      (projection) => { configuration = { status: 'ready', projection } },
      () => { configuration = { status: 'unavailable' } },
    ),
  )
  if (capabilities.includes('learners:read')) reads.push(
    dependencies.readLearners(options.today).then(
      (projection) => { learners = { status: 'ready', projection } },
      () => { learners = { status: 'unavailable' } },
    ),
  )
  if (capabilities.includes('safety:read')) reads.push(
    dependencies.readSafety(options.signal).then((state) => {
      safety = state.status === 'ready'
        ? { status: 'ready', projection: state.snapshot }
        : { status: 'unavailable' }
    }, () => { safety = { status: 'unavailable' } }),
  )
  if (capabilities.includes('costs:read')) reads.push(
    dependencies.readCosts(options.signal).then(
      (projection) => { costs = { status: 'ready', projection } },
      () => { costs = { status: 'unavailable' } },
    ),
  )

  await Promise.all(reads)
  return buildAdminAttentionCenter(capabilities, {
    readiness,
    health,
    configuration,
    learners,
    safety,
    costs,
  })
}
