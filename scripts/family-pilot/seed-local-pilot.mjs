// Deterministic, local-only fixture generator for the supervised Family
// Pilot. Produces one household, one adult supervisor, one Grade 5 learner,
// a second learner for isolation tests, an assigned Grade 5 Math pilot unit
// reference, and clean starting session/progress state.
//
// LOCAL ONLY — no network calls, no hosted Supabase writes. Every ID is
// derived deterministically from a seed string, so the same input always
// produces byte-identical output.
//
// No single Grade 5 Math unit is designated in this repository as "the"
// pilot unit (see docs/family-pilot/grade5-math-unit.md), so the unit
// reference must be supplied explicitly rather than guessed.

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FAMILY_PILOT_SEED_SCHEMA_VERSION = 1
export const FAMILY_PILOT_SEED_UNIT_REQUIRED = 'FAMILY_PILOT_SEED_UNIT_REQUIRED'
export const FAMILY_PILOT_SEED_UNIT_INVALID = 'FAMILY_PILOT_SEED_UNIT_INVALID'

const DEFAULT_SEED = 'family-pilot-local-seed-r1'
const UNIT_ID_PATTERN = /^ma-g5-mathematics-u(\d{2})$/
const SECRET_FIELD_NAME_PATTERN = /password|secret|token|apikey|api[_-]?key/i

/** Recursively checks every object key in a value for a secret-shaped field name. */
function hasSecretShapedKey(value) {
  if (Array.isArray(value)) return value.some(hasSecretShapedKey)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, nested]) => SECRET_FIELD_NAME_PATTERN.test(key) || hasSecretShapedKey(nested),
    )
  }
  return false
}

/** Normalizes a unit_id or bare unit number to a canonical unit_id. Returns null if unrecognized. */
export function normalizeUnitId(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null
  const trimmed = input.trim()
  if (UNIT_ID_PATTERN.test(trimmed)) return trimmed
  if (/^\d{1,2}$/.test(trimmed)) return `ma-g5-mathematics-u${trimmed.padStart(2, '0')}`
  return null
}

/** Derives a stable, UUID-v4-shaped identifier from a seed and a namespace label. */
function deterministicId(seed, namespace) {
  const digest = createHash('sha256').update(`${seed}::${namespace}`).digest('hex')
  const hex = digest.slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const h = hex.join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/**
 * Checks internal consistency of a generated dataset: no duplicate IDs,
 * adult/learner roles distinct, learners A/B distinct, assignment and
 * sessions reference real learners, sessions start clean, and no
 * secret-shaped field is present anywhere in the serialized output.
 */
export function validateSeedIntegrity(dataset) {
  const ids = [
    dataset.household.id,
    ...dataset.adults.map((adult) => adult.id),
    ...dataset.adults.map((adult) => adult.membershipId),
    ...dataset.learners.map((learner) => learner.id),
    ...dataset.learners.map((learner) => learner.membershipId),
    dataset.assignment.id,
    ...dataset.sessions.map((session) => session.sessionId),
  ]
  if (new Set(ids).size !== ids.length) {
    throw new Error('family_pilot_seed_duplicate_ids')
  }

  const learnerIds = new Set(dataset.learners.map((learner) => learner.id))
  if (learnerIds.size !== dataset.learners.length) {
    throw new Error('family_pilot_seed_duplicate_learner_ids')
  }

  const roles = new Set([
    ...dataset.adults.map((adult) => adult.role),
    ...dataset.learners.map((learner) => learner.role),
  ])
  if (!roles.has('guardian') || !roles.has('learner') || roles.size !== 2) {
    throw new Error('family_pilot_seed_roles_not_distinct')
  }

  if (!learnerIds.has(dataset.assignment.learnerId)) {
    throw new Error('family_pilot_seed_assignment_unknown_learner')
  }

  const sessionLearnerIds = dataset.sessions.map((session) => session.learnerId)
  if (new Set(sessionLearnerIds).size !== sessionLearnerIds.length) {
    throw new Error('family_pilot_seed_duplicate_session_learner')
  }
  for (const session of dataset.sessions) {
    if (!learnerIds.has(session.learnerId)) {
      throw new Error('family_pilot_seed_session_unknown_learner')
    }
    if (session.progressStatus !== 'not_started' || session.attempts.length !== 0) {
      throw new Error('family_pilot_seed_session_not_clean')
    }
  }

  if (hasSecretShapedKey(dataset)) {
    throw new Error('family_pilot_seed_secret_like_field_present')
  }

  return true
}

/**
 * Builds the deterministic local pilot fixture dataset.
 * @param {{ unit?: string, seed?: string }} options
 * @returns {{ status: 'OK', dataset: object } | { status: string, input?: string }}
 */
export function buildLocalPilotSeed({ unit, seed = DEFAULT_SEED } = {}) {
  if (unit === undefined || unit === null || unit === '') {
    return { status: FAMILY_PILOT_SEED_UNIT_REQUIRED }
  }
  const unitId = normalizeUnitId(unit)
  if (!unitId) {
    return { status: FAMILY_PILOT_SEED_UNIT_INVALID, input: unit }
  }

  const householdId = deterministicId(seed, 'household')
  const adultId = deterministicId(seed, 'adult:supervisor')
  const adultMembershipId = deterministicId(seed, 'membership:adult:supervisor')
  const learnerAId = deterministicId(seed, 'learner:a:grade5')
  const learnerAMembershipId = deterministicId(seed, 'membership:learner:a')
  const learnerBId = deterministicId(seed, 'learner:b:isolation')
  const learnerBMembershipId = deterministicId(seed, 'membership:learner:b')
  const assignmentId = deterministicId(seed, `assignment:learner:a:${unitId}`)
  const sessionAId = deterministicId(seed, 'session:learner:a')
  const sessionBId = deterministicId(seed, 'session:learner:b')

  const dataset = {
    schemaVersion: FAMILY_PILOT_SEED_SCHEMA_VERSION,
    scope: 'local-family-pilot-fixture-only',
    seed,
    household: {
      id: householdId,
      displayName: 'Pilot Household 01',
      status: 'active',
    },
    adults: [
      {
        id: adultId,
        membershipId: adultMembershipId,
        householdId,
        role: 'guardian',
        displayName: 'Pilot Adult Supervisor',
        status: 'active',
      },
    ],
    learners: [
      {
        id: learnerAId,
        membershipId: learnerAMembershipId,
        householdId,
        role: 'learner',
        displayName: 'Pilot Learner A',
        grade: 5,
        status: 'active',
        isolationLabel: 'primary',
      },
      {
        id: learnerBId,
        membershipId: learnerBMembershipId,
        householdId,
        role: 'learner',
        displayName: 'Pilot Learner B',
        grade: 5,
        status: 'active',
        isolationLabel: 'isolation-control',
      },
    ],
    assignment: {
      id: assignmentId,
      householdId,
      learnerId: learnerAId,
      subject: 'mathematics',
      grade: 5,
      unitId,
      status: 'assigned',
    },
    sessions: [
      { learnerId: learnerAId, sessionId: sessionAId, progressStatus: 'not_started', attempts: [] },
      { learnerId: learnerBId, sessionId: sessionBId, progressStatus: 'not_started', attempts: [] },
    ],
  }

  validateSeedIntegrity(dataset)

  return { status: 'OK', dataset }
}

function parseArgs(argv) {
  const args = { unit: null, seed: DEFAULT_SEED, format: 'operator', out: null }
  for (const arg of argv) {
    if (arg.startsWith('--unit=')) args.unit = arg.slice('--unit='.length)
    else if (arg.startsWith('--seed=')) args.seed = arg.slice('--seed='.length)
    else if (arg.startsWith('--format=')) args.format = arg.slice('--format='.length)
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length)
  }
  return args
}

function printOperator(outcome) {
  if (outcome.status === FAMILY_PILOT_SEED_UNIT_REQUIRED) {
    console.log(FAMILY_PILOT_SEED_UNIT_REQUIRED)
    console.log('No Grade 5 Math unit is designated as the pilot unit in this repository.')
    console.log(
      'Pass one explicitly: --unit=<unit_id|unit_number>, e.g. --unit=3 or --unit=ma-g5-mathematics-u03',
    )
    return
  }
  if (outcome.status === FAMILY_PILOT_SEED_UNIT_INVALID) {
    console.log(FAMILY_PILOT_SEED_UNIT_INVALID)
    console.log(`Could not parse unit reference: ${JSON.stringify(outcome.input)}`)
    return
  }
  const { dataset } = outcome
  console.log('Family pilot local seed (LOCAL ONLY — no hosted/network writes made)')
  console.log(`seed: ${dataset.seed}`)
  console.log(`household: ${dataset.household.id}`)
  console.log(`adult supervisor: ${dataset.adults[0].id}`)
  console.log(`learner A (grade 5, assigned unit ${dataset.assignment.unitId}): ${dataset.learners[0].id}`)
  console.log(`learner B (isolation control): ${dataset.learners[1].id}`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!['json', 'operator'].includes(args.format)) {
    process.stderr.write(
      'Usage: seed-local-pilot.mjs --unit=<unit_id|unit_number> [--seed string] [--format json|operator] [--out path]\n',
    )
    process.exitCode = 2
    return
  }

  const outcome = buildLocalPilotSeed({ unit: args.unit, seed: args.seed })

  if (outcome.status === 'OK' && args.out) {
    const outPath = isAbsolute(args.out) ? args.out : resolve(process.cwd(), args.out)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, `${JSON.stringify(outcome.dataset, null, 2)}\n`, 'utf8')
  }

  if (args.format === 'json') {
    console.log(JSON.stringify(outcome, null, 2))
  } else {
    printOperator(outcome)
  }

  if (outcome.status !== 'OK') process.exitCode = 2
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
