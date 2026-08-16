import { richLessonSubjectAdapter } from './subjectAdapters'
import type { FinalLearnerMaterial, LearnerMaterialSection, RichLessonPage, RichLessonRenderModel, RichLessonSectionKind } from './types'

const SENSITIVE = /(?:answer|correct|solution|scor|rubric|mastery.?rule|adaptive.?route)/i

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'section'
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function list(value: unknown): readonly string[] {
  return Array.isArray(value) ? Object.freeze(value.filter((item): item is string => Boolean(text(item))).map((item) => item.trim())) : Object.freeze([])
}

export function classifyRichLessonSection(section: LearnerMaterialSection): RichLessonSectionKind {
  const value = `${section.kind ?? section.sectionKind ?? ''} ${section.title}`.toLowerCase().replaceAll(/[_-]+/g, ' ')
  if (/goal|objective|essential question|success criteria/.test(value)) return 'lesson-goal'
  if (/material|safety|equipment|space setup|stopping rule/.test(value)) return 'materials-safety'
  if (/guided|supported practice|we do/.test(value)) return 'guided-practice'
  if (/independent|your turn|application|student task|activity|project/.test(value)) return 'independent-practice'
  if (/mastery|assessment|exit ticket|knowledge check/.test(value)) return 'mastery-check'
  if (/reflection|self check|wrap up/.test(value)) return 'reflection'
  if (/source|citation|primary document/.test(value)) return 'source'
  if (/reference|resource|passage|data|map|image/.test(value)) return 'reference'
  return 'teaching'
}

function safeDetails(section: LearnerMaterialSection): readonly string[] {
  const details: string[] = []
  for (const [key, value] of Object.entries(section)) {
    if (SENSITIVE.test(key) || ['sectionRef', 'sectionId', 'kind', 'sectionKind', 'title', 'body', 'directions', 'items'].includes(key)) continue
    if (text(value)) details.push(text(value)!)
    else details.push(...list(value))
  }
  return Object.freeze(details)
}

function pageDrafts(material: FinalLearnerMaterial): Omit<RichLessonPage, 'pageRef' | 'progressRef' | 'position' | 'total'>[] {
  const pages: Omit<RichLessonPage, 'pageRef' | 'progressRef' | 'position' | 'total'>[] = []
  const goals = [material.lessonGoal, material.essentialQuestion, ...(material.learningObjectives ?? []), ...(material.successCriteria ?? [])].filter((item): item is string => Boolean(text(item)))
  if (goals.length) pages.push({ sectionRef: `${material.lessonRef}:goals`, kind: 'lesson-goal', title: 'Lesson goal', details: Object.freeze(goals) })
  const setup = [...(material.materials ?? []), ...(material.safetyRules ?? [])].filter((item) => Boolean(text(item)))
  if (setup.length) pages.push({ sectionRef: `${material.lessonRef}:materials`, kind: 'materials-safety', title: 'Materials and safety', details: Object.freeze(setup) })
  for (const [index, section] of (material.sections ?? []).entries()) {
    const sectionRef = section.sectionRef ?? section.sectionId ?? `${material.lessonRef}:section:${index + 1}:${slug(section.title)}`
    pages.push({
      sectionRef,
      kind: classifyRichLessonSection(section),
      title: section.title,
      ...(text(section.body) ? { body: section.body!.trim() } : {}),
      ...(text(section.directions) ? { directions: section.directions!.trim() } : {}),
      details: safeDetails(section),
    })
  }
  if (!pages.length) pages.push({ sectionRef: `${material.lessonRef}:lesson`, kind: 'teaching', title: material.title, details: Object.freeze([]) })
  return pages
}

export function createRichLessonRenderModel(material: FinalLearnerMaterial): RichLessonRenderModel {
  const drafts = pageDrafts(material)
  const total = drafts.length
  const pages = Object.freeze(drafts.map((page, index) => Object.freeze({
    ...page,
    pageRef: `${material.lessonRef}:page:${index + 1}`,
    progressRef: `${material.lessonRef}:progress:${index + 1}`,
    position: index + 1,
    total,
  })))
  return Object.freeze({
    version: 1 as const,
    mode: pages.length > 1 ? 'rich' as const : 'legacy' as const,
    lessonRef: material.lessonRef,
    title: material.title,
    subject: richLessonSubjectAdapter(material.subject),
    pages,
  })
}

/** Exact lesson/material seam used by final composition before presentation. */
export function createBoundRichLessonRenderModel(input: {
  readonly lessonRef: string
  readonly material: FinalLearnerMaterial
}): RichLessonRenderModel {
  if (input.material.lessonRef !== input.lessonRef) {
    throw new Error('Final lesson material does not match the bound lesson.')
  }
  return createRichLessonRenderModel(input.material)
}
