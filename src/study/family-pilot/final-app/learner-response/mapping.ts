import type {
  LearnerMaterialDto,
  LearnerMaterialItemDto,
  LearnerMaterialSectionDto,
  LearnerResponseChoice,
  LearnerResponseItem,
  LearnerResponseLesson,
  LearnerResponseType,
  LearnerStudySegmentRole,
} from './types'
import { LEARNER_RESPONSE_TYPES } from './types'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:#-]{0,255}$/
const ROLES: readonly LearnerStudySegmentRole[] = ['LEARN', 'PRACTICE', 'REFLECT']

function assertRef(value: string, label: string): string {
  if (!SAFE_REF.test(value)) throw new Error(`${label} must be a stable opaque reference.`)
  return value
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'section'
}

function sectionIdentity(lessonRef: string, section: LearnerMaterialSectionDto, index: number): string {
  return assertRef(
    section.sectionRef ?? section.sectionId ?? `${lessonRef}:section:${index + 1}:${slug(section.title)}`,
    'sectionRef',
  )
}

function itemIdentity(sectionRef: string, item: LearnerMaterialItemDto | undefined, index: number): string {
  return assertRef(item?.itemRef ?? item?.ref ?? `${sectionRef}:item:${index + 1}`, 'itemRef')
}

function classify(section: LearnerMaterialSectionDto): {
  readonly role: LearnerStudySegmentRole
  readonly mode: 'READ' | 'GUIDED' | 'INDEPENDENT' | 'MASTERY' | 'ACTIVITY' | 'RUBRIC' | 'GUARDIAN'
} {
  const value = `${section.kind ?? ''} ${section.title}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  if (/guardian|attestation/.test(value)) return { role: 'REFLECT', mode: 'GUARDIAN' }
  if (/rubric.review|review.pending/.test(value)) return { role: 'REFLECT', mode: 'RUBRIC' }
  if (/mastery|assessment|exit.ticket|knowledge.check/.test(value)) return { role: 'REFLECT', mode: 'MASTERY' }
  if (/independent|application|essential.question/.test(value)) return { role: 'PRACTICE', mode: 'INDEPENDENT' }
  if (/guided|supported.practice/.test(value)) return { role: 'PRACTICE', mode: 'GUIDED' }
  if (/student.task|primary.task|deliverable|activity|project|performance.task/.test(value)) return { role: 'PRACTICE', mode: 'ACTIVITY' }
  return { role: 'LEARN', mode: 'READ' }
}

function splitFlattenedChoices(prompt: string): { readonly prompt: string; readonly labels: readonly string[] } {
  const marker = '\nChoices:'
  const offset = prompt.lastIndexOf(marker)
  if (offset < 0) return { prompt, labels: [] }
  const labels = prompt.slice(offset + marker.length).split(' · ').map((value) => value.trim()).filter(Boolean)
  return labels.length >= 2 ? { prompt: prompt.slice(0, offset).trim(), labels } : { prompt, labels: [] }
}

function choicesFor(itemRef: string, item: LearnerMaterialItemDto | undefined, flattened: readonly string[]): readonly LearnerResponseChoice[] {
  const source = item?.choices ?? flattened
  return Object.freeze(source.map((choice, index) => {
    const label = typeof choice === 'string' ? choice : choice.label
    const choiceRef = typeof choice === 'string'
      ? `${itemRef}:choice:${index + 1}`
      : choice.id ?? choice.ref ?? `${itemRef}:choice:${index + 1}`
    return Object.freeze({ choiceRef: assertRef(choiceRef, 'choiceRef'), label: label.trim() })
  }).filter((choice) => choice.label))
}

function inferredResponseType(
  classification: ReturnType<typeof classify>,
  item: LearnerMaterialItemDto | undefined,
  choices: readonly LearnerResponseChoice[],
): LearnerResponseType {
  if (item?.responseKind && LEARNER_RESPONSE_TYPES.includes(item.responseKind)) return item.responseKind
  if (classification.mode === 'RUBRIC') return 'RUBRIC_REVIEW_PENDING'
  if (classification.mode === 'GUARDIAN') return 'GUARDIAN_ATTESTATION'
  if (item?.kind === 'worked-example' || item?.workedSolution) return 'READ'
  if (choices.length) return 'CHOICE'
  if (item?.responseType && LEARNER_RESPONSE_TYPES.includes(item.responseType as LearnerResponseType) && item.responseType !== 'NONE') return item.responseType as LearnerResponseType
  if (classification.mode === 'READ') return 'READ'
  const itemKind = `${item?.kind ?? item?.itemKind ?? ''} ${item?.itemType ?? ''}`.toLowerCase()
  if (/numeric|number.entry|calculation/.test(itemKind)) return 'NUMERIC'
  if (/short.text|short-answer/.test(itemKind)) return 'TEXT'
  if (classification.mode === 'ACTIVITY') return 'ACTIVITY_EVIDENCE'
  return 'CONSTRUCTED_RESPONSE'
}

function evidenceMode(classification: ReturnType<typeof classify>) {
  if (classification.mode === 'GUIDED') return 'SUPPORTED' as const
  if (classification.mode === 'INDEPENDENT') return 'INDEPENDENT' as const
  if (classification.mode === 'MASTERY') return 'MASTERY' as const
  if (classification.mode === 'ACTIVITY') return 'COMPLETION' as const
  return null
}

function mappedItem(input: {
  readonly lessonRef: string
  readonly section: LearnerMaterialSectionDto
  readonly sectionRef: string
  readonly item?: LearnerMaterialItemDto
  readonly itemIndex: number
  readonly prompt?: string
}): LearnerResponseItem {
  const classification = classify(input.section)
  const itemRef = itemIdentity(input.sectionRef, input.item, input.itemIndex)
  const sourcePrompt = input.item?.prompt ?? input.prompt ?? input.section.body ?? input.section.directions
  const parsed = splitFlattenedChoices(sourcePrompt ?? '')
  const choices = choicesFor(itemRef, input.item, parsed.labels)
  const responseType = inferredResponseType(classification, input.item, choices)
  const instructionalExample = responseType === 'READ' || input.item?.kind === 'worked-example' || input.item?.itemKind === 'worked-example' || Boolean(input.item?.workedSolution)
  const segmentRole = classification.role === 'LEARN' && !instructionalExample ? 'PRACTICE' : classification.role
  const example = input.item?.workedSolution?.steps?.join('\n')
  return Object.freeze({
    lessonRef: input.lessonRef,
    sectionRef: input.sectionRef,
    itemRef,
    segmentRole,
    responseType: instructionalExample ? 'READ' : responseType,
    evidenceMode: instructionalExample ? null : evidenceMode(classification) ?? 'INDEPENDENT',
    title: input.section.title,
    ...(input.section.directions || input.section.body ? { instruction: input.section.directions ?? input.section.body } : {}),
    ...(parsed.prompt ? { prompt: parsed.prompt } : {}),
    ...(example ? { example } : {}),
    choices,
    required: !['NONE', 'READ', 'RUBRIC_REVIEW_PENDING', 'GUARDIAN_ATTESTATION'].includes(instructionalExample ? 'READ' : responseType),
    instructionalExample,
  })
}

function sectionItems(lessonRef: string, section: LearnerMaterialSectionDto, sectionIndex: number): readonly LearnerResponseItem[] {
  const sectionRef = sectionIdentity(lessonRef, section, sectionIndex)
  if (section.items?.length) {
    return Object.freeze(section.items.map((item, itemIndex) => mappedItem({ lessonRef, section, sectionRef, item, itemIndex })))
  }
  if (section.prompts?.length) {
    return Object.freeze(section.prompts.map((prompt, itemIndex) => mappedItem({ lessonRef, section, sectionRef, itemIndex, prompt })))
  }
  return Object.freeze([mappedItem({ lessonRef, section, sectionRef, itemIndex: 0 })])
}

function markdownItems(material: LearnerMaterialDto): readonly LearnerResponseItem[] {
  const lessonRef = material.lessonRef
  const make = (role: LearnerStudySegmentRole, suffix: string, responseType: LearnerResponseType, prompt: string): LearnerResponseItem => Object.freeze({
    lessonRef,
    sectionRef: `${lessonRef}:section:${suffix}`,
    itemRef: `${lessonRef}:section:${suffix}:item:1`,
    segmentRole: role,
    responseType,
    evidenceMode: role === 'PRACTICE' ? 'COMPLETION' : null,
    title: role === 'LEARN' ? 'Read the lesson' : role === 'PRACTICE' ? 'Complete the lesson activity' : 'Review your work',
    instruction: role === 'LEARN' ? material.markdown : undefined,
    prompt,
    choices: Object.freeze([]),
    required: responseType === 'ACTIVITY_EVIDENCE',
    instructionalExample: role === 'LEARN',
  })
  return Object.freeze([
    make('LEARN', 'read', 'READ', 'Read the admitted lesson material.'),
    make('PRACTICE', 'activity', 'ACTIVITY_EVIDENCE', 'Describe what you completed or where your activity evidence is saved.'),
    make('REFLECT', 'review', 'READ', 'Review your work before finishing the lesson.'),
  ])
}

/** Pure mapping only: no scoring, persistence, or Study transition occurs here. */
export function mapLearnerMaterialToStudySegments(material: LearnerMaterialDto): LearnerResponseLesson {
  const lessonRef = assertRef(material.lessonRef, 'lessonRef')
  if (!material.title.trim()) throw new Error('Lesson title is required.')
  if (material.format === 'structured') {
    const sectionRefs = (material.sections ?? []).map((section, index) => sectionIdentity(lessonRef, section, index))
    if (new Set(sectionRefs).size !== sectionRefs.length) throw new Error('sectionRef values must be unique within a lesson.')
  }
  const projectedMarkdownItems = (material.sections ?? []).flatMap((section, index) =>
    section.items?.length ? sectionItems(lessonRef, section, index) : [])
  const items = material.format === 'structured'
    ? Object.freeze((material.sections ?? []).flatMap((section, index) => sectionItems(lessonRef, section, index)))
    : projectedMarkdownItems.length
      ? Object.freeze([
          markdownItems(material)[0] as LearnerResponseItem,
          ...projectedMarkdownItems,
          markdownItems(material)[2] as LearnerResponseItem,
        ])
      : markdownItems(material)
  const itemRefs = items.map((item) => item.itemRef)
  if (new Set(itemRefs).size !== itemRefs.length) throw new Error('itemRef values must be unique within a lesson.')
  const segments = ROLES.map((role) => Object.freeze({ role, items: Object.freeze(items.filter((item) => item.segmentRole === role)) }))
  return Object.freeze({ lessonRef, title: material.title.trim(), segments: Object.freeze(segments) })
}
