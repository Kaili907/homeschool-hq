import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateAdminProductionPreflight } from './admin-production-preflight.mjs'
import { createMigrationReconciliationPlan } from './migration-reconciliation-planner.mjs'
import {
  evaluateUnifiedLocalProductionPreflight,
  formatUnifiedLocalProductionPreflight,
  serializeUnifiedLocalProductionPreflight,
  UNIFIED_LOCAL_PREFLIGHT_PRECEDENCE,
} from './production-local-preflight.mjs'
import {
  evaluateStudyDeploymentPreflight,
  EXPECTED_FAMILY_PILOT_CONTEXT,
  EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS,
} from './study-deployment-env-preflight.mjs'
import { EXPECTED_STUDY_PROJECT_REF } from './study-migration-preflight.mjs'

const scenariosUrl = new URL('./fixtures/production-local-preflight/scenarios.json', import.meta.url)
const evidenceReference = 'scripts/production-local-preflight.test.ts'

interface MigrationSpec {
  filename: string
  source: string
}

function checksum(source: string) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

function manifestFor(specs: MigrationSpec[]) {
  return {
    schemaVersion: 1,
    projectRef: EXPECTED_STUDY_PROJECT_REF,
    hashNormalization: 'UTF-8 bytes with CRLF normalized to LF',
    migrations: specs.map((spec, index) => ({
      version: spec.filename.slice(0, 14),
      filename: spec.filename,
      sha256: checksum(spec.source),
      dependency: index === 0 ? null : specs[index - 1].filename,
      classification: index === 0 ? 'historical-baseline' : 'executable',
      applicationStatus: index === 0
        ? 'hosted-equivalent-baseline-pending-authorization'
        : 'not-applied-hosted',
      requiredMarkerTransition: `fixture-marker-${index + 1}`,
      supersessionStatus: 'current',
    })),
  }
}

function contractFor(manifest: ReturnType<typeof manifestFor>) {
  return {
    schemaVersion: 1,
    contractId: 'unified-production-local-fixture',
    localOnly: true,
    classificationPriority: ['BLOCKED_BY_LOCAL_INTEGRATION'],
    migrationIdentity: {
      frozenHistoricalMigrations: [{
        filename: manifest.migrations[0].filename,
        sha256: manifest.migrations[0].sha256,
      }],
      approvedHistoricalReconciliations: [],
    },
    gates: [{
      id: 'admin_fixture_gate',
      area: 'admin',
      applicability: 'required',
      blockerClassification: 'BLOCKED_BY_LOCAL_INTEGRATION',
    }],
  }
}

function evidenceFor(contract: ReturnType<typeof contractFor>, blockedReason?: string) {
  return {
    schemaVersion: 1,
    contractId: contract.contractId,
    scope: 'local-only',
    gates: {
      admin_fixture_gate: blockedReason
        ? { status: 'BLOCKING', reasonCode: blockedReason, evidenceRefs: [evidenceReference] }
        : { status: 'PASS', evidenceRefs: [evidenceReference] },
    },
  }
}

const secretSentinels = Object.freeze({
  serviceRole: 'service-role-secret-sentinel-never-print',
  hmac: 'safety-hmac-secret-sentinel-never-print',
  provider: 'anthropic-secret-sentinel-never-print',
  worker: 'worker-credential-secret-sentinel-never-print',
  invocation: 'manual-invocation-secret-sentinel-never-print',
})

function readyEnvironment(): Record<string, string> {
  return {
    VITE_STUDY_ENGINE_ENABLED: 'true',
    ACADEMY_STUDY_ENABLED: 'true',
    VITE_STUDY_ENGINE_PREVIEW: 'false',
    VITE_SUPABASE_URL: 'https://academy.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'fixture-public-anon-key',
    SUPABASE_URL: 'https://academy.supabase.co',
    SUPABASE_ANON_KEY: 'fixture-public-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: secretSentinels.serviceRole,
    STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: secretSentinels.hmac,
    ANTHROPIC_API_KEY: secretSentinels.provider,
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: 'credential:adult-review',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'worker-credential-v1',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'worker-configuration-v1',
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: secretSentinels.worker,
    ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET: secretSentinels.invocation,
  }
}

function validNetlifyConfig() {
  return `
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/function-entrypoints"

[build.environment]
  VITE_USE_PROXY = "true"
  NODE_VERSION = "22"

[context."${EXPECTED_FAMILY_PILOT_CONTEXT}".environment]
  VITE_FAMILY_PILOT_ENABLED = "true"

[functions."study-adult-review-scheduled-worker"]
  schedule = "*/5 * * * *"

[[redirects]]
  from = "/api/study/adult-review/worker"
  to = "/.netlify/functions/study-adult-review-worker"
  status = 200

[[redirects]]
  from = "/api/study/safety/*"
  to = "/.netlify/functions/study-safety-classify"
  status = 200
`
}

function studyResult(env = readyEnvironment()) {
  return evaluateStudyDeploymentPreflight({
    env,
    netlifyToml: validNetlifyConfig(),
    functionFiles: new Set(EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS),
    functionEntrypointSources: new Map(EXPECTED_NETLIFY_FUNCTION_ENTRYPOINTS.map((name) => [
      name,
      `export { handler } from '../functions/${name}.js'`,
    ])),
  })
}

async function withMigrationFixture<T>(
  specs: MigrationSpec[],
  run: (fixture: {
    adminResult: Awaited<ReturnType<typeof evaluateAdminProductionPreflight>>
    migrationPlan: Awaited<ReturnType<typeof createMigrationReconciliationPlan>>
  }) => Promise<T> | T,
  blockedReason?: string,
) {
  const directory = await mkdtemp(join(tmpdir(), 'unified-production-local-'))
  try {
    await Promise.all(specs.map((spec) => writeFile(join(directory, spec.filename), spec.source, 'utf8')))
    const manifest = manifestFor(specs)
    const contract = contractFor(manifest)
    const [adminResult, migrationPlan] = await Promise.all([
      evaluateAdminProductionPreflight({
        contract,
        evidence: evidenceFor(contract, blockedReason),
        manifest,
        migrationDirectory: directory,
        evidenceRoot: process.cwd(),
      }),
      createMigrationReconciliationPlan({
        migrationDirectory: directory,
        manifest,
        manifestPath: 'fixture-manifest.json',
        safety: contract,
        referenceRoots: [],
      }),
    ])
    return await run({ adminResult, migrationPlan })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const uniqueMigrations = Object.freeze([
  { filename: '20260810110000_fixture_foundation.sql', source: 'select 1;\n' },
  { filename: '20260810120000_fixture_feature.sql', source: 'select 2;\n' },
])

const collidingMigrations = Object.freeze([
  { filename: '20260810120000_fixture_alpha.sql', source: 'select 1;\n' },
  { filename: '20260810120000_fixture_beta.sql', source: 'select 2;\n' },
])

async function loadScenarios() {
  return JSON.parse(await readFile(scenariosUrl, 'utf8')).scenarios as Record<string, any>
}

describe('unified local production preflight scenario fixtures', () => {
  it('all-local-pass reaches hosted-preflight eligibility without authorizing hosted work', async () => {
    const scenarios = await loadScenarios()
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult,
        migrationPlan,
        studyResult: studyResult(),
        env: readyEnvironment(),
      })
      expect(report).toMatchObject({
        overall: scenarios['all-local-pass'].expectedOverall,
        readyForHostedPreflight: true,
        productionActivationAuthorized: false,
        hostedContactPerformed: false,
        deploymentSmokeTestsPerformed: false,
        summary: { ready: 3, blocking: 0 },
      })
      expect(report.phases.hostedPreflight).toMatchObject({ status: 'NOT_RUN', authorized: false })
      expect(report.phases.deploymentSmokeTests).toMatchObject({ status: 'NOT_RUN', performed: false })
    })
  })

  it('migration-collision remains BLOCKED_BY_MIGRATION_IDENTITY', async () => {
    const scenarios = await loadScenarios()
    await withMigrationFixture([...collidingMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult,
        migrationPlan,
        studyResult: studyResult(),
        env: readyEnvironment(),
      })
      expect(report.overall).toBe(scenarios['migration-collision'].expectedOverall)
      expect(report.readyForHostedPreflight).toBe(false)
      expect(report.components.adminR3.status).toBe('BLOCKED_BY_MIGRATION_IDENTITY')
      expect(report.components.migrationReconciliation).toMatchObject({
        status: 'BLOCKED',
        mode: 'READ_ONLY',
        mutationPerformed: false,
      })
    })
  })

  it('missing-env remains BLOCKED_BY_MISSING_ENV', async () => {
    const scenarios = await loadScenarios()
    const env = readyEnvironment()
    delete env.VITE_STUDY_ENGINE_ENABLED
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult,
        migrationPlan,
        studyResult: studyResult(env),
        env,
      })
      expect(report.overall).toBe(scenarios['missing-env'].expectedOverall)
      expect(report.components.studyDeploymentEnvironment.status).toBe('BLOCKED_BY_MISSING_ENV')
    })
  })

  it('unsafe-env takes deterministic safety precedence', async () => {
    const scenarios = await loadScenarios()
    const env = {
      ...readyEnvironment(),
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'client-exposed-secret-sentinel-never-print',
    }
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult,
        migrationPlan,
        studyResult: studyResult(env),
        env,
      })
      expect(report.overall).toBe(scenarios['unsafe-env'].expectedOverall)
      expect(report.components.studyDeploymentEnvironment.status).toBe('BLOCKED_BY_UNSAFE_ENV')
    })
  })

  it('Admin blocker retains the Admin R3 classification and detail', async () => {
    const scenarios = await loadScenarios()
    await withMigrationFixture(
      [...uniqueMigrations],
      ({ adminResult, migrationPlan }) => {
        const report = evaluateUnifiedLocalProductionPreflight({
          adminResult,
          migrationPlan,
          studyResult: studyResult(),
          env: readyEnvironment(),
        })
        expect(report.overall).toBe(scenarios['admin-blocker'].expectedOverall)
        expect(report.components.adminR3.result?.blockers).toEqual([{
          gateId: 'admin_fixture_gate',
          classification: 'BLOCKED_BY_LOCAL_INTEGRATION',
          reasonCode: scenarios['admin-blocker'].reasonCode,
        }])
      },
      scenarios['admin-blocker'].reasonCode,
    )
  })

  it('multiple-simultaneous-blockers reports every authority and applies precedence', async () => {
    const scenarios = await loadScenarios()
    let collisionPlan: Awaited<ReturnType<typeof createMigrationReconciliationPlan>> | undefined
    await withMigrationFixture([...collidingMigrations], ({ migrationPlan }) => {
      collisionPlan = migrationPlan
    })
    await withMigrationFixture(
      [...uniqueMigrations],
      ({ adminResult }) => {
        const env = readyEnvironment()
        delete env.VITE_STUDY_ENGINE_ENABLED
        const report = evaluateUnifiedLocalProductionPreflight({
          adminResult,
          migrationPlan: collisionPlan,
          studyResult: studyResult(env),
          env,
        })
        expect(report.overall).toBe(scenarios['multiple-simultaneous-blockers'].expectedOverall)
        expect(report.blockers).toHaveLength(
          scenarios['multiple-simultaneous-blockers'].expectedBlockerCount,
        )
        expect(report.blockers.map((blocker) => blocker.classification)).toEqual([
          'BLOCKED_BY_LOCAL_INTEGRATION',
          'BLOCKED_BY_MIGRATION_IDENTITY',
          'BLOCKED_BY_MISSING_ENV',
        ])
        expect(report.precedence).toEqual([...UNIFIED_LOCAL_PREFLIGHT_PRECEDENCE])
      },
      'FIXTURE_ADMIN_BLOCKER',
    )
  })

  it('secret-redaction excludes sensitive values from JSON and operator output', async () => {
    const scenarios = await loadScenarios()
    const env = { ...readyEnvironment(), ANTHROPIC_API_KEY: scenarios['secret-redaction'].sentinel }
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult: { ...adminResult, accidentalSecret: scenarios['secret-redaction'].sentinel },
        migrationPlan,
        studyResult: studyResult(env),
        env,
      })
      const output = serializeUnifiedLocalProductionPreflight(report) +
        formatUnifiedLocalProductionPreflight(report)
      for (const secret of [...Object.values(secretSentinels), scenarios['secret-redaction'].sentinel]) {
        expect(output).not.toContain(secret)
      }
      expect(output).not.toContain('fixture-public-anon-key')
      expect(report.components.adminR3.result?.accidentalSecret).toBe('[REDACTED]')
    })
  })

  it('JSON output is parseable, deterministic, and retains detailed subsystem results', async () => {
    const scenarios = await loadScenarios()
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult,
        migrationPlan,
        studyResult: studyResult(),
        env: readyEnvironment(),
      })
      const first = serializeUnifiedLocalProductionPreflight(report)
      const second = serializeUnifiedLocalProductionPreflight(report)
      const parsed = JSON.parse(first)
      expect(second).toBe(first)
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        preflight: scenarios['json-output'].expectedPreflight,
        components: {
          adminR3: { result: { classification: 'READY_FOR_HOSTED_PREFLIGHT' } },
          migrationReconciliation: { result: { mode: 'READ_ONLY' } },
          studyDeploymentEnvironment: {
            result: { overall: 'READY_FOR_DEPLOYMENT_ENVIRONMENT' },
          },
        },
      })
      expect(parsed).not.toHaveProperty('generatedAt')
    })
  })

  it('operator output identifies boundaries, blockers, and all authority details', async () => {
    const scenarios = await loadScenarios()
    await withMigrationFixture(
      [...uniqueMigrations],
      ({ adminResult, migrationPlan }) => {
        const output = formatUnifiedLocalProductionPreflight(
          evaluateUnifiedLocalProductionPreflight({
            adminResult,
            migrationPlan,
            studyResult: studyResult(),
            env: readyEnvironment(),
          }),
        )
        expect(output).toContain(scenarios['operator-output'].expectedTitle)
        expect(output).toContain('Hosted preflight: NOT RUN')
        expect(output).toContain('Deployment smoke tests: NOT RUN')
        expect(output).toContain('Admin R3 authority detail:')
        expect(output).toContain('Migration reconciliation authority detail:')
        expect(output).toContain('Mode: READ ONLY (no files renamed or modified)')
        expect(output).toContain('Study deployment environment authority detail:')
        expect(output).toContain('FIXTURE_ADMIN_BLOCKER')
      },
      'FIXTURE_ADMIN_BLOCKER',
    )
  })

  it('fails closed when an authority returns an unknown non-ready status', async () => {
    await withMigrationFixture([...uniqueMigrations], ({ adminResult, migrationPlan }) => {
      const report = evaluateUnifiedLocalProductionPreflight({
        adminResult: {
          ...adminResult,
          classification: 'UNKNOWN_ADMIN_STATUS',
          readyForHostedPreflight: false,
        },
        migrationPlan,
        studyResult: studyResult(),
        env: readyEnvironment(),
      })
      expect(report.overall).toBe('BLOCKED_BY_LOCAL_INTEGRATION')
      expect(report.readyForHostedPreflight).toBe(false)
      expect(report.blockers).toHaveLength(1)
    })
  })
})
