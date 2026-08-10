import { sanitizeSavedAdminConfigurationProjection } from '../../../src/admin/configurationModel.ts'
import { isCanonicalIntegerMicros } from '../../../src/admin/contracts.ts'
import { buildAdminCostProjection, ADMIN_COST_RECORD_LIMIT } from './admin-cost-projection.js'

export const ADMIN_MONTHLY_COST_ALERT_CONTRACT_VERSION = 1
export const ADMIN_MONTHLY_COST_ALERT_SCOPE =
  'recorded_usage_derived_calculated_provider_cost'

const DAY_MS = 24 * 60 * 60 * 1_000

function observedDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date
}

/** Full UTC calendar month containing the trusted server observation time. */
export function resolveAdminMonthlyCostWindow(observedAt = new Date()) {
  const date = observedDate(observedAt)
  if (!date) throw new TypeError('invalid monthly cost alert observation time')
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const startMs = Date.UTC(year, month, 1)
  const endMs = Date.UTC(year, month + 1, 1)
  return Object.freeze({
    timezone: 'UTC',
    startAt: new Date(startMs).toISOString(),
    endExclusive: new Date(endMs).toISOString(),
  })
}

function thresholds(configuration) {
  const saved = sanitizeSavedAdminConfigurationProjection(configuration)
  if (!saved) return null
  const byKey = new Map(saved.settings.map((setting) => [setting.key, setting.value]))
  const warning = byKey.get('cost.warning.monthly_micros')
  const critical = byKey.get('cost.critical.monthly_micros')
  if (typeof warning !== 'string' || typeof critical !== 'string') return null
  if (BigInt(warning) >= BigInt(critical)) return null
  return Object.freeze({ warning, critical })
}

function monthlyCalculatedCost(projection, windowValue) {
  const metric = projection?.summary?.calculatedCost
  if (
    !projection || projection.range?.startAt !== windowValue.startAt
    || projection.range?.endExclusive !== windowValue.endExclusive
    || !metric || !['available', 'partial', 'unavailable'].includes(metric.status)
  ) return Object.freeze({ completeness: 'unavailable', micros: null })
  if (metric.status === 'unavailable' || typeof metric.micros !== 'string'
    || metric.micros.length > 24
    || !isCanonicalIntegerMicros(metric.micros)) {
    return Object.freeze({ completeness: 'unavailable', micros: null })
  }
  return Object.freeze({
    completeness: metric.status === 'available' ? 'complete' : 'partial',
    micros: metric.micros,
  })
}

function remaining(total, threshold) {
  const difference = BigInt(threshold) - BigInt(total)
  return difference > 0n ? difference.toString() : null
}

/**
 * The recorded calculated-cost total is additive and non-negative. An
 * incomplete total is therefore a lower bound: it can prove critical once the
 * lower bound reaches critical, but it cannot safely prove normal or warning.
 */
export function evaluateAdminMonthlyCostAlert({
  costProjection,
  configuration,
  generatedAt = new Date(),
}) {
  const date = observedDate(generatedAt)
  if (!date) throw new TypeError('invalid monthly cost alert generation time')
  const windowValue = resolveAdminMonthlyCostWindow(date)
  const configured = thresholds(configuration)
  const aggregate = monthlyCalculatedCost(costProjection, windowValue)

  let status = 'unavailable'
  let reason = configured ? 'aggregate_unavailable' : 'configuration_unavailable'
  if (configured && aggregate.completeness === 'complete') {
    const total = BigInt(aggregate.micros)
    status = total >= BigInt(configured.critical)
      ? 'critical'
      : total >= BigInt(configured.warning) ? 'warning' : 'normal'
    reason = 'complete'
  } else if (configured && aggregate.completeness === 'partial') {
    if (BigInt(aggregate.micros) >= BigInt(configured.critical)) {
      status = 'critical'
      reason = 'partial_lower_bound_critical'
    } else {
      status = 'partial'
      reason = 'partial_lower_bound'
    }
  }

  const exactRemaining = configured && aggregate.completeness === 'complete'
    ? {
        warning: remaining(aggregate.micros, configured.warning),
        critical: remaining(aggregate.micros, configured.critical),
      }
    : { warning: null, critical: null }

  return Object.freeze({
    contractVersion: ADMIN_MONTHLY_COST_ALERT_CONTRACT_VERSION,
    generatedAt: date.toISOString(),
    currency: 'USD',
    window: windowValue,
    costAuthority: 'academy_provider_usage_ledger',
    scope: ADMIN_MONTHLY_COST_ALERT_SCOPE,
    providerInvoiceTotalClaim: false,
    automaticProviderShutdown: false,
    completeness: aggregate.completeness,
    status,
    reason,
    activeCritical: status === 'critical',
    monthlyCostMicros: aggregate.micros,
    warningThresholdMicros: configured?.warning ?? null,
    criticalThresholdMicros: configured?.critical ?? null,
    remainingToWarningMicros: exactRemaining.warning,
    remainingToCriticalMicros: exactRemaining.critical,
  })
}

function monthProjectionRange(observedAt) {
  const windowValue = resolveAdminMonthlyCostWindow(observedAt)
  const endMs = Date.parse(windowValue.endExclusive)
  const lastDate = new Date(endMs - DAY_MS).toISOString().slice(0, 10)
  return Object.freeze({
    kind: 'month',
    start: windowValue.startAt.slice(0, 10),
    end: lastDate,
    startAt: windowValue.startAt,
    endExclusive: windowValue.endExclusive,
    days: Math.round((endMs - Date.parse(windowValue.startAt)) / DAY_MS),
  })
}

/** Trusted read seam shared by Costs, Overview, and future readiness checks. */
export function createAdminMonthlyCostAlertEvaluator({
  gatewayAccess,
  configurationSource,
  now = () => new Date(),
}) {
  if (!gatewayAccess || typeof gatewayAccess.readProviderUsageCosts !== 'function') {
    throw new TypeError('monthly cost alert evaluator requires provider cost access')
  }
  if (!configurationSource || typeof configurationSource.read !== 'function') {
    throw new TypeError('monthly cost alert evaluator requires saved configuration access')
  }
  return Object.freeze({
    async read({ generatedAt = now() } = {}) {
      const date = observedDate(generatedAt)
      if (!date) throw new TypeError('invalid monthly cost alert generation time')
      const range = monthProjectionRange(date)
      const [ledgerResult, configurationResult] = await Promise.allSettled([
        gatewayAccess.readProviderUsageCosts({
          limit: ADMIN_COST_RECORD_LIMIT,
          before: date.toISOString(),
        }),
        configurationSource.read(),
      ])
      let costProjection = null
      if (ledgerResult.status === 'fulfilled') {
        try {
          costProjection = buildAdminCostProjection(ledgerResult.value, range, date)
        } catch {
          costProjection = null
        }
      }
      return evaluateAdminMonthlyCostAlert({
        costProjection,
        configuration: configurationResult.status === 'fulfilled'
          ? configurationResult.value
          : null,
        generatedAt: date,
      })
    },
  })
}
