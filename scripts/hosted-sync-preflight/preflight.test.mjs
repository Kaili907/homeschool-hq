import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  inspectEnvironment,
  inspectInventorySql,
  inspectRepoGuard,
  inspectRollbackChecklist,
  inspectTargetIdentity,
  LEARNER_RELEASE_SHA,
  PRODUCTION_PROJECT_REF,
  runHostedInventory,
  runLocalReplay,
} from './lib.mjs'
import { parseArguments, runPreflight } from './preflight.mjs'

const stagingRef = 'abcdefghijklmnopqrst'
const convergenceFixture = '1'.repeat(40)
const secret = 'postgresql://postgres:secret-sentinel@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=require'

function readyEnv() {
  return {
    HOSTED_SYNC_DATABASE_URL: secret,
    HOSTED_SYNC_TARGET_PROJECT_REF: stagingRef,
    VITE_FAMILY_PILOT_ENABLED: 'false',
    VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'false',
    VITE_STUDY_ENGINE_ENABLED: 'false',
    ACADEMY_STUDY_ENABLED: 'false',
  }
}

test('environment inventory reports presence and disabled state without values', () => {
  const result = inspectEnvironment(readyEnv())
  assert.equal(result.valid, true)
  assert.equal(JSON.stringify(result).includes('secret-sentinel'), false)
  assert.deepEqual(result.hosted.map((item) => Object.keys(item).sort()), [
    ['name', 'present', 'secret'],
    ['name', 'present', 'secret'],
  ])
})

test('feature gates must exist and equal the exact string false', () => {
  assert.equal(inspectEnvironment({ ...readyEnv(), ACADEMY_STUDY_ENABLED: 'true' }).valid, false)
  assert.equal(inspectEnvironment({
    ...readyEnv(),
    VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
  }).valid, false)
  const missing = readyEnv()
  delete missing.VITE_FAMILY_PILOT_ENABLED
  assert.equal(inspectEnvironment(missing).valid, false)
})

test('target identity rejects production and mismatched URLs', () => {
  assert.equal(inspectTargetIdentity({
    expectedProjectRef: PRODUCTION_PROJECT_REF,
    environmentProjectRef: PRODUCTION_PROJECT_REF,
    databaseUrl: `postgresql://postgres:x@db.${PRODUCTION_PROJECT_REF}.supabase.co/postgres`,
  }).valid, false)
  assert.equal(inspectTargetIdentity({
    expectedProjectRef: stagingRef,
    environmentProjectRef: stagingRef,
    databaseUrl: 'postgresql://postgres:x@db.zzzzzzzzzzzzzzzzzzzz.supabase.co/postgres',
  }).valid, false)
  const accepted = inspectTargetIdentity({
    expectedProjectRef: stagingRef,
    environmentProjectRef: stagingRef,
    databaseUrl: secret,
  })
  assert.equal(accepted.valid, true)
  assert.equal(JSON.stringify(accepted).includes('secret-sentinel'), false)
  assert.equal(inspectTargetIdentity({
    expectedProjectRef: stagingRef,
    environmentProjectRef: stagingRef,
    databaseUrl: secret.replace('sslmode=require', 'sslmode=disable'),
  }).valid, false)
})

test('repo guard requires exact clean HEAD and learner ancestry', async () => {
  const cleanRun = async (_command, args) => {
    if (args[0] === 'rev-parse') return { stdout: `${convergenceFixture}\n` }
    if (args[0] === 'status') return { stdout: '' }
    return { stdout: '' }
  }
  assert.equal((await inspectRepoGuard({
    rootDirectory: '/fixture',
    learnerReleaseSha: LEARNER_RELEASE_SHA,
    convergenceSha: convergenceFixture,
    run: cleanRun,
  })).valid, true)

  const dirtyRun = async (_command, args) => {
    if (args[0] === 'rev-parse') return { stdout: `${convergenceFixture}\n` }
    if (args[0] === 'status') return { stdout: '?? unexpected\n' }
    return { stdout: '' }
  }
  assert.equal((await inspectRepoGuard({
    rootDirectory: '/fixture',
    learnerReleaseSha: LEARNER_RELEASE_SHA,
    convergenceSha: convergenceFixture,
    run: dirtyRun,
  })).reasons.includes('worktree-not-clean'), true)
})

test('inventory SQL has a read-only transaction and no write-capable tokens', async () => {
  const source = await readFile(new URL('./inventory.sql', import.meta.url), 'utf8')
  assert.equal(inspectInventorySql(source).valid, true)
  assert.equal(inspectInventorySql(`${source}\ninsert into public.x values (1);`).valid, false)
})

test('local replay child receives no hosted connection environment', async () => {
  let childEnvironment
  const result = await runLocalReplay({
    rootDirectory: '/fixture',
    env: {
      PATH: '/bin',
      HOSTED_SYNC_DATABASE_URL: secret,
      SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      PGHOST: 'hosted.example',
    },
    run: async (_command, _args, options) => {
      childEnvironment = options.env
      return { stdout: '' }
    },
  })
  assert.equal(result.valid, true)
  assert.equal(childEnvironment.NO_HOSTED_CONTACT, 'true')
  assert.equal('HOSTED_SYNC_DATABASE_URL' in childEnvironment, false)
  assert.equal('SUPABASE_SERVICE_ROLE_KEY' in childEnvironment, false)
  assert.equal('PGHOST' in childEnvironment, false)
})

test('hosted reader keeps the password out of argv and forces server read-only defaults', async () => {
  const target = inspectTargetIdentity({
    expectedProjectRef: stagingRef,
    environmentProjectRef: stagingRef,
    databaseUrl: secret,
  })
  let invocation
  const result = await runHostedInventory({
    parsedDatabaseUrl: target.parsed,
    inventoryPath: new URL('./inventory.sql', import.meta.url).pathname,
    env: { PATH: '/bin', HOSTED_SYNC_DATABASE_URL: secret },
    run: async (command, args, options) => {
      invocation = { command, args, options }
      return { stdout: 'catalog-only' }
    },
  })
  assert.equal(result.valid, true)
  assert.equal(invocation.command, 'psql')
  assert.equal(invocation.args.join(' ').includes('secret-sentinel'), false)
  assert.equal(invocation.options.env.PGPASSWORD, 'secret-sentinel')
  assert.match(invocation.options.env.PGOPTIONS, /default_transaction_read_only=on/u)
  assert.equal('HOSTED_SYNC_DATABASE_URL' in invocation.options.env, false)
})

test('rollback checklist remains a non-authorizing pending template', async () => {
  const checklist = JSON.parse(await readFile(
    new URL('../../docs/hosted-study-sync/staging-preflight/rollback-checklist.json', import.meta.url),
    'utf8',
  ))
  assert.equal(inspectRollbackChecklist(checklist).valid, true)
  assert.equal(inspectRollbackChecklist({ ...checklist, hostedApplyAuthorized: true }).valid, false)
})

test('parser pins learner release SHA and has no apply mode', () => {
  assert.throws(() => parseArguments(['--apply']), /apply-mode-does-not-exist/u)
  assert.throws(() => parseArguments([
    '--learner-release-sha', '0'.repeat(40),
    '--convergence-sha', '1'.repeat(40),
    '--target-project-ref', stagingRef,
  ]), /learner-release-sha-does-not-match-pinned-release/u)
})

test('default execution does not call the hosted inventory runner', async () => {
  let hostedCalls = 0
  const options = parseArguments([
    '--learner-release-sha', LEARNER_RELEASE_SHA,
    '--convergence-sha', LEARNER_RELEASE_SHA,
    '--target-project-ref', stagingRef,
  ])
  const report = await runPreflight(options, {
    env: readyEnv(),
    repoInspector: async () => ({ valid: true, reasons: [] }),
    replayRunner: async () => ({ valid: true, command: 'fixture-local-replay' }),
    inventoryRunner: async () => {
      hostedCalls += 1
      return { valid: true, inventory: 'fixture' }
    },
  })
  assert.equal(report.passed, true)
  assert.equal(report.mode, 'LOCAL_ONLY')
  assert.equal(report.hostedContactPerformed, false)
  assert.equal(report.hostedWritePerformed, false)
  assert.equal(report.applyModeAvailable, false)
  assert.equal(hostedCalls, 0)
  assert.equal(JSON.stringify(report).includes('secret-sentinel'), false)
})

test('hosted read is explicit and still never authorizes writes or enablement', async () => {
  let hostedCalls = 0
  const options = parseArguments([
    '--learner-release-sha', LEARNER_RELEASE_SHA,
    '--convergence-sha', LEARNER_RELEASE_SHA,
    '--target-project-ref', stagingRef,
    '--hosted-read',
  ])
  const report = await runPreflight(options, {
    env: readyEnv(),
    repoInspector: async () => ({ valid: true, reasons: [] }),
    replayRunner: async () => ({ valid: true, command: 'fixture-local-replay' }),
    inventoryRunner: async () => {
      hostedCalls += 1
      return { valid: true, inventory: 'read-only-fixture', sqlSha256: 'a'.repeat(64) }
    },
  })
  assert.equal(report.status, 'HOSTED_READ_COMPLETE')
  assert.equal(report.hostedContactPerformed, true)
  assert.equal(report.hostedWritePerformed, false)
  assert.equal(report.stagingApplyAuthorized, false)
  assert.equal(report.familyEnablementAuthorized, false)
  assert.equal(hostedCalls, 1)
})
