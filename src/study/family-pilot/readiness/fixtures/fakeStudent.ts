import type { StudentConfiguration } from '../types'

/** Builds a StudentConfiguration for tests, defaulting unset fields. */
export function createFakeStudent(
  overrides: Partial<StudentConfiguration> & Pick<StudentConfiguration, 'studentRef' | 'displayName'>,
): StudentConfiguration {
  return {
    nominalGrade: 5,
    enabledSubjects: [],
    workingGradeBySubject: {},
    ...overrides,
  }
}
