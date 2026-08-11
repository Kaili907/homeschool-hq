import { afterEach, describe, expect, it, vi } from 'vitest'
import { enterStudyEnginePath, isStudyEnginePath } from './studyEngineRoute'

describe('Study Engine root delegation', () => {
  it('recognizes exactly one subject-neutral route with an optional trailing slash', () => {
    expect(isStudyEnginePath('/study-engine')).toBe(true)
    expect(isStudyEnginePath('/study-engine/')).toBe(true)
    expect(isStudyEnginePath('/')).toBe(false)
    expect(isStudyEnginePath('/study-engine/english')).toBe(false)
    expect(isStudyEnginePath('/study-engine/math')).toBe(false)
    expect(isStudyEnginePath('/study-engine?x=1')).toBe(false)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('enters the established production route once and preserves an existing deep link', () => {
    let pathname = '/academy'
    const pushState = vi.fn((_state: unknown, _title: string, next: string) => {
      pathname = next
    })
    vi.stubGlobal('window', {
      location: { get pathname() { return pathname } },
      history: { pushState },
    })

    enterStudyEnginePath()
    enterStudyEnginePath()

    expect(pathname).toBe('/study-engine')
    expect(pushState).toHaveBeenCalledTimes(1)
  })
})
