import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CANONICAL_PROFILE_IDS,
  isProfileId,
  parseProfileId,
  type ProfileId,
} from './profileId'

describe('canonical ProfileId contract', () => {
  it.each(CANONICAL_PROFILE_IDS)('accepts %s exactly', (value) => {
    expect(isProfileId(value)).toBe(true)
    expect(parseProfileId(value)).toBe(value)
  })

  it.each([' p1', 'p1 ', '\tp1', 'p1\n', '\u00a0p1', 'p1\u200b'])(
    'rejects whitespace without trimming: %j',
    (value) => {
      expect(parseProfileId(value)).toBeNull()
    },
  )

  it.each(['P1', 'P5', 'pI', 'Pı'])('rejects case variants: %s', (value) => {
    expect(parseProfileId(value)).toBeNull()
  })

  it.each(['p0', 'p6', 'p9', 'p10', 'p01', 'p-1'])(
    'rejects unsupported number: %s',
    (value) => {
      expect(parseProfileId(value)).toBeNull()
    },
  )

  it.each(['😀', 'é', 'e\u0301', 'ｐ１', 'p１', 'learner-one'])(
    'rejects arbitrary or compatibility-normalizable Unicode: %s',
    (value) => {
      expect(parseProfileId(value)).toBeNull()
    },
  )

  it.each([null, undefined, 1, {}, [], true])(
    'rejects non-string input: %j',
    (value) => {
      expect(parseProfileId(value)).toBeNull()
    },
  )

  it('returns the branded narrow type without accepting an unparsed string', () => {
    expectTypeOf(parseProfileId('p1')).toEqualTypeOf<ProfileId | null>()
    expectTypeOf<'p1'>().not.toMatchTypeOf<ProfileId>()
  })
})
