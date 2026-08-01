import {
  CORE_V02_CONTRACT_VERSION,
  type AssemblyFailure,
  type CoreGradeBand,
  type CoreSubject,
  type OptionalMediaCapability,
  type RegisteredSubjectSummary,
  type RequiredTutorCapability,
  type SubjectArtifactProvenance,
  type SubjectAvailability,
  type SubjectRegistrationInput,
  type TutorProgramDescriptor,
  type TutorProgramLoader,
} from './types'

const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER = /^\d+\.\d+\.\d+$/
const SHA256 = /^[a-f0-9]{64}$/
const SAFE_CODE = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/
const CORE_SUBJECTS = new Set<CoreSubject>([
  'math',
  'english',
  'science',
  'social-studies',
  'general',
])
const REQUIRED_CAPABILITIES = new Set<RequiredTutorCapability>([
  'core-runtime-validation',
  'keyboard-input',
  'displayed-text',
  'adult-review',
])
const OPTIONAL_MEDIA_CAPABILITIES = new Set<OptionalMediaCapability>([
  'audio',
  'image',
  'video',
])

interface ValidatedRegistration {
  readonly summary: RegisteredSubjectSummary
  readonly loader: TutorProgramLoader
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isSafeText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}

function malformed(safeMessage: string): AssemblyFailure {
  return {
    stage: 'registry',
    code: 'MALFORMED_DESCRIPTOR',
    safeMessage,
  }
}

function parseGradeBand(value: unknown): CoreGradeBand | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ['min', 'max', 'label'])) return undefined
  const { min, max, label } = value
  if (
    typeof min !== 'number' ||
    typeof max !== 'number' ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 12 ||
    min > max ||
    !isSafeText(label, 40)
  ) return undefined
  return Object.freeze({ min, max, label })
}

function parseProgram(value: unknown): TutorProgramDescriptor | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'programId',
      'displayName',
      'programVersion',
      'coreSubject',
      'gradeBand',
    ])
  ) return undefined
  const { programId, displayName, programVersion, coreSubject } = value
  const gradeBand = parseGradeBand(value.gradeBand)
  if (
    typeof programId !== 'string' ||
    !STABLE_ID.test(programId) ||
    programId.length > 120 ||
    !isSafeText(displayName, 200) ||
    typeof programVersion !== 'string' ||
    !SEMVER.test(programVersion) ||
    typeof coreSubject !== 'string' ||
    !CORE_SUBJECTS.has(coreSubject as CoreSubject) ||
    !gradeBand
  ) return undefined
  return Object.freeze({
    programId,
    displayName,
    programVersion,
    coreSubject: coreSubject as CoreSubject,
    gradeBand,
  })
}

function parseProvenance(value: unknown): SubjectArtifactProvenance | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined
  if (value.kind === 'frozen-artifact') {
    if (
      !hasOnlyKeys(value, ['kind', 'artifactName', 'sha256']) ||
      !isSafeText(value.artifactName, 240) ||
      value.artifactName.includes('/') ||
      value.artifactName.includes('\\') ||
      typeof value.sha256 !== 'string' ||
      !SHA256.test(value.sha256)
    ) return undefined
    return Object.freeze({
      kind: 'frozen-artifact',
      artifactName: value.artifactName,
      sha256: value.sha256,
    })
  }
  if (value.kind === 'build') {
    if (
      !hasOnlyKeys(value, ['kind', 'repositoryId', 'revision', 'buildId']) ||
      !isSafeText(value.repositoryId, 160) ||
      !isSafeText(value.revision, 120) ||
      !isSafeText(value.buildId, 120)
    ) return undefined
    return Object.freeze({
      kind: 'build',
      repositoryId: value.repositoryId,
      revision: value.revision,
      buildId: value.buildId,
    })
  }
  return undefined
}

function parseAvailability(value: unknown): SubjectAvailability | undefined {
  if (!isRecord(value) || typeof value.status !== 'string') return undefined
  if (value.status === 'available' && hasOnlyKeys(value, ['status'])) {
    return Object.freeze({ status: 'available' })
  }
  if (
    value.status === 'unavailable' &&
    hasOnlyKeys(value, ['status', 'failure']) &&
    isRecord(value.failure) &&
    hasOnlyKeys(value.failure, ['code', 'safeMessage']) &&
    typeof value.failure.code === 'string' &&
    SAFE_CODE.test(value.failure.code) &&
    isSafeText(value.failure.safeMessage, 300)
  ) {
    return Object.freeze({
      status: 'unavailable',
      failure: Object.freeze({
        code: value.failure.code,
        safeMessage: value.failure.safeMessage,
      }),
    })
  }
  return undefined
}

function parseUniqueList<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): readonly T[] | undefined {
  if (!Array.isArray(value)) return undefined
  const parsed: T[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item as T) || parsed.includes(item as T)) {
      return undefined
    }
    parsed.push(item as T)
  }
  return Object.freeze(parsed)
}

export function validateSubjectRegistration(
  candidate: unknown,
):
  | { readonly ok: true; readonly value: ValidatedRegistration }
  | { readonly ok: false; readonly failure: AssemblyFailure } {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, [
      'subjectId',
      'displayName',
      'packageVersion',
      'compatibleCoreContractVersion',
      'provenance',
      'programs',
      'requiredCapabilities',
      'optionalMediaCapabilities',
      'loaderEntryPoint',
      'loader',
      'availability',
    ])
  ) return { ok: false, failure: malformed('The subject descriptor shape is invalid.') }

  if (
    typeof candidate.compatibleCoreContractVersion !== 'string' ||
    candidate.compatibleCoreContractVersion !== CORE_V02_CONTRACT_VERSION
  ) {
    return {
      ok: false,
      failure: {
        stage: 'registry',
        code: 'UNSUPPORTED_CORE_VERSION',
        safeMessage: 'The subject does not declare the supported Tutor Core contract.',
      },
    }
  }

  if (typeof candidate.loader !== 'function') {
    return {
      ok: false,
      failure: {
        stage: 'registry',
        code: 'LOADER_UNAVAILABLE',
        safeMessage: 'The subject loader is unavailable.',
      },
    }
  }

  const provenance = parseProvenance(candidate.provenance)
  const availability = parseAvailability(candidate.availability)
  const requiredCapabilities = parseUniqueList(
    candidate.requiredCapabilities,
    REQUIRED_CAPABILITIES,
  )
  const optionalMediaCapabilities = parseUniqueList(
    candidate.optionalMediaCapabilities,
    OPTIONAL_MEDIA_CAPABILITIES,
  )
  const programs = Array.isArray(candidate.programs)
    ? candidate.programs.map(parseProgram)
    : []
  if (
    typeof candidate.subjectId !== 'string' ||
    !STABLE_ID.test(candidate.subjectId) ||
    candidate.subjectId.length > 120 ||
    !isSafeText(candidate.displayName, 200) ||
    typeof candidate.packageVersion !== 'string' ||
    !SEMVER.test(candidate.packageVersion) ||
    !provenance ||
    !availability ||
    !Array.isArray(candidate.programs) ||
    candidate.programs.length < 1 ||
    programs.some((program) => program === undefined) ||
    !requiredCapabilities ||
    !optionalMediaCapabilities ||
    typeof candidate.loaderEntryPoint !== 'string' ||
    !STABLE_ID.test(candidate.loaderEntryPoint) ||
    candidate.loaderEntryPoint.length > 120
  ) return { ok: false, failure: malformed('The subject descriptor contains invalid fields.') }

  const parsedPrograms = programs.filter(
    (program): program is TutorProgramDescriptor => program !== undefined,
  )
  if (new Set(parsedPrograms.map((program) => program.programId)).size !== parsedPrograms.length) {
    return {
      ok: false,
      failure: {
        stage: 'registry',
        code: 'DUPLICATE_PROGRAM_ID',
        safeMessage: 'A subject descriptor contains a duplicate program identifier.',
        subjectId: candidate.subjectId,
      },
    }
  }

  const summary: RegisteredSubjectSummary = Object.freeze({
    subjectId: candidate.subjectId,
    displayName: candidate.displayName,
    packageVersion: candidate.packageVersion,
    compatibleCoreContractVersion: CORE_V02_CONTRACT_VERSION,
    provenance,
    programs: Object.freeze(parsedPrograms),
    requiredCapabilities,
    optionalMediaCapabilities,
    loaderEntryPoint: candidate.loaderEntryPoint,
    availability,
  })
  return {
    ok: true,
    value: Object.freeze({
      summary,
      loader: candidate.loader as SubjectRegistrationInput['loader'],
    }),
  }
}
