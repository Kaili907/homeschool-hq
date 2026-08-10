import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStudyEnginePath, syncStudyEnginePath } from './studyEngineRoute'

afterEach(() => vi.unstubAllGlobals())

describe('Study Engine root delegation', () => {
  it('recognizes exactly one subject-neutral route with an optional trailing slash', () => {
    expect(isStudyEnginePath('/study-engine')).toBe(true)
    expect(isStudyEnginePath('/study-engine/')).toBe(true)
    expect(isStudyEnginePath('/')).toBe(false)
    expect(isStudyEnginePath('/study-engine/english')).toBe(false)
    expect(isStudyEnginePath('/study-engine/math')).toBe(false)
    expect(isStudyEnginePath('/study-engine?x=1')).toBe(false)
  })

  it('enters the production route without query parameters or history payload state', () => {
    let pathname = '/academy'
    const replaceState = vi.fn((_state: unknown, _title: string, path: string) => { pathname = path })
    vi.stubGlobal('window', {
      location: { get pathname() { return pathname } },
      history: { replaceState },
    })

    syncStudyEnginePath()

    expect(pathname).toBe('/study-engine')
    expect(replaceState).toHaveBeenCalledWith(null, '', '/study-engine')
  })
})
