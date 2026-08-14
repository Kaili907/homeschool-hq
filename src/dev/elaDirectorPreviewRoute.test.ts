import { describe, expect, it } from 'vitest'
import { ELA_DIRECTOR_PREVIEW_PATH, isElaDirectorPreviewEnabled } from './elaDirectorPreviewRoute'

describe('ELA Director preview route', () => {
  it('is available only at the exact development route', () => {
    expect(isElaDirectorPreviewEnabled({ developmentBuild: true, pathname: ELA_DIRECTOR_PREVIEW_PATH })).toBe(true)
    expect(isElaDirectorPreviewEnabled({ developmentBuild: true, pathname: `${ELA_DIRECTOR_PREVIEW_PATH}/` })).toBe(true)
    expect(isElaDirectorPreviewEnabled({ developmentBuild: true, pathname: '/dev/ela-director-preview/extra' })).toBe(false)
    expect(isElaDirectorPreviewEnabled({ developmentBuild: true, pathname: '/academy' })).toBe(false)
  })

  it('fails closed outside a development build', () => {
    expect(isElaDirectorPreviewEnabled({ developmentBuild: false, pathname: ELA_DIRECTOR_PREVIEW_PATH })).toBe(false)
  })
})
