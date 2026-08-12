import { describe, expect, it } from 'vitest'
import {
  FAMILY_PILOT_SEED_UNIT_INVALID,
  FAMILY_PILOT_SEED_UNIT_REQUIRED,
  buildLocalPilotSeed,
  normalizeUnitId,
  validateSeedIntegrity,
} from './seed-local-pilot.mjs'

describe('normalizeUnitId', () => {
  it('accepts a canonical unit_id unchanged', () => {
    expect(normalizeUnitId('ma-g5-mathematics-u03')).toBe('ma-g5-mathematics-u03')
  })

  it('pads a bare unit number', () => {
    expect(normalizeUnitId('3')).toBe('ma-g5-mathematics-u03')
    expect(normalizeUnitId('10')).toBe('ma-g5-mathematics-u10')
  })

  it('rejects empty, missing, or unrecognized input', () => {
    expect(normalizeUnitId(undefined)).toBeNull()
    expect(normalizeUnitId('')).toBeNull()
    expect(normalizeUnitId('   ')).toBeNull()
    expect(normalizeUnitId('not-a-unit')).toBeNull()
    expect(normalizeUnitId('grade-5-unit-3')).toBeNull()
  })
})

describe('buildLocalPilotSeed refusal', () => {
  it('refuses when no unit is given', () => {
    expect(buildLocalPilotSeed({}).status).toBe(FAMILY_PILOT_SEED_UNIT_REQUIRED)
    expect(buildLocalPilotSeed({ unit: '' }).status).toBe(FAMILY_PILOT_SEED_UNIT_REQUIRED)
  })

  it('refuses an unrecognized unit reference', () => {
    const outcome = buildLocalPilotSeed({ unit: 'not-a-real-unit' })
    expect(outcome.status).toBe(FAMILY_PILOT_SEED_UNIT_INVALID)
    expect(outcome.input).toBe('not-a-real-unit')
  })
})

describe('buildLocalPilotSeed dataset', () => {
  it('builds a dataset for a bare unit number and for a canonical unit_id identically', () => {
    const byNumber = buildLocalPilotSeed({ unit: '3', seed: 'fixed-seed' })
    const byId = buildLocalPilotSeed({ unit: 'ma-g5-mathematics-u03', seed: 'fixed-seed' })
    expect(byNumber.status).toBe('OK')
    expect(byNumber).toEqual(byId)
  })

  it('is deterministic: the same unit and seed produce byte-identical output on repeat runs', () => {
    const first = buildLocalPilotSeed({ unit: '3', seed: 'repeat-check' })
    const second = buildLocalPilotSeed({ unit: '3', seed: 'repeat-check' })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('produces different IDs for different seeds', () => {
    const a = buildLocalPilotSeed({ unit: '3', seed: 'seed-a' })
    const b = buildLocalPilotSeed({ unit: '3', seed: 'seed-b' })
    expect(a.dataset.household.id).not.toBe(b.dataset.household.id)
  })

  it('keeps learner A and learner B distinct', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'ab-check' })
    const [learnerA, learnerB] = dataset.learners
    expect(learnerA.id).not.toBe(learnerB.id)
    expect(learnerA.membershipId).not.toBe(learnerB.membershipId)
    expect(learnerA.isolationLabel).not.toBe(learnerB.isolationLabel)
    expect(learnerA.displayName).not.toBe(learnerB.displayName)
  })

  it('keeps the adult supervisor role distinct from the learner role', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'role-check' })
    expect(dataset.adults[0].role).toBe('guardian')
    for (const learner of dataset.learners) {
      expect(learner.role).toBe('learner')
    }
    expect(dataset.adults[0].id).not.toBe(dataset.learners[0].id)
    expect(dataset.adults[0].id).not.toBe(dataset.learners[1].id)
  })

  it('assigns the pilot unit to learner A only, using the requested unit reference', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '7', seed: 'assignment-check' })
    expect(dataset.assignment.learnerId).toBe(dataset.learners[0].id)
    expect(dataset.assignment.learnerId).not.toBe(dataset.learners[1].id)
    expect(dataset.assignment.unitId).toBe('ma-g5-mathematics-u07')
  })

  it('starts every learner session clean', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'session-check' })
    for (const session of dataset.sessions) {
      expect(session.progressStatus).toBe('not_started')
      expect(session.attempts).toEqual([])
    }
    const sessionLearnerIds = dataset.sessions.map((session) => session.learnerId)
    expect(new Set(sessionLearnerIds).size).toBe(sessionLearnerIds.length)
  })

  it('contains no secret-shaped field names anywhere in the output', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'no-secret-fields-check' })
    const walk = (value): boolean => {
      if (Array.isArray(value)) return value.every(walk)
      if (value !== null && typeof value === 'object') {
        return Object.keys(value).every(
          (key) => !/password|secret|token|apikey|api[_-]?key/i.test(key) && walk((value as Record<string, unknown>)[key]),
        )
      }
      return true
    }
    expect(walk(dataset)).toBe(true)
  })
})

describe('validateSeedIntegrity', () => {
  it('accepts a well-formed dataset', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'integrity-ok' })
    expect(validateSeedIntegrity(dataset)).toBe(true)
  })

  it('rejects a dataset with duplicate IDs', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'integrity-dup' })
    const corrupted = { ...dataset, learners: [dataset.learners[0], { ...dataset.learners[1], id: dataset.learners[0].id }] }
    expect(() => validateSeedIntegrity(corrupted)).toThrow('family_pilot_seed_duplicate_ids')
  })

  it('rejects a dataset where a session references an unknown learner', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'integrity-orphan' })
    const corrupted = {
      ...dataset,
      sessions: [{ ...dataset.sessions[0], learnerId: 'not-a-real-learner-id' }, dataset.sessions[1]],
    }
    expect(() => validateSeedIntegrity(corrupted)).toThrow('family_pilot_seed_session_unknown_learner')
  })

  it('rejects a dataset where a session is not clean', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'integrity-dirty' })
    const corrupted = {
      ...dataset,
      sessions: [{ ...dataset.sessions[0], attempts: [{ score: 1 }] }, dataset.sessions[1]],
    }
    expect(() => validateSeedIntegrity(corrupted)).toThrow('family_pilot_seed_session_not_clean')
  })

  it('rejects a dataset carrying a secret-shaped field name', () => {
    const { dataset } = buildLocalPilotSeed({ unit: '3', seed: 'integrity-secret' })
    const corrupted = { ...dataset, household: { ...dataset.household, apiToken: 'x' } }
    expect(() => validateSeedIntegrity(corrupted)).toThrow('family_pilot_seed_secret_like_field_present')
  })
})
