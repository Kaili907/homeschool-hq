import { describe, expect, it } from 'vitest'
import { academyProfileContractFixtures } from '../../supabase/academy-profile-contract.fixtures'
import { validateProfileForSync } from './provenance'

describe('shared Academy profile contract fixtures', () => {
  for (const fixture of academyProfileContractFixtures()) {
    it(`${fixture.valid ? 'accepts' : 'rejects'} ${fixture.name}`, () => {
      expect(validateProfileForSync(fixture.profileId, fixture.data)).toBe(
        fixture.valid,
      )
    })
  }
})
