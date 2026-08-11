import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  createReleaseCandidateResult,
  discoverReleaseCandidateGates,
  formatReleaseCandidateOperatorResult,
  redactSensitiveText,
  runReleaseCandidateValidation,
  serializeReleaseCandidateResult,
} from './release-candidate-validation.mjs'

const gateNames = [
  'migration_identity_manifest_checksum',
  'unified_local_production_preflight',
  'study_local_production_smoke',
  'full_root_tests',
  'full_netlify_tests',
  'supabase_db_contracts',
  'admin_authorization',
  'costs_pricing',
  'study_security_adversarial',
  'study_recovery_chaos',
  'study_operations_browser_accessibility',
  'curriculum_validation',
  'typecheck',
  'production_build',
  'git_diff_check',
]

function passingGates() {
  return gateNames.map((gate, index) => ({
    gate,
    status: 'PASSED',
    durationMs: index + 1,
    reason: 'completed successfully',
    blocking: true,
  }))
}

async function loadScenarios() {
  const fixture = JSON.parse(await readFile(
    new URL('./fixtures/release-candidate-validation/scenarios.json', import.meta.url),
    'utf8',
  ))
  return fixture.scenarios as Array<{
    name: string
    overrides: Record<string, Partial<ReturnType<typeof passingGates>[number]>>
    expectedClassification: string
  }>
}

function applyOverrides(overrides: Record<string, Record<string, unknown>>) {
  return passingGates().map((gate) => ({ ...gate, ...(overrides[gate.gate] ?? {}) }))
}

describe('release candidate bounded classifications', () => {
  it('classifies the all-pass, missing, failure, collision, preflight, and build fixtures', async () => {
    const scenarios = await loadScenarios()
    expect(scenarios.map((scenario) => scenario.name)).toEqual([
      'all-pass',
      'missing-required-gate',
      'test-failure',
      'migration-collision',
      'preflight-block',
      'build-failure',
    ])

    for (const scenario of scenarios) {
      const result = createReleaseCandidateResult(applyOverrides(scenario.overrides))
      expect(result.classification, scenario.name).toBe(scenario.expectedClassification)
      expect(result.readyForHostedPreflight, scenario.name)
        .toBe(scenario.expectedClassification === 'READY_FOR_HOSTED_PREFLIGHT')
      expect(result.hostedContactPerformed).toBe(false)
    }
  })
})

describe('strict capability discovery', () => {
  const scripts = {
    'plan:migration-reconciliation:json': 'node scripts/migration-reconciliation-planner.mjs --format json',
    'preflight:production-local:json': 'node scripts/production-local-preflight.mjs --format json',
    'test:root-app': 'vitest run --project root-app',
    'test:netlify': 'vitest run --project netlify-functions',
    'test:admin-auth': 'vitest run src/admin/authorization.test.ts',
    typecheck: 'tsc --noEmit',
    build: 'vite build',
  }
  const files = [
    { path: 'vite.config.ts', content: "name: 'root-supabase'" },
    'supabase/example.db.test.ts',
    'src/admin/costsModel.test.ts',
    'src/study/hostContext.security.test.ts',
    'src/study/production/adversarialRegression.test.ts',
    'tests/curriculum-content.test.js',
  ]

  it('marks mandatory capabilities missing instead of silently skipping them', () => {
    const plans = discoverReleaseCandidateGates({ packageScripts: scripts, fileRecords: files })
    const byGate = Object.fromEntries(plans.map((plan) => [plan.gate, plan]))

    expect(byGate.costs_pricing).toMatchObject({ availability: 'missing', blocking: true })
    expect(byGate.study_recovery_chaos).toMatchObject({ availability: 'missing', blocking: true })
    expect(byGate.study_operations_browser_accessibility)
      .toMatchObject({ availability: 'missing', blocking: true })
    expect(byGate.study_local_production_smoke)
      .toMatchObject({ availability: 'not-applicable', blocking: false })
    expect(byGate.curriculum_validation).toMatchObject({ availability: 'detected', blocking: true })
  })

  it('blocks when Study smoke files are installed without the operator script', () => {
    const plans = discoverReleaseCandidateGates({
      packageScripts: scripts,
      fileRecords: [...files, 'scripts/study-production-local-smoke.mjs'],
    })

    expect(plans.find((plan) => plan.gate === 'study_local_production_smoke'))
      .toMatchObject({ availability: 'missing', blocking: true })
  })

  it('detects the integrated domain suites without broad test globs', () => {
    const plans = discoverReleaseCandidateGates({
      packageScripts: {
        ...scripts,
        'smoke:study-production-local': 'vitest run --config scripts/study-production-local-smoke.vitest.config.mjs',
      },
      fileRecords: [
        ...files,
        'src/admin/providerPricingModel.test.ts',
        'src/study/production/studyRecoveryChaos.test.ts',
        {
          path: 'src/components/admin/AdminStudyOperations.test.tsx',
          content: 'aria-busy aria-labelledby aria-live focus-visible reduced-motion',
        },
      ],
    })
    const byGate = Object.fromEntries(plans.map((plan) => [plan.gate, plan]))

    expect(byGate.study_local_production_smoke.availability).toBe('detected')
    expect(byGate.costs_pricing.availability).toBe('detected')
    expect(byGate.study_security_adversarial.availability).toBe('detected')
    expect(byGate.study_recovery_chaos.availability).toBe('detected')
    expect(byGate.study_operations_browser_accessibility.availability).toBe('detected')
  })

  it('rejects scripts that silently turn missing tests into success', () => {
    const plans = discoverReleaseCandidateGates({
      packageScripts: { ...scripts, 'test:root-app': 'vitest run --project root-app --passWithNoTests' },
      fileRecords: files,
    })

    expect(plans.find((plan) => plan.gate === 'full_root_tests'))
      .toMatchObject({ availability: 'missing', blocking: true })
  })
})

describe('execution and output contracts', () => {
  const fixturePlans = gateNames.map((gate) => ({
    gate,
    blocking: true,
    availability: 'detected',
    command: { kind: 'fixture' },
    reason: 'fixture',
    semantic: null,
  }))

  it('redacts secrets from failures and serialized output', async () => {
    const secret = 'unit-secret-value-12345'
    const result = await runReleaseCandidateValidation({
      gatePlans: fixturePlans,
      env: { TEST_API_KEY: secret },
      runner: async (_command, context) => context.gate === 'full_root_tests'
        ? { exitCode: 1, stdout: '', stderr: `TEST_API_KEY=${secret}`, durationMs: 7 }
        : { exitCode: 0, stdout: '', stderr: '', durationMs: 3 },
    })
    const json = serializeReleaseCandidateResult(result)
    const operator = formatReleaseCandidateOperatorResult(result)

    expect(result.classification).toBe('BLOCKED_BY_TEST_FAILURE')
    expect(json).not.toContain(secret)
    expect(operator).not.toContain(secret)
    expect(json).toContain('[REDACTED]')
    expect(redactSensitiveText(`Authorization: Bearer ${secret}`, {}))
      .toBe('Authorization: Bearer [REDACTED]')
  })

  it('uses blocked migration JSON as the reason for a migration identity failure', async () => {
    const [migrationPlan] = discoverReleaseCandidateGates({
      packageScripts: {
        'plan:migration-reconciliation:json': 'node scripts/migration-reconciliation-planner.mjs --format json',
      },
    })
    const result = await runReleaseCandidateValidation({
      gatePlans: [migrationPlan],
      runner: async () => ({
        exitCode: 2,
        stdout: JSON.stringify({
          mode: 'READ_ONLY',
          mutationPerformed: false,
          validation: { valid: false, result: 'BLOCKED' },
        }),
        stderr: '',
        durationMs: 4,
      }),
    })

    expect(result.classification).toBe('BLOCKED_BY_MIGRATION_IDENTITY')
    expect(result.gates[0]).toMatchObject({
      status: 'FAILED',
      reason: 'migration identity, manifest, or checksum validation blocked',
    })
  })

  it('uses blocked preflight JSON as the reason for a local preflight failure', async () => {
    const preflightPlan = discoverReleaseCandidateGates({
      packageScripts: {
        'preflight:production-local:json': 'node scripts/production-local-preflight.mjs --format json',
      },
    }).find((plan) => plan.gate === 'unified_local_production_preflight')!
    const result = await runReleaseCandidateValidation({
      gatePlans: [preflightPlan],
      runner: async () => ({
        exitCode: 2,
        stdout: JSON.stringify({
          overall: 'BLOCKED_BY_CONFIGURATION',
          readyForHostedPreflight: false,
          hostedContactPerformed: false,
          productionActivationAuthorized: false,
        }),
        stderr: '',
        durationMs: 5,
      }),
    })

    expect(result.classification).toBe('BLOCKED_BY_LOCAL_PREFLIGHT')
    expect(result.gates[0]).toMatchObject({
      status: 'FAILED',
      reason: 'unified local production preflight blocked (BLOCKED_BY_CONFIGURATION)',
    })
  })

  it('classifies an absent migration validator as a missing gate', () => {
    const [missingMigration] = discoverReleaseCandidateGates()
    const result = createReleaseCandidateResult([{
      gate: missingMigration.gate,
      status: 'MISSING',
      durationMs: 0,
      reason: missingMigration.reason,
      blocking: missingMigration.blocking,
    }])

    expect(result.classification).toBe('BLOCKED_BY_MISSING_GATE')
  })

  it('produces machine-readable JSON with every requested gate field', () => {
    const parsed = JSON.parse(serializeReleaseCandidateResult(
      createReleaseCandidateResult(passingGates()),
    ))

    expect(parsed.classification).toBe('READY_FOR_HOSTED_PREFLIGHT')
    expect(parsed.gates).toHaveLength(gateNames.length)
    for (const gate of parsed.gates) {
      expect(gate).toEqual(expect.objectContaining({
        gate: expect.any(String),
        status: expect.any(String),
        durationMs: expect.any(Number),
        reason: expect.any(String),
        blocking: expect.any(Boolean),
      }))
    }
  })

  it('produces an operator result with status, duration, reason, and blocking mode', () => {
    const output = formatReleaseCandidateOperatorResult(
      createReleaseCandidateResult(passingGates()),
    )

    expect(output).toContain('Classification: READY_FOR_HOSTED_PREFLIGHT')
    expect(output).toContain('Scope: LOCAL VALIDATION ONLY (no hosted contact)')
    expect(output).toContain('gate=production_build status=PASSED')
    expect(output).toContain('duration=14ms blocking=blocking reason="completed successfully"')
    expect(output).toContain('Operator result: READY_FOR_HOSTED_PREFLIGHT')
  })
})
