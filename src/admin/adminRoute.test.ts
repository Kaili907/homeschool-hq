import { describe, expect, it } from 'vitest'
import { ADMIN_CONSOLE_PATH, isAdminConsolePath } from './adminRoute'

describe('admin console mount path', () => {
  it('matches only the exact admin root with an optional trailing slash', () => {
    expect(ADMIN_CONSOLE_PATH).toBe('/academy/admin')
    expect(isAdminConsolePath('/academy/admin')).toBe(true)
    expect(isAdminConsolePath('/academy/admin/')).toBe(true)
    expect(isAdminConsolePath('/academy')).toBe(false)
    expect(isAdminConsolePath('/academy/admin/audit-log')).toBe(false)
    expect(isAdminConsolePath('/academy/administrator')).toBe(false)
  })
})
