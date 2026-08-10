import {
  CURRICULUM_SCHEMA_SET_VERSION,
  assessmentProtectedInterpretationSchema,
  assessmentSchema,
  courseSchema,
  curriculumManifestSchema,
  lessonSchema,
  mediaResourceSchema,
  policySetSchema,
  scheduleSchema,
  standardFrameworkSchema,
  unitSchema,
  type CurriculumAuthoringSet,
  type StandardReference,
} from '../../curriculum-authoring/v2/contracts.ts'
import { validateWithSchema, type AuthoringSchema } from '../../curriculum-authoring/v2/schema.ts'
import {
  validateAuthoringSet,
  type AuthoringIssue,
  type AuthoringIssueCode,
  type AuthoringValidationReport,
} from '../../curriculum-authoring/v2/validation.ts'

export const CURRICULUM_VALIDATION_ENGINE_VERSION = 'curriculum-validation-v2' as const

export const CURRICULUM_VALIDATION_CATEGORIES = [
  'schema',
  'structure',
  'references',
  'assessments',
  'resources',
  'standards',
  'mastery',
  'tutor-routing',
  'safety-privacy',
  'accessibility',
  'version-consistency',
] as const

export type CurriculumValidationCategory = (typeof CURRICULUM_VALIDATION_CATEGORIES)[number]
export type CurriculumFindingSeverity = 'error' | 'warning' | 'info'
export type CurriculumSnapshotValidationStatus = 'valid' | 'invalid' | 'incomplete' | 'unavailable' | 'error'
export type CurriculumSnapshotOrigin = 'published-release' | 'draft'

export type CurriculumEntityType =
  | 'snapshot'
  | 'manifest'
  | 'course'
  | 'unit'
  | 'lesson'
  | 'assessment'
  | 'assessment-interpretation'
  | 'schedule'
  | 'standard-framework'
  | 'resource'
  | 'policy-set'

export interface CurriculumEntityReference {
  readonly type: CurriculumEntityType
  readonly id: string | null
}

export interface CurriculumValidationFinding {
  /** Stable for the same rule, entity, field, and explanation across repeated runs. */
  readonly id: string
  readonly severity: CurriculumFindingSeverity
  readonly category: CurriculumValidationCategory
  readonly entity: CurriculumEntityReference
  readonly path: string
  readonly rule: string
  readonly explanation: string
  readonly blocking: boolean
  readonly remediation?: string
}

export interface CurriculumSnapshotValidationOptions {
  readonly origin: CurriculumSnapshotOrigin
  readonly snapshotId?: string
  /** Release/draft version asserted by the source envelope, when one exists. */
  readonly expectedVersion?: string
}

export interface CurriculumSnapshotValidationRun {
  readonly engineVersion: typeof CURRICULUM_VALIDATION_ENGINE_VERSION
  readonly status: CurriculumSnapshotValidationStatus
  readonly statusMessage: string
  readonly publicationReady: boolean
  readonly source: {
    readonly origin: CurriculumSnapshotOrigin
    readonly snapshotId: string | null
    readonly curriculumVersion: string | null
    readonly schemaSetVersion: string | null
  }
  readonly summary: {
    readonly total: number
    readonly errors: number
    readonly warnings: number
    readonly info: number
    readonly blocking: number
    readonly nonBlocking: number
  }
  readonly findings: readonly CurriculumValidationFinding[]
}

export interface CurriculumValidationEngineDependencies {
  readonly validateSemantics: (snapshot: CurriculumAuthoringSet) => AuthoringValidationReport
}

interface FindingSeed {
  readonly severity: CurriculumFindingSeverity
  readonly category: CurriculumValidationCategory
  readonly entity: CurriculumEntityReference
  readonly path: string
  readonly rule: string
  readonly explanation: string
  readonly blocking: boolean
  readonly remediation?: string
}

type CollectionKey = Exclude<keyof CurriculumAuthoringSet, 'manifest'>

interface CollectionDefinition {
  readonly key: CollectionKey
  readonly entityType: Exclude<CurriculumEntityType, 'snapshot' | 'manifest'>
  readonly idKey: string
  readonly schema: AuthoringSchema<unknown>
}

const COLLECTIONS: readonly CollectionDefinition[] = [
  { key: 'courses', entityType: 'course', idKey: 'course_id', schema: courseSchema },
  { key: 'units', entityType: 'unit', idKey: 'unit_id', schema: unitSchema },
  { key: 'lessons', entityType: 'lesson', idKey: 'lesson_id', schema: lessonSchema },
  { key: 'assessments', entityType: 'assessment', idKey: 'assessment_id', schema: assessmentSchema },
  {
    key: 'assessment_interpretations',
    entityType: 'assessment-interpretation',
    idKey: 'interpretation_id',
    schema: assessmentProtectedInterpretationSchema,
  },
  { key: 'schedules', entityType: 'schedule', idKey: 'schedule_id', schema: scheduleSchema },
  {
    key: 'standard_frameworks',
    entityType: 'standard-framework',
    idKey: 'framework_id',
    schema: standardFrameworkSchema,
  },
  { key: 'resources', entityType: 'resource', idKey: 'resource_id', schema: mediaResourceSchema },
  { key: 'policy_sets', entityType: 'policy-set', idKey: 'policy_set_id', schema: policySetSchema },
]

const TOP_LEVEL_KEYS = new Set<string>(['manifest', ...COLLECTIONS.map((collection) => collection.key)])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function hashFinding(value: string, seed: number): string {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function findingId(seed: FindingSeed): string {
  const stablePath = seed.entity.id
    ? seed.path.replace(/^[a-z_]+\[\d+\]/, seed.entity.type)
    : seed.path
  const identity = [
    CURRICULUM_VALIDATION_ENGINE_VERSION,
    seed.rule,
    seed.entity.type,
    seed.entity.id ?? '',
    stablePath,
    seed.explanation,
  ].join('|')
  return `cvf-${hashFinding(identity, 0x811c9dc5)}${hashFinding(identity, 0x9e3779b9)}`
}

function materializeFindings(seeds: readonly FindingSeed[]): readonly CurriculumValidationFinding[] {
  const findings = seeds.map((seed) => ({ ...seed, id: findingId(seed) }))
  const unique = new Map(findings.map((finding) => [finding.id, finding]))
  return [...unique.values()].sort((left, right) =>
    Number(right.blocking) - Number(left.blocking)
      || severityRank(left.severity) - severityRank(right.severity)
      || left.category.localeCompare(right.category)
      || left.entity.type.localeCompare(right.entity.type)
      || (left.entity.id ?? '').localeCompare(right.entity.id ?? '')
      || left.path.localeCompare(right.path)
      || left.rule.localeCompare(right.rule),
  )
}

function severityRank(severity: CurriculumFindingSeverity): number {
  if (severity === 'error') return 0
  if (severity === 'warning') return 1
  return 2
}

function collectionDefinition(key: string): CollectionDefinition | undefined {
  return COLLECTIONS.find((collection) => collection.key === key)
}

function entityFromPath(path: string, snapshot: Record<string, unknown>): CurriculumEntityReference {
  if (path === 'manifest' || path.startsWith('manifest.')) {
    const manifest = isRecord(snapshot.manifest) ? snapshot.manifest : null
    return { type: 'manifest', id: safeText(manifest?.curriculum_id) }
  }
  const match = /^([a-z_]+)\[(\d+)\]/.exec(path)
  if (!match) return { type: 'snapshot', id: null }
  const definition = collectionDefinition(match[1])
  const collection = snapshot[match[1]]
  const values: readonly unknown[] = Array.isArray(collection) ? collection : []
  const candidate = values[Number(match[2])]
  if (!definition) return { type: 'snapshot', id: null }
  return {
    type: definition.entityType,
    id: isRecord(candidate) ? safeText(candidate[definition.idKey]) : null,
  }
}

function ruleForShapePath(path: string): {
  readonly category: CurriculumValidationCategory
  readonly rule: string
  readonly remediation: string
} {
  if (path.endsWith('.schema_set_version')) {
    return {
      category: 'version-consistency',
      rule: 'version.schema_set_supported',
      remediation: `Set the entity schema_set_version to ${CURRICULUM_SCHEMA_SET_VERSION} before validation.`,
    }
  }
  if (path.includes('.accessibility')) {
    return {
      category: 'accessibility',
      rule: 'accessibility.metadata_complete',
      remediation: 'Supply Schema v2 accessibility metadata and the required fallback for this entity.',
    }
  }
  if (path.includes('.tutor_') || path.includes('.tutorAuthority') || path.includes('.tutor_authority')) {
    return {
      category: 'tutor-routing',
      rule: 'tutor.authority_contract',
      remediation: 'Use only the controlled Tutor routing fields and preserve policy-owned answer authority.',
    }
  }
  if (path.includes('.safety_privacy') || path.includes('.privacy_')) {
    return {
      category: 'safety-privacy',
      rule: 'safety_privacy.metadata_complete',
      remediation: 'Supply policy-linked safety and privacy metadata without weakening protected requirements.',
    }
  }
  if (path.includes('.resource_refs') || path.startsWith('resources[')) {
    return {
      category: 'resources',
      rule: 'resources.schema_correct',
      remediation: 'Correct the resource metadata or resource reference to match Schema v2.',
    }
  }
  if (path.includes('.standards')) {
    return {
      category: 'standards',
      rule: 'standards.mapping_shape',
      remediation: 'Correct the mapping shape; retain uncertain source labels and do not invent an official standard ID.',
    }
  }
  return {
    category: 'schema',
    rule: 'schema.entity_shape',
    remediation: 'Correct this field to satisfy the Curriculum Schema Set v2 contract.',
  }
}

const ISSUE_PRESENTATION: Readonly<Record<AuthoringIssueCode, {
  readonly category: CurriculumValidationCategory
  readonly rule: string
  readonly remediation: string
}>> = {
  SHAPE_INVALID: {
    category: 'schema',
    rule: 'schema.entity_shape',
    remediation: 'Correct this field to satisfy the Curriculum Schema Set v2 contract.',
  },
  DUPLICATE_ID: {
    category: 'structure',
    rule: 'structure.unique_identifier',
    remediation: 'Assign a unique stable identifier and update every reference to it.',
  },
  BAD_REFERENCE: {
    category: 'references',
    rule: 'references.resolve',
    remediation: 'Point this field at an existing entity with the required parent relationship.',
  },
  ORDERING_INVALID: {
    category: 'structure',
    rule: 'structure.authoring_order',
    remediation: 'Align declared child references and numeric boundaries with canonical authoring order.',
  },
  COUNT_MISMATCH: {
    category: 'structure',
    rule: 'structure.manifest_counts',
    remediation: 'Regenerate manifest counts from the exact snapshot contents.',
  },
  SCHEDULE_INVALID: {
    category: 'structure',
    rule: 'structure.schedule_coverage',
    remediation: 'Correct schedule slots so each applicable lesson is covered exactly once.',
  },
  ASSESSMENT_POINT_MISMATCH: {
    category: 'assessments',
    rule: 'assessments.point_total',
    remediation: 'Make total_points equal the sum of prompt points.',
  },
  STANDARD_REFERENCE_INVALID: {
    category: 'standards',
    rule: 'standards.reference_integrity',
    remediation: 'Resolve the framework mapping or retain the original label for human review; do not guess an official ID.',
  },
  MASTERY_FLOOR_WEAKENED: {
    category: 'mastery',
    rule: 'mastery.policy_floor',
    remediation: 'Strengthen the lesson requirement so it meets or exceeds the active policy floor.',
  },
  TUTOR_INVARIANT_VIOLATION: {
    category: 'tutor-routing',
    rule: 'tutor.routing_invariant',
    remediation: 'Use the allowed signal/strategy pair and remove curriculum-owned answer authority.',
  },
  ACCESSIBILITY_INVALID: {
    category: 'accessibility',
    rule: 'accessibility.required_support',
    remediation: 'Add the required accessible fallback or policy-linked accessibility metadata.',
  },
  SAFETY_PRIVACY_INVALID: {
    category: 'safety-privacy',
    rule: 'safety_privacy.protected_policy',
    remediation: 'Restore the active policy reference, stop conditions, and privacy declarations.',
  },
  EXTENSION_INVALID: {
    category: 'safety-privacy',
    rule: 'safety_privacy.extension_projection',
    remediation: 'Register the extension and match its declared schema and protected/student-safe projection.',
  },
  PROJECTION_LEAK: {
    category: 'safety-privacy',
    rule: 'safety_privacy.protected_field_boundary',
    remediation: 'Remove protected authoring data from the student projection and regenerate both projections.',
  },
}

function seedFromAuthoringIssue(issue: AuthoringIssue, snapshot: Record<string, unknown>): FindingSeed {
  let presentation = ISSUE_PRESENTATION[issue.code]
  if (issue.code === 'SHAPE_INVALID') presentation = ruleForShapePath(issue.path)
  if (issue.code === 'BAD_REFERENCE' && issue.path.includes('resource_refs')) {
    presentation = {
      category: 'resources',
      rule: 'resources.reference_integrity',
      remediation: 'Reference a resource present in this exact snapshot or remove the stale reference.',
    }
  } else if (issue.code === 'BAD_REFERENCE' && issue.path.includes('assessment')) {
    presentation = {
      category: 'assessments',
      rule: 'assessments.relationship_integrity',
      remediation: 'Link the unit, assessment, protected interpretation, and prompts to their matching parent entities.',
    }
  }
  return {
    severity: 'error',
    category: presentation.category,
    entity: entityFromPath(issue.path, snapshot),
    path: issue.path,
    rule: presentation.rule,
    explanation: issue.message,
    blocking: true,
    remediation: presentation.remediation,
  }
}

function schemaSeeds(snapshot: Record<string, unknown>): FindingSeed[] {
  const seeds: FindingSeed[] = []
  const manifestResult = validateWithSchema(curriculumManifestSchema, snapshot.manifest)
  if (!manifestResult.success) {
    manifestResult.issues.forEach((issue) => {
      const path = `manifest${issue.path.slice(1)}`
      const presentation = ruleForShapePath(path)
      seeds.push({
        severity: 'error',
        category: presentation.category,
        entity: entityFromPath(path, snapshot),
        path,
        rule: presentation.rule,
        explanation: issue.message,
        blocking: true,
        remediation: presentation.remediation,
      })
    })
  }
  COLLECTIONS.forEach((collection) => {
    const values = snapshot[collection.key]
    if (!Array.isArray(values)) return
    values.forEach((value, index) => {
      const result = validateWithSchema(collection.schema, value)
      if (!result.success) {
        result.issues.forEach((issue) => {
          const path = `${collection.key}[${index}]${issue.path.slice(1)}`
          const presentation = ruleForShapePath(path)
          seeds.push({
            severity: 'error',
            category: presentation.category,
            entity: entityFromPath(path, snapshot),
            path,
            rule: presentation.rule,
            explanation: issue.message,
            blocking: true,
            remediation: presentation.remediation,
          })
        })
      }
    })
  })
  return seeds
}

function standardsReviewSeeds(snapshot: CurriculumAuthoringSet): FindingSeed[] {
  const seeds: FindingSeed[] = []
  const references: Array<{
    readonly values: readonly StandardReference[]
    readonly path: string
    readonly entity: CurriculumEntityReference
  }> = []
  snapshot.courses.forEach((item, index) => references.push({
    values: item.standards,
    path: `courses[${index}].standards`,
    entity: { type: 'course', id: item.course_id },
  }))
  snapshot.units.forEach((item, index) => references.push({
    values: item.standards,
    path: `units[${index}].standards`,
    entity: { type: 'unit', id: item.unit_id },
  }))
  snapshot.lessons.forEach((item, index) => references.push({
    values: item.standards,
    path: `lessons[${index}].standards`,
    entity: { type: 'lesson', id: item.lesson_id },
  }))
  snapshot.assessments.forEach((item, index) => references.push({
    values: item.standards,
    path: `assessments[${index}].standards`,
    entity: { type: 'assessment', id: item.assessment_id },
  }))
  references.forEach((owner) => owner.values.forEach((reference, index) => {
    const path = `${owner.path}[${index}]`
    if (reference.mapping_status === 'human-review') {
      seeds.push({
        severity: 'error',
        category: 'standards',
        entity: owner.entity,
        path,
        rule: 'standards.human_review_required',
        explanation: `The preserved standards label ${JSON.stringify(reference.legacy_label ?? 'unlabeled')} requires human mapping approval.`,
        blocking: true,
        remediation: 'Keep the preserved label in the review queue until an authorized human approves a verified mapping; do not invent an official ID.',
      })
    } else if (reference.mapping_status === 'unverified') {
      seeds.push({
        severity: 'warning',
        category: 'standards',
        entity: owner.entity,
        path,
        rule: 'standards.unverified_mapping',
        explanation: `The preserved standards label ${JSON.stringify(reference.legacy_label ?? 'unlabeled')} is not a verified canonical mapping.`,
        blocking: false,
        remediation: 'Retain the source label and obtain authoritative mapping evidence before changing it to canonical.',
      })
    }
  }))
  snapshot.standard_frameworks.forEach((framework, index) => {
    if (framework.authority_status === 'verified') return
    seeds.push({
      severity: 'warning',
      category: 'standards',
      entity: { type: 'standard-framework', id: framework.framework_id },
      path: `standard_frameworks[${index}].authority_status`,
      rule: 'standards.framework_authority',
      explanation: `The standards framework is classified ${framework.authority_status}, not verified authority.`,
      blocking: false,
      remediation: 'Preserve this classification until authoritative framework evidence is reviewed.',
    })
  })
  return seeds
}

function summary(findings: readonly CurriculumValidationFinding[]) {
  return {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    blocking: findings.filter((finding) => finding.blocking).length,
    nonBlocking: findings.filter((finding) => !finding.blocking).length,
  }
}

function sourceFrom(
  snapshot: Record<string, unknown> | null,
  options: CurriculumSnapshotValidationOptions,
) {
  const manifest = snapshot && isRecord(snapshot.manifest) ? snapshot.manifest : null
  return {
    origin: options.origin,
    snapshotId: options.snapshotId ?? safeText(manifest?.curriculum_id),
    curriculumVersion: safeText(manifest?.draft_version),
    schemaSetVersion: safeText(manifest?.schema_set_version),
  }
}

function run(
  status: CurriculumSnapshotValidationStatus,
  statusMessage: string,
  source: CurriculumSnapshotValidationRun['source'],
  seeds: readonly FindingSeed[],
): CurriculumSnapshotValidationRun {
  const findings = materializeFindings(seeds)
  return {
    engineVersion: CURRICULUM_VALIDATION_ENGINE_VERSION,
    status,
    statusMessage,
    publicationReady: status === 'valid' && findings.every((finding) => !finding.blocking),
    source,
    summary: summary(findings),
    findings,
  }
}

export function createCurriculumSnapshotValidator(
  dependencies: CurriculumValidationEngineDependencies = { validateSemantics: validateAuthoringSet },
) {
  return function validateSnapshot(
    input: unknown,
    options: CurriculumSnapshotValidationOptions,
  ): CurriculumSnapshotValidationRun {
    const snapshot = isRecord(input) ? input : null
    const source = sourceFrom(snapshot, options)
    if (!snapshot) {
      return run('incomplete', 'The curriculum snapshot is missing or is not an object.', source, [{
        severity: 'error',
        category: 'structure',
        entity: { type: 'snapshot', id: options.snapshotId ?? null },
        path: '$',
        rule: 'structure.snapshot_required',
        explanation: 'A complete curriculum snapshot object is required.',
        blocking: true,
        remediation: 'Provide the manifest and every Schema v2 entity collection from one explicit snapshot.',
      }])
    }

    const missingSeeds: FindingSeed[] = []
    if (!isRecord(snapshot.manifest)) {
      missingSeeds.push({
        severity: 'error',
        category: 'structure',
        entity: { type: 'manifest', id: null },
        path: 'manifest',
        rule: 'structure.snapshot_section_required',
        explanation: 'The snapshot manifest is missing or incomplete.',
        blocking: true,
        remediation: 'Include the Schema v2 curriculum manifest from the same snapshot.',
      })
    }
    COLLECTIONS.forEach((collection) => {
      if (Array.isArray(snapshot[collection.key])) return
      missingSeeds.push({
        severity: 'error',
        category: 'structure',
        entity: { type: 'snapshot', id: options.snapshotId ?? null },
        path: collection.key,
        rule: 'structure.snapshot_section_required',
        explanation: `The ${collection.key} collection is missing or incomplete.`,
        blocking: true,
        remediation: `Include the ${collection.key} collection from the same explicit snapshot.`,
      })
    })
    if (missingSeeds.length) {
      return run('incomplete', 'Validation could not cover an incomplete curriculum snapshot.', source, missingSeeds)
    }

    const manifest = snapshot.manifest as Record<string, unknown>
    const reportedSchemaVersion = safeText(manifest.schema_set_version)
    if (reportedSchemaVersion && reportedSchemaVersion !== CURRICULUM_SCHEMA_SET_VERSION) {
      return run('unavailable', `Schema set ${reportedSchemaVersion} is not supported by this validation engine.`, source, [{
        severity: 'error',
        category: 'version-consistency',
        entity: { type: 'manifest', id: safeText(manifest.curriculum_id) },
        path: 'manifest.schema_set_version',
        rule: 'version.schema_set_supported',
        explanation: `This engine supports Schema Set ${CURRICULUM_SCHEMA_SET_VERSION}; the snapshot reports ${reportedSchemaVersion}.`,
        blocking: true,
        remediation: 'Use a validator that explicitly supports this schema set, or migrate the snapshot through the approved compatibility workflow.',
      }])
    }

    const seeds: FindingSeed[] = []
    Object.keys(snapshot).sort().forEach((key) => {
      if (TOP_LEVEL_KEYS.has(key)) return
      seeds.push({
        severity: 'error',
        category: 'schema',
        entity: { type: 'snapshot', id: source.snapshotId },
        path: key,
        rule: 'schema.snapshot_shape',
        explanation: `The top-level field ${key} is not part of Curriculum Schema Set v2.`,
        blocking: true,
        remediation: 'Remove the unknown field or place approved data in a registered extension.',
      })
    })
    seeds.push(...schemaSeeds(snapshot))
    if (seeds.some((seed) => seed.blocking)) {
      return run('invalid', 'The snapshot does not satisfy Curriculum Schema Set v2.', source, seeds)
    }

    const typedSnapshot = snapshot as unknown as CurriculumAuthoringSet
    try {
      const semanticReport = dependencies.validateSemantics(typedSnapshot)
      if (!semanticReport.valid && semanticReport.issues.length === 0) {
        throw new Error('inconsistent semantic validation report')
      }
      seeds.push(...semanticReport.issues.map((issue) => seedFromAuthoringIssue(issue, snapshot)))
      seeds.push(...standardsReviewSeeds(typedSnapshot))
      if (options.expectedVersion && options.expectedVersion !== typedSnapshot.manifest.draft_version) {
        seeds.push({
          severity: 'error',
          category: 'version-consistency',
          entity: { type: 'manifest', id: typedSnapshot.manifest.curriculum_id },
          path: 'manifest.draft_version',
          rule: 'version.source_snapshot_match',
          explanation: `The source reports version ${options.expectedVersion}, but the snapshot manifest reports ${typedSnapshot.manifest.draft_version}.`,
          blocking: true,
          remediation: 'Validate the manifest and entities from the same release or draft snapshot.',
        })
      }
    } catch {
      return run('error', 'The validation engine failed to execute; no readiness conclusion was produced.', source, [{
        severity: 'error',
        category: 'schema',
        entity: { type: 'snapshot', id: source.snapshotId },
        path: '$',
        rule: 'engine.execution_failed',
        explanation: 'The semantic validation stage did not complete.',
        blocking: true,
        remediation: 'Retry validation and inspect controlled server diagnostics if the failure repeats.',
      }])
    }

    const findings = materializeFindings(seeds)
    const blocking = findings.some((finding) => finding.blocking)
    return run(
      blocking ? 'invalid' : 'valid',
      blocking
        ? 'The snapshot has publication-blocking validation findings.'
        : findings.some((finding) => finding.severity === 'warning')
          ? 'The snapshot is valid with non-blocking review warnings.'
          : 'The snapshot is valid and has no validation findings.',
      source,
      seeds,
    )
  }
}

export const validateCurriculumSnapshot = createCurriculumSnapshotValidator()
