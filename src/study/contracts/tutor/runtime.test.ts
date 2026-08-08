import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_FORBIDDEN_KEYS,
  type StudyTutorLaunch,
  type StudyTutorResult,
  type StudyTutorRuntime,
  type StudyTutorTurn,
} from './runtime'
import { STUDY_TUTOR_RESULT_KEYS, parseStudyTutorResult } from './results'

// STUDY-A1-TUTOR-CONTRACT — the boundary itself, held to its own statements.
//
// Every field set below is declared as `Record<keyof T, true>`, so TypeScript
// refuses the file when a field is added to or removed from the contract and
// this list is not updated in the same edit. A per-field value test would only
// ever be one field behind; the forcing type is what makes the runtime
// assertions here a claim about the interface rather than about a sample.

const LAUNCH_FIELDS: Record<keyof StudyTutorLaunch, true> = {
  sessionRef: true,
  lessonRef: true,
  householdTimeZone: true,
  learnerLocalDate: true,
}

const TURN_FIELDS: Record<keyof StudyTutorTurn, true> = {
  sessionRef: true,
  requestRef: true,
  lessonRef: true,
  segmentRef: true,
  subject: true,
  skillRef: true,
  taskType: true,
  transientLearnerText: true,
  expectedAnswer: true,
  occurredAt: true,
  learnerLocalDate: true,
  householdTimeZone: true,
}

const RUNTIME_MEMBERS: Record<keyof StudyTutorRuntime, true> = {
  contractVersion: true,
  launch: true,
  submit: true,
}

const FORBIDDEN = new Set<string>(STUDY_TUTOR_FORBIDDEN_KEYS)

/** Closed at four: this compiles only while the union has exactly these branches. */
function branchOf(result: StudyTutorResult): string {
  switch (result.status) {
    case 'accepted': return result.eventRef
    case 'stopped': return result.deliveryStatus
    case 'interrupted': return result.interruption.kind
    case 'quarantined': return result.reasonCode
    default: {
      const unreachable: never = result
      throw new Error(`Unhandled Tutor result branch: ${JSON.stringify(unreachable)}`)
    }
  }
}

describe('production Tutor runtime contract', () => {
  it('is a two-method boundary with a pinned contract version', () => {
    expect(Object.keys(RUNTIME_MEMBERS).sort()).toEqual(['contractVersion', 'launch', 'submit'])
    expect(STUDY_TUTOR_CONTRACT_VERSION).toBe('study-tutor.v1')
  })

  it('closes the result union on exactly the four semantic branches', () => {
    expect(Object.keys(STUDY_TUTOR_RESULT_KEYS).sort()).toEqual([
      'accepted',
      'interrupted',
      'quarantined',
      'stopped',
    ])
    expect(branchOf({ status: 'accepted', eventRef: 'event.1', visibleText: 'Next step.' })).toBe('event.1')
    expect(branchOf({ status: 'stopped', reasonCode: 'x-stop', deliveryStatus: 'not-confirmed' })).toBe('not-confirmed')
    expect(branchOf({ status: 'interrupted', interruption: { kind: 'rate-limit' } })).toBe('rate-limit')
    expect(branchOf({ status: 'quarantined', reasonCode: 'x-quarantine' })).toBe('x-quarantine')
  })

  it('refuses a fifth catch-all success state at runtime', () => {
    expect(parseStudyTutorResult({ status: 'completed', eventRef: 'event.1' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'unknown', reasonCode: 'x' })).toBeNull()
  })

  it('does not collapse a technical interruption into learner safety', () => {
    const interrupted = parseStudyTutorResult({
      status: 'interrupted',
      interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
    })
    expect(interrupted).toEqual({
      status: 'interrupted',
      interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
    })
    // An interruption carries no classification, no reason code and no delivery
    // status, so a host has nothing stop-shaped it could record from one.
    expect(Object.keys(interrupted!).sort()).toEqual(['interruption', 'status'])
    // Quarantine stays structural: it is not an adult-help state either.
    expect(STUDY_TUTOR_RESULT_KEYS.quarantined).not.toContain('deliveryStatus')
    expect(STUDY_TUTOR_RESULT_KEYS.interrupted).not.toContain('deliveryStatus')
  })

  it('gives a Tutor no field in which to claim authority', () => {
    // Grade, working level, curriculum, permissions, parent controls and safety
    // clearance are absent from every declared shape, in both directions.
    for (const declared of [
      Object.keys(LAUNCH_FIELDS),
      Object.keys(TURN_FIELDS),
      ...Object.values(STUDY_TUTOR_RESULT_KEYS).map((keys) => [...keys]),
    ]) {
      expect(declared.filter((key) => FORBIDDEN.has(key))).toEqual([])
    }
    for (const key of ['officialGrade', 'workingLevel', 'curriculum', 'permissions', 'parentControls', 'safetyClearance']) {
      expect(FORBIDDEN.has(key)).toBe(true)
      expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: 'Next.', [key]: 5 })).toBeNull()
      expect(parseStudyTutorResult({ status: 'stopped', reasonCode: 'x-stop', deliveryStatus: 'not-confirmed', [key]: 5 })).toBeNull()
    }
  })

  it('takes no credential and no record identity across the boundary', () => {
    // The learner is named to a Tutor by one opaque session reference only.
    for (const key of ['bearer', 'accessToken', 'authorization', 'householdId', 'studentId', 'grantId', 'serviceRole', 'permissionLevel']) {
      expect(FORBIDDEN.has(key)).toBe(true)
      expect(Object.keys(TURN_FIELDS)).not.toContain(key)
      expect(Object.keys(LAUNCH_FIELDS)).not.toContain(key)
    }
    expect(Object.keys(TURN_FIELDS)).not.toContain('scope')
    expect(Object.keys(TURN_FIELDS)).not.toContain('householdRef')
    expect(Object.keys(TURN_FIELDS)).not.toContain('learnerRef')
    expect(Object.keys(TURN_FIELDS)).not.toContain('hostProfileRef')
  })

  it('requires no persisted transcript, audio, label, diagnosis or private note', () => {
    const declared = [
      ...Object.keys(LAUNCH_FIELDS),
      ...Object.keys(TURN_FIELDS),
      ...Object.values(STUDY_TUTOR_RESULT_KEYS).flatMap((keys) => [...keys]),
    ]
    for (const key of ['transcript', 'transcriptIncluded', 'audio', 'emotion', 'personality', 'diagnosis', 'privateNote', 'rawAnswer']) {
      expect(FORBIDDEN.has(key)).toBe(true)
      expect(declared).not.toContain(key)
    }
    // The learner's words are input only. No result branch can carry them back.
    expect(Object.keys(TURN_FIELDS)).toContain('transientLearnerText')
    expect(declared.filter((key) => key === 'transientLearnerText')).toHaveLength(1)
  })
})

describe('Tutor contract isolation', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  // Comments are stripped first: the documentation names the preview runtime and
  // its release mode on purpose, and what is being asserted is about the code.
  const contractCode = readdirSync(here)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => readFileSync(join(here, name), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')

  it('imports no Tutor Core file, no preview runtime and no preview port bundle', () => {
    // PROD_TUTOR_WRAPPER_REMAINS_SEPARATE: this layer states the boundary and
    // reaches nothing behind it.
    expect(contractCode).not.toMatch(/from\s+['"][^'"]*adaptive-tutor/)
    expect(contractCode).not.toMatch(/from\s+['"][^'"]*runtimeFacade/)
    expect(contractCode).not.toMatch(/from\s+['"][^'"]*(?:mountedPorts|localDevelopmentPorts)/)
    expect(contractCode).not.toMatch(/learner:local-release-candidate/)
    expect(contractCode).not.toMatch(/RELEASE_MODE|portable-non-production/)
    // The stripper must not have eaten the code it is asked to judge.
    expect(contractCode).toMatch(/export function parseStudyTutorResult/)
    expect(contractCode).toMatch(/export const STUDY_TUTOR_CONTRACT_VERSION/)
  })

  it('declares no implementation it could be tempted to construct', () => {
    expect(contractCode).not.toMatch(/\bnew\s+[A-Z]\w*HostRuntime\b/)
    expect(contractCode).not.toMatch(/(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?class\s/)
  })
})
