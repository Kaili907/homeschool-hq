import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { StudyDashboardPorts, StudyParentControlPorts, StudySettingsPorts } from './ports'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * FULL_BUNDLE_STILL_UNSUPPORTED.
 *
 * The three narrow contracts are building blocks, not a production bundle. None
 * of them carries the safety role — the compiler asserts that here — so nothing
 * composed purely from them can supply it. A complete StudyPortBundle is still
 * produced only by the local-development and mounted preview factories.
 */
// @ts-expect-error the learner dashboard contract cannot supply the safety role
type DashboardExcludesSafety = StudyDashboardPorts['safety']
// @ts-expect-error the learner settings contract cannot supply the safety role
type SettingsExcludesSafety = StudySettingsPorts['safety']
// @ts-expect-error the parent control contract cannot supply the safety role
type ParentControlExcludesSafety = StudyParentControlPorts['safety']

/**
 * StudyDashboardPorts, StudySettingsPorts, and StudyParentControlPorts narrow
 * what each surface may reach, but a cast at the place the ports are handed over
 * erases that narrowing without the compiler objecting. Nothing else in the
 * repository would notice.
 *
 * This guard covers exactly the four sites that supply those three contracts. It
 * is not a repository sweep: StudySessionContainer still requires the whole
 * StudyPortBundle and casts to it, which is pre-existing and outside this card.
 * The final test holds that exclusion in place.
 */
const BANNED_CASTS = [
  /\bas\s+any\b/,
  /\bas\s+unknown\s+as\s+StudyPortBundle\b/,
  /\bas\s+StudyPortBundle\b/,
]

const read = (relativePath: string) =>
  readFileSync(join(sourceRoot, relativePath), 'utf8').replaceAll('\r\n', '\n')

const occurrencesOf = (source: string, marker: string) => source.split(marker).length - 1

/**
 * The opening tag of a JSX element, brace-aware so a prop body — including the
 * `>` of an arrow function — stays inside the slice instead of ending it.
 */
function openingTag(source: string, element: string): string {
  const marker = `<${element}`
  const found = occurrencesOf(source, marker)
  if (found !== 1) throw new Error(`expected exactly one ${marker} injection site, found ${found}`)
  const start = source.indexOf(marker)
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (character === '{') depth += 1
    else if (character === '}') depth -= 1
    else if (character === '>' && depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`unterminated ${marker} opening tag`)
}

/** The argument list of a construction site, paren-aware for the same reason. */
function constructorArguments(source: string, className: string): string {
  const marker = `new ${className}(`
  const found = occurrencesOf(source, marker)
  if (found !== 1) throw new Error(`expected exactly one ${marker} construction site, found ${found}`)
  const start = source.indexOf(marker) + marker.length - 1
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (character === '(') depth += 1
    else if (character === ')') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`unterminated ${marker} argument list`)
}

const COVERED_FILES = ['App.tsx', 'components/hub/ParentHub.tsx', 'components/hub/StudyParentPanel.tsx'] as const

/**
 * `injected` is the anti-false-negative control: without it a truncated or
 * misaimed slice would satisfy the cast assertions vacuously. It deliberately
 * stops before the closing brace so that a cast leaves it satisfied — the banned
 * pattern is then what reports the failure, and the two assertions keep separate
 * jobs: "this is the right site" and "the right site is clean".
 */
const injectionSites = [
  {
    label: 'App hands StudyDashboard the runtime ports',
    contract: 'StudyDashboardPorts',
    extract: () => openingTag(read('App.tsx'), 'StudyDashboard'),
    injected: 'ports={studyRuntime.ports',
  },
  {
    label: 'App hands StudySettings the runtime ports',
    contract: 'StudySettingsPorts',
    extract: () => openingTag(read('App.tsx'), 'StudySettings'),
    injected: 'ports={studyRuntime.ports',
  },
  {
    label: 'ParentHub hands StudyParentPanel the household ports',
    contract: 'StudyParentControlPorts',
    extract: () => openingTag(read('components/hub/ParentHub.tsx'), 'StudyParentPanel'),
    injected: 'ports={study.ports',
  },
  {
    label: 'StudyParentPanel hands StudyParentController its own ports',
    contract: 'StudyParentControlPorts',
    extract: () => constructorArguments(read('components/hub/StudyParentPanel.tsx'), 'StudyParentController'),
    injected: '(ports',
  },
] as const

describe('narrowed Study consumer contracts survive their injection sites', () => {
  it.each(injectionSites)('$label without erasing $contract', ({ extract, injected }) => {
    const site = extract()
    expect(site).toContain(injected)
    for (const cast of BANNED_CASTS) expect(site, `cast at injection site: ${site}`).not.toMatch(cast)
  })

  it('stays narrow instead of sweeping the pre-existing StudySessionContainer casts', () => {
    const container = read('components/study/StudySessionContainer.tsx')
    // The container genuinely requires all nine roles and casts to reach them.
    // A repository-wide ban would fail here, which is why this guard names files.
    expect((container.match(/\bas StudyPortBundle\b/g) ?? []).length).toBeGreaterThan(0)
    expect(COVERED_FILES).not.toContain('components/study/StudySessionContainer.tsx')
  })

  it('pins FULL_BUNDLE_STILL_UNSUPPORTED: no production module composes a complete bundle', () => {
    const productionDirectory = join(sourceRoot, 'study', 'production')
    const productionText = readdirSync(productionDirectory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(productionDirectory, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/StudyPortBundle/)
  })
})
