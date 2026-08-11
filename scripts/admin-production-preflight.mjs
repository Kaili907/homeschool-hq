import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MIGRATION_RECONCILIATION_PLANNER_COMMAND } from './migration-reconciliation-planner.mjs'
import { validateMigrationManifest } from './study-migration-preflight.mjs'

export const ADMIN_PREFLIGHT_SCHEMA_VERSION = 1
export const ADMIN_PREFLIGHT_CLASSIFICATIONS = Object.freeze([
  'READY_FOR_HOSTED_PREFLIGHT',
  'BLOCKED_BY_LOCAL_INTEGRATION',
  'BLOCKED_BY_MIGRATION_IDENTITY',
  'BLOCKED_BY_CONFIGURATION',
  'BLOCKED_BY_STUDY',
  'BLOCKED_BY_PROVIDER_ACCOUNTING',
])

const GATE_STATUSES = new Set(['PASS', 'BLOCKING', 'NOT_APPLICABLE'])
const SAFE_REASON_CODE = /^[A-Z][A-Z0-9_]{2,80}$/
const SAFE_EVIDENCE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,180}$/

function freezeGate(gate) {
  return Object.freeze({
    id: gate.id,
    area: gate.area,
    status: gate.status,
    reasonCode: gate.reasonCode,
    blockerClassification: gate.blockerClassification,
    evidenceCount: gate.evidenceCount,
  })
}

function validateContract(contract) {
  const errors = []
  const gates = Array.isArray(contract?.gates) ? contract.gates : []
  const priorities = Array.isArray(contract?.classificationPriority)
    ? contract.classificationPriority
    : []
  if (contract?.schemaVersion !== ADMIN_PREFLIGHT_SCHEMA_VERSION ||
      typeof contract?.contractId !== 'string' ||
      contract?.localOnly !== true ||
      gates.length === 0) {
    errors.push('preflight-contract-invalid')
  }
  const ids = gates.map((gate) => gate?.id)
  if (new Set(ids).size !== ids.length) errors.push('duplicate-gate-id')
  if (gates.some((gate) =>
    typeof gate?.id !== 'string' || !/^[a-z][a-z0-9_]{2,80}$/.test(gate.id) ||
    typeof gate?.area !== 'string' || !/^[a-z][a-z0-9_]{2,40}$/.test(gate.area) ||
    !['required', 'not_applicable'].includes(gate?.applicability) ||
    !ADMIN_PREFLIGHT_CLASSIFICATIONS.includes(gate?.blockerClassification) ||
    gate.blockerClassification === 'READY_FOR_HOSTED_PREFLIGHT' ||
    (gate.applicability === 'not_applicable' && !SAFE_REASON_CODE.test(gate?.notApplicableReason ?? ''))
  )) errors.push('gate-contract-invalid')
  if (new Set(priorities).size !== priorities.length || priorities.some((value) =>
    !ADMIN_PREFLIGHT_CLASSIFICATIONS.includes(value) ||
    ['READY_FOR_HOSTED_PREFLIGHT', 'BLOCKED_BY_MIGRATION_IDENTITY'].includes(value)
  )) errors.push('classification-priority-invalid')
  const requiredPriorities = new Set(gates
    .filter((gate) => gate?.applicability === 'required')
    .map((gate) => gate?.blockerClassification))
  if ([...requiredPriorities].some((value) => !priorities.includes(value))) {
    errors.push('classification-priority-incomplete')
  }
  const frozen = contract?.migrationIdentity?.frozenHistoricalMigrations
  const approvals = contract?.migrationIdentity?.approvedHistoricalReconciliations
  if (!Array.isArray(frozen) || !Array.isArray(approvals)) {
    errors.push('migration-identity-contract-invalid')
  }
  return Object.freeze(errors)
}

async function localEvidenceExists(evidenceRefs, evidenceRoot) {
  if (evidenceRefs.length === 0 || evidenceRefs.some((value) =>
    typeof value !== 'string' ||
    !SAFE_EVIDENCE_REF.test(value) ||
    value.includes('..') ||
    value.includes('://'),
  )) return false
  for (const value of evidenceRefs) {
    try {
      if (!(await stat(resolve(evidenceRoot, value))).isFile()) return false
    } catch {
      return false
    }
  }
  return true
}

async function evaluateGates(contract, evidence, contractErrors, evidenceRoot) {
  const evidenceGates = evidence?.gates && typeof evidence.gates === 'object' && !Array.isArray(evidence.gates)
    ? evidence.gates
    : {}
  if (evidence?.schemaVersion !== ADMIN_PREFLIGHT_SCHEMA_VERSION ||
      evidence?.contractId !== contract?.contractId ||
      evidence?.scope !== 'local-only') {
    contractErrors.push('preflight-evidence-invalid')
  }
  const knownGateIds = new Set((contract?.gates ?? []).map((gate) => gate.id))
  for (const id of Object.keys(evidenceGates)) {
    if (!knownGateIds.has(id) && !contractErrors.includes('unexpected-evidence-gate')) {
      contractErrors.push('unexpected-evidence-gate')
    }
  }
  const results = []
  for (const gate of contract?.gates ?? []) {
    const supplied = evidenceGates[gate.id]
    if (gate.applicability === 'not_applicable') {
      if (supplied !== undefined) contractErrors.push(`evidence-for-not-applicable-gate:${gate.id}`)
      results.push(freezeGate({
        ...gate,
        status: 'NOT_APPLICABLE',
        reasonCode: gate.notApplicableReason,
        evidenceCount: 0,
      }))
      continue
    }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
      results.push(freezeGate({ ...gate, status: 'BLOCKING', reasonCode: 'EVIDENCE_MISSING', evidenceCount: 0 }))
      continue
    }
    const evidenceRefs = Array.isArray(supplied.evidenceRefs) ? supplied.evidenceRefs : []
    const evidenceSafe = await localEvidenceExists(evidenceRefs, evidenceRoot)
    if (!GATE_STATUSES.has(supplied.status) || supplied.status === 'NOT_APPLICABLE') {
      results.push(freezeGate({ ...gate, status: 'BLOCKING', reasonCode: 'EVIDENCE_INVALID', evidenceCount: 0 }))
      continue
    }
    if (supplied.status === 'PASS') {
      results.push(freezeGate({
        ...gate,
        status: evidenceSafe ? 'PASS' : 'BLOCKING',
        reasonCode: evidenceSafe ? 'LOCAL_EVIDENCE_VERIFIED' : 'EVIDENCE_INVALID',
        evidenceCount: evidenceSafe ? evidenceRefs.length : 0,
      }))
      continue
    }
    results.push(freezeGate({
      ...gate,
      status: 'BLOCKING',
      reasonCode: SAFE_REASON_CODE.test(supplied.reasonCode ?? '') ? supplied.reasonCode : 'EVIDENCE_INVALID',
      evidenceCount: evidenceSafe ? evidenceRefs.length : 0,
    }))
  }
  return Object.freeze(results)
}

function classificationFor(contract, migrationIdentity, gates, contractErrors) {
  if (!migrationIdentity.valid) return 'BLOCKED_BY_MIGRATION_IDENTITY'
  if (contractErrors.length > 0) return 'BLOCKED_BY_LOCAL_INTEGRATION'
  const blocking = gates.filter((gate) => gate.status === 'BLOCKING')
  if (blocking.length === 0) return 'READY_FOR_HOSTED_PREFLIGHT'
  return contract.classificationPriority.find((classification) =>
    blocking.some((gate) => gate.blockerClassification === classification),
  ) ?? 'BLOCKED_BY_LOCAL_INTEGRATION'
}

export async function evaluateAdminProductionPreflight({
  contract,
  evidence,
  manifest,
  migrationDirectory,
  evidenceRoot = process.cwd(),
}) {
  const contractErrors = [...validateContract(contract)]
  const migrationIdentity = await validateMigrationManifest(
    manifest,
    migrationDirectory,
    contract?.migrationIdentity,
  )
  const reconciliationPlanner = migrationIdentity.reasons.some((reason) =>
    reason === 'duplicate-migration-version' || reason.startsWith('duplicate-migration-version:'),
  )
    ? Object.freeze({
        mode: 'READ_ONLY',
        command: MIGRATION_RECONCILIATION_PLANNER_COMMAND,
      })
    : null
  const gates = await evaluateGates(contract, evidence, contractErrors, evidenceRoot)
  const classification = classificationFor(contract, migrationIdentity, gates, contractErrors)
  const summary = Object.freeze({
    pass: gates.filter((gate) => gate.status === 'PASS').length,
    blocking: gates.filter((gate) => gate.status === 'BLOCKING').length,
    notApplicable: gates.filter((gate) => gate.status === 'NOT_APPLICABLE').length,
  })
  const blockers = Object.freeze(gates
    .filter((gate) => gate.status === 'BLOCKING')
    .map((gate) => Object.freeze({
      gateId: gate.id,
      classification: gate.blockerClassification,
      reasonCode: gate.reasonCode,
    })))
  return Object.freeze({
    schemaVersion: ADMIN_PREFLIGHT_SCHEMA_VERSION,
    contractId: typeof contract?.contractId === 'string' ? contract.contractId : 'invalid-contract',
    scope: 'LOCAL_ONLY',
    classification,
    readyForHostedPreflight: classification === 'READY_FOR_HOSTED_PREFLIGHT',
    productionActivationAuthorized: false,
    hostedContactPerformed: false,
    migrationIdentity: Object.freeze({
      status: migrationIdentity.valid ? 'PASS' : 'BLOCKING',
      reasons: Object.freeze([...migrationIdentity.reasons]),
      reconciliationPlanner,
    }),
    contractErrors: Object.freeze(contractErrors),
    gates,
    blockers,
    summary,
  })
}

export function formatOperatorReport(report) {
  const lines = [
    'Admin production activation preflight R3',
    'Scope: LOCAL ONLY (no hosted contact)',
    `Classification: ${report.classification}`,
    `Ready for hosted preflight: ${report.readyForHostedPreflight ? 'YES' : 'NO'}`,
    'Production activation authorized: NO',
    `Migration identity: ${report.migrationIdentity.status}`,
    `Gates: ${report.summary.pass} PASS | ${report.summary.blocking} BLOCKING | ${report.summary.notApplicable} NOT_APPLICABLE`,
  ]
  if (report.migrationIdentity.reasons.length > 0) {
    lines.push('Migration blockers:')
    for (const reason of report.migrationIdentity.reasons) lines.push(`- ${reason}`)
  }
  if (report.migrationIdentity.reconciliationPlanner) {
    lines.push(
      'Migration reconciliation planner (read-only):',
      `- ${report.migrationIdentity.reconciliationPlanner.command}`,
    )
  }
  if (report.contractErrors.length > 0) {
    lines.push('Contract errors:')
    for (const reason of report.contractErrors) lines.push(`- ${reason}`)
  }
  if (report.blockers.length > 0) {
    lines.push('Gate blockers:')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker.gateId} [${blocker.classification}]: ${blocker.reasonCode}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function valueAfter(args, flag, fallback) {
  const index = args.indexOf(flag)
  return index < 0 ? fallback : args[index + 1]
}

async function main() {
  const args = process.argv.slice(2)
  const contractPath = resolve(valueAfter(args, '--contract', 'docs/admin-production-preflight/deployment-contract.json'))
  const evidencePath = resolve(valueAfter(args, '--evidence', 'docs/admin-production-preflight/current-local-evidence.json'))
  const manifestPath = resolve(valueAfter(args, '--manifest', 'docs/study-engine-final-production/migration-manifest.json'))
  const migrationDirectory = resolve(valueAfter(args, '--migrations', 'supabase/migrations'))
  const format = valueAfter(args, '--format', 'operator')
  if (![contractPath, evidencePath, manifestPath, migrationDirectory, format].every(Boolean) ||
      !['operator', 'json'].includes(format)) {
    throw new Error('Usage: admin-production-preflight [--contract path] [--evidence path] [--manifest path] [--migrations path] [--format operator|json]')
  }
  const [contract, evidence, manifest] = await Promise.all(
    [contractPath, evidencePath, manifestPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
  )
  const report = await evaluateAdminProductionPreflight({ contract, evidence, manifest, migrationDirectory })
  process.stdout.write(format === 'json' ? `${JSON.stringify(report)}\n` : formatOperatorReport(report))
  if (!report.readyForHostedPreflight) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'admin_preflight_failed'}\n`)
    process.exitCode = 1
  })
}
