import { importImmutableV1 } from '../../../src/curriculum-authoring/v2/v1Importer.node.ts'
import { validateCurriculumSnapshot } from '../../../src/admin/curriculum-validation/engine.ts'

const SUPPORTED_RELEASE = '1.0.0'
const ENTITY_COLLECTIONS = Object.freeze({
  course: 'courses',
  unit: 'units',
  lesson: 'lessons',
  assessment: 'assessments',
  media_resource: 'resources',
})
const ID_KEYS = Object.freeze({
  course: 'course_id',
  unit: 'unit_id',
  lesson: 'lesson_id',
  assessment: 'assessment_id',
  media_resource: 'resource_id',
})

let immutableImport

function baseRelease(version) {
  if (version !== SUPPORTED_RELEASE) {
    throw Object.assign(new Error('curriculum_release_unavailable'), { code: 'not-found' })
  }
  if (!immutableImport) immutableImport = importImmutableV1()
  return immutableImport.draft
}

function entityRef(entityType, payload) {
  return payload[ID_KEYS[entityType]]
}

function entityEntry(entityType, payload, origin, revision, position) {
  const ref = entityRef(entityType, payload)
  if (entityType === 'course') {
    return {
      entityType, entityRef: ref, origin, revision, position,
      parentId: `grade:${payload.grade}`, grade: payload.grade, subject: payload.subject,
      label: payload.title, context: `${payload.subject} · ${payload.unit_refs.length} units`,
    }
  }
  if (entityType === 'unit') {
    return {
      entityType, entityRef: ref, origin, revision, position,
      parentId: `course:${payload.course_ref}`, grade: payload.grade, subject: payload.subject,
      courseRef: payload.course_ref,
      label: `Unit ${payload.order}: ${payload.title}`,
      context: `${payload.lesson_refs.length} lessons${payload.assessment_ref ? ' · assessment' : ''}`,
    }
  }
  if (entityType === 'lesson') {
    return {
      entityType, entityRef: ref, origin, revision, position,
      parentId: `unit:${payload.unit_ref}`, grade: payload.grade, subject: payload.subject,
      courseRef: payload.course_ref, unitRef: payload.unit_ref,
      label: `Lesson ${payload.day_in_unit}: ${payload.title}`,
      context: `${payload.phase} · day ${payload.course_day}`,
    }
  }
  if (entityType === 'assessment') {
    return {
      entityType, entityRef: ref, origin, revision, position,
      parentId: `unit:${payload.unit_ref}`, courseRef: payload.course_ref, unitRef: payload.unit_ref,
      label: `Assessment: ${payload.title}`, context: `${payload.total_points} points`,
    }
  }
  return {
    entityType, entityRef: ref, origin, revision, position,
    parentId: 'resources:all',
    label: payload.title, context: `${payload.kind} · ${payload.required ? 'required' : 'optional'}`,
  }
}

function baseEntities(version) {
  const base = baseRelease(version)
  return Object.entries(ENTITY_COLLECTIONS).flatMap(([entityType, collection]) =>
    base[collection].map((payload, position) => ({
      entityType,
      entityRef: entityRef(entityType, payload),
      origin: 'base',
      revision: null,
      position,
      payload,
    })),
  )
}

async function mapConcurrent(values, limit, mapper) {
  const result = new Array(values.length)
  let cursor = 0
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++
      result[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return result
}

async function materialize(authoring, actorUserRef, draftId, expectedRevision) {
  const draft = await authoring.read(actorUserRef, draftId)
  if (draft.revision !== expectedRevision) {
    throw Object.assign(new Error('curriculum_revision_conflict'), { code: 'conflict' })
  }
  const liveSummaries = draft.entities.filter((entity) => !entity.tombstoned)
  const details = await mapConcurrent(liveSummaries, 12, (entity) => authoring.readEntity(
    actorUserRef,
    draftId,
    entity.entityType,
    entity.entityRef,
  ))
  const detailByKey = new Map(details.map((detail) => [`${detail.entityType}:${detail.entityRef}`, detail]))
  const composed = new Map(baseEntities(draft.baseReleaseVersion).map((entity) => [
    `${entity.entityType}:${entity.entityRef}`,
    entity,
  ]))
  for (const summary of draft.entities) {
    const key = `${summary.entityType}:${summary.entityRef}`
    if (summary.tombstoned) {
      composed.delete(key)
      continue
    }
    const detail = detailByKey.get(key)
    if (!detail) throw new Error('curriculum_authoring_unavailable')
    composed.set(key, {
      entityType: summary.entityType,
      entityRef: summary.entityRef,
      origin: summary.origin,
      revision: summary.revision,
      position: summary.position,
      payload: detail.payload,
    })
  }
  return { draft, entities: [...composed.values()] }
}

function snapshotFromMaterialization(materialization) {
  const base = baseRelease(materialization.draft.baseReleaseVersion)
  const byType = Object.fromEntries(Object.keys(ENTITY_COLLECTIONS).map((entityType) => [
    entityType,
    materialization.entities
      .filter((entity) => entity.entityType === entityType)
      .sort((left, right) => left.position - right.position || left.entityRef.localeCompare(right.entityRef))
      .map((entity) => entity.payload),
  ]))
  return {
    ...base,
    manifest: {
      ...base.manifest,
      draft_version: materialization.draft.targetVersion,
      status: 'draft',
      course_refs: byType.course.map((course) => course.course_id),
      resource_refs: byType.media_resource.map((resource) => resource.resource_id),
      counts: {
        ...base.manifest.counts,
        courses: byType.course.length,
        units: byType.unit.length,
        lessons: byType.lesson.length,
        assessments: byType.assessment.length,
        resources: byType.media_resource.length,
      },
    },
    courses: byType.course,
    units: byType.unit,
    lessons: byType.lesson,
    assessments: byType.assessment,
    resources: byType.media_resource,
  }
}

export function createAdminCurriculumStudioService({ authoring } = {}) {
  if (!authoring) throw new Error('curriculum_authoring_service_required')
  return Object.freeze({
    readBaseIndex(version) {
      return {
        schemaVersion: 1,
        baseReleaseVersion: version,
        entities: baseEntities(version).map((entity) => entityEntry(
          entity.entityType, entity.payload, entity.origin, entity.revision, entity.position,
        )),
      }
    },
    readBaseEntity(version, entityType, ref) {
      const entity = baseEntities(version).find((candidate) =>
        candidate.entityType === entityType && candidate.entityRef === ref,
      )
      if (!entity) throw Object.assign(new Error('curriculum_entity_unavailable'), { code: 'not-found' })
      return {
        schemaVersion: 1,
        baseReleaseVersion: version,
        entityType,
        entityRef: ref,
        payload: entity.payload,
      }
    },
    async readMaterialization(actorUserRef, draftId, expectedRevision) {
      const value = await materialize(authoring, actorUserRef, draftId, expectedRevision)
      return {
        schemaVersion: 1,
        draftId,
        draftRevision: value.draft.revision,
        baseReleaseVersion: value.draft.baseReleaseVersion,
        entities: value.entities.map((entity) => entityEntry(
          entity.entityType, entity.payload, entity.origin, entity.revision, entity.position,
        )),
      }
    },
    async validateDraft(actorUserRef, draftId, expectedRevision) {
      const value = await materialize(authoring, actorUserRef, draftId, expectedRevision)
      const snapshot = snapshotFromMaterialization(value)
      return {
        schemaVersion: 1,
        draftId,
        draftRevision: value.draft.revision,
        run: validateCurriculumSnapshot(snapshot, {
          origin: 'draft',
          snapshotId: `${draftId}@${value.draft.revision}`,
          expectedVersion: value.draft.targetVersion,
        }),
      }
    },
  })
}

export const adminCurriculumStudioInternals = Object.freeze({
  baseEntities,
  entityEntry,
  snapshotFromMaterialization,
})
