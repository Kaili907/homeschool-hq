import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeAllBackup } from './appState'
import { defaultAppState, emptyProfile, PROFILE_SEEDS } from './migration'
import { toPortableProfile, toWireProfile } from './portableProfile'
import {
  applyReviewedSelection,
  buildReconciliationPreview,
  changedProfiles,
  markDirty,
  pendingRows,
  profileHash,
} from './sync/engine'
import { prepareConfirmedLocalUpload } from './sync/workflow'
import { getVerifiedAuthContext, pushProfiles } from './sync/supabase'
import { emptyHouseholdMeta, type RemoteProfileRow } from './sync/types'
import { validateProfileForSync } from './sync/provenance'
import type { AppState, Profile } from './types'

/**
 * Needles are distinctive four-digit strings verified absent from the whole
 * repository, so an assertion can never pass or fail on an unrelated match.
 * `emptyProfile` seeds pin '', which would make every leak assertion vacuous —
 * every fixture here sets a real credential.
 */
const LOCAL_PIN = '7401'
const OTHER_PIN = '8206'

const T1 = Date.parse('2026-07-24T10:00:00Z')

const row = (data: Profile, time = T1): RemoteProfileRow => ({
  profile_id: data.id,
  data: toWireProfile(data),
  updated_at: new Date(time).toISOString(),
})

/** A state whose p1 carries both a real credential and recognisable school data. */
function stateWithCredential(): AppState {
  const state = defaultAppState()
  state.profiles.p1 = {
    ...state.profiles.p1,
    name: 'Sam',
    pin: LOCAL_PIN,
    placementDone: true,
    totals: {
      ...state.profiles.p1.totals,
      questionsAnswered: 42,
    },
  }
  return state
}

describe('the portable projection strips the learner credential', () => {
  it('export-all writes the educational profiles and no learner credential', () => {
    const json = serializeAllBackup(stateWithCredential())
    const reparsed = JSON.parse(json) as {
      profiles: Record<string, Record<string, unknown>>
    }
    const learners = Object.values(reparsed.profiles)

    // Positive controls first: the payload really reached the serializer and
    // carries school data, so the absence assertions below cannot pass vacuously.
    expect(learners).toHaveLength(5)
    expect(learners.map((p) => p.name)).toContain('Sam')
    expect(
      (reparsed.profiles.p1.totals as { questionsAnswered: number })
        .questionsAnswered,
    ).toBe(42)

    for (const learner of learners) {
      expect(Object.hasOwn(learner, 'pin')).toBe(false)
    }
    // Scoped to the learner subtree: parentPin legitimately still rides the file.
    expect(JSON.stringify(reparsed.profiles)).not.toContain(LOCAL_PIN)
  })

  it('keeps every current Profile field except the declared pin credential', () => {
    const before = stateWithCredential().profiles.p1
    const after = toPortableProfile(before)

    // Exhaustiveness for the current Profile shape, not a claim that the type
    // system can identify the security meaning of a future field.
    expect(new Set([...Object.keys(after), 'pin'])).toEqual(
      new Set(Object.keys(before)),
    )
    for (const field of Object.keys(after) as (keyof typeof after)[]) {
      expect(after[field]).toEqual(before[field as keyof Profile])
    }
    expect(Object.hasOwn(after, 'pin')).toBe(false)
  })

  it('the five household profile identities are unchanged by the projection', () => {
    const state = stateWithCredential()
    const reparsed = JSON.parse(serializeAllBackup(state)) as {
      profiles: Record<string, { id: string }>
    }
    expect(PROFILE_SEEDS.map((seed) => seed.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ])
    expect(Object.keys(reparsed.profiles)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ])
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5'] as const) {
      // The id FIELD, not merely the map key.
      expect(reparsed.profiles[id].id).toBe(id)
      expect(toWireProfile(state.profiles[id]).id).toBe(id)
    }
  })
})

describe('the educational hash ignores the learner credential', () => {
  const base = emptyProfile('p1', 'Ada', '3')
  const withLocal: Profile = { ...base, pin: LOCAL_PIN }
  const withOther: Profile = { ...base, pin: OTHER_PIN }
  const withSchoolChange: Profile = {
    ...base,
    pin: LOCAL_PIN,
    name: 'Ada Renamed',
  }

  it('changing only the credential does not move the hash, but school data does', () => {
    expect(profileHash(withLocal)).toBe(profileHash(withOther))
    // POSITIVE CONTROL — without this the hash could be a constant stub and the
    // equality above would still hold.
    expect(profileHash(withLocal)).not.toBe(profileHash(withSchoolChange))
    expect(profileHash(withLocal)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('a credential-only edit does not mark a profile dirty, a school edit does', () => {
    expect(changedProfiles({ p1: withLocal }, { p1: withOther })).toEqual([])
    // POSITIVE CONTROL: the comparison is live, not stubbed to "no change".
    expect(changedProfiles({ p1: withLocal }, { p1: withSchoolChange })).toEqual(
      ['p1'],
    )
  })

  it('a credential-only change is not a sync event, but a school change is', () => {
    const meta = emptyHouseholdMeta('household-a', 'a@example.com')
    const pinOnly = buildReconciliationPreview(
      { p1: withOther },
      [row(withLocal)],
      meta,
    )
    expect(pinOnly.profiles[0].category).toBe('unchanged')

    const schoolChange = buildReconciliationPreview(
      { p1: withSchoolChange },
      [row(withLocal)],
      meta,
    )
    expect(schoolChange.profiles[0].category).not.toBe('unchanged')
  })
})

describe('the real outgoing-row producers project the credential away', () => {
  // These drive the PRODUCERS themselves rather than pre-projected fixtures, so
  // they fail if any producer ever puts a raw Profile on the wire.
  it('a confirmed upload builds rows with school data and no learner pin', () => {
    const state = stateWithCredential()
    const { rows } = prepareConfirmedLocalUpload(
      state.profiles,
      emptyHouseholdMeta('household-a', 'a@example.com'),
      T1,
      '0',
    )
    expect(rows).toHaveLength(5)
    const p1 = rows.find((r) => r.profile_id === 'p1')!
    expect(p1.data.name).toBe('Sam')
    expect(p1.data.pin).toBe('')
    expect(JSON.stringify(rows)).not.toContain(LOCAL_PIN)
  })

  it('the dirty-queue rows carry school data and no learner pin', () => {
    const state = stateWithCredential()
    const rows = pendingRows(
      state.profiles,
      markDirty(emptyHouseholdMeta('household-a', 'a@example.com'), ['p1'], T1),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].data.name).toBe('Sam')
    expect(rows[0].data.pin).toBe('')
    expect(JSON.stringify(rows)).not.toContain(LOCAL_PIN)
  })

  it('a reviewed local-wins merge pushes school data and no learner pin', () => {
    const state = stateWithCredential()
    const local = { p1: state.profiles.p1 }
    // A cloud copy that differs educationally, so p1 is genuinely pushed.
    const stale: Profile = { ...state.profiles.p1, name: 'Stale', pin: '' }
    const preview = buildReconciliationPreview(
      local,
      [row(stale)],
      emptyHouseholdMeta('household-a', 'a@example.com'),
    )
    const { toPush } = applyReviewedSelection(
      local,
      [row(stale)],
      preview,
      { p1: 'local' },
      T1,
    )
    expect(toPush).toHaveLength(1)
    expect(toPush[0].data.name).toBe('Sam')
    expect(toPush[0].data.pin).toBe('')
    expect(JSON.stringify(toPush)).not.toContain(LOCAL_PIN)
  })
})

describe('the cloud mutation payload carries no learner credential', () => {
  const ACCESS_TOKEN = 'header.payload.signature'

  async function verifiedContext() {
    const context = await getVerifiedAuthContext({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: ACCESS_TOKEN } },
          error: null,
        })),
        getUser: vi.fn(async (token: string) => ({
          data: {
            user:
              token === ACCESS_TOKEN
                ? { id: 'household-a', email: 'a@example.com' }
                : null,
          },
          error: token === ACCESS_TOKEN ? null : new Error('invalid'),
        })),
      },
    } as never)
    if (!context) throw new Error('Test auth context was not verified.')
    return context
  }

  function canonicalVerificationClient() {
    return {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: 'refreshed.header.signature',
              user: { id: 'household-a' },
            },
          },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'household-a' } },
          error: null,
        })),
      },
    }
  }

  function writer() {
    const rpc = vi.fn(
      async (_name: string, _arguments: Record<string, unknown>) => ({
        data: { status: 'applied', revision: '1' },
        error: null,
      }),
    )
    return { factory: vi.fn(() => ({ rpc })), rpc }
  }

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('the captured RPC row carries school data but never the learner pin', async () => {
    const state = stateWithCredential()
    const rows = [row(state.profiles.p1)]
    const sink = writer()

    const result = await pushProfiles(
      rows,
      '0',
      'mutation-a',
      await verifiedContext(),
      'household-a',
      () => true,
      undefined,
      canonicalVerificationClient() as never,
      sink.factory as never,
    )

    // The push must have actually happened — an early return would make every
    // absence assertion below vacuously true.
    expect(result).toMatchObject({ ok: true })
    expect(sink.rpc).toHaveBeenCalledOnce()

    const sent = sink.rpc.mock.calls[0][1] as unknown as {
      p_profiles: { data: Record<string, unknown> }[]
    }
    expect(sent.p_profiles).toHaveLength(1)
    expect(sent.p_profiles[0].data.name).toBe('Sam')
    expect(
      (sent.p_profiles[0].data.totals as { questionsAnswered: number })
        .questionsAnswered,
    ).toBe(42)

    // The load-bearing assertion: the girl's credential is not on the wire.
    expect(JSON.stringify(sent.p_profiles)).not.toContain(LOCAL_PIN)
    expect(sent.p_profiles[0].data.pin).toBe('')
    // …and the row still satisfies the stored cloud contract, so no migration
    // is needed to accept it.
    expect(validateProfileForSync('p1', sent.p_profiles[0].data)).toBe(true)
  })
})
