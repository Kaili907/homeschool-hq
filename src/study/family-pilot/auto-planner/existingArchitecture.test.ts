import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Profile } from '../../../types'
import { learnerFromProfile } from './existingArchitecture'

describe('Family Auto Planner existing-architecture boundary', () => {
  it('projects Profile working levels and course assignments without changing nominal grade', () => {
    const profile = {
      id: 'learner:ada',
      name: 'Ada',
      grade: '6',
      workingLevels: { mathematics: '5' },
      academy: { courseIds: ['ma-g5-mathematics'] },
    } as unknown as Profile
    const before = structuredClone(profile)
    expect(learnerFromProfile(profile)).toEqual({
      learnerRef: 'learner:ada',
      displayName: 'Ada',
      nominalGrade: '6',
      workingGradeBySubject: { mathematics: '5' },
      enabledSubjects: ['mathematics'],
      assignedCourseRefs: ['ma-g5-mathematics'],
    })
    expect(profile).toEqual(before)
  })

  it('keeps production modules browser-safe and outside Tutor implementation', () => {
    const files = [
      'clock.ts', 'coordinator.ts', 'dashboardPort.ts', 'existingArchitecture.ts',
      'index.ts', 'indexedDbStore.ts', 'plan.ts', 'ports.ts', 'studyPort.ts', 'types.ts',
    ]
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
    expect(source).not.toMatch(/from ['"]node:/)
    expect(source).not.toContain('/testing/')
    expect(source).not.toContain('TutorV2')
    expect(source).not.toContain('Math.random')
  })
})
