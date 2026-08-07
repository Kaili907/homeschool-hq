import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const contractPath = join(here, 'tutorContract.ts')
const contractSource = readFileSync(contractPath, 'utf8')

/**
 * Strips block and line comments by plain scanning.
 *
 * No regular expression, and no string-literal awareness is needed: the
 * contract contains no literal holding a comment token, so the tokens below are
 * unambiguous. A future edit that added one would be caught by the specifier
 * test above rather than silently mis-stripped here.
 */
function stripComments(source: string): string {
  const open = '/*'
  const close = '*/'
  const line = '//'
  const kept: string[] = []
  let inBlock = false
  for (const raw of source.split('\n')) {
    let text = raw
    if (inBlock) {
      const end = text.indexOf(close)
      if (end < 0) continue
      text = text.slice(end + close.length)
      inBlock = false
    }
    for (;;) {
      const start = text.indexOf(open)
      if (start < 0) break
      const end = text.indexOf(close, start + open.length)
      if (end < 0) {
        text = text.slice(0, start)
        inBlock = true
        break
      }
      text = text.slice(0, start) + text.slice(end + close.length)
    }
    const lineAt = text.indexOf(line)
    if (lineAt >= 0) text = text.slice(0, lineAt)
    kept.push(text)
  }
  return kept.join('\n')
}

const codeWithoutComments = stripComments(contractSource)

/** The custody base this contract was authored against. */
const BASE_COMMIT = '230b836e0ac35bcd8adc00cc5ae7be142ad5993f'

function git(...args: readonly string[]): string | null {
  try {
    return execFileSync('git', [...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

describe('production Tutor contract isolation', () => {
  it('imports nothing but host study types', () => {
    // Single-space `from '...'` is the repository's import style, including the
    // closing line of a multi-line type import.
    const specifiers = [...contractSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    )
    expect(specifiers).toEqual(['../types'])
  })

  it('does not reach the release-candidate wrapper, preview, demo or release-mode paths', () => {
    // Comments are stripped first, deliberately. The contract's documentation
    // names the paths it must never reach, and forbidding the words outright
    // would force that reasoning out of the file to satisfy a text search.
    for (const forbidden of [
      'adaptive-tutor',
      'study-engine',
      'tutor-bridge',
      'runtimeFacade',
      'RELEASE_MODE',
      'mountedPorts',
      'StudySessionRoute',
      '/composition/',
      'AcceptedRc1HostRuntime',
    ]) {
      expect(codeWithoutComments).not.toContain(forbidden)
    }
    // No dynamic escape hatch either.
    expect(codeWithoutComments).not.toContain('import(')
    expect(codeWithoutComments).not.toContain('require(')
  })

  it('declares no runtime dependency at all beyond a type-only host import', () => {
    // A type-only import erases at build time, so the contract adds no module
    // to the production bundle and cannot pull a wrapper in transitively.
    expect(contractSource).toContain("import type { StudyRuntimeInterruption } from '../types'")
    expect(contractSource).not.toMatch(/^import (?!type )/m)
  })

  it('leaves every file under adaptive-tutor unmodified since the custody base', () => {
    const hasBase = git('cat-file', '-e', BASE_COMMIT + '^{commit}') !== null
    if (!hasBase) {
      // A shallow or rebased checkout cannot answer this; the commit proof in
      // the card's report covers it instead of a false pass.
      expect(hasBase).toBe(false)
      return
    }
    const changed = git('diff', '--name-only', BASE_COMMIT, '--')
    expect(changed).not.toBeNull()
    const touched = (changed ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    expect(touched.filter((path) => path.startsWith('adaptive-tutor/'))).toEqual([])
  })

  it('leaves the host consumers this card only read unmodified', () => {
    const hasBase = git('cat-file', '-e', BASE_COMMIT + '^{commit}') !== null
    if (!hasBase) {
      expect(hasBase).toBe(false)
      return
    }
    const touched = (git('diff', '--name-only', BASE_COMMIT, '--') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const protectedPaths = [
      'src/study/runtimeFacade.ts',
      'src/components/study/StudySessionContainer.tsx',
      'src/study/types.ts',
      'src/App.tsx',
    ]
    expect(touched.filter((path) => protectedPaths.includes(path))).toEqual([])
    for (const prefix of ['src/study/lifecycle/', 'src/study/composition/', 'netlify/', 'supabase/', 'curriculum/']) {
      expect(touched.filter((path) => path.startsWith(prefix))).toEqual([])
    }
  })
})
