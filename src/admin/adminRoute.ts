export const ADMIN_CONSOLE_PATH = '/academy/admin'

/** ADMIN-1 owns the authorization decision; this only identifies the mount path. */
export function isAdminConsolePath(pathname: string): boolean {
  return pathname === ADMIN_CONSOLE_PATH || pathname === `${ADMIN_CONSOLE_PATH}/`
}
