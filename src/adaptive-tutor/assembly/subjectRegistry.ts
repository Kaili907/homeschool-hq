import { validateSubjectRegistration } from './descriptorValidation'
import type {
  AssemblyFailure,
  AssemblyResult,
  RegisteredSubjectSummary,
  TutorProgramDescriptor,
  TutorProgramLoader,
} from './types'

export interface ResolvedProgramRegistration {
  readonly subject: RegisteredSubjectSummary
  readonly program: TutorProgramDescriptor
  readonly loader: TutorProgramLoader
}

interface RegistryEntry {
  readonly summary: RegisteredSubjectSummary
  readonly loader: TutorProgramLoader
}

const validatedRegistries = new WeakSet<object>()

export interface AdaptiveTutorSubjectRegistry {
  listSubjects(): readonly RegisteredSubjectSummary[]
  resolve(subjectId: string, programId: string): AssemblyResult<ResolvedProgramRegistration>
}

class ValidatedAdaptiveTutorSubjectRegistry implements AdaptiveTutorSubjectRegistry {
  readonly #entries: ReadonlyMap<string, RegistryEntry>

  constructor(entries: ReadonlyMap<string, RegistryEntry>) {
    this.#entries = new Map(entries)
  }

  listSubjects(): readonly RegisteredSubjectSummary[] {
    return Object.freeze([...this.#entries.values()].map((entry) => entry.summary))
  }

  resolve(subjectId: string, programId: string): AssemblyResult<ResolvedProgramRegistration> {
    const entry = this.#entries.get(subjectId)
    if (!entry) {
      return {
        ok: false,
        failure: {
          stage: 'registry',
          code: 'UNKNOWN_SUBJECT',
          safeMessage: 'The requested tutor subject is not registered.',
          subjectId,
          programId,
        },
      }
    }
    if (entry.summary.availability.status === 'unavailable') {
      return {
        ok: false,
        failure: {
          stage: 'registry',
          code: 'SUBJECT_UNAVAILABLE',
          safeMessage: entry.summary.availability.failure.safeMessage,
          subjectId,
          programId,
        },
      }
    }
    const program = entry.summary.programs.find((item) => item.programId === programId)
    if (!program) {
      return {
        ok: false,
        failure: {
          stage: 'registry',
          code: 'UNKNOWN_PROGRAM',
          safeMessage: 'The requested tutor program is not registered for this subject.',
          subjectId,
          programId,
        },
      }
    }
    return {
      ok: true,
      value: Object.freeze({ subject: entry.summary, program, loader: entry.loader }),
    }
  }
}

export function createSubjectRegistry(
  candidates: readonly unknown[],
): AssemblyResult<AdaptiveTutorSubjectRegistry> {
  const entries = new Map<string, RegistryEntry>()
  const globalProgramIds = new Set<string>()
  for (const candidate of candidates) {
    const validated = validateSubjectRegistration(candidate)
    if (!validated.ok) return validated
    const { summary, loader } = validated.value
    if (entries.has(summary.subjectId)) {
      return {
        ok: false,
        failure: {
          stage: 'registry',
          code: 'DUPLICATE_SUBJECT_ID',
          safeMessage: 'The subject registry contains a duplicate subject identifier.',
          subjectId: summary.subjectId,
        },
      }
    }
    for (const program of summary.programs) {
      if (globalProgramIds.has(program.programId)) {
        return {
          ok: false,
          failure: {
            stage: 'registry',
            code: 'DUPLICATE_PROGRAM_ID',
            safeMessage: 'The subject registry contains a duplicate program identifier.',
            subjectId: summary.subjectId,
            programId: program.programId,
          },
        }
      }
      globalProgramIds.add(program.programId)
    }
    entries.set(summary.subjectId, Object.freeze({ summary, loader }))
  }
  const registry = new ValidatedAdaptiveTutorSubjectRegistry(entries)
  validatedRegistries.add(registry)
  return { ok: true, value: registry }
}

export function isValidatedSubjectRegistry(
  value: unknown,
): value is AdaptiveTutorSubjectRegistry {
  return typeof value === 'object' && value !== null && validatedRegistries.has(value)
}

export function registryFailure(failure: AssemblyFailure): AssemblyResult<never> {
  return { ok: false, failure }
}
