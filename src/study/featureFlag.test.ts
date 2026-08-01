import { describe, expect, it } from 'vitest'
import { isStudyEngineEnabled } from './featureFlag'

describe('Study feature gate', () => {
  it.each([undefined, '', 'false', 'TRUE', '1', ' true ', 'yes'])('defaults disabled for %s', (value) => {
    expect(isStudyEngineEnabled(value)).toBe(false)
  })

  it('enables only exact true', () => {
    expect(isStudyEngineEnabled('true')).toBe(true)
  })
})
