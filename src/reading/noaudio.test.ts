import { describe, it, expect } from 'vitest'

/**
 * Acceptance (privacy, load-bearing): "No audio is stored ever — only transcript
 * alignment results." This test asserts that NO reading source path touches an
 * audio-capture or audio-persistence API. Recognition yields transcript strings
 * only; tap-to-pronounce plays through the shared speak adapter (voice.ts), which
 * lives OUTSIDE the reading paths — so reading code never creates or stores a blob.
 */

// Load every reading source file as raw text via Vite's glob (no node fs needed).
const rawFiles: Record<string, string> = {
  ...import.meta.glob('./*.ts', { query: '?raw', eager: true, import: 'default' }),
  ...import.meta.glob('../components/reading/*.tsx', { query: '?raw', eager: true, import: 'default' }),
}

// APIs that would capture or persist audio. If a reading file ever needs one of
// these, the privacy promise is broken and this test must fail loudly.
const FORBIDDEN: RegExp[] = [
  /MediaRecorder/,
  /getUserMedia/,
  /\.ondataavailable/,
  /createObjectURL/,
  /\bnew Blob\b/,
  /audio\/(webm|mpeg|wav|ogg)/,
  /indexedDB/,
]

/** Strip block and line comments so the scan asserts real CODE, not the prose that
 * documents what the code deliberately avoids (the privacy note names these APIs). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('no audio is ever persisted from reading paths', () => {
  const entries = Object.entries(rawFiles).filter(([path]) => !/\.test\.tsx?$/.test(path))

  it('finds the reading source files to scan', () => {
    // guard against the test silently passing because it scanned nothing
    expect(entries.length).toBeGreaterThan(0)
  })

  it('no reading source file uses an audio-capture or audio-storage API', () => {
    const violations: string[] = []
    for (const [path, raw] of entries) {
      const src = stripComments(raw)
      for (const pattern of FORBIDDEN) {
        if (pattern.test(src)) violations.push(`${path} :: ${pattern}`)
      }
    }
    expect(violations).toEqual([])
  })
})
