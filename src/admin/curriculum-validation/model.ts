export const CURRICULUM_VALIDATION_CAPABILITY = 'curriculum:read' as const

export const ADMIN_CURRICULUM_GOVERNANCE_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12] as const

const ADMIN_CURRICULUM_GOVERNANCE_GRADE_SET = new Set<number>(ADMIN_CURRICULUM_GOVERNANCE_GRADES)
const COURSE_REFERENCE = /^ma-g(1[0-2]|[1-9])-[a-z0-9]+(?:-[a-z0-9]+)*$/
const UNIT_REFERENCE = /^(?:ma-g(1[0-2]|[1-9])-[a-z0-9]+(?:-[a-z0-9]+)*-)?u\d{2}$/
const LESSON_REFERENCE = /^ma-g(1[0-2]|[1-9])-[a-z0-9]+(?:-[a-z0-9]+)*-u\d{2}-l\d{2}$/
const ASSESSMENT_REFERENCE = /^ma-g(1[0-2]|[1-9])-[a-z0-9]+(?:-[a-z0-9]+)*-u\d{2}-assessment$/

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
  readonly validationReportedCurriculumVersion: string | null
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

interface FindingPresentation {
  readonly category: ValidationCategoryId
  readonly label: string
  readonly subject: string
}

const KNOWN_FINDINGS: Readonly<Record<string, FindingPresentation>> = {
  'three-grades': { category: 'completeness', label: 'Recorded grade set', subject: 'The grade set recorded by this legacy validation artifact' },
  'nine-grades': { category: 'completeness', label: 'Expected grade set', subject: 'The expected curriculum grade set' },
  'expected-grade-set': { category: 'completeness', label: 'Expected grade set', subject: 'The expected curriculum grade set' },
  'ten-courses-per-grade': { category: 'completeness', label: 'Courses per grade', subject: 'Course totals for each grade' },
  'course-count': { category: 'completeness', label: 'Course count', subject: 'The package course count' },
  'lesson-count': { category: 'completeness', label: 'Lesson count', subject: 'The package lesson count' },
  'grade-lesson-counts': { category: 'completeness', label: 'Lessons per grade', subject: 'Lesson totals for each grade' },
  'unique-course-ids': { category: 'identifiers', label: 'Unique course identifiers', subject: 'Course identifier uniqueness' },
  'unique-unit-ids': { category: 'identifiers', label: 'Unique unit identifiers', subject: 'Unit identifier uniqueness' },
  'unique-lesson-ids': { category: 'identifiers', label: 'Unique lesson identifiers', subject: 'Lesson identifier uniqueness' },
  'duplicate-course-id': { category: 'identifiers', label: 'Duplicate course identifiers', subject: 'Course identifier uniqueness' },
  'duplicate-unit-id': { category: 'identifiers', label: 'Duplicate unit identifiers', subject: 'Unit identifier uniqueness' },
  'duplicate-lesson-id': { category: 'identifiers', label: 'Duplicate lesson identifiers', subject: 'Lesson identifier uniqueness' },
  'invalid-id': { category: 'identifiers', label: 'Identifier format', subject: 'Curriculum identifier formatting' },
  'schedule-covers-every-lesson-once': { category: 'references', label: 'Schedule lesson coverage', subject: 'Schedule-to-lesson reference coverage' },
  'broken-reference': { category: 'references', label: 'Reference integrity', subject: 'Curriculum reference integrity' },
  'missing-reference': { category: 'references', label: 'Required references', subject: 'Required curriculum references' },
  'missing-lesson': { category: 'references', label: 'Required lessons', subject: 'Required lesson references' },
  'missing-unit': { category: 'references', label: 'Required units', subject: 'Required unit references' },
  'missing-assessment': { category: 'references', label: 'Required assessments', subject: 'Required assessment references' },
  'schema-validation': { category: 'schema', label: 'Lesson schema validation', subject: 'Lesson schema validation' },
  'lesson-required-fields': { category: 'completeness', label: 'Required lesson fields', subject: 'Required lesson fields' },
  'optional-media-and-fallback': { category: 'completeness', label: 'Optional media fallbacks', subject: 'Optional media fallback coverage' },
  'accessibility-depth': { category: 'completeness', label: 'Accessibility requirements', subject: 'Lesson accessibility requirements' },
  'safety-depth': { category: 'completeness', label: 'Safety requirements', subject: 'Lesson safety requirements' },
  'multi-occasion-mastery': { category: 'completeness', label: 'Multi-occasion mastery', subject: 'Multi-occasion mastery requirements' },
  'original-text-count': { category: 'completeness', label: 'Original text count', subject: 'The original practice text count' },
  'frozen-baselines-recorded': { category: 'frozen-references', label: 'Frozen baselines', subject: 'Frozen baseline references' },
  'frozen-reference-verification': { category: 'frozen-references', label: 'Frozen reference verification', subject: 'Frozen artifact reference verification' },
  'grade8-finance-pf1-pf7': { category: 'standards', label: 'Grade 8 finance PF1–PF7', subject: 'Grade 8 finance PF1–PF7 mapping' },
  'grade8-finance-72-sessions': { category: 'completeness', label: 'Grade 8 finance sessions', subject: 'The Grade 8 finance session count' },
  'standards-coverage': { category: 'standards', label: 'Standards coverage', subject: 'Recorded standards coverage' },
  'generator-validation': { category: 'build', label: 'Generator validation', subject: 'Curriculum generator validation' },
  'build-validation': { category: 'build', label: 'Build validation', subject: 'Curriculum build validation' },
  'no-required-photo-or-voice': { category: 'completeness', label: 'Photo and voice fallback', subject: 'No-photo and no-voice fallback requirements' },
}

function findingDetail(
  presentation: FindingPresentation | null,
  state: Exclude<ValidationCheckState, 'not_checked'>,
): string {
  if (!presentation) {
    if (state === 'passed') return 'An unrecognized validation check reported a pass; unvetted details were omitted.'
    if (state === 'warning') return 'An unrecognized validation check reported a warning; unvetted details were omitted.'
    return 'An unrecognized validation check reported a failure; unvetted details were omitted.'
  }
  if (state === 'passed') return `${presentation.subject} passed the recorded check.`
  if (state === 'warning') return `${presentation.subject} completed with a recorded warning.`
  return `${presentation.subject} failed the recorded check.`
}

function normalizedFindingCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : null
}

function safeGrade(value: unknown): string | undefined {
  const grade = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^(?:1[0-2]|[1-9])$/.test(value)
      ? Number(value)
      : Number.NaN
  return Number.isSafeInteger(grade) && ADMIN_CURRICULUM_GOVERNANCE_GRADE_SET.has(grade)
    ? String(grade)
    : undefined
}

export function curriculumGovernanceGradeFromReference(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^ma-g(1[0-2]|[1-9])-/.exec(value)
  if (!match) return null
  const grade = Number(match[1])
  return ADMIN_CURRICULUM_GOVERNANCE_GRADE_SET.has(grade) ? grade : null
}

function safeCourseRef(value: unknown): string | undefined {
  return typeof value === 'string' && COURSE_REFERENCE.test(value)
    && curriculumGovernanceGradeFromReference(value) !== null
    ? value
    : undefined
}

function safeUnitRef(value: unknown): string | undefined {
  if (typeof value !== 'string' || !UNIT_REFERENCE.test(value)) return undefined
  return value.startsWith('ma-g') && curriculumGovernanceGradeFromReference(value) === null
    ? undefined
    : value
}

function safeLessonRef(value: unknown): string | undefined {
  return typeof value === 'string' && LESSON_REFERENCE.test(value)
    && curriculumGovernanceGradeFromReference(value) !== null
    ? value
    : undefined
}

function safeAssessmentRef(value: unknown): string | undefined {
  return typeof value === 'string' && ASSESSMENT_REFERENCE.test(value)
    && curriculumGovernanceGradeFromReference(value) !== null
    ? value
    : undefined
}

function safeStandardRef(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return /^(?:PF\d(?:\.\d+)?|MP\.\d+|[0-9A-Z]{1,8}(?:[.-][0-9A-Z]{1,12}){1,6})$/.test(value)
    ? value
    : undefined
}

function safeReference(value: unknown): string | undefined {
  return safeLessonRef(value)
    ?? safeAssessmentRef(value)
    ?? safeUnitRef(value)
    ?? safeCourseRef(value)
    ?? safeStandardRef(value)
}

function semanticVersion(value: unknown): string | null {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(value)
    ? value
    : null
}

function validationArtifactVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^(?:validation[-_.][a-z0-9]+(?:[-_.][a-z0-9]+)*|\d+\.\d+)$/.test(value)
    ? value
    : null
}

function recordedDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)
    ? value
    : null
}

function packageId(value: unknown): string | null {
  return typeof value === 'string' && /^manuel-academy-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value
    : null
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
    grade: safeGrade(affected.grade),
    course: safeCourseRef(affected.course ?? affected.course_id),
    unit: safeUnitRef(affected.unit ?? affected.unit_id),
    lesson: safeLessonRef(affected.lesson ?? affected.lesson_id),
    reference: safeReference(affected.reference),
  }
}

function findingFromCheck(raw: unknown, index: number): ValidationFinding | null {
  if (!isRecord(raw)) return null
  const code = normalizedFindingCode(raw.check ?? raw.name)
  const state = checkState(raw.result ?? raw.status)
  if (!code || !state) return null
  const presentation = KNOWN_FINDINGS[code] ?? null
  return {
    id: presentation ? `${code}-${index}` : `unrecognized-finding-${index}`,
    category: presentation?.category ?? 'completeness',
    check: presentation?.label ?? 'Unrecognized validation finding',
    state,
    detail: findingDetail(presentation, state),
    scope: presentation ? scopeFrom(raw) : {},
    source: VALIDATION_SOURCE,
  }
}

function versionOf(value: unknown): string | null {
  return isRecord(value) ? semanticVersion(value.version) : null
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
    const path = typeof item.path === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/.test(item.path)
      && !item.path.split('/').includes('..')
      ? item.path
      : null
    const hash = typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
      ? item.sha256
      : null
    if (path === null || hash === null) continue
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
      ? `${mismatches.length} checksum declaration mismatch(es) were found.`
      : `${compared} package hash declarations match ${CHECKSUM_SOURCE}; file bytes were not recomputed by this dashboard.`,
    scope: {},
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
    const standard = safeStandardRef(raw.standard)
    if (!standard) return []
    const lessonCandidates = raw.lessonRefs ?? raw.lessons
    const assessmentCandidates = raw.assessmentRefs ?? raw.assessments
    const lessonRefs = Array.isArray(lessonCandidates)
      ? lessonCandidates.flatMap((item: unknown) => safeLessonRef(item) ?? [])
      : []
    const assessmentRefs = Array.isArray(assessmentCandidates)
      ? assessmentCandidates.flatMap((item: unknown) => safeAssessmentRef(item) ?? [])
      : []
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
    packageId: packageId(manifest?.package_id) ?? packageId(validationRecord?.package_id),
    curriculumVersion: versionOf(bundle.curriculumManifest) ?? versionOf(bundle.packageManifest),
    validationReportedCurriculumVersion: versionOf(validation),
    validationArtifactVersion: validationArtifactVersion(
      validationRecord?.artifact_version ?? validationRecord?.schema_version,
    ),
    validatedAt: recordedDate(validationRecord?.validated_at ?? validationRecord?.validated_on),
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
