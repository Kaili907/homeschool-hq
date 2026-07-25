import { getStoredSession } from '../sync/config'

/**
 * Return a current Supabase access token for same-origin AI gateways.
 *
 * The token remains in the existing dedicated sync-session store and is never
 * copied into AppState, transcripts, gateway bodies, or provider requests.
 * Token refresh remains owned by the signed-in sync session. Rotating a refresh
 * token here would leave that hook's in-memory session stale, so this file-disjoint
 * gateway adapter fails closed once the stored access token expires.
 */
export async function getGatewayAccessToken(): Promise<string | null> {
  return getGatewayAccessTokenWith()
}

export interface GatewayAuthDeps {
  getSession?: typeof getStoredSession
  now?: () => number
}

/** Dependency-injected seam used by network-free tests. */
export async function getGatewayAccessTokenWith(deps: GatewayAuthDeps = {}): Promise<string | null> {
  const read = deps.getSession ?? getStoredSession
  const now = deps.now ?? (() => Date.now())
  const stored = read()
  if (!stored) return null
  if (!stored.access_token || !Number.isFinite(stored.expires_at) || stored.expires_at <= now()) {
    return null
  }
  return stored.access_token
}
