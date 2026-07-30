import { getCurrentSession } from '../sync/supabase'

/**
 * Return a current Supabase access token for same-origin AI gateways.
 *
 * The token remains in the official Supabase client's session store and is
 * never copied into AppState, transcripts, gateway bodies, or provider
 * requests. Token refresh remains owned by that client; this adapter fails
 * closed when no current, unexpired access token is available.
 */
export async function getGatewayAccessToken(): Promise<string | null> {
  return getGatewayAccessTokenWith()
}

export interface GatewayAuthDeps {
  getSession?: typeof getCurrentSession
  now?: () => number
}

/** Dependency-injected seam used by network-free tests. */
export async function getGatewayAccessTokenWith(deps: GatewayAuthDeps = {}): Promise<string | null> {
  const read = deps.getSession ?? getCurrentSession
  const now = deps.now ?? (() => Date.now())
  const stored = await read()
  if (!stored) return null
  if (
    !stored.access_token ||
    typeof stored.expires_at !== 'number' ||
    !Number.isFinite(stored.expires_at) ||
    stored.expires_at * 1000 <= now()
  ) {
    return null
  }
  return stored.access_token
}
