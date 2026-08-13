import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

function outputText(result: Rollup.RollupOutput | readonly Rollup.RollupOutput[]): string {
  return (Array.isArray(result) ? result : [result]).flatMap((output) => output.output)
    .map((entry) => entry.type === 'chunk' ? entry.code : String(entry.source)).join('\n')
}

describe('hosted Study convergence production browser boundary', () => {
  it('contains no Node, service credential, raw SQL, or privileged SDK import', () => {
    const sources = ['index.ts', 'rpcClient.ts', 'rpcAuthorization.ts', 'service.ts', 'syncMetadata.ts']
      .map((name) => readFileSync(join(here, name), 'utf8')).join('\n')
    expect(sources).not.toMatch(/from ['"]node:|@supabase\/supabase-js|SUPABASE_SERVICE_ROLE_KEY|create\s+function\s+public/i)
    expect(sources).not.toMatch(/localStorage|sessionStorage|history\.(?:pushState|replaceState)/)
  })

  it('bundles the real RPC/IndexedDB convergence entry without privileged capability', async () => {
    const result = await build({
      configFile: false, root: repoRoot, mode: 'production', logLevel: 'silent',
      build: {
        write: false, minify: true, target: 'es2022',
        lib: { entry: join(here, 'index.ts'), formats: ['es'], fileName: 'hosted-study-convergence' },
      },
    })
    if ('on' in result) throw new Error('Hosted Study convergence bundle unexpectedly entered watch mode.')
    const bundle = outputText(result)
    expect(bundle).toContain('academy_study_sync_hydrate_v1')
    expect(bundle).toContain('academy_study_sync_write_v1')
    expect(bundle).toContain('indexedDB')
    expect(bundle).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|@supabase\/supabase-js|node:fs|node:path|child_process/)
    expect(bundle).not.toMatch(/create\s+function\s+public|alter\s+table\s+academy_private/i)
  }, 120_000)
})
