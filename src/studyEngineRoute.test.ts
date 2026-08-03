import { describe, expect, it } from 'vitest'
import { isStudyEnginePath } from './studyEngineRoute'

describe('Study Engine root delegation', () => {
  it('recognizes exactly one subject-neutral route with an optional trailing slash', () => {
    expect(isStudyEnginePath('/study-engine')).toBe(true)
    expect(isStudyEnginePath('/study-engine/')).toBe(true)
    expect(isStudyEnginePath('/')).toBe(false)
    expect(isStudyEnginePath('/study-engine/english')).toBe(false)
    expect(isStudyEnginePath('/study-engine/math')).toBe(false)
    expect(isStudyEnginePath('/study-engine?x=1')).toBe(false)
  })
})
