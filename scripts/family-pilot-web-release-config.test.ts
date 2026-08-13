import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = readFileSync('netlify.toml', 'utf8')
const pilotContext = '[context."mac/family-pilot-web-release-r1".environment]'

describe('Family Pilot controlled web release configuration', () => {
  it('enables the route with the exact literal only for the dedicated pilot branch', () => {
    expect(config).toContain(`${pilotContext}\n  VITE_FAMILY_PILOT_ENABLED = "true"`)
    expect(config.match(/VITE_FAMILY_PILOT_ENABLED/g)).toHaveLength(1)
  })

  it('does not enable the route in the global build environment', () => {
    const globalEnvironment = config.slice(
      config.indexOf('[build.environment]'),
      config.indexOf(pilotContext),
    )
    expect(globalEnvironment).not.toContain('VITE_FAMILY_PILOT_ENABLED')
  })
})
