import { describe, expect, it } from 'vitest'
// @ts-expect-error -- plain ESM helper shared with the operator CLI
import { replayChain, replayFromHostedBaseline, HOSTED_APPLIED_PREFIX } from '../scripts/replay-migration-chain.mjs'

// The reconciled chain has to hold two properties that a merge can silently
// break: it applies from zero on a clean database, and it still applies on top
// of the prefix the dispatcher already ran by hand against hosted Supabase.
describe.sequential('reconciled migration chain', () => {
  it('applies from zero on a clean database and refuses a second pass', async () => {
    const result = await replayChain()
    expect({ phase: result.phase, failed: result.failed, integrity: result.integrity })
      .toEqual({ phase: 'complete', failed: undefined, integrity: [] })
    expect(result.applied).toHaveLength(50)
    expect(result.replay.some((entry: { refused: boolean }) => entry.refused)).toBe(true)
    expect(result.replay[0]).toMatchObject({ refused: true })
  }, 120_000)

  it('still applies on top of the migrations already applied to hosted', async () => {
    const hosted = await replayFromHostedBaseline()
    expect(hosted.prefixMatches).toBe(true)
    expect(hosted.prefixReplayRefused).toBe(true)
    expect(hosted.failed).toBeUndefined()
    expect(hosted.resumed).toHaveLength(50 - HOSTED_APPLIED_PREFIX.length)
    expect(hosted.ok).toBe(true)
  }, 120_000)
})
