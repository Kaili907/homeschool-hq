import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = process.cwd()
const read = (path: string) => readFileSync(join(sourceRoot, path), 'utf8')

describe('mounted Study progression route', () => {
  it('keeps calendar mutation behind the one Study authority module', () => {
    const container = read('src/components/study/StudySessionContainer.tsx')
    const authority = read('src/study/progressionAuthority.ts')
    expect(container).not.toMatch(/\.calendar\.completeCurrentSegment\s*\(/)
    expect(container.match(/applyStudyProgression\s*\(/g)).toHaveLength(2)
    expect(authority.match(/\.calendar\.completeCurrentSegment\s*\(/g)).toHaveLength(1)
  })

  it('mounts one Tutor facade in the preview route and no Tutor progression in the production dashboard host', () => {
    const container = read('src/components/study/StudySessionContainer.tsx')
    const route = read('src/components/study/StudySessionRoute.tsx')
    const app = read('src/App.tsx')
    expect(container.match(/new AcceptedRc1HostRuntime\s*\(/g)).toHaveLength(1)
    expect(route.match(/<StudySessionContainer\b/g)).toHaveLength(1)
    expect(app).toMatch(/const StudySessionRoute = import\.meta\.env\.DEV/)
    const productionHost = app.slice(app.indexOf('function VerifiedProductionStudyHost'), app.indexOf('function AcademyRouteLoading'))
    expect(productionHost).toContain("operation: 'dashboard:read'")
    expect(productionHost).not.toMatch(/Tutor|completeCurrentSegment|session:transition/)
  })
})
