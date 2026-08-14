import { describe, expect, it } from 'vitest'
import { HOSTED_SYNC_PRODUCTION_ACTIVATION, requireHostedSyncProductionPrivacySerializer } from '../../src/study/hosted-sync/v2/client/productionActivation'
import { HOSTED_SYNC_RPC } from '../../src/study/hosted-sync/v2/client/types'
import { buildFirstLinkPlan } from '../../src/study/hosted-sync/v2/linking/plan'
import type { FirstLinkInspection, LocalHouseholdForLink } from '../../src/study/hosted-sync/v2/linking/types'
import { HOSTED_SYNC_R2_SCENARIOS } from './scenarioLibrary'
import {
  ASSERTION, ASSESSMENT, CERTIFIED, ConvergedR2Harness, GUARDIAN_DIGEST, HOLD,
  LOCAL_SCOPE, NOW, OTHER_STUDENT_ID, SOURCE, STUDENT_DIGEST, checkpoint,
  firstLinkImport, operationId,
} from './harness'

async function linked(): Promise<ConvergedR2Harness> {
  const harness = new ConvergedR2Harness()
  expect(await harness.firstLink()).toMatchObject({ code: 'SUCCESS', value: { status: 'imported' } })
  return harness
}

function readyDocument(result: Awaited<ReturnType<ConvergedR2Harness['hydrate']>>): Record<string, unknown> {
  if (result.code !== 'SUCCESS' || result.value.status !== 'ready') throw new Error('hydrate-not-ready')
  return result.value.document as Record<string, unknown>
}

function firstLinkFixture(identityValue = 'student:ada', remoteIdentityValues: readonly string[] = [identityValue]): { local: LocalHouseholdForLink; inspection: FirstLinkInspection } {
  const local = { localHouseholdRef: 'household:alpha', capturedAt: NOW, students: [{
    localStudentRef: 'student:ada', displayName: 'Ada Local', identity: { kind: 'academy-student-id' as const, value: identityValue },
    assignments: [], studyDocument: { localDocumentRef: 'document:ada', updatedAt: NOW, sessions: [] }, sources: [], attestations: [], safetyHolds: [],
  }] }
  const inspection = { authority: { status: 'authenticated-parent-household-authority' as const, authorityRef: 'authority:parent', remoteHouseholdRef: 'remote:household', expiresAt: '2027-08-13T00:00:00.000Z' }, serverBaseRevision: 1,
    remoteStudents: remoteIdentityValues.map((value, index) => ({ remoteStudentRef: `remote:student:${index}`, displayName: index ? 'Ada Local' : 'Completely Different Name', identities: [{ kind: 'academy-student-id' as const, value }], assignments: [], sessions: [] })) }
  return { local, inspection }
}

describe('hosted Study sync R2 — 37 scenarios through the converged adapter', () => {
  it('catalogs exactly 37 scenarios', () => expect(HOSTED_SYNC_R2_SCENARIOS).toHaveLength(37))

  it('1. uses the exact four-RPC client surface', async () => {
    const h = await linked(); await h.resolve(); await h.hydrate(); await h.write(h.a, { revision: 1, id: 101, operation: 'session:complete', payload: { completedAt: NOW } })
    expect(h.provider.calls.map((call) => call.name)).toEqual(Object.values(HOSTED_SYNC_RPC))
  })
  it('2. imports first-link state', async () => expect(await new ConvergedR2Harness().firstLink()).toMatchObject({ code: 'SUCCESS', value: { status: 'imported' } }))
  it('3. repeats first link idempotently', async () => { const h = new ConvergedR2Harness(); const first = await h.firstLink(); expect(await h.firstLink()).toEqual(first) })
  it('4. resolves only the exact explicit mapping', async () => { const h = await linked(); expect(await h.resolve()).toMatchObject({ code: 'SUCCESS', value: { status: 'mapped', mapping: { localStudentRef: LOCAL_SCOPE.studentRef } } }) })
  it('5. returns unavailable for an unknown mapping', async () => { const h = await linked(); expect(await h.resolve(h.a, { ...LOCAL_SCOPE, studentRef: 'student:unknown' })).toMatchObject({ code: 'SUCCESS', value: { status: 'unavailable' } }) })
  it('6. hydrates the imported session', async () => { const h = await linked(); expect(await h.hydrate(h.b)).toMatchObject({ code: 'SUCCESS', value: { status: 'ready' } }) })
  it('7. writes Device A checkpoint progress', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 1, id: 107, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2, ['segment-1']) } })).toMatchObject({ code: 'SUCCESS', value: { serverRevision: 2 } }) })
  it('8. propagates A checkpoint to B', async () => { const h = await linked(); await h.write(h.a, { revision: 1, id: 108, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2, ['segment-1']) } }); expect(readyDocument(await h.hydrate(h.b)).checkpoint).toEqual(checkpoint(2, ['segment-1'])) })
  it('9. writes Device B checkpoint progress', async () => { const h = await linked(); expect(await h.write(h.b, { revision: 1, id: 109, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2, ['segment-1']) } })).toMatchObject({ code: 'SUCCESS' }) })
  it('10. propagates B checkpoint to A', async () => { const h = await linked(); await h.write(h.b, { revision: 1, id: 110, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2, ['segment-1']) } }); expect(readyDocument(await h.hydrate(h.a)).checkpoint).toEqual(checkpoint(2, ['segment-1'])) })
  it('11. preserves every production recovery checkpoint field exactly', async () => { const h = await linked(); const exact = checkpoint(2, ['segment-1']); await h.write(h.a, { revision: 1, id: 111, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: exact } }); expect(readyDocument(await h.hydrate(h.b)).checkpoint).toStrictEqual(exact) })
  it('12. stores normal completion', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 1, id: 112, operation: 'session:complete', payload: { completedAt: NOW } })).toMatchObject({ code: 'SUCCESS', value: { completionState: 'completed' } }) })
  it('13. hydrates normal completion on B', async () => { const h = await linked(); await h.write(h.a, { revision: 1, id: 113, operation: 'session:complete', payload: { completedAt: NOW } }); expect(readyDocument(await h.hydrate(h.b)).completion).toEqual({ state: 'completed', startedAt: NOW, completedAt: NOW }) })
  it('14. synchronizes active assessment state', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 114, operation: 'assessment:set-state', payload: { assessment: ASSESSMENT } }); expect(readyDocument(await h.hydrate(h.b)).assessment).toEqual(ASSESSMENT) })
  it('15. synchronizes certified assessment state', async () => { const h = await linked(); const certified = { ...ASSESSMENT, status: 'CERTIFIED', completedAt: NOW }; await h.write(h.a, { revision: 2, id: 115, operation: 'assessment:set-state', payload: { assessment: certified } }); expect(readyDocument(await h.hydrate(h.b)).assessment).toEqual(certified) })
  it('16. enforces assessment authority CAS', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 1, id: 116, operation: 'assessment:set-state', payload: { assessment: ASSESSMENT } })).toMatchObject({ code: 'SUCCESS', value: { status: 'revision-conflict', serverRevision: 2 } }) })
  it('17. stores RFL learner assertion', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 2, id: 117, operation: 'rfl:assert', payload: { attestation: ASSERTION } })).toMatchObject({ code: 'SUCCESS', value: { guardianAttestationStatus: 'PENDING_GUARDIAN_ATTESTATION' } }) })
  it('18. hydrates RFL assertion on B', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 118, operation: 'rfl:assert', payload: { attestation: ASSERTION } }); expect(readyDocument(await h.hydrate(h.b)).guardianAttestation).toEqual(ASSERTION) })
  it('19. stores guardian RFL certification', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 119, operation: 'rfl:assert', payload: { attestation: ASSERTION } }); expect(await h.write(h.a, { revision: 3, id: 120, operation: 'rfl:attest', payload: { attestation: CERTIFIED } })).toMatchObject({ code: 'SUCCESS' }) })
  it('20. denies student RFL certification', async () => { const h = await linked(); expect(await h.write(h.b, { revision: 2, id: 121, operation: 'rfl:attest', payload: { attestation: CERTIFIED }, tokenDigest: STUDENT_DIGEST })).toMatchObject({ code: 'SUCCESS', value: { status: 'denied', code: 'actor-not-authorized' } }) })
  it('21. attaches Social source metadata', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 2, id: 122, operation: 'social-source:attach', payload: { source: SOURCE } })).toMatchObject({ code: 'SUCCESS' }) })
  it('22. hydrates Social source metadata on B', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 123, operation: 'social-source:attach', payload: { source: SOURCE } }); expect(readyDocument(await h.hydrate(h.b)).socialSource).toEqual(SOURCE) })
  it('23. refuses a second Social create-only write', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 124, operation: 'social-source:attach', payload: { source: SOURCE } }); expect(await h.write(h.a, { revision: 3, id: 125, operation: 'social-source:attach', payload: { source: SOURCE } })).toMatchObject({ code: 'SUCCESS', value: { status: 'invalid-write', reasonCode: 'remote-state-exists' } }) })
  it('24. writes a Safety hold', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 2, id: 126, operation: 'safety:hold', payload: { hold: HOLD } })).toMatchObject({ code: 'SUCCESS', value: { safetyState: 'stopped' } }) })
  it('25. hydrates Safety hold on B', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 127, operation: 'safety:hold', payload: { hold: HOLD } }); expect((readyDocument(await h.hydrate(h.b)).safetyState as { holds: unknown[] }).holds).toContainEqual(HOLD) })
  it('26. blocks completion under an open Safety hold', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 128, operation: 'safety:hold', payload: { hold: HOLD } }); expect(await h.write(h.b, { revision: 1, id: 129, operation: 'session:complete', payload: { completedAt: NOW } })).toMatchObject({ code: 'SUCCESS', value: { status: 'denied', code: 'safety-hold-active' } }) })
  it('27. permits guardian Safety clear', async () => { const h = await linked(); await h.write(h.a, { revision: 2, id: 130, operation: 'safety:hold', payload: { hold: HOLD } }); expect(await h.write(h.a, { revision: 3, id: 131, operation: 'safety:clear', payload: { holdRef: HOLD.holdRef, clearedAt: NOW, clearedByRef: 'adult:guardian' } })).toMatchObject({ code: 'SUCCESS', value: { safetyState: 'clear' } }) })
  it('28. denies student Safety clear', async () => { const h = await linked(); expect(await h.write(h.b, { revision: 2, id: 132, operation: 'safety:clear', payload: { holdRef: HOLD.holdRef, clearedAt: NOW, clearedByRef: 'adult:guardian' }, tokenDigest: STUDENT_DIGEST })).toMatchObject({ code: 'SUCCESS', value: { status: 'denied' } }) })
  it('29. reports offline without contacting the provider', async () => { const h = await linked(); const calls = h.provider.calls.length; h.setOnline('a', false); expect(await h.write(h.a, { revision: 1, id: 133, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2) } })).toMatchObject({ code: 'OFFLINE' }); expect(h.provider.calls).toHaveLength(calls) })
  it('30. succeeds with the same intent after reconnect', async () => { const h = await linked(); h.setOnline('a', false); await h.write(h.a, { revision: 1, id: 134, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2) } }); h.setOnline('a', true); expect(await h.write(h.a, { revision: 1, id: 134, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(2) } })).toMatchObject({ code: 'SUCCESS' }) })
  it('31. returns an explicit stale checkpoint CAS result', async () => { const h = await linked(); expect(await h.write(h.a, { revision: 0, id: 135, operation: 'checkpoint:compare-and-swap', payload: { checkpoint: checkpoint(1) } })).toMatchObject({ code: 'SUCCESS', value: { status: 'revision-conflict', revisionDomain: 'checkpoint', serverRevision: 1 } }) })
  it('32. returns the exact stored receipt for an idempotent write retry', async () => { const h = await linked(); const values = { revision: 1, id: 136, operation: 'checkpoint:compare-and-swap' as const, payload: { checkpoint: checkpoint(2) } }; const first = await h.write(h.a, values); expect(await h.write(h.a, values)).toEqual(first) })
  it('33. recovers a write acknowledgement lost after commit', async () => { const h = await linked(); h.provider.dropNextCommittedResponse(HOSTED_SYNC_RPC.write); const values = { revision: 1, id: 137, operation: 'checkpoint:compare-and-swap' as const, payload: { checkpoint: checkpoint(2) } }; expect(await h.write(h.a, values)).toMatchObject({ code: 'NETWORK_UNAVAILABLE' }); expect(await h.write(h.a, values)).toMatchObject({ code: 'SUCCESS', value: { status: 'stored', serverRevision: 2 } }) })
  it('34. implements the four first-link states without name matching', async () => { const h = await linked(); await h.resolve(); const exact = firstLinkFixture(); expect(buildFirstLinkPlan(exact.local, exact.inspection).students[0].state).toBe('EXACT_MATCH'); const explicit = firstLinkFixture('local-only', ['remote-only']); expect(buildFirstLinkPlan(explicit.local, explicit.inspection).students[0].state).toBe('EXPLICIT_MAP_REQUIRED'); expect(buildFirstLinkPlan(explicit.local, { ...explicit.inspection, remoteStudents: [] }).students[0].state).toBe('NEW_REMOTE_STUDENT'); const conflict = firstLinkFixture('same', ['same', 'same']); expect(buildFirstLinkPlan(conflict.local, conflict.inspection).students[0].state).toBe('CONFLICT'); expect(exact.local.students[0].displayName).not.toBe(exact.inspection.remoteStudents[0].displayName) })
  it('35. keeps production activation off after installing the privacy serializer', async () => { const h = await linked(); await h.hydrate(); expect(HOSTED_SYNC_PRODUCTION_ACTIVATION).toEqual({ enabled: false, reason: 'HOSTED_SYNC_R2_INACTIVE_PENDING_STAGING' }); expect(requireHostedSyncProductionPrivacySerializer()).toBe(true) })
  it('36. never hydrates legacy Profile sync fields', async () => { const h = await linked(); const serialized = JSON.stringify(readyDocument(await h.hydrate(h.b))); expect(serialized).not.toMatch(/legacyProfile|profileId|pinDigest|pinHash/i); expect(await h.hydrate(h.b, OTHER_STUDENT_ID)).toMatchObject({ code: 'SUCCESS', value: { status: 'unavailable' } }) })
  it('37. refuses an unknown mutation field before provider contact', async () => { const h = await linked(); const calls = h.provider.calls.length; expect(await h.write(h.a, { revision: 1, id: 138, operation: 'session:complete', payload: { completedAt: NOW, futurePrivateField: true } })).toMatchObject({ code: 'PERMANENT_REFUSAL' }); expect(h.provider.calls).toHaveLength(calls) })
})
