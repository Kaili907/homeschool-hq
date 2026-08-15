/**
 * Literal current-product policy. This module is intentionally dependency-free
 * so the Parent's Local-only badge cannot pull an RPC adapter or provider into
 * the Family Pilot runtime graph.
 */
export const FAMILY_HOSTED_SYNC_CONVERGENCE_R1 = Object.freeze({
  enabled: false as const,
  localFirst: true as const,
  plannerPersistence: 'LOCAL_AND_HOSTED_CHECKPOINT' as const,
  hostedContract: 'hosted-study-sync-state.r2.v1' as const,
})
