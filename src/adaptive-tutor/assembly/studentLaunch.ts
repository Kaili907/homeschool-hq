import type { Profile } from '../../types'
import { assembleAdaptiveTutorRuntime, type AdaptiveTutorRuntime } from './engineRuntime'
import type { AdaptiveTutorSubjectRegistry } from './subjectRegistry'
import type {
  AssemblyResult,
  CoreGradeBand,
  CoreV02RuntimeAdapter,
  TutorProgramLoadRequest,
} from './types'
import { loadValidatedProgram } from './validatedProgramLoader'

export interface TutorLaunchRequest extends TutorProgramLoadRequest {
  /** Resolved by App's existing active-profile guard; never looked up by the assembly. */
  readonly activeProfile: Readonly<Pick<Profile, 'id' | 'grade'>> | null
}

export interface TutorLaunchSession {
  readonly instructionalGrade: number
  readonly runtime: StudentAdaptiveTutorRuntime
  exit(): void
}

export type StudentAdaptiveTutorRuntime = Omit<AdaptiveTutorRuntime, 'getAdultReview'>

export interface AdaptiveTutorLaunchCoordinator {
  launch(request: Readonly<TutorLaunchRequest>): Promise<AssemblyResult<TutorLaunchSession>>
  cancel(): void
}

function hostGradeToInstructionalGrade(grade: Profile['grade']): number | undefined {
  switch (grade) {
    case '3': return 3
    case '4': return 4
    case '6': return 6
    case '10': return 10
    case '12': return 12
  }
}

export function gradeIsWithinBand(grade: number, band: CoreGradeBand): boolean {
  return Number.isInteger(grade) && grade >= band.min && grade <= band.max
}

export async function launchAdaptiveTutor(
  registry: AdaptiveTutorSubjectRegistry,
  core: CoreV02RuntimeAdapter,
  request: Readonly<TutorLaunchRequest>,
  isCurrent: () => boolean = () => true,
): Promise<AssemblyResult<TutorLaunchSession>> {
  if (!request.activeProfile) {
    return {
      ok: false,
      failure: {
        stage: 'launch',
        code: 'NO_ACTIVE_PROFILE',
        safeMessage: 'Choose an active student profile before opening the tutor.',
        subjectId: request.subjectId,
        programId: request.programId,
      },
    }
  }
  const instructionalGrade = hostGradeToInstructionalGrade(request.activeProfile.grade)
  if (instructionalGrade === undefined) {
    return {
      ok: false,
      failure: {
        stage: 'launch',
        code: 'PROFILE_GRADE_UNSUPPORTED',
        safeMessage: 'This profile grade is not supported by the tutor launch boundary.',
        subjectId: request.subjectId,
        programId: request.programId,
      },
    }
  }

  const loaded = await loadValidatedProgram(registry, core, {
    subjectId: request.subjectId,
    programId: request.programId,
  })
  if (!loaded.ok) return loaded
  if (!isCurrent()) {
    return {
      ok: false,
      failure: {
        stage: 'launch',
        code: 'STALE_LAUNCH',
        safeMessage: 'This tutor launch was cancelled before it became active.',
        subjectId: request.subjectId,
        programId: request.programId,
      },
    }
  }
  if (!gradeIsWithinBand(instructionalGrade, loaded.value.gradeBand)) {
    return {
      ok: false,
      failure: {
        stage: 'launch',
        code: 'GRADE_OUTSIDE_PROGRAM_BAND',
        safeMessage: 'The selected program does not support this profile grade.',
        subjectId: request.subjectId,
        programId: request.programId,
      },
    }
  }

  const assembled = assembleAdaptiveTutorRuntime(core, loaded.value)
  if (!assembled.ok) return assembled
  const runtime: StudentAdaptiveTutorRuntime = Object.freeze({
    launchId: assembled.value.launchId,
    subjectId: assembled.value.subjectId,
    programId: assembled.value.programId,
    get status() {
      return assembled.value.status
    },
    start: () => assembled.value.start(),
    submit: (input) => assembled.value.submit(input),
    continueLesson: () => assembled.value.continueLesson(),
    requestAlternateExplanation: () => assembled.value.requestAlternateExplanation(),
    reset: () => assembled.value.reset(),
    dispose: () => assembled.value.dispose(),
  })
  const session: TutorLaunchSession = Object.freeze({
    instructionalGrade,
    runtime,
    exit: () => assembled.value.dispose(),
  })
  return { ok: true, value: session }
}

/**
 * Component-lifetime coordinator. A profile/route change calls cancel (or starts
 * another launch), which prevents a late loader result from crossing students.
 */
export function createAdaptiveTutorLaunchCoordinator(
  registry: AdaptiveTutorSubjectRegistry,
  core: CoreV02RuntimeAdapter,
): AdaptiveTutorLaunchCoordinator {
  let generation = 0
  let active: TutorLaunchSession | undefined
  return {
    launch: async (request) => {
      const currentGeneration = ++generation
      active?.exit()
      active = undefined
      const result = await launchAdaptiveTutor(
        registry,
        core,
        request,
        () => currentGeneration === generation,
      )
      if (currentGeneration !== generation) {
        if (result.ok) result.value.exit()
        return {
          ok: false,
          failure: {
            stage: 'launch',
            code: 'STALE_LAUNCH',
            safeMessage: 'This tutor launch was cancelled before it became active.',
            subjectId: request.subjectId,
            programId: request.programId,
          },
        }
      }
      if (result.ok) active = result.value
      return result
    },
    cancel: () => {
      generation += 1
      active?.exit()
      active = undefined
    },
  }
}
