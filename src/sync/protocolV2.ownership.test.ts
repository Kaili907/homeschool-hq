import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (name: string) =>
  readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Sync Protocol v2 ownership boundary', () => {
  it('has no Admin or Study imports', () => {
    const implementation = [
      source('./credentialFreeProfile.ts'),
      source('./protocolV2.ts'),
    ].join('\n')
    const imports = implementation
      .split('\n')
      .filter((line) => /^import\b/.test(line.trim()))
      .join('\n')

    expect(imports).not.toMatch(/(?:^|\/)admin(?:\/|['"])/i)
    expect(imports).not.toMatch(/(?:^|\/)study(?:\/|['"])/i)
  })

  it('does not activate v2 from the current application wiring', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
    const mountedSync = source('./useSync.ts')
    expect(app).not.toContain('protocolV2')
    expect(mountedSync).not.toContain('protocolV2')
  })

  it('contains no exact legacy RPC declaration', () => {
    const implementation = source('./protocolV2.ts')
    expect(implementation).not.toMatch(
      /['"]academy_sync_snapshot['"]/,
    )
    expect(implementation).not.toMatch(
      /['"]academy_apply_profile_mutation['"]/,
    )
  })
})
