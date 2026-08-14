import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = readFileSync('netlify.toml', 'utf8')
const pilotContext = '[context."mac/web-release-r3-convergence-r1".environment]'

function scorerBundleConfig(): string {
  return config.slice(
    config.indexOf('[functions."production-item-assessment"]'),
    config.indexOf('# ---- Browser/service-worker cache boundaries ----'),
  )
}

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

  it('keeps trusted production-item authorities in the scorer function bundle', () => {
    const scorerBundle = scorerBundleConfig()
    expect(scorerBundle).toContain('node_bundler = "esbuild"')
    expect(scorerBundle).toContain('curriculum-release-admitted/family-pilot-r1/MANIFEST.json')
    expect(scorerBundle).toContain('curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl')
    expect(scorerBundle).toContain('curriculum-production/final/mathematics/active/**')
    expect(scorerBundle).toContain('curriculum-production/student-work/english-language-arts/packages/**')
    expect(scorerBundle).toContain('curriculum-production/student-work/social-studies/**')
    expect(scorerBundle).toContain('curriculum-production/student-work/technology-arts-lessons/scoring-guides/**')
  })

  it('covers every dynamically resolved package and scoring authority', () => {
    const includedFiles = [...scorerBundleConfig().matchAll(/^\s+"([^"]+)",?$/gm)]
      .map((match) => match[1])
    const covered = (path: string) => includedFiles.some((pattern) =>
      pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern)
    const bindings = readFileSync(
      'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl',
      'utf8',
    ).trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    const trustedRefs = bindings.flatMap((binding) => [
      binding.productionPackageRef,
      binding.scoringAuthorityRef,
    ]).map((reference) => String(reference).slice(String(reference).indexOf(':') + 1))
    expect(trustedRefs).toHaveLength(16_584)
    expect(trustedRefs.filter((path) => !covered(path))).toEqual([])
  })
})
