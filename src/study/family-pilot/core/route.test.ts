import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FAMILY_PILOT_PATH,
  FAMILY_PILOT_RESET_PASSWORD_PATH,
  enterFamilyPilotPath,
  isFamilyPilotPath,
  isFamilyPilotResetPasswordPath,
  leaveFamilyPilotPath,
} from './route'

function stubLocation(pathname: string) {
  const pushState = vi.fn()
  const replaceState = vi.fn()
  vi.stubGlobal('window', {
    location: { pathname },
    history: { pushState, replaceState },
  })
  return { pushState, replaceState }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('family pilot route', () => {
  it('matches the path with and without a trailing slash', () => {
    expect(isFamilyPilotPath(FAMILY_PILOT_PATH)).toBe(true)
    expect(isFamilyPilotPath(`${FAMILY_PILOT_PATH}/`)).toBe(true)
    expect(isFamilyPilotPath(FAMILY_PILOT_RESET_PASSWORD_PATH)).toBe(true)
    expect(isFamilyPilotResetPasswordPath(FAMILY_PILOT_RESET_PASSWORD_PATH)).toBe(true)
  })

  it.each(['/', '/study-engine', '/family-pilots', '/family-pilot/session', ''])(
    'does not match %s',
    (pathname) => {
      expect(isFamilyPilotPath(pathname)).toBe(false)
    },
  )

  it('pushes the path on entry', () => {
    const { pushState } = stubLocation('/')
    enterFamilyPilotPath()
    expect(pushState).toHaveBeenCalledWith(null, '', FAMILY_PILOT_PATH)
  })

  it('does not push a second history entry when already there', () => {
    const { pushState } = stubLocation(FAMILY_PILOT_PATH)
    enterFamilyPilotPath()
    expect(pushState).not.toHaveBeenCalled()
  })

  it('rewrites the path on exit so a refresh cannot re-enter the pilot', () => {
    const { replaceState } = stubLocation(FAMILY_PILOT_PATH)
    leaveFamilyPilotPath()
    expect(replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('leaves an unrelated path alone on exit', () => {
    const { replaceState } = stubLocation('/academy')
    leaveFamilyPilotPath()
    expect(replaceState).not.toHaveBeenCalled()
  })
})
