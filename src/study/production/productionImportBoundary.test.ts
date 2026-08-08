import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

/**
 * STUDY-A1-PROD-DASH-1 Phase 9 — the boundary is claimed over the whole static
 * import closure, not over one file's own import list. A forbidden module one
 * hop away is still in the production surface, and a single-file regex would
 * never see it.
 */
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  // `./x.js` in this repo's TypeScript sources means `./x.ts` on disk.
  const withoutJs = base.replace(/\.js$/, '')
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`,
    `${withoutJs}.ts`, `${withoutJs}.tsx`,
    join(base, 'index.ts'), join(base, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

interface ImportClosure {
  /** Every reachable module, as a `src`-relative POSIX path. */
  readonly files: readonly string[]
  /** Relative specifiers that resolved to nothing, as `<file> -> <specifier>`. */
  readonly unresolved: readonly string[]
}

/**
 * Unresolved specifiers are collected rather than thrown. Throwing mid-walk
 * turns every boundary question into one collection error about whichever
 * import happened to be unresolvable first, which hides the finding that
 * matters — the forbidden module the closure actually reached.
 */
function importClosure(entry: string): ImportClosure {
  const seen = new Set<string>()
  const unresolved = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const [, specifier] of text.matchAll(IMPORT_SPECIFIER)) {
      if (!specifier.startsWith('.')) continue
      const resolved = resolveRelative(file, specifier)
      if (resolved) pending.push(resolved)
      else unresolved.add(`${relative(sourceRoot, file).replaceAll('\\', '/')} -> ${specifier}`)
    }
  }
  return {
    files: [...seen].map((file) => relative(sourceRoot, file).replaceAll('\\', '/')),
    unresolved: [...unresolved],
  }
}

describe('production Study import boundary', () => {
  it('does not statically import preview ports or the sentinel runtime from App', () => {
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(/from ['"]\.\/study\/(?:localDevelopmentPorts|mountedPorts)['"]/)
    expect(app).not.toMatch(/from ['"]\.\/components\/study\/StudySessionRoute['"]/)
    expect(app).toContain('import.meta.env.DEV')
    expect(app).toContain("import('./study/mountedPorts')")
  })

  it('keeps local, memory, test, preview, synthetic and sentinel identifiers out of the production root', () => {
    const productionText = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(here, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/localDevelopmentPorts|memory-store|test provider|learner:local-release-candidate/i)
  })
})

describe('verified production Study dashboard import boundary', () => {
  const entry = join(sourceRoot, 'components', 'study', 'VerifiedStudyDashboard.tsx')
  const { files: closure, unresolved } = importClosure(entry)

  it('walked a real closure', () => {
    // Guards every assertion below: an empty or one-file closure would pass the
    // forbidden checks without having looked at anything.
    expect(closure.length).toBeGreaterThan(5)
    expect(closure).toContain('components/study/VerifiedStudyDashboard.tsx')
    expect(closure).toContain('study/production/verifiedDashboardContracts.ts')
    expect(closure).toContain('study/production/verifiedRuntimeAdapter.ts')
    // Nothing was skipped, so "absent from the closure" means absent.
    expect(unresolved).toEqual([])
  })

  it.each([
    'study/localDevelopmentPorts',
    'study/mountedPorts',
    'study/ports',
    'study/persistence/',
    'components/study/StudyDashboard',
    'components/study/StudySessionRoute',
    'components/study/StudySessionContainer',
    'components/study/StudySettings',
    'study/calendarAdapter',
    'study/demonstrations',
  ])('never reaches %s', (forbidden) => {
    expect(closure.filter((file) => file.startsWith(forbidden))).toEqual([])
  })

  it('never reaches supabaseShared, trustedServerRpc or trustedServerClient', () => {
    const text = closure.map((file) => readFileSync(join(sourceRoot, file), 'utf8')).join('\n')
    expect(text).not.toMatch(/supabaseShared|trustedServerRpc|trustedServerClient/)
  })

  it('runs the verified runtime adapter and never the identity client directly', () => {
    const component = readFileSync(entry, 'utf8')
    expect(component).toContain("from '../../study/production/verifiedRuntimeAdapter'")
    expect(component).not.toMatch(/studyIdentityClient|createStudyIdentityClient/)
    // No transport of its own: no fetch, no storage, no Supabase client.
    expect(component).not.toMatch(/\bfetch\s*\(|localStorage|sessionStorage|createClient/)
    expect(component).toContain('runtime.execute(')
  })

  it('leaves no mojibake in the surfaces this card wrote', () => {
    for (const file of [
      'components/study/VerifiedStudyDashboard.tsx',
      'study/production/verifiedDashboardContracts.ts',
    ]) {
      // Latin-1 supplement characters are how a mis-decoded UTF-8 ellipsis or
      // apostrophe shows up in this codebase.
      expect(readFileSync(join(sourceRoot, file), 'utf8')).not.toMatch(/[À-ÿ]/)
    }
    // The placeholder that carried one was deleted, not edited around.
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toContain('VerifiedProductionStudyHost')
    expect(app).not.toContain('Verified Study workspace')
  })
})
