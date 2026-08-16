import { mapLearnerMaterialToStudySegments } from './mapping'
import type {
  LearnerMaterialDto,
  LearnerResponseAssessor,
  LearnerResponseAttemptContext,
  LearnerResponseItem,
  LearnerResponsePresentation,
  LearnerResponseRecord,
  LearnerResponseStore,
  LearnerResponseSubmission,
  LearnerResponseSubmissionResult,
  LearnerResponseValue,
  LearnerStudySegmentRole,
} from './types'

const SEGMENT_ROLE: Readonly<Record<number, LearnerStudySegmentRole>> = Object.freeze({ 1: 'LEARN', 2: 'PRACTICE', 3: 'REFLECT' })

function reject(reason: Extract<LearnerResponseSubmissionResult, { status: 'rejected' }>['reason'], message: string): LearnerResponseSubmissionResult {
  return { status: 'rejected', reason, message }
}

function responseValue(item: LearnerResponseItem, value: string): LearnerResponseValue | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (item.responseType === 'CHOICE') return item.choices.some((choice) => choice.choiceRef === trimmed) ? { kind: 'CHOICE', choiceRef: trimmed } : null
  if (item.responseType === 'TEXT' || item.responseType === 'NUMERIC' || item.responseType === 'CONSTRUCTED_RESPONSE' || item.responseType === 'ACTIVITY_EVIDENCE') {
    return { kind: item.responseType, text: trimmed }
  }
  return null
}

export class LearnerResponseRuntime {
  readonly #lesson

  constructor(
    material: LearnerMaterialDto,
    readonly context: LearnerResponseAttemptContext,
    readonly store: LearnerResponseStore,
    readonly assessor?: LearnerResponseAssessor,
    readonly now: () => Date = () => new Date(),
  ) {
    this.#lesson = mapLearnerMaterialToStudySegments(material)
    if (this.#lesson.lessonRef !== context.lessonRef) throw new Error('Wrong lesson material rejected.')
  }

  async open(segmentOrdinal: number | null, segmentRef: string | null): Promise<LearnerResponsePresentation> {
    const role = SEGMENT_ROLE[segmentOrdinal ?? 1] ?? 'LEARN'
    const segment = this.#lesson.segments.find((candidate) => candidate.role === role)!
    const records = await this.store.list(this.context)
    const answered = new Set(records.map((record) => record.itemRef))
    const required = segment.items.filter((item) => item.required)
    const item = required.find((candidate) => !answered.has(candidate.itemRef)) ?? segment.items[0] ?? null
    return Object.freeze({
      segmentRole: role,
      segmentRef: segmentRef ?? `${this.context.lessonRef}:segment:${role.toLowerCase()}`,
      item: required.every((candidate) => answered.has(candidate.itemRef)) ? (required.length ? null : item) : item,
      answeredItemRefs: Object.freeze([...answered]),
      requiredItemRefs: Object.freeze(required.map((candidate) => candidate.itemRef)),
      canCompleteSegment: required.every((candidate) => answered.has(candidate.itemRef)),
      pendingAssessmentCount: records.filter((record) => record.status === 'PENDING_ASSESSMENT').length,
      assessmentDecisions: Object.freeze(Object.fromEntries(records.flatMap((record) =>
        record.status === 'ASSESSED' && record.assessment
          ? [[record.itemRef, record.assessment.decision] as const]
          : []))),
    })
  }

  async submit(submission: LearnerResponseSubmission): Promise<LearnerResponseSubmissionResult> {
    if (submission.lessonRef !== this.context.lessonRef || submission.lessonRef !== this.#lesson.lessonRef) {
      return reject('wrong-lesson', 'That response belongs to a different lesson.')
    }
    if (!submission.sectionRef) return reject('lost-section-ref', 'The response section reference is required.')
    if (!submission.itemRef) return reject('lost-item-ref', 'The response item reference is required.')
    const item = this.#lesson.segments.flatMap((segment) => segment.items).find((candidate) =>
      candidate.sectionRef === submission.sectionRef && candidate.itemRef === submission.itemRef)
    if (!item) return reject('wrong-item', 'That response item does not belong to this lesson.')
    if (!item.required) return reject('wrong-response-kind', 'This instructional item is read-only.')
    const value = responseValue(item, submission.value)
    if (!value) {
      return reject(item.responseType === 'CHOICE' && submission.value.trim() ? 'invalid-choice' : 'empty-response',
        item.responseType === 'CHOICE' ? 'Choose one of the available answers.' : 'Enter a response before saving.')
    }
    const pending: LearnerResponseRecord = Object.freeze({
      schemaVersion: 1,
      ...this.context,
      sectionRef: item.sectionRef,
      itemRef: item.itemRef,
      segmentRef: submission.segmentRef,
      responseType: item.responseType as LearnerResponseRecord['responseType'],
      evidenceMode: item.evidenceMode,
      response: value,
      status: 'PENDING_ASSESSMENT',
      savedAt: this.now().toISOString(),
      assessment: null,
    })
    try {
      await this.store.save(pending)
    } catch {
      return reject('storage-unavailable', 'The response could not be saved on this device. Nothing advanced.')
    }
    if (!this.assessor) return { status: 'saved', record: pending, assessmentStatus: 'PENDING_ASSESSMENT' }
    try {
      const receipt = await this.assessor.assess(pending)
      if (receipt.assessorRef !== this.assessor.assessorRef) return { status: 'saved', record: pending, assessmentStatus: 'PENDING_ASSESSMENT' }
      const assessed: LearnerResponseRecord = Object.freeze({ ...pending, status: 'ASSESSED', assessment: Object.freeze({ ...receipt }) })
      const committed = await this.store.commitAssessment(pending, assessed)
      if (committed.status === 'stale' || committed.record.status !== 'ASSESSED') {
        return { status: 'saved', record: committed.record, assessmentStatus: 'PENDING_ASSESSMENT' }
      }
      return { status: 'saved', record: committed.record, assessmentStatus: 'ASSESSED' }
    } catch {
      // Offline/unavailable assessment never changes the locally durable pending response.
      return { status: 'saved', record: pending, assessmentStatus: 'PENDING_ASSESSMENT' }
    }
  }
}
