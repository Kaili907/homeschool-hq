import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importBackup, serializeAllBackup } from './appState'
import { defaultAppState, emptyProfile } from './migration'
import { toWireProfile } from './portableProfile'
import { applyReviewedSelection, buildReconciliationPreview } from './sync/engine'
import { datasetFingerprint } from './sync/provenance'
import { emptyHouseholdMeta, type RemoteProfileRow } from './sync/types'
import type { AppState, Profile } from './types'

/**
 * CREDENTIAL AUTHORITY — a learner PIN arriving from a backup file or from the
 * cloud must never become the credential that gates a girl's profile.
 *
 * The two predicates below are the REAL ones the app authenticates with. Both
 * are inlined in JSX callbacks in App.tsx and cannot be imported, so they are
 * mirrored here with their source lines. Asserting only `pin !== hostile` would
 * be insufficient: App.tsx routes an EMPTY pin to the create-a-PIN screen, which
 * signs the next person in without checking anything. Blanking a credential is
 * therefore an attack, not a safe default, and every case below where a profile
 * already exists locally asserts the POSITIVE — her original PIN still works.
 */
/** src/App.tsx — `if (pin === profile.pin)` on the enter-your-PIN screen. */
const authenticates = (profile: Profile, entry: string) =>
  entry === profile.pin
/** src/App.tsx — `p.pin === '' ? kidPinCreate : kidPin`; true means "no gate". */
const routesToCredentialCreation = (profile: Profile) => profile.pin === ''

const LOCAL_PIN = '7401'
const HOSTILE_PIN = '8206'
const PARENT_PIN = '5193'
const OTHER_PARENT_PIN = '6284'

const T1 = Date.parse('2026-07-24T10:00:00Z')
const T2 = Date.parse('2026-07-24T11:00:00Z')

const row = (data: Profile, time = T1): RemoteProfileRow => ({
  profile_id: data.id,
  data: toWireProfile(data),
  updated_at: new Date(time).toISOString(),
})

class MemStorage implements Storage {
  protected values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function deviceState(): AppState {
  const state = defaultAppState()
  state.parentPin = PARENT_PIN
  state.profiles.p1 = { ...state.profiles.p1, pin: LOCAL_PIN }
  return state
}

describe('cloud learner credentials are non-authoritative', () => {
  it('a cloud copy carrying a credential cannot overwrite the device credential', () => {
    const base = emptyProfile('p1', 'Ada', '3')
    const local: Profile = { ...base, pin: LOCAL_PIN }
    const cloud: Profile = {
      ...base,
      pin: HOSTILE_PIN,
      name: 'Cloud Ada',
      placementDone: true,
    }
    const preview = buildReconciliationPreview(
      { p1: local },
      [row(cloud)],
      emptyHouseholdMeta('household-a', 'a@example.com'),
    )
    const chosen = applyReviewedSelection(
      { p1: local },
      [row(cloud)],
      preview,
      { p1: 'cloud' },
      T2,
    )

    // The merge really ran and really adopted the cloud copy — without these,
    // a silently no-op merge would leave the pin equal for the wrong reason.
    expect(chosen.profiles.p1.name).toBe('Cloud Ada')
    expect(chosen.profiles.p1.placementDone).toBe(true)

    expect(chosen.profiles.p1.pin).toBe(LOCAL_PIN)
    expect(authenticates(chosen.profiles.p1, LOCAL_PIN)).toBe(true)
    expect(authenticates(chosen.profiles.p1, HOSTILE_PIN)).toBe(false)
    expect(routesToCredentialCreation(chosen.profiles.p1)).toBe(false)
  })

  it('a cloud-only profile lands with school data but no imported credential', () => {
    const cloud: Profile = {
      ...emptyProfile('p2', 'New Kid', '4'),
      pin: HOSTILE_PIN,
      placementDone: true,
    }
    const preview = buildReconciliationPreview(
      {},
      [row(cloud)],
      emptyHouseholdMeta('household-a', 'a@example.com'),
    )
    const chosen = applyReviewedSelection({}, [row(cloud)], preview, {}, T2)
    const landed = chosen.profiles.p2

    expect(landed.name).toBe('New Kid')
    expect(landed.placementDone).toBe(true)
    expect(authenticates(landed, HOSTILE_PIN)).toBe(false)
    // A girl genuinely new to THIS device has no credential here yet and
    // enrols one at first sign-in — the same state emptyProfile seeds. This is
    // an accepted enrolment state, not a bypass of an existing credential.
    expect(routesToCredentialCreation(landed)).toBe(true)
  })
})

describe('imported learner credentials are non-authoritative', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
    ;(globalThis as unknown as { window: EventTarget }).window =
      new EventTarget()
  })
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
    delete (globalThis as unknown as { window?: EventTarget }).window
  })

  it('an imported backup cannot replace the credential of an existing learner', () => {
    const current = deviceState()
    const incoming = structuredClone(current)
    incoming.profiles.p1 = {
      ...incoming.profiles.p1,
      pin: HOSTILE_PIN,
      name: 'Renamed By Import',
      placementDone: true,
    }

    const result = importBackup(current, JSON.stringify(incoming))
    if (!result.ok) throw new Error(result.error)
    const next = result.state

    // The import really ran.
    expect(next.profiles.p1.name).toBe('Renamed By Import')
    expect(next.profiles.p1.placementDone).toBe(true)

    expect(next.profiles.p1.pin).toBe(LOCAL_PIN)
    expect(authenticates(next.profiles.p1, LOCAL_PIN)).toBe(true)
    expect(authenticates(next.profiles.p1, HOSTILE_PIN)).toBe(false)
    expect(routesToCredentialCreation(next.profiles.p1)).toBe(false)
  })

  it('an imported learner with no local credential installs no authority', () => {
    const current = deviceState()
    // p3 has never been signed in on this device.
    current.profiles.p3 = { ...current.profiles.p3, pin: '' }
    const incoming = structuredClone(current)
    incoming.profiles.p3 = {
      ...incoming.profiles.p3,
      pin: HOSTILE_PIN,
      name: 'Imported Kid',
      placementDone: true,
    }

    const result = importBackup(current, JSON.stringify(incoming))
    if (!result.ok) throw new Error(result.error)
    const next = result.state

    expect(next.profiles.p3.name).toBe('Imported Kid')
    expect(next.profiles.p3.placementDone).toBe(true)
    expect(authenticates(next.profiles.p3, HOSTILE_PIN)).toBe(false)
    expect(routesToCredentialCreation(next.profiles.p3)).toBe(true)
  })

  it('a legacy backup that still carries pins is accepted, credentials ignored', () => {
    const current = deviceState()
    // A pre-correction file written before pins were projected out.
    const legacy = structuredClone(current)
    for (const id of Object.keys(legacy.profiles)) {
      legacy.profiles[id] = {
        ...legacy.profiles[id],
        pin: HOSTILE_PIN,
        placementDone: true,
      }
    }
    const legacyText = JSON.stringify(legacy)
    expect(legacyText).toContain(HOSTILE_PIN)

    const result = importBackup(current, legacyText)
    if (!result.ok) throw new Error(result.error)
    const next = result.state

    // Backward compatible: the file is NOT rejected for carrying a pin…
    expect(Object.keys(next.profiles)).toHaveLength(5)
    expect(next.profiles.p1.placementDone).toBe(true)
    // …and the pin it carried is simply ignored.
    expect(authenticates(next.profiles.p1, HOSTILE_PIN)).toBe(false)
    expect(next.profiles.p1.pin).toBe(LOCAL_PIN)
  })

  it('the pre-import safety copy duplicates no learner credential', () => {
    const current = deviceState()
    const incoming = structuredClone(current)
    incoming.profiles.p1 = { ...incoming.profiles.p1, name: 'Changed' }

    const result = importBackup(current, JSON.stringify(incoming))
    if (!result.ok) throw new Error(result.error)

    const key = [...Array(localStorage.length).keys()]
      .map((index) => localStorage.key(index))
      .find((candidate) => candidate?.startsWith('homeschool-hq:backup:import:'))
    expect(key).toBeDefined()

    const copy = JSON.parse(localStorage.getItem(key!)!) as {
      profiles: Record<string, Record<string, unknown>>
    }
    // The copy is real and complete…
    expect(Object.keys(copy.profiles)).toHaveLength(5)
    expect(copy.profiles.p1.name).toBe(current.profiles.p1.name)
    // …and carries no learner credential.
    expect(JSON.stringify(copy.profiles).split(LOCAL_PIN)).toHaveLength(1)
    expect(Object.hasOwn(copy.profiles.p1, 'pin')).toBe(false)
  })

  it('a legacy v1 backup does not blank the existing learner credential', () => {
    const current = deviceState()
    // A v1 single-profile file. migrateV1ToV2 seeds an empty pin, which would
    // otherwise strip p1's PIN and drop her profile to the create-a-PIN screen.
    const v1 = JSON.stringify({
      version: 1,
      name: 'Legacy Ada',
      createdAt: '2026-07-01T00:00:00.000Z',
      placementDone: true,
      skillStats: {},
      totals: {
        questionsAnswered: 7,
        correct: 5,
        bestStreak: 2,
        sessions: 1,
      },
    })

    const result = importBackup(current, v1)
    if (!result.ok) throw new Error(result.error)
    const next = result.state

    // The legacy import really ran.
    expect(next.profiles.p1.name).toBe('Legacy Ada')
    expect(next.profiles.p1.totals.questionsAnswered).toBe(7)
    // …and left the credential this device already trusts intact.
    expect(next.profiles.p1.pin).toBe(LOCAL_PIN)
    expect(authenticates(next.profiles.p1, LOCAL_PIN)).toBe(true)
    expect(routesToCredentialCreation(next.profiles.p1)).toBe(false)
  })

  it('the parent credential is untouched by export and import', async () => {
    const state = deviceState()

    // Export still carries the parent credential — a redaction breaks this.
    expect(
      (JSON.parse(serializeAllBackup(state)) as { parentPin: string })
        .parentPin,
    ).toBe(PARENT_PIN)

    const incoming = structuredClone(state)
    incoming.profiles.p1 = { ...incoming.profiles.p1, name: 'Changed' }
    const result = importBackup(state, JSON.stringify(incoming))
    if (!result.ok) throw new Error(result.error)
    expect(result.state.parentPin).toBe(PARENT_PIN)

    // Differential probe: parentPin is still inside the hashed durable set, so
    // two states differing ONLY in parentPin must fingerprint differently. A
    // snapshot could not catch a redaction here; this does.
    const other = { ...state, parentPin: OTHER_PARENT_PIN }
    expect(await datasetFingerprint(other)).not.toBe(
      await datasetFingerprint(state),
    )
  })
})
