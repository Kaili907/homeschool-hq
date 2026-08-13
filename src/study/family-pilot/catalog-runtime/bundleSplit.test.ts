import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COURSES } from './generated/index'

/**
 * FF-M11 — measures the real build output rather than trusting the source shape.
 *
 * The app does not import this runtime yet (FF-M11 owns the catalog only, not
 * integration), so `vite build` at the repo root would not reach it and could
 * not answer the question that matters: does the catalog code-split? This runs
 * a production Rollup build of the runtime's own entry and inspects the chunks.
 *
 * It uses configFile: false, so this is NOT the app's build config — it is lib
 * mode without the app's plugins. What it proves is that the module graph
 * splits per course under stock Rollup. That carries to the app build because
 * vite.config.ts sets no build.rollupOptions or manualChunks of its own, but
 * this test cannot prove the app build on its own.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ENTRY = join(HERE, 'index.ts')

let outDir: string
let chunks: { name: string; bytes: number; code: string }[]

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'ff-m11-bundle-'))
  await build({
    logLevel: 'error',
    configFile: false,
    // Without this Vite copies public/ into the output and its files would be
    // counted as chunks, padding the split and hiding a missing course.
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      minify: 'esbuild',
      target: 'es2022',
      lib: { entry: ENTRY, formats: ['es'], fileName: 'catalog-runtime' },
      rollupOptions: { output: { chunkFileNames: '[name].js' } },
    },
  })
  chunks = readdirSync(outDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({
      name,
      bytes: statSync(join(outDir, name)).size,
      code: readFileSync(join(outDir, name), 'utf8'),
    }))
}, 180_000)

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true })
})

describe('production bundle', () => {
  it('emits exactly one lazily loadable chunk per course, plus the entry', () => {
    expect(chunks).toHaveLength(COURSES.length + 1)
    const lazyNames = chunks
      .filter((chunk) => !chunk.name.startsWith('catalog-runtime'))
      .map((chunk) => chunk.name.replace(/\.js$/, ''))
      .sort()
    expect(lazyNames).toEqual(COURSES.map((course) => course.courseRef).sort())
  })

  it('keeps every course payload out of the entry chunk', () => {
    const entry = chunks.find((chunk) => chunk.name.startsWith('catalog-runtime'))
    expect(entry, 'entry chunk not emitted').toBeDefined()

    // The entry must know each course exists, but must not carry its lessons.
    for (const course of COURSES) {
      expect(entry!.code).toContain(course.courseRef)
    }

    // Lesson TITLES exist only inside payloads. Sample one real title per
    // course from the generated source and require none of them in the entry.
    const leaked = COURSES.map((course) => {
      const payload = readFileSync(join(HERE, 'generated/courses', `${course.courseRef}.ts`), 'utf8')
      const title = /title: "((?:[^"\\]|\\.)+)"/.exec(payload)?.[1]
      expect(title, `no title found in ${course.courseRef} payload`).toBeTruthy()
      return { courseRef: course.courseRef, title: title! }
    }).filter(({ title }) => entry!.code.includes(title))
    expect(leaked).toEqual([])

    // Lesson REFS are eager on purpose: they are the unit index, and they are
    // what makes listUnits/getUnit synchronous. Pinned so the split is explicit.
    const entryLessonRefs = entry!.code.match(/ma-g\d-[a-z-]+-u\d\d-l\d\d/g) ?? []
    expect(entryLessonRefs).toHaveLength(2736)
  })

  it('never emits one giant eagerly loaded chunk', () => {
    const entry = chunks.find((chunk) => chunk.name.startsWith('catalog-runtime'))!
    // The eager half is course + unit structure for the whole release. Measured
    // at ~190 KB (22 KB gzipped); this catches a regression, not normal drift.
    expect(entry.bytes).toBeLessThan(220_000)
  })

  it('splits the lesson payloads across chunks rather than one blob', () => {
    const lazy = chunks.filter((chunk) => !chunk.name.startsWith('catalog-runtime'))
    expect(lazy).toHaveLength(COURSES.length)
    const total = lazy.reduce((n, chunk) => n + chunk.bytes, 0)
    const largest = Math.max(...lazy.map((chunk) => chunk.bytes))
    // Largest lazy chunk is a small fraction of the lazy total: real splitting.
    // Measured largest is ~34 KB against a ~491 KB total, i.e. about a
    // fourteenth; a tenth leaves room for content growth but not for a collapse
    // back into one blob.
    expect(largest).toBeLessThan(total / 10)
  })

  it('ships no node builtin in any emitted chunk', () => {
    for (const chunk of chunks) {
      expect(chunk.code, `${chunk.name} references a node builtin`).not.toMatch(
        /require\(["']node:|from["']node:|["']node:fs["']/,
      )
    }
  })
})
