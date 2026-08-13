import type { AuthorizedStudentAuthority, HostedFamilyIdentityBridge } from '../identity'
import { STUDY_SESSION_HEADER } from '../identity'
import type { HostedStudyRpcAuthorization } from './rpcTypes'

/**
 * Adapts the accepted memory-only identity bridge to the DB RPC client. The
 * grant is returned for one call only and is never copied into a queue, store,
 * URL, history entry, backup, or diagnostic.
 */
export function createBridgeHostedStudyRpcAuthorization(input: {
  readonly bridge: HostedFamilyIdentityBridge
  readonly studentAuthority: AuthorizedStudentAuthority
  readonly publicClientKey?: string
}): HostedStudyRpcAuthorization {
  return Object.freeze({
    async authorize(signal?: AbortSignal) {
      const result = await input.bridge.getAuthorizationHeaders({
        scope: 'study',
        authority: input.studentAuthority,
        headers: input.publicClientKey ? { apikey: input.publicClientKey } : {},
        signal,
      })
      if (result.status !== 'authorized') return Object.freeze({ status: 'interrupted' as const })
      const held = Object.entries(result.headers).find(([name]) => name.toLowerCase() === STUDY_SESSION_HEADER)
      if (!held?.[1]) return Object.freeze({ status: 'interrupted' as const })
      return Object.freeze({
        status: 'authorized' as const,
        headers: result.headers,
        studySessionReference: held[1],
      })
    },
  })
}
