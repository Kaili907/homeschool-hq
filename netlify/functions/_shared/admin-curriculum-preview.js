import { createHash } from 'node:crypto'
import { validateCurriculumSnapshot } from '../../../src/admin/curriculum-validation/engine.ts'
import { approvedStandardsReviewDecisions } from '../../../src/admin/curriculum-standards-review/model.ts'
import { adminCurriculumStudioInternals } from './admin-curriculum-studio.js'

const { baseEntities, draftStandardsEvidence, entityEntry, materialize } = adminCurriculumStudioInternals

const ENTITY_ORDER = Object.freeze(['course', 'unit', 'lesson', 'assessment', 'media_resource'])
const ID_FIELDS = new Set(['course_id', 'unit_id', 'lesson_id', 'assessment_id', 'resource_id'])
const SAFE_FIELDS = Object.freeze({
  course: new Set(['grade', 'subject', 'title', 'description', 'capstone', 'days', 'order', 'unit_refs', 'standards', 'extensions']),
  unit: new Set(['course_ref', 'grade', 'subject', 'order', 'title', 'days', 'standards', 'essential_question', 'topics', 'performance_task', 'lesson_refs', 'assessment_ref', 'extensions']),
  lesson: new Set([
    'course_ref', 'unit_ref', 'grade', 'subject', 'course_day', 'day_in_unit', 'title', 'phase', 'focus',
    'estimated_duration', 'standards', 'essential_question', 'learning_objectives', 'success_criteria',
    'materials', 'lesson_flow', 'student_activity', 'formative_check',
    'extension_activity', 'accessibility', 'resource_refs', 'home_connection', 'extensions',
  ]),
  assessment: new Set(['course_ref', 'unit_ref', 'title', 'standards', 'total_points', 'prompts', 'rubric_dimensions', 'accommodation_note', 'extensions']),
  media_resource: new Set(['kind', 'title', 'rights', 'required', 'text_fallback', 'caption_or_transcript', 'alt_text', 'long_description']),
})

const CATEGORY_BY_FIELD = Object.freeze({
  title: 'identity', name: 'identity', description: 'content', capstone: 'content', focus: 'content',
  essential_question: 'content', learning_objectives: 'content', success_criteria: 'content',
  lesson_flow: 'lesson-content', student_activity: 'lesson-content', formative_check: 'assessment-structure',
  scoring_guidance: 'assessment-structure', prompts: 'assessment-structure', rubric_dimensions: 'assessment-structure',
  total_points: 'assessment-structure', standards: 'standards', mastery: 'mastery', tutor_routes: 'tutor-routing',
  safety_privacy: 'safety-privacy', guardian_visibility_note: 'safety-privacy', accessibility: 'accessibility',
  resource_refs: 'resources', unit_refs: 'navigation', lesson_refs: 'navigation', assessment_ref: 'navigation',
  course_ref: 'navigation', unit_ref: 'navigation', order: 'navigation', position: 'navigation',
  course_day: 'navigation', day_in_unit: 'navigation', days: 'navigation', estimated_duration: 'navigation',
  extensions: 'extensions', kind: 'resources', rights: 'resources', required: 'resources',
  text_fallback: 'accessibility', caption_or_transcript: 'accessibility', alt_text: 'accessibility',
  long_description: 'accessibility',
})

const PROTECTED_VALIDATION_TYPES = new Set(['assessment-interpretation', 'policy-set'])
const MAX_VALUE_LENGTH = 320
const MAX_LIST_ITEMS = 8
const MAX_FIELD_CHANGES = 80

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function candidateDigest(draft, entities) {
  const candidate = entities
    .map((entity) => ({
      entityType: entity.entityType,
      entityRef: entity.entityRef,
      position: entity.position,
      payload: entity.payload,
    }))
    .sort(compareEntity)
  return createHash('sha256').update(stableStringify({
    draftId: draft.draftId,
    draftRevision: draft.revision,
    baseReleaseVersion: draft.baseReleaseVersion,
    targetVersion: draft.targetVersion,
    schemaSetVersion: draft.authoringSchemaVersion,
    candidate,
  })).digest('hex')
}

function compareEntity(left, right) {
  const leftPosition = left.position ?? left.candidatePosition ?? left.basePosition ?? 0
  const rightPosition = right.position ?? right.candidatePosition ?? right.basePosition ?? 0
  return ENTITY_ORDER.indexOf(left.entityType) - ENTITY_ORDER.indexOf(right.entityType)
    || leftPosition - rightPosition
    || left.entityRef.localeCompare(right.entityRef)
}

function safeProjection(entityType, payload) {
  const allowed = SAFE_FIELDS[entityType]
  const projected = {}
  for (const key of Object.keys(payload).sort()) {
    if (!allowed.has(key) || ID_FIELDS.has(key) || key === 'schema_set_version') continue
    if (key === 'extensions') {
      const extensions = Array.isArray(payload.extensions)
        ? payload.extensions.filter((entry) => entry?.projection === 'student-safe')
        : []
      if (extensions.length) projected.extensions = extensions
      continue
    }
    projected[key] = payload[key]
  }
  return projected
}

function hasWithheldChange(entityType, before, after) {
  const withheld = (payload) => Object.fromEntries(Object.entries(payload ?? {}).flatMap(([key, value]) => {
    if (ID_FIELDS.has(key) || key === 'schema_set_version') return []
    if (key === 'extensions') {
      const protectedExtensions = Array.isArray(value)
        ? value.filter((entry) => entry?.projection !== 'student-safe')
        : []
      return protectedExtensions.length ? [[key, protectedExtensions]] : []
    }
    return SAFE_FIELDS[entityType].has(key) ? [] : [[key, value]]
  }))
  return stableStringify(withheld(before)) !== stableStringify(withheld(after))
}

function labelForPath(path) {
  return path
    .replaceAll('_', ' ')
    .split('.')
    .map((segment) => segment.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(' · ')
}

function boundedText(value, maximum = 96) {
  const text = String(value)
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text
}

function structuredItemPreview(item) {
  const identityKey = [
    'title', 'segment_id', 'prompt_id', 'standard_id', 'framework_ref', 'signal', 'namespace', 'kind',
  ].find((key) => typeof item[key] === 'string')
  const identity = identityKey ? boundedText(item[identityKey], 80) : 'structured item'
  const details = Object.keys(item).sort().flatMap((key) => {
    if (key === identityKey || key === 'schema_set_version') return []
    const value = item[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [`${labelForPath(key)}: ${boundedText(value, 80)}`]
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const scalars = Object.keys(value).sort().flatMap((nestedKey) => {
        const nested = value[nestedKey]
        return typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean'
          ? [`${labelForPath(nestedKey)} ${boundedText(nested, 48)}`]
          : []
      })
      return scalars.length ? [`${labelForPath(key)}: ${scalars.slice(0, 4).join(', ')}`] : []
    }
    return []
  })
  return `${identity}${details.length ? ` · ${details.slice(0, 4).join(' · ')}` : ''}`
}

function valuePreview(value) {
  if (value === undefined || value === null) return { kind: 'empty', display: 'Not present' }
  if (typeof value === 'boolean') return { kind: 'boolean', display: value ? 'Yes' : 'No' }
  if (typeof value === 'number') return { kind: 'number', display: String(value) }
  if (typeof value === 'string') {
    return {
      kind: 'text',
      display: value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…` : value,
      truncated: value.length > MAX_VALUE_LENGTH,
    }
  }
  if (Array.isArray(value)) {
    const sample = value.slice(0, MAX_LIST_ITEMS).map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item)
      if (item && typeof item === 'object') {
        return structuredItemPreview(item)
      }
      return String(item)
    })
    const fullDisplay = value.length
      ? `${value.length} item${value.length === 1 ? '' : 's'}${sample.length ? `: ${sample.join('; ')}` : ''}${value.length > MAX_LIST_ITEMS ? '; …' : ''}`
      : 'No items'
    return {
      kind: 'list',
      display: boundedText(fullDisplay, MAX_VALUE_LENGTH),
      itemCount: value.length,
      truncated: value.length > MAX_LIST_ITEMS || fullDisplay.length > MAX_VALUE_LENGTH,
    }
  }
  return {
    kind: 'structure',
    display: `${Object.keys(value).length} structured field${Object.keys(value).length === 1 ? '' : 's'}`,
    itemCount: Object.keys(value).length,
  }
}

function collectChanges(before, after, prefix = '') {
  if (stableStringify(before) === stableStringify(after)) return []
  const beforeRecord = before !== null && typeof before === 'object' && !Array.isArray(before)
  const afterRecord = after !== null && typeof after === 'object' && !Array.isArray(after)
  if ((before === undefined || before === null) && afterRecord) {
    return Object.keys(after).sort().flatMap((key) =>
      collectChanges(undefined, after[key], prefix ? `${prefix}.${key}` : key))
  }
  if ((after === undefined || after === null) && beforeRecord) {
    return Object.keys(before).sort().flatMap((key) =>
      collectChanges(before[key], undefined, prefix ? `${prefix}.${key}` : key))
  }
  if (
    before === undefined || after === undefined
    || before === null || after === null
    || !beforeRecord || !afterRecord
    || Array.isArray(before) || Array.isArray(after)
  ) {
    const root = prefix.split('.')[0]
    return [{
      path: prefix,
      label: labelForPath(prefix),
      category: CATEGORY_BY_FIELD[root] ?? 'content',
      before: valuePreview(before),
      after: valuePreview(after),
    }]
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.flatMap((key) => collectChanges(before[key], after[key], prefix ? `${prefix}.${key}` : key))
}

function sanitizeValidationRun(run) {
  return {
    ...run,
    findings: run.findings.map((finding) => PROTECTED_VALIDATION_TYPES.has(finding.entity.type)
      ? {
          ...finding,
          entity: { type: 'snapshot', id: null },
          path: '$.protected_metadata',
          rule: 'protected.review_required',
          explanation: 'A protected curriculum rule requires authorized review.',
          remediation: 'Resolve the finding through the protected curriculum review workflow.',
        }
      : finding),
  }
}

function diffEntity(base, candidate) {
  const source = candidate ?? base
  const display = entityEntry(source.entityType, source.payload, source.origin, source.revision, source.position)
  let changeType
  if (!base) changeType = 'added'
  else if (!candidate) changeType = 'removed'
  else if (base.position === candidate.position && stableStringify(base.payload) === stableStringify(candidate.payload)) changeType = 'unchanged'
  else changeType = 'modified'

  const beforeSafe = base ? safeProjection(base.entityType, base.payload) : undefined
  const afterSafe = candidate ? safeProjection(candidate.entityType, candidate.payload) : undefined
  let changes = collectChanges(beforeSafe, afterSafe)
  if (base && candidate && base.position !== candidate.position) {
    changes = [{
      path: 'position', label: 'Navigation Position', category: 'navigation',
      before: valuePreview(base.position), after: valuePreview(candidate.position),
    }, ...changes]
  }
  if (changeType !== 'unchanged' && hasWithheldChange(source.entityType, base?.payload, candidate?.payload)) {
    changes.push({
      path: 'protected_metadata', label: 'Protected Metadata', category: 'protected',
      before: { kind: 'withheld', display: 'Withheld from preview' },
      after: { kind: 'withheld', display: 'Withheld from preview' },
    })
  }
  const fieldChangeCount = changes.length
  return {
    entityType: source.entityType,
    entityRef: source.entityRef,
    label: display.label,
    context: display.context,
    changeType,
    basePosition: base?.position ?? null,
    candidatePosition: candidate?.position ?? null,
    fieldChangeCount,
    fieldChangesLimited: fieldChangeCount > MAX_FIELD_CHANGES,
    fieldChanges: changes.slice(0, MAX_FIELD_CHANGES),
  }
}

function buildDiff(materialization) {
  const base = baseEntities(materialization.draft.baseReleaseVersion)
  const baseByKey = new Map(base.map((entity) => [`${entity.entityType}:${entity.entityRef}`, entity]))
  const candidateByKey = new Map(materialization.entities.map((entity) => [`${entity.entityType}:${entity.entityRef}`, entity]))
  const keys = [...new Set([...baseByKey.keys(), ...candidateByKey.keys()])]
  const entities = keys.map((key) => diffEntity(baseByKey.get(key), candidateByKey.get(key))).sort(compareEntity)
  const count = (changeType) => entities.filter((entity) => entity.changeType === changeType).length
  const byEntityType = Object.fromEntries(ENTITY_ORDER.map((entityType) => {
    const typed = entities.filter((entity) => entity.entityType === entityType)
    return [entityType, {
      unchanged: typed.filter((entity) => entity.changeType === 'unchanged').length,
      added: typed.filter((entity) => entity.changeType === 'added').length,
      modified: typed.filter((entity) => entity.changeType === 'modified').length,
      removed: typed.filter((entity) => entity.changeType === 'removed').length,
    }]
  }))
  return {
    entities,
    summary: {
      baseEntities: base.length,
      candidateEntities: materialization.entities.length,
      totalCompared: entities.length,
      unchanged: count('unchanged'),
      added: count('added'),
      modified: count('modified'),
      removed: count('removed'),
      byEntityType,
    },
  }
}

export function createAdminCurriculumPreviewService({ authoring, standardsReview } = {}) {
  if (!authoring) throw new Error('curriculum_authoring_service_required')
  return Object.freeze({
    async read(actorUserRef, draftId, expectedRevision) {
      const value = await materialize(authoring, actorUserRef, draftId, expectedRevision)
      const diff = buildDiff(value)
      const evidence = await draftStandardsEvidence(standardsReview, actorUserRef, value)
      const validation = validateCurriculumSnapshot(evidence.snapshot, {
        origin: 'draft',
        snapshotId: `${draftId}@${value.draft.revision}`,
        expectedVersion: value.draft.targetVersion,
        standardsReviewDecisions: approvedStandardsReviewDecisions(evidence.decisions),
      })
      const standardsBlockers = validation.findings.filter((finding) =>
        finding.blocking && finding.category === 'standards').length
      const humanReviewBlockers = validation.findings.filter((finding) =>
        finding.blocking && (finding.category === 'standards' || finding.rule.includes('human_review'))).length
      const digest = candidateDigest(value.draft, value.entities)
      return {
        schemaVersion: 1,
        previewRef: `curriculum-preview:${draftId}:${value.draft.revision}:${digest}`,
        authority: {
          draftId,
          draftRevision: value.draft.revision,
          baseReleaseVersion: value.draft.baseReleaseVersion,
          targetVersion: value.draft.targetVersion,
          schemaSetVersion: value.draft.authoringSchemaVersion,
          candidateDigest: digest,
        },
        freshness: 'current',
        summary: {
          ...diff.summary,
          validationStatus: validation.status,
          publicationReady: validation.publicationReady,
          validationBlockers: validation.summary.blocking,
          humanReviewBlockers,
          standardsBlockers,
        },
        validation: {
          state: 'current',
          draftRevision: value.draft.revision,
          run: sanitizeValidationRun(validation),
        },
        entities: diff.entities,
      }
    },
  })
}

export const adminCurriculumPreviewInternals = Object.freeze({
  buildDiff,
  candidateDigest,
  collectChanges,
  safeProjection,
  stableStringify,
  valuePreview,
})
