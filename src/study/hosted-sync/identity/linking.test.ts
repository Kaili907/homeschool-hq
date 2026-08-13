import { describe, expect, it } from 'vitest'
import type { FamilySetupState } from '../../family-pilot/setup'
import type { AuthorizedStudentListResolution } from './contracts'
import {
  evaluateLocalHostedIdentityLink,
  type DeviceLocalFamilyIdentityState,
  type ExplicitFamilyIdentityLink,
} from './linking'

const LOCAL_HOUSEHOLD = 'family-pilot-household'
const HOSTED_HOUSEHOLD = 'a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6'
const HOSTED_A = '11111111-2222-4333-8444-555555555555'
const HOSTED_B = '66666666-7777-4888-9999-aaaaaaaaaaaa'

const setup: FamilySetupState = Object.freeze({
  completedAt: '2026-08-01T12:00:00.000Z',
  students: Object.freeze([
    Object.freeze({
      studentRef: 'family-setup-student:local-a',
      displayName: 'Same Name',
      nominalGrade: '5',
      workingGradeBySubject: Object.freeze({}),
      enabledSubjects: Object.freeze(['mathematics'] as const),
      pinRequired: true,
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }),
    Object.freeze({
      studentRef: 'family-setup-student:local-b',
      displayName: 'Same Name',
      nominalGrade: '8',
      workingGradeBySubject: Object.freeze({}),
      enabledSubjects: Object.freeze(['science'] as const),
      pinRequired: false,
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }),
  ]),
})

const local: DeviceLocalFamilyIdentityState = Object.freeze({
  source: 'device-local-identity-state',
  householdRef: LOCAL_HOUSEHOLD,
  setup,
})

const hosted: AuthorizedStudentListResolution = Object.freeze({
  status: 'authorized',
  householdRef: HOSTED_HOUSEHOLD,
  students: Object.freeze([
    Object.freeze({
      studentRef: Object.freeze({ kind: 'academy-student-id', value: HOSTED_A }),
      displayName: 'Same Name',
      nominalGrade: '5',
      workingGradeBySubject: Object.freeze({}),
      enabledSubjects: Object.freeze(['mathematics'] as const),
      pinRequired: true,
      configRevision: 1,
    }),
    Object.freeze({
      studentRef: Object.freeze({ kind: 'academy-student-id', value: HOSTED_B }),
      displayName: 'Same Name',
      nominalGrade: '8',
      workingGradeBySubject: Object.freeze({}),
      enabledSubjects: Object.freeze(['science'] as const),
      pinRequired: false,
      configRevision: 1,
    }),
  ]),
})

function link(studentLinks: ExplicitFamilyIdentityLink['studentLinks']): ExplicitFamilyIdentityLink {
  return {
    schemaVersion: 1,
    kind: 'explicit-adult-confirmed-link',
    localHouseholdRef: LOCAL_HOUSEHOLD,
    hostedHouseholdRef: HOSTED_HOUSEHOLD,
    studentLinks,
    confirmedAt: '2026-08-13T12:00:00.000Z',
  }
}

describe('local-to-hosted identity convergence', () => {
  it('keeps local-only identity explicitly separate for offline policy', () => {
    expect(evaluateLocalHostedIdentityLink({ local, hosted: null })).toEqual({
      status: 'device-local-only',
      source: 'device-local-identity-state',
      offlineContinuation: 'requires-convergence-policy',
    })
  })

  it('never auto-merges households or students solely because display names match', () => {
    expect(evaluateLocalHostedIdentityLink({ local, hosted })).toEqual({
      status: 'explicit-link-required',
      localHouseholdRef: LOCAL_HOUSEHOLD,
      hostedHouseholdRef: HOSTED_HOUSEHOLD,
    })
  })

  it('accepts only a complete, one-to-one, adult-confirmed stable-ref link', () => {
    const confirmed = link([
      { localStudentRef: setup.students[0].studentRef, hostedStudentRef: { kind: 'academy-student-id', value: HOSTED_A } },
      { localStudentRef: setup.students[1].studentRef, hostedStudentRef: { kind: 'academy-student-id', value: HOSTED_B } },
    ])
    expect(evaluateLocalHostedIdentityLink({ local, hosted, link: confirmed })).toEqual({
      status: 'linked',
      localHouseholdRef: LOCAL_HOUSEHOLD,
      hostedHouseholdRef: HOSTED_HOUSEHOLD,
      studentLinks: confirmed.studentLinks,
    })
  })

  it('sends wrong household, unknown student, duplicate target, and incomplete links to review', () => {
    const mappings: ExplicitFamilyIdentityLink['studentLinks'] = [
      { localStudentRef: setup.students[0].studentRef, hostedStudentRef: { kind: 'academy-student-id', value: HOSTED_A } },
      { localStudentRef: setup.students[1].studentRef, hostedStudentRef: { kind: 'academy-student-id', value: HOSTED_B } },
    ]
    expect(evaluateLocalHostedIdentityLink({
      local,
      hosted,
      link: { ...link(mappings), hostedHouseholdRef: 'wrong-household' },
    })).toMatchObject({ status: 'review-required', reason: 'hosted-household-mismatch' })
    expect(evaluateLocalHostedIdentityLink({
      local,
      hosted,
      link: link([{ ...mappings[0], hostedStudentRef: { kind: 'academy-student-id', value: 'unknown' } }, mappings[1]]),
    })).toMatchObject({ status: 'review-required', reason: 'hosted-student-unknown' })
    expect(evaluateLocalHostedIdentityLink({
      local,
      hosted,
      link: link([mappings[0], { ...mappings[1], hostedStudentRef: mappings[0].hostedStudentRef }]),
    })).toMatchObject({ status: 'review-required', reason: 'duplicate-student-link' })
    expect(evaluateLocalHostedIdentityLink({ local, hosted, link: link([mappings[0]]) }))
      .toMatchObject({ status: 'review-required', reason: 'local-student-unmapped' })
  })
})
