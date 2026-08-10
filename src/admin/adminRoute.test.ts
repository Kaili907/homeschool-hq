import { describe, expect, it } from 'vitest'
import { ADMIN_CONSOLE_PATH, isAdminConsolePath } from './adminRoute'

describe('admin console mount path', () => {
  it('matches the canonical admin prefix and nested admin routes', () => {
    expect(ADMIN_CONSOLE_PATH).toBe('/academy/admin')
    expect(isAdminConsolePath('/academy/admin')).toBe(true)
    expect(isAdminConsolePath('/academy/admin/')).toBe(true)
    expect(isAdminConsolePath('/academy/admin/audit-log')).toBe(true)
    expect(isAdminConsolePath('/academy/admin/access')).toBe(true)
    expect(isAdminConsolePath('/academy/admin/engines/tutor')).toBe(true)
    expect(isAdminConsolePath('/academy')).toBe(false)
    expect(isAdminConsolePath('/academy/administrator')).toBe(false)
  })
})
