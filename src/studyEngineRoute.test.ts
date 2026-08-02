import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isStudyEnginePath } from './studyEngineRoute'

describe('Study Engine root delegation', () => {
  it('recognizes exactly one subject-neutral route with an optional trailing slash', () => {
    expect(isStudyEnginePath('/study-engine')).toBe(true)
    expect(isStudyEnginePath('/study-engine/')).toBe(true)
    expect(isStudyEnginePath('/')).toBe(false)
    expect(isStudyEnginePath('/study-engine/english')).toBe(false)
    expect(isStudyEnginePath('/study-engine/math')).toBe(false)
  })

  it('imports only the public Study Engine entry and owns no tutor or subject behavior', () => {
    const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const studyEngineImports = [...appSource.matchAll(/^import .*study-engine.*$/gim)].map(
      ([statement]) => statement,
    )

    expect(studyEngineImports).toEqual([
      "import { StudyEngineApp } from '../study-engine/src/index'",
    ])
    expect(appSource).not.toMatch(
      /adaptive-tutor\/subjects\/(?:english|math)|src\/adaptive(?:English|Math)|study-engine\/src\/tutor\//i,
    )

    const mountBlock = appSource.slice(
      appSource.indexOf('if (isStudyEnginePath(pathname))'),
      appSource.indexOf('// MA mount point'),
    )
    expect(mountBlock).not.toMatch(/Tutor Core|session|review|English|Math|fetch\(|analytics/i)
    expect(mountBlock).toContain('learner={{ id: active.id, displayName: active.name }}')
  })
})
