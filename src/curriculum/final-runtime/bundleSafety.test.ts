import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

interface EmittedChunk {
  readonly type: 'chunk'
  readonly code: string
}

interface InMemoryBuild {
  readonly output: readonly ({ readonly type: string } | EmittedChunk)[]
}

describe('final runtime browser bundle', () => {
  it('bundles as a small browser module with no server or development provider', async () => {
    const result = await build({
      logLevel: 'silent',
      configFile: false,
      publicDir: false,
      build: {
        write: false,
        minify: 'esbuild',
        target: 'es2022',
        lib: {
          entry: fileURLToPath(new URL('./index.ts', import.meta.url)),
          formats: ['es'],
          fileName: 'final-runtime',
        },
      },
    }) as InMemoryBuild | InMemoryBuild[]
    const output = Array.isArray(result) ? result[0] : result
    const code = output.output
      .filter((item): item is EmittedChunk => item.type === 'chunk')
      .map((chunk) => chunk.code)
      .join('\n')

    expect(code.length).toBeLessThan(25_000)
    expect(code).not.toMatch(/node:|\bfs\b|supabase|localhost|127\.0\.0\.1/i)
    expect(code).not.toMatch(/localDevelopment|devProvider|curriculum-production|curriculum-content/)
    expect(code).not.toContain('Independent application')
  })
})
