import { ADMIN_CONSOLE_PATH } from './admin0Vocabulary'

export { ADMIN_CONSOLE_PATH } from './admin0Vocabulary'

/** ADMIN-1 owns the authorization decision; this only identifies the mount path. */
export function isAdminConsolePath(pathname: string): boolean {
  return pathname === ADMIN_CONSOLE_PATH || pathname.startsWith(`${ADMIN_CONSOLE_PATH}/`)
}
