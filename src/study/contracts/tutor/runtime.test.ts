import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH,
  isStudyTutorLearnerText,
  parseStudyTutorLearnerText,
} from './learnerText'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_FORBIDDEN_KEYS,
  type StudyTutorLaunch,
  type StudyTutorResult,
  type StudyTutorRuntime,
  type StudyTutorTurn,
} from './runtime'
import {
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  STUDY_TUTOR_RESULT_KEYS,
  parseStudyTutorResult,
} from './results'

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

  // STUDY-A1-TUTOR-CONTRACT-H2 Phase 7 — the H2 hardening tightened what may
  // enter the union's fields. It changed none of the fields. Pinned exactly, so
  // a later card cannot widen a branch while the H2 tests still pass.
  it('keeps every branch on exactly the fields it had', () => {
    expect(STUDY_TUTOR_RESULT_KEYS.accepted).toEqual(['status', 'eventRef', 'visibleText'])
    expect(STUDY_TUTOR_RESULT_KEYS.stopped).toEqual(['status', 'reasonCode', 'deliveryStatus'])
    expect(STUDY_TUTOR_RESULT_KEYS.interrupted).toEqual(['status', 'interruption'])
    expect(STUDY_TUTOR_RESULT_KEYS.quarantined).toEqual(['status', 'reasonCode'])
    // A stopped result still carries no Tutor-authored learner copy. The host
    // owns the words a stopped child reads.
    for (const key of ['studentMessage', 'learnerMessage', 'message', 'visibleText', 'safeMessage']) {
      expect(STUDY_TUTOR_RESULT_KEYS.stopped).not.toContain(key)
    }
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

  // STUDY-A1-TUTOR-CONTRACT-H3 — the field set did not change, and the one
  // free-text input field became bounded. Both halves are pinned here so a later
  // card cannot add a persistence field beside it or loosen the bound and still
  // pass the contract suite.
  it('keeps the turn on exactly the fields it had, with learner text bounded', () => {
    expect(Object.keys(TURN_FIELDS).sort()).toEqual([
      'expectedAnswer',
      'householdTimeZone',
      'learnerLocalDate',
      'lessonRef',
      'occurredAt',
      'requestRef',
      'segmentRef',
      'sessionRef',
      'skillRef',
      'subject',
      'taskType',
      'transientLearnerText',
    ])
    // Transient means transient: no field beside it says to keep it.
    for (const key of ['transcript', 'persist', 'persisted', 'store', 'retain', 'history', 'learnerTextRef']) {
      expect(Object.keys(TURN_FIELDS)).not.toContain(key)
    }
    expect(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH).toBe(4_000)
    expect(isStudyTutorLearnerText('x'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH))).toBe(true)
    expect(isStudyTutorLearnerText('x'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH + 1))).toBe(false)
    // Learner text and Tutor prose are bounded separately, at the bound each
    // side's own boundary applies. Borrowing one for the other would be wrong in
    // whichever direction it was borrowed.
    expect(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH).not.toBe(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
  })

  // H2's bounds, held. H3 added a field type; it removed no rule.
  it('keeps every H2 result bound in place', () => {
    const overLongProse = 'a'.repeat(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH + 1)
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: 'event.1', visibleText: overLongProse })).toBeNull()
    expect(parseStudyTutorResult({ status: 'accepted', eventRef: `e${'x'.repeat(128)}`, visibleText: 'ok' })).toBeNull()
    expect(parseStudyTutorResult({ status: 'quarantined', reasonCode: 'a'.repeat(65) })).toBeNull()
    expect(parseStudyTutorResult({
      status: 'accepted',
      eventRef: 'event.1',
      visibleText: 'ok',
      officialGrade: 'C',
    })).toBeNull()
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
    // H3 added a module to this folder. It is covered by the sweep above
    // because the sweep reads the folder, not a list — and this is the check
    // that the folder read actually included it.
    expect(contractCode).toMatch(/export function parseStudyTutorLearnerText/)
  })

  // H3 — the learner-text rule is a restatement of the bridge's, because the
  // isolation rule above forbids importing it. A restatement drifts unless
  // something holds it, and the thing that holds it is a differential test
  // against the real gateway. If that file stops existing, or stops calling the
  // real gateway, the restatement is unguarded.
  it('keeps the learner-text restatement pinned to the real bridge by a differential test', () => {
    const differential = readFileSync(join(here, 'bridgeCompatibility.test.ts'), 'utf8')
    expect(differential).toMatch(
      /import\s*\{\s*evaluatePreCoreUrgentSafety\s*\}\s*from\s*'[^']*adaptive-tutor[^']*safety-gateway\.ts'/,
    )
    expect(differential).toMatch(/isStudyTutorLearnerText\(candidate\).*\).toBe\(bridgeAdmits\(candidate\)\)/s)
  })

  it('states the learner-text bound once, and does not restate the bridge’s content rules', () => {
    const learnerText = readFileSync(join(here, 'learnerText.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    // Exactly one numeric bound in the module, and it is the bridge's.
    expect(learnerText.match(/4_000|4000/g)).toEqual(['4_000'])
    // The bridge's quote folding, dash folding, punctuation collapse and
    // obfuscation collapse are content rules and are deliberately NOT here:
    // this contract decides how much a learner may say, never what.
    expect(learnerText).not.toMatch(/kill|die|hurt|touch/)
    expect(learnerText).not.toMatch(/\\u2018|\\u2010|\\u2212/)
    // And it does not truncate.
    expect(learnerText).not.toMatch(/\.slice\(|\.substring\(|\.substr\(/)
    // And it does not coerce.
    expect(learnerText).not.toMatch(/String\(|\+\s*''|`\$\{/)
  })

  it('declares no implementation it could be tempted to construct', () => {
    expect(contractCode).not.toMatch(/\bnew\s+[A-Z]\w*HostRuntime\b/)
    expect(contractCode).not.toMatch(/(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?class\s/)
  })
})
