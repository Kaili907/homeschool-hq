import { describe, expect, it } from 'vitest'
import {
  EXPECTED_FROZEN_ARTIFACT,
  EXPECTED_FROZEN_SHA256,
  reportFrozenBaselineCustody,
} from './frozenBaseline'

describe('FULL-FAMILY-READY-FOR-LIFE reportFrozenBaselineCustody', () => {
  const report = reportFrozenBaselineCustody()

  it('matches the expected frozen baseline identity', () => {
    expect(report.artifact).toBe(EXPECTED_FROZEN_ARTIFACT)
    expect(report.expectedSha256).toBe(EXPECTED_FROZEN_SHA256)
    expect(EXPECTED_FROZEN_SHA256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('finds the manifest entry and its hash matches the expected reference', () => {
    expect(report.manifestEntryFound).toBe(true)
    expect(report.manifestSha256Matches).toBe(true)
  })

  it('finds the same hash repeated consistently in both companion docs', () => {
    expect(report.importCardReferenceMatches).toBe(true)
    expect(report.standardsReferenceMatches).toBe(true)
  })

  it('establishes reference custody: manifest + both docs agree with the expected hash', () => {
    expect(report.referenceCustodyEstablished).toBe(true)
  })

  it('reports the true state of the binary rather than assuming it: not present in this repo', () => {
    // The manifest itself declares this artifact "referenced, not copied or
    // modified" — this repo integrates it through adapters, never rewrites
    // it, and this assertion is what "not rewritten" actually means here:
    // there is no local copy of the frozen zip for anything in this lane to
    // touch, silently or otherwise.
    expect(report.artifactBytesPresentInRepo).toBe(false)
  })
})
