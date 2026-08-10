import {
  CURRICULUM_DRAFT_ENTITY_TYPES,
  CURRICULUM_PREVIEW_CHANGE_TYPES,
  type CurriculumDraftEntityType,
  type CurriculumPreviewChangeType,
  type CurriculumPreviewEntityDiff,
  type CurriculumPreviewResult,
} from '../curriculum-authoring/contracts'

export const CURRICULUM_PREVIEW_RENDER_LIMIT = 200

export interface CurriculumPreviewFilters {
  readonly search: string
  readonly changeType: CurriculumPreviewChangeType | 'all'
  readonly entityType: CurriculumDraftEntityType | 'all'
}

export interface FilteredCurriculumPreview {
  readonly entities: readonly CurriculumPreviewEntityDiff[]
  readonly total: number
  readonly limited: boolean
}

export function curriculumPreviewEntityToken(entity: Pick<CurriculumPreviewEntityDiff, 'entityType' | 'entityRef'>): string {
  return `${entity.entityType}:${entity.entityRef}`
}

export function filterCurriculumPreview(
  preview: CurriculumPreviewResult,
  filters: CurriculumPreviewFilters,
  limit = CURRICULUM_PREVIEW_RENDER_LIMIT,
): FilteredCurriculumPreview {
  const query = filters.search.trim().toLocaleLowerCase()
  const matches = preview.entities.filter((entity) =>
    (filters.changeType === 'all' || entity.changeType === filters.changeType)
    && (filters.entityType === 'all' || entity.entityType === filters.entityType)
    && (!query || [entity.entityRef, entity.label, entity.context, entity.entityType, entity.changeType]
      .some((value) => value.toLocaleLowerCase().includes(query))))
  return {
    entities: matches.slice(0, Math.max(1, limit)),
    total: matches.length,
    limited: matches.length > limit,
  }
}

export function isCurriculumPreviewStale(previewRevision: number, latestDraftRevision: number | null): boolean {
  return latestDraftRevision !== null && latestDraftRevision !== previewRevision
}

export function currentPreviewValidation(preview: CurriculumPreviewResult) {
  return preview.validation.state === 'current'
    && preview.validation.draftRevision === preview.authority.draftRevision
    && preview.validation.run !== null
    ? preview.validation.run
    : null
}

export function curriculumPreviewKeyboardTarget(
  entities: readonly CurriculumPreviewEntityDiff[],
  currentToken: string,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
): string | null {
  if (!entities.length) return null
  const index = Math.max(0, entities.findIndex((entity) => curriculumPreviewEntityToken(entity) === currentToken))
  if (key === 'Home') return curriculumPreviewEntityToken(entities[0])
  if (key === 'End') return entities.at(-1) ? curriculumPreviewEntityToken(entities.at(-1)!) : null
  if (key === 'ArrowDown') return curriculumPreviewEntityToken(entities[Math.min(entities.length - 1, index + 1)])
  return curriculumPreviewEntityToken(entities[Math.max(0, index - 1)])
}

export const curriculumPreviewFilterOptions = Object.freeze({
  changeTypes: CURRICULUM_PREVIEW_CHANGE_TYPES,
  entityTypes: CURRICULUM_DRAFT_ENTITY_TYPES,
})
