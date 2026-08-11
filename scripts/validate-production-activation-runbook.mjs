import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const checklistPath = resolve(root, 'docs/final-integration/production-activation-checklist.json')
const runbookPath = resolve(root, 'docs/final-integration/production-activation-runbook.md')
const packagePath = resolve(root, 'package.json')

const [checklistText, runbook, packageText] = await Promise.all([
  readFile(checklistPath, 'utf8'),
  readFile(runbookPath, 'utf8'),
  readFile(packagePath, 'utf8'),
])

const checklist = JSON.parse(checklistText)
const packageJson = JSON.parse(packageText)
const errors = []

function requireCondition(condition, message) {
  if (!condition) errors.push(message)
}

const requiredPhaseIds = [
  'phase-0-local-rc-gate',
  'phase-1-hosted-read-only-preflight',
  'phase-2-migrations',
  'phase-3-production-configuration',
  'phase-4-deploy',
  'phase-5-production-smoke',
  'rollback-and-stop-the-line',
  'incident-evidence-and-closeout',
]

const requiredStopIds = [
  'migration-checksum-mismatch',
  'unexpected-hosted-migration',
  'authorization-failure',
  'privacy-leak',
  'provider-pricing-wrong',
  'cost-arithmetic-wrong',
  'study-authority-bypass',
  'worker-duplicate-delivery',
  'telemetry-duplicate-counting',
  'production-smoke-failure',
  'unexpected-release-binding-behavior',
]

const requiredRollbackIds = [
  'application-rollback',
  'feature-gate-disable',
  'worker-schedule-disable',
  'provider-ai-tts-disable',
  'curriculum-active-pointer-rollback',
  'new-study-session-release-rollback',
  'database-forward-repair',
]

requireCondition(checklist.schemaVersion === 1, 'schemaVersion must be 1')
requireCondition(
  checklist.classification === 'PRODUCTION_ACTIVATION_RUNBOOK_READY',
  'classification must be PRODUCTION_ACTIVATION_RUNBOOK_READY',
)
requireCondition(Array.isArray(checklist.phases), 'phases must be an array')
requireCondition(
  JSON.stringify(checklist.phases?.map((phase) => phase.id)) === JSON.stringify(requiredPhaseIds),
  'phases are missing or out of order',
)

const allStepIds = new Set()
const commandIds = new Set()
for (const command of checklist.commandCatalog ?? []) {
  requireCondition(typeof command.id === 'string' && command.id.length > 0, 'command id missing')
  requireCondition(!commandIds.has(command.id), `duplicate command id ${command.id}`)
  commandIds.add(command.id)
  const mayOmitCommand = command.type === 'release_discovery' || command.type === 'hosted_procedure'
  requireCondition(
    mayOmitCommand || (typeof command.command === 'string' && command.command.length > 0),
    `${command.id}: executable command missing`,
  )
  if (command.availability === 'reachable_repository_commit') {
    requireCondition(/^[a-f0-9]{40}$/.test(command.sourceCommit ?? ''), `${command.id}: source commit invalid`)
  }
}

for (const phase of checklist.phases ?? []) {
  requireCondition(Number.isInteger(phase.order), `${phase.id}: order must be an integer`)
  requireCondition(Array.isArray(phase.steps) && phase.steps.length > 0, `${phase.id}: steps must be nonempty`)
  let previousOrder = -1
  for (const step of phase.steps ?? []) {
    requireCondition(typeof step.id === 'string' && step.id.length > 0, `${phase.id}: step id missing`)
    requireCondition(!allStepIds.has(step.id), `${phase.id}: duplicate step id ${step.id}`)
    allStepIds.add(step.id)
    requireCondition(Number.isInteger(step.order) && step.order > previousOrder, `${step.id}: step order is invalid`)
    previousOrder = step.order
    requireCondition(typeof step.action === 'string' && step.action.length > 0, `${step.id}: action missing`)
    requireCondition(Array.isArray(step.evidence) && step.evidence.length > 0, `${step.id}: evidence missing`)
    requireCondition(step.onFailure === 'STOP', `${step.id}: onFailure must be STOP`)
    for (const ref of [...(step.commandRefs ?? []), ...(step.procedureRefs ?? [])]) {
      requireCondition(commandIds.has(ref), `${step.id}: unknown command/procedure ref ${ref}`)
    }
  }
}

const stopIds = checklist.stopTheLine?.map((condition) => condition.id) ?? []
for (const id of requiredStopIds) requireCondition(stopIds.includes(id), `missing stop condition ${id}`)

const rollbackIds = checklist.rollbackMatrix?.map((entry) => entry.id) ?? []
for (const id of requiredRollbackIds) requireCondition(rollbackIds.includes(id), `missing rollback entry ${id}`)

for (const command of checklist.commandCatalog ?? []) {
  if (command.type === 'npm_script' && command.availability === 'authoring_base') {
    requireCondition(
      typeof packageJson.scripts?.[command.script] === 'string',
      `missing package script ${command.script}`,
    )
  }
}

const requiredRunbookText = [
  'READY_FOR_HOSTED_PREFLIGHT',
  'already-bound Study sessions remain pinned',
  'PRODUCTION_ACTIVATION_RUNBOOK_READY',
  'Phase 0 — Local RC gate',
  'Phase 1 — Hosted read-only preflight',
  'Phase 2 — Migrations',
  'Phase 3 — Production configuration',
  'Phase 4 — Deploy',
  'Phase 5 — Production smoke',
  'Stop-the-line conditions',
  'Incident evidence',
]
for (const text of requiredRunbookText) {
  requireCondition(runbook.includes(text), `runbook is missing required text: ${text}`)
}

const combined = `${runbook}\n${checklistText}`
const secretPatterns = [
  /sk-ant-[A-Za-z0-9_-]{12,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
]
for (const pattern of secretPatterns) requireCondition(!pattern.test(combined), `possible raw secret matched ${pattern}`)

const destructiveRollbackPatterns = [
  /\bsupabase\s+db\s+reset\b/i,
  /\bdown\s+migration\b/i,
  /\bdrop\s+(?:table|schema|database)\b/i,
  /\bdelete\s+from\s+[^\n]+migration/i,
  /\bforce[^\n]+migration[^\n]+history\b/i,
]
for (const pattern of destructiveRollbackPatterns) {
  requireCondition(!pattern.test(combined), `destructive rollback instruction matched ${pattern}`)
}

if (errors.length > 0) {
  console.error(JSON.stringify({
    result: 'PRODUCTION_ACTIVATION_RUNBOOK_INVALID',
    errors,
  }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    result: 'PRODUCTION_ACTIVATION_RUNBOOK_VALID',
    phaseCount: checklist.phases.length,
    stepCount: allStepIds.size,
    commandCount: checklist.commandCatalog.length,
    stopConditionCount: checklist.stopTheLine.length,
    rollbackEntryCount: checklist.rollbackMatrix.length,
  }))
}
