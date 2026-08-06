import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

// A6-5-C — the safety record is adult-only. It is rendered from the parent-PIN
// gated Parent Hub and must stay unreachable from any student-facing surface.

// The adult-only surface is A6-4's panel, now the single Safety panel. The
// ledger module itself is deliberately NOT asserted absent: the student path
// legitimately writes to it — only the parent-facing rendering is boundaried.
const PANEL_MODULE = /StudyLocalSafetyStopsPanel/

function readAll(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => readFileSync(join(directory, entry.name), 'utf8'))
    .join('\n')
}

describe('A6-5-C adult-only safety surface boundary', () => {
  it('is rendered by the parent-PIN gated Parent Hub', () => {
    const hub = readFileSync(join(here, 'ParentHub.tsx'), 'utf8')
    expect(hub).toMatch(PANEL_MODULE)
    expect(hub).toContain("tab === 'safety'")
    expect(hub.match(/\{ id: 'safety' as const, label: 'Safety'/g)).toHaveLength(1)
    expect(hub).not.toContain("tabs.push({ id: 'safety'")
  })

  it('is not reachable from any student-facing Study component', () => {
    const studentSurfaces = readAll(join(sourceRoot, 'components', 'study'))
    expect(studentSurfaces).not.toMatch(PANEL_MODULE)
  })

  it('is not reachable from the Study runtime, ports or safety modules the student path uses', () => {
    const studyRoot = join(sourceRoot, 'study')
    const runtimeText = [
      readAll(studyRoot),
      readAll(join(studyRoot, 'safety')),
      readAll(join(studyRoot, 'production')),
    ].join('\n')
    expect(runtimeText).not.toMatch(PANEL_MODULE)
  })

  it('is not statically imported by the app root, which also serves the student picker', () => {
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(PANEL_MODULE)
  })
})
