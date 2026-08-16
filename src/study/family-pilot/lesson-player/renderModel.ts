import {
  mapLearnerMaterialToStudySegments,
  type LearnerMaterialDto,
  type LearnerMaterialSectionDto,
  type LearnerResponseItem,
  type LearnerStudySegmentRole,
} from '../final-app/learner-response'
import { richLessonSubjectAdapter } from './subjectAdapters'
import type {
  RichLessonDetail,
  RichLessonPage,
  RichLessonRenderModel,
  RichLessonSectionKind,
} from './types'

const SENSITIVE_REFERENCE_KEY = /(?:answer|answer.?key|correct|solution|score|scoring|rubric.?key)/i
const SAFE_MEDIA_URL = /^(?:https:\/\/|\/[^/]|data:image\/(?:png|jpeg|gif|webp);base64,)/i

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'section'
}

function sectionRef(material: LearnerMaterialDto, section: LearnerMaterialSectionDto, index: number): string {
  return section.sectionRef ?? section.sectionId ?? `${material.lessonRef}:section:${index + 1}:${slug(section.title)}`
}

function semanticText(section: LearnerMaterialSectionDto): string {
  return `${section.kind ?? section.sectionKind ?? ''} ${section.title}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
}

export function classifyRichLessonSection(section: LearnerMaterialSectionDto): RichLessonSectionKind {
  const value = semanticText(section)
  if (/goal|objective|essential.question|success.criteria/.test(value)) return 'lesson-goal'
  if (/vocabulary|word.bank|key.terms/.test(value)) return 'vocabulary'
  if (/worked|model.example|instructional.example|think.aloud/.test(value)) return 'worked-example'
  if (/guided|supported.practice|we.do/.test(value)) return 'guided-practice'
  if (/independent|your.turn|application|you.do/.test(value)) return 'independent-practice'
  if (/student.task|primary.task|deliverable|activity|project|performance.task/.test(value)) return 'independent-practice'
  if (/mastery|assessment|exit.ticket|knowledge.check|check.what.you.know/.test(value)) return 'mastery-check'
  if (/remediation|reteach|try.again/.test(value)) return 'remediation'
  if (/challenge|extension|enrichment/.test(value)) return 'challenge'
  if (/reflection|self.check|wrap.up/.test(value)) return 'reflection'
  if (/material|safety|equipment|space.setup|stopping.rule/.test(value)) return 'materials-safety'
  if (/source|citation|primary.document/.test(value)) return 'source'
  if (/data|table|dataset|graph/.test(value)) return 'data'
  if (/map|geograph/.test(value)) return 'map'
  if (/image|figure|photo|artwork/.test(value)) return 'image'
  if (/reference|resource|passage|text.bank/.test(value)) return 'reference'
  return 'teaching'
}

function roleFor(kind: RichLessonSectionKind): LearnerStudySegmentRole {
  if (['guided-practice', 'independent-practice', 'remediation', 'challenge'].includes(kind)) return 'PRACTICE'
  if (kind === 'mastery-check' || kind === 'reflection') return 'REFLECT'
  return 'LEARN'
}

function label(value: string): string {
  return value.replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function primitive(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function referenceDetails(value: unknown, depth = 0): readonly RichLessonDetail[] {
  const direct = primitive(value)
  if (direct) return Object.freeze([{ text: direct }])
  if (depth > 2 || value === null || value === undefined) return Object.freeze([])
  if (Array.isArray(value)) {
    const simple = value.map(primitive).filter((item): item is string => Boolean(item))
    if (simple.length === value.length) return Object.freeze([{ items: Object.freeze(simple) }])
    return Object.freeze(value.flatMap((item) => referenceDetails(item, depth + 1)))
  }
  if (typeof value !== 'object') return Object.freeze([])
  const record = value as Readonly<Record<string, unknown>>
  const url = primitive(record.url ?? record.src ?? record.href)
  const alt = primitive(record.alt ?? record.altText ?? record.description)
  const caption = primitive(record.caption ?? record.title ?? record.label)
  const imageUrl = url ? /\.(?:png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(url) || url.startsWith('data:image/') : false
  const media = url && SAFE_MEDIA_URL.test(url)
    ? [{ ...(caption ? { label: caption } : {}), ...(alt ? { alt } : {}), ...(imageUrl ? { imageSrc: url } : { href: url }) }]
    : []
  const remaining = Object.entries(record).flatMap(([key, item]) => {
    if (SENSITIVE_REFERENCE_KEY.test(key) || ['url', 'src', 'href', 'alt', 'altText', 'description', 'caption', 'title', 'label'].includes(key)) return []
    const text = primitive(item)
    if (text) return [{ label: label(key), text }]
    const nested = referenceDetails(item, depth + 1)
    return nested.map((detail) => ({ ...detail, label: detail.label ?? label(key) }))
  })
  return Object.freeze([...media, ...remaining])
}

function vocabularyDetails(values: LearnerMaterialDto['vocabulary']): readonly RichLessonDetail[] {
  return Object.freeze((values ?? []).map((entry) => typeof entry === 'string'
    ? { text: entry }
    : { label: entry.term, text: entry.definition }))
}

function richSignal(material: LearnerMaterialDto): boolean {
  return Boolean(
    material.essentialQuestion || material.lessonGoal || material.keyPoints?.length || material.vocabulary?.length ||
    material.materials?.length || material.safetyRules?.length || material.stoppingRules?.length || material.successCriteria?.length ||
    material.movementCues?.length || material.activitySteps?.length || material.technique || material.spaceSetup ||
    material.accessibleAdaptation || material.noEquipmentAlternative || material.commonErrorToWatchFor ||
    material.equipmentRequirements || material.simulationAlternative || material.activitySetup || material.learnerResource ||
    material.sourceMetadata || material.rubricCriteria?.length || (material.sections ?? []).some((section) =>
      section.kind || section.sectionKind || section.items?.length || section.vocabulary?.length || section.source ||
      section.data || section.map || section.image || section.reference || classifyRichLessonSection(section) !== 'teaching'),
  )
}

interface PageDraft extends Omit<RichLessonPage, 'pageRef' | 'progressRef' | 'position' | 'total'> {}

function supplementalPages(material: LearnerMaterialDto): PageDraft[] {
  const pages: PageDraft[] = []
  const goal = material.lessonGoal ?? material.essentialQuestion
  if (goal || material.successCriteria?.length) pages.push({
    sectionRef: `${material.lessonRef}:rich:goal`, role: 'LEARN', kind: 'lesson-goal', title: 'Lesson goal',
    ...(goal ? { body: goal } : {}),
    details: material.successCriteria?.length ? Object.freeze([{ label: 'You will know you are ready when', items: material.successCriteria }]) : Object.freeze([]),
    item: null,
  })
  if (material.keyPoints?.length) pages.push({
    sectionRef: `${material.lessonRef}:rich:teaching`, role: 'LEARN', kind: 'teaching', title: 'Key ideas',
    details: Object.freeze([{ items: material.keyPoints }]), item: null,
  })
  if (material.vocabulary?.length) pages.push({
    sectionRef: `${material.lessonRef}:rich:vocabulary`, role: 'LEARN', kind: 'vocabulary', title: 'Vocabulary',
    details: vocabularyDetails(material.vocabulary), item: null,
  })
  const setupDetails: RichLessonDetail[] = [
    ...(material.materials?.length ? [{ label: 'Materials', items: material.materials }] : []),
    ...(material.safetyRules?.length ? [{ label: 'Safety rules', items: material.safetyRules }] : []),
    ...(material.stoppingRules?.length ? [{ label: 'Stop and get help when', items: material.stoppingRules }] : []),
    ...(material.movementCues?.length ? [{ label: 'Movement cues', items: material.movementCues }] : []),
    ...(material.technique ? [{ label: 'Technique', text: material.technique }] : []),
    ...(material.spaceSetup ? [{ label: 'Space setup', text: material.spaceSetup }] : []),
    ...(material.accessibleAdaptation ? [{ label: 'Accessible adaptation', text: material.accessibleAdaptation }] : []),
    ...(material.noEquipmentAlternative ? [{ label: 'No-equipment alternative', text: material.noEquipmentAlternative }] : []),
    ...referenceDetails(material.equipmentRequirements).map((detail) => ({ ...detail, label: detail.label ?? 'Equipment' })),
  ]
  if (setupDetails.length) pages.push({
    sectionRef: `${material.lessonRef}:rich:materials-safety`, role: 'LEARN', kind: 'materials-safety', title: 'Materials and safety',
    details: Object.freeze(setupDetails), item: null,
  })
  if (material.activitySteps?.length || material.activitySetup) pages.push({
    sectionRef: `${material.lessonRef}:rich:activity`, role: 'PRACTICE', kind: 'guided-practice', title: 'Activity steps',
    details: Object.freeze([
      ...(material.activitySteps?.length ? [{ items: material.activitySteps }] : []),
      ...referenceDetails(material.activitySetup),
    ]), item: null,
  })
  if (material.commonErrorToWatchFor) pages.push({
    sectionRef: `${material.lessonRef}:rich:reteach`, role: 'PRACTICE', kind: 'remediation', title: 'If you get stuck',
    body: material.commonErrorToWatchFor, details: Object.freeze([]), item: null,
  })
  const references: readonly [RichLessonSectionKind, string, unknown][] = [
    ['reference', 'Learner reference', material.learnerResource],
    ['source', 'Source and context', material.sourceMetadata],
    ['data', 'Model or data alternative', material.simulationAlternative],
    ['reference', 'Rubric-facing criteria', material.rubricCriteria],
  ]
  for (const [kind, title, value] of references) {
    const details = referenceDetails(value)
    if (details.length) pages.push({ sectionRef: `${material.lessonRef}:rich:${slug(title)}`, role: roleFor(kind), kind, title, details, item: null })
  }
  return pages
}

function sectionPages(
  material: LearnerMaterialDto,
  section: LearnerMaterialSectionDto,
  index: number,
  mappedItems: readonly LearnerResponseItem[],
): PageDraft[] {
  const ref = sectionRef(material, section, index)
  const kind = classifyRichLessonSection(section)
  const items = mappedItems.filter((item) => item.sectionRef === ref)
  const sourceDetails: RichLessonDetail[] = [
    ...vocabularyDetails(section.vocabulary),
    ...referenceDetails(section.source), ...referenceDetails(section.data), ...referenceDetails(section.map),
    ...referenceDetails(section.image), ...referenceDetails(section.reference),
  ]
  return (items.length ? items : [null]).map((item, itemIndex) => ({
    sectionRef: ref,
    role: item?.segmentRole ?? roleFor(kind),
    kind,
    title: section.title,
    ...((itemIndex === 0 && section.body) ? { body: section.body } : {}),
    ...((itemIndex === 0 && section.directions) ? { directions: section.directions } : {}),
    details: itemIndex === 0 ? Object.freeze(sourceDetails) : Object.freeze([]),
    item,
  }))
}

/** Pure presentation projection. It never stores, scores, or advances Study. */
export function createRichLessonRenderModel(material: LearnerMaterialDto): RichLessonRenderModel {
  const mapped = mapLearnerMaterialToStudySegments(material)
  const mappedItems = mapped.segments.flatMap((segment) => segment.items)
  const drafts = [
    ...supplementalPages(material),
    ...(material.format === 'structured'
      ? (material.sections ?? []).flatMap((section, index) => sectionPages(material, section, index, mappedItems))
      : mappedItems.map((item) => ({
          sectionRef: item.sectionRef, role: item.segmentRole,
          kind: item.segmentRole === 'PRACTICE' ? 'independent-practice' as const : item.segmentRole === 'REFLECT' ? 'reflection' as const : 'teaching' as const,
          title: item.title, ...(item.instruction ? { body: item.instruction } : {}), details: Object.freeze([]), item,
        }))),
  ]
  const rolePositions = new Map<LearnerStudySegmentRole, number>()
  const roleTotals = new Map<LearnerStudySegmentRole, number>()
  for (const page of drafts) roleTotals.set(page.role, (roleTotals.get(page.role) ?? 0) + 1)
  const pages = drafts.map((page, index): RichLessonPage => {
    const position = (rolePositions.get(page.role) ?? 0) + 1
    rolePositions.set(page.role, position)
    return Object.freeze({
      ...page,
      pageRef: `${material.lessonRef}:page:${index + 1}`,
      progressRef: `lesson-cursor:${page.role.toLowerCase()}:${position}`,
      position,
      total: roleTotals.get(page.role) ?? 1,
    })
  })
  return Object.freeze({
    version: 1,
    mode: richSignal(material) ? 'rich' : 'legacy',
    lessonRef: material.lessonRef,
    title: material.title,
    subject: richLessonSubjectAdapter(material.subject),
    pages: Object.freeze(pages),
    review: material.lessonReview ? Object.freeze({
      ...material.lessonReview,
      whatYouLearned: Object.freeze([...material.lessonReview.whatYouLearned]),
    }) : null,
  })
}
