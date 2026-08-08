export const CURRICULUM_VALIDATION_CAPABILITY = 'curriculum:read' as const

export const VALIDATION_CATEGORY_IDS = [
  'schema',
  'manifest',
  'checksums',
  'references',
  'identifiers',
  'completeness',
  'standards',
  'build',
  'frozen-references',
  'version-consistency',
] as const

export type ValidationCategoryId = (typeof VALIDATION_CATEGORY_IDS)[number]
export type ValidationCheckState = 'not_checked' | 'passed' | 'warning' | 'failed'
export type CurriculumValidationStatus =
  | 'pass'
  | 'pass_with_warnings'
  | 'fail'
  | 'unknown'

export interface ValidationScope {
  readonly grade?: string
  readonly course?: string
  readonly unit?: string
  readonly lesson?: string
  readonly reference?: string
}

export interface ValidationFinding {
  readonly id: string
  readonly category: ValidationCategoryId
  readonly check: string
  readonly state: Exclude<ValidationCheckState, 'not_checked'>
  readonly detail: string
  readonly scope: ValidationScope
  readonly source: string
}

export interface ValidationCategory {
  readonly id: ValidationCategoryId
  readonly label: string
  readonly state: ValidationCheckState
  readonly findings: readonly ValidationFinding[]
}

export interface StandardsCoverageRow {
  readonly standard: string
  readonly lessonRefs: readonly string[]
  readonly assessmentRefs: readonly string[]
  readonly state: 'covered' | 'gap'
}

export interface CurriculumValidationReadModel {
  readonly status: CurriculumValidationStatus
  readonly packageId: string | null
  readonly curriculumVersion: string | null
  readonly validationArtifactVersion: string | null
  readonly validatedAt: string | null
  readonly summary: {
    readonly checked: number
    readonly passed: number
    readonly warnings: number
    readonly failed: number
    readonly notChecked: number
  }
  readonly categories: readonly ValidationCategory[]
  readonly coverage: readonly StandardsCoverageRow[]
  readonly sources: readonly string[]
  readonly evidenceError: string | null
}

export interface CurriculumValidationEvidenceBundle {
  readonly validation?: unknown
  readonly curriculumManifest?: unknown
  readonly packageManifest?: unknown
  readonly checksumManifest?: unknown
  readonly manifestVerification?: unknown
  readonly coverage?: unknown
}

const CATEGORY_LABELS: Readonly<Record<ValidationCategoryId, string>> = {
  schema: 'Schema validation',
  manifest: 'Manifest validation',
  checksums: 'Checksums and hashes',
  references: 'References and indexes',
  identifiers: 'Identifiers',
  completeness: 'Curriculum completeness',
  standards: 'Standards mapping',
  build: 'Generator and build validation',
  'frozen-references': 'Frozen artifact references',
  'version-consistency': 'Version consistency',
}

const VALIDATION_SOURCE = 'validation/validation.json'
const CURRICULUM_MANIFEST_SOURCE = 'curriculum-manifest.json'
const PACKAGE_MANIFEST_SOURCE = 'MANIFEST.json'
const CHECKSUM_SOURCE = 'SHA256SUMS.txt'
const MANIFEST_VERIFICATION_SOURCE = 'validation/manifest-verification.txt'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeString(value: unknown, maxLength = 280): string | null {
  if (typeof value !== 'string') return null
  if (/\r?\n\s*at\s|\bat\s+\S+\s*\(|[A-Za-z]:\\|(?:\/Users|\/home)\//.test(value)) {
    return 'Unsafe technical detail omitted.'
  }
  const oneLine = value.replaceAll(/[\r\n\t]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
  if (!oneLine) return null
  return oneLine.slice(0, maxLength)
}

function safeRef(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const ref = safeString(value, 100)
  return ref ?? undefined
}

function checkCategory(check: string): ValidationCategoryId {
  const value = check.toLowerCase()
  if (/schema|malformed/.test(value)) return 'schema'
  if (/checksum|sha|hash/.test(value)) return 'checksums'
  if (/manifest/.test(value)) return 'manifest'
  if (/frozen|baseline/.test(value)) return 'frozen-references'
  if (/standard|coverage|pf1|pf7/.test(value)) return 'standards'
  if (/reference|schedule|index|missing-(lesson|unit|assessment)/.test(value)) return 'references'
  if (/unique|duplicate|invalid-id|identifier/.test(value)) return 'identifiers'
  if (/generator|build/.test(value)) return 'build'
  if (/version/.test(value)) return 'version-consistency'
  return 'completeness'
}

function checkState(value: unknown): Exclude<ValidationCheckState, 'not_checked'> | null {
  if (typeof value !== 'string') return null
  switch (value.trim().toUpperCase()) {
    case 'PASS':
    case 'PASSED':
      return 'passed'
    case 'WARN':
    case 'WARNING':
    case 'PASS WITH WARNINGS':
      return 'warning'
    case 'FAIL':
    case 'FAILED':
    case 'ERROR':
      return 'failed'
    default:
      return null
  }
}

function scopeFrom(raw: Record<string, unknown>): ValidationScope {
  const affected = isRecord(raw.affected) ? raw.affected : raw
  return {
    grade: safeRef(affected.grade),
    course: safeRef(affected.course ?? affected.course_id),
    unit: safeRef(affected.unit ?? affected.unit_id),
    lesson: safeRef(affected.lesson ?? affected.lesson_id),
    reference: safeRef(affected.reference ?? affected.path),
  }
}

function findingFromCheck(raw: unknown, index: number): ValidationFinding | null {
  if (!isRecord(raw)) return null
  const check = safeString(raw.check ?? raw.name, 100)
  const state = checkState(raw.result ?? raw.status)
  if (!check || !state) return null
  return {
    id: `${check.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${index}`,
    category: checkCategory(check),
    check,
    state,
    detail: safeString(raw.details ?? raw.detail ?? raw.message) ?? 'No additional detail recorded.',
    scope: scopeFrom(raw),
    source: safeString(raw.source, 160) ?? VALIDATION_SOURCE,
  }
}

function versionOf(value: unknown): string | null {
  return isRecord(value) ? safeString(value.version, 50) : null
}

function parseManifestVerification(value: unknown): ValidationFinding | null {
  if (typeof value !== 'string') return null
  const state = checkState(/:\s*([^\r\n]+)/.exec(value)?.[1])
  if (!state) return null
  const files = /Files checked:\s*(\d+)/i.exec(value)?.[1]
  return {
    id: 'content-manifest-verification',
    category: 'manifest',
    check: 'Content manifest verification',
    state,
    detail: files ? `${files} files were recorded as checked.` : 'Manifest verification result recorded.',
    scope: {},
    source: MANIFEST_VERIFICATION_SOURCE,
  }
}

function parseChecksumRows(value: unknown): Map<string, string> | null {
  if (typeof value !== 'string') return null
  const rows = new Map<string, string>()
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
    if (!match) return null
    rows.set(match[2], match[1])
  }
  return rows.size ? rows : null
}

function checksumConsistency(
  packageManifest: unknown,
  checksumManifest: unknown,
): ValidationFinding | null {
  if (!isRecord(packageManifest) || !Array.isArray(packageManifest.files)) return null
  const checksums = parseChecksumRows(checksumManifest)
  if (!checksums) return null
  const mismatches: string[] = []
  let compared = 0
  for (const item of packageManifest.files) {
    if (!isRecord(item)) continue
    const path = safeString(item.path, 180)
    const hash = safeString(item.sha256, 64)
    if (!path || !hash) continue
    compared++
    if (checksums.get(path) !== hash) mismatches.push(path)
  }
  if (!compared) return null
  return {
    id: 'checksum-declaration-consistency',
    category: 'checksums',
    check: 'Checksum declaration consistency',
    state: mismatches.length ? 'failed' : 'passed',
    detail: mismatches.length
      ? `${mismatches.length} declaration mismatch(es), including ${mismatches.slice(0, 3).join(', ')}.`
      : `${compared} package hash declarations match ${CHECKSUM_SOURCE}; file bytes were not recomputed by this dashboard.`,
    scope: mismatches[0] ? { reference: mismatches[0] } : {},
    source: `${PACKAGE_MANIFEST_SOURCE}; ${CHECKSUM_SOURCE}`,
  }
}

function versionConsistency(bundle: CurriculumValidationEvidenceBundle): ValidationFinding | null {
  const versions: ReadonlyArray<readonly [string, string | null]> = [
    [VALIDATION_SOURCE, versionOf(bundle.validation)],
    [CURRICULUM_MANIFEST_SOURCE, versionOf(bundle.curriculumManifest)],
    [PACKAGE_MANIFEST_SOURCE, versionOf(bundle.packageManifest)],
  ]
  const recorded = versions.filter((entry): entry is readonly [string, string] => entry[1] !== null)
  if (recorded.length < 2) return null
  const unique = new Set(recorded.map(([, version]) => version))
  return {
    id: 'curriculum-version-consistency',
    category: 'version-consistency',
    check: 'Curriculum version consistency',
    state: unique.size === 1 ? 'passed' : 'failed',
    detail: unique.size === 1
      ? `Recorded version ${recorded[0][1]} agrees across ${recorded.length} artifacts.`
      : `Conflicting recorded versions: ${recorded.map(([source, version]) => `${source}=${version}`).join(', ')}.`,
    scope: {},
    source: recorded.map(([source]) => source).join('; '),
  }
}

function parseCoverage(value: unknown): StandardsCoverageRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw): StandardsCoverageRow[] => {
    if (!isRecord(raw)) return []
    const standard = safeString(raw.standard, 100)
    if (!standard) return []
    const refs = (candidate: unknown) => Array.isArray(candidate)
      ? candidate.flatMap((item) => safeRef(item) ?? [])
      : []
    const lessonRefs = refs(raw.lessonRefs ?? raw.lessons)
    const assessmentRefs = refs(raw.assessmentRefs ?? raw.assessments)
    return [{
      standard,
      lessonRefs,
      assessmentRefs,
      state: raw.state === 'gap' || lessonRefs.length === 0 || assessmentRefs.length === 0
        ? 'gap'
        : 'covered',
    }]
  })
}

function aggregateState(findings: readonly ValidationFinding[]): ValidationCheckState {
  if (!findings.length) return 'not_checked'
  if (findings.some((finding) => finding.state === 'failed')) return 'failed'
  if (findings.some((finding) => finding.state === 'warning')) return 'warning'
  return 'passed'
}

export function buildCurriculumValidationReadModel(
  bundle: CurriculumValidationEvidenceBundle,
): CurriculumValidationReadModel {
  const validation = bundle.validation
  const malformedValidation = validation !== undefined && (
    !isRecord(validation) || !Array.isArray(validation.checks)
  )
  const validationChecks = isRecord(validation) && Array.isArray(validation.checks)
    ? validation.checks
    : []
  const parsedValidationFindings = validationChecks.map(findingFromCheck)
  const malformedChecks = parsedValidationFindings.some((finding) => finding === null)
  const findings = parsedValidationFindings.filter(
    (finding): finding is ValidationFinding => finding !== null,
  )
  const manifestFinding = parseManifestVerification(bundle.manifestVerification)
  if (manifestFinding) findings.push(manifestFinding)
  const checksumFinding = checksumConsistency(bundle.packageManifest, bundle.checksumManifest)
  if (checksumFinding) findings.push(checksumFinding)
  const versionFinding = versionConsistency(bundle)
  if (versionFinding) findings.push(versionFinding)

  const categories = VALIDATION_CATEGORY_IDS.map((id): ValidationCategory => {
    const categoryFindings = findings.filter((finding) => finding.category === id)
    return { id, label: CATEGORY_LABELS[id], state: aggregateState(categoryFindings), findings: categoryFindings }
  })
  const recordedOverall = isRecord(validation) ? checkState(validation.overall) : null
  const hasValidationChecks = validationChecks.length > 0 && findings.some((finding) => finding.source === VALIDATION_SOURCE)
  const status: CurriculumValidationStatus = malformedValidation || malformedChecks || !hasValidationChecks
    ? 'unknown'
    : findings.some((finding) => finding.state === 'failed') || recordedOverall === 'failed'
      ? 'fail'
      : findings.some((finding) => finding.state === 'warning') || recordedOverall === 'warning'
        ? 'pass_with_warnings'
        : recordedOverall === 'passed' && parsedValidationFindings.every((finding) => finding?.state === 'passed')
          ? 'pass'
          : 'unknown'
  const stateCounts = categories.reduce(
    (counts, category) => ({ ...counts, [category.state]: counts[category.state] + 1 }),
    { not_checked: 0, passed: 0, warning: 0, failed: 0 },
  )
  const manifest = isRecord(bundle.curriculumManifest) ? bundle.curriculumManifest : null
  const validationRecord = isRecord(validation) ? validation : null

  return {
    status,
    packageId: safeString(validationRecord?.package_id ?? manifest?.package_id, 120),
    curriculumVersion: versionOf(validation) ?? versionOf(bundle.curriculumManifest) ?? versionOf(bundle.packageManifest),
    validationArtifactVersion: safeString(validationRecord?.artifact_version ?? validationRecord?.schema_version, 50),
    validatedAt: safeString(validationRecord?.validated_at ?? validationRecord?.validated_on, 50),
    summary: {
      checked: stateCounts.passed + stateCounts.warning + stateCounts.failed,
      passed: stateCounts.passed,
      warnings: stateCounts.warning,
      failed: stateCounts.failed,
      notChecked: stateCounts.not_checked,
    },
    categories,
    coverage: parseCoverage(bundle.coverage),
    sources: [...new Set(findings.map((finding) => finding.source))],
    evidenceError: malformedValidation || malformedChecks
      ? 'Validation evidence could not be interpreted safely.'
      : null,
  }
}
