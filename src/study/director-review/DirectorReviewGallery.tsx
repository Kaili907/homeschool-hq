import { useEffect, useMemo, useState } from 'react'
import { FamilyPilotLessonPlayer, createRichLessonRenderModel } from '../family-pilot/lesson-player'
import { mapLearnerMaterialToStudySegments } from '../family-pilot/final-app/learner-response'
import type { FamilyPilotStudySnapshot } from '../family-pilot/study'
import {
  DIRECTOR_REVIEW_GRADES,
  DIRECTOR_REVIEW_PATH,
  DIRECTOR_REVIEW_SAMPLES,
  DIRECTOR_REVIEW_SUBJECTS,
  directorReviewSample,
  type DirectorReviewGrade,
  type DirectorReviewSample,
  type DirectorReviewStatus,
  type DirectorReviewSubject,
} from './registry'
import './director-review.css'

const NOTES_KEY = 'manuel-academy:director-review:r2:notes'

interface ReviewNote {
  readonly status: DirectorReviewStatus
  readonly note: string
}

type ReviewNotes = Readonly<Record<string, ReviewNote>>

function loadNotes(): ReviewNotes {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTES_KEY) ?? '{}') as ReviewNotes
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function navigate(sampleId: string | null, replace = false) {
  const next = new URL(DIRECTOR_REVIEW_PATH, window.location.origin)
  if (sampleId) next.searchParams.set('sample', sampleId)
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${next.pathname}${next.search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function orderedSamples(order: 'grade' | 'subject') {
  const subjectIndex = new Map(DIRECTOR_REVIEW_SUBJECTS.map((subject, index) => [subject, index]))
  return [...DIRECTOR_REVIEW_SAMPLES].sort((a, b) => order === 'grade'
    ? a.grade - b.grade || (subjectIndex.get(a.subject) ?? 0) - (subjectIndex.get(b.subject) ?? 0)
    : (subjectIndex.get(a.subject) ?? 0) - (subjectIndex.get(b.subject) ?? 0) || a.grade - b.grade)
}

function statusLabel(status: DirectorReviewStatus) {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'NEEDS_CHANGES') return 'Needs changes'
  return 'Pending Director review'
}

function ReviewNotesPanel({ sample, notes, onChange }: {
  readonly sample: DirectorReviewSample
  readonly notes: ReviewNotes
  readonly onChange: (next: ReviewNotes) => void
}) {
  const current = notes[sample.sampleId] ?? { status: 'PENDING_DIRECTOR_REVIEW' as const, note: '' }
  const update = (value: ReviewNote) => {
    const next = { ...notes, [sample.sampleId]: value }
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(next))
    onChange(next)
  }
  return (
    <aside className="director-review__notes" aria-labelledby="director-review-notes-heading">
      <div>
        <p className="director-review__kicker">Local review record</p>
        <h2 id="director-review-notes-heading">Director notes</h2>
        <p>Saved only in this browser. Nothing is sent to Family Cloud or learner records.</p>
        <code>{sample.sampleId}</code>
      </div>
      <label>Status
        <select value={current.status} onChange={(event) => update({ ...current, status: event.target.value as DirectorReviewStatus })}>
          <option value="PENDING_DIRECTOR_REVIEW">Pending Director review</option>
          <option value="APPROVED">Approved</option>
          <option value="NEEDS_CHANGES">Needs changes</option>
        </select>
      </label>
      <label>Review note
        <textarea rows={3} value={current.note} placeholder="Record a concise change request or approval note." onChange={(event) => update({ ...current, note: event.target.value })} />
      </label>
    </aside>
  )
}

function sampleNeighbors(sample: DirectorReviewSample, order: 'grade' | 'subject') {
  const ordered = orderedSamples(order)
  const index = ordered.findIndex((candidate) => candidate.sampleId === sample.sampleId)
  const sameSubject = DIRECTOR_REVIEW_SAMPLES.filter((candidate) => candidate.subject === sample.subject)
  const gradeIndex = sameSubject.findIndex((candidate) => candidate.grade === sample.grade)
  return {
    previous: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null,
    previousGrade: sameSubject[gradeIndex - 1] ?? null,
    nextGrade: sameSubject[gradeIndex + 1] ?? null,
  }
}

function ReviewLesson({ sample, order, notes, onNotesChange }: {
  readonly sample: DirectorReviewSample
  readonly order: 'grade' | 'subject'
  readonly notes: ReviewNotes
  readonly onNotesChange: (next: ReviewNotes) => void
}) {
  const renderModel = useMemo(() => createRichLessonRenderModel(sample.material), [sample])
  const responseModel = useMemo(() => mapLearnerMaterialToStudySegments(sample.material), [sample])
  const [segmentOrdinal, setSegmentOrdinal] = useState(1)
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [answered, setAnswered] = useState<readonly string[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const neighbors = sampleNeighbors(sample, order)
  const role = segmentOrdinal === 1 ? 'LEARN' : segmentOrdinal === 2 ? 'PRACTICE' : 'REFLECT'
  const roleItems = responseModel.segments.find((segment) => segment.role === role)?.items ?? []
  const unanswered = roleItems.find((item) => item.required && !answered.includes(item.itemRef)) ?? null
  const segmentRefs = [`${sample.sampleId}:learn`, `${sample.sampleId}:practice`, `${sample.sampleId}:reflect`]
  const segmentRef = segmentRefs[segmentOrdinal - 1]!
  const snapshot: FamilyPilotStudySnapshot = {
    session: {
      householdRef: 'director-review:ephemeral', learnerRef: 'director-review:reviewer',
      blockRef: `director-review:${sample.sampleId}`, sessionRef: `director-review:${sample.sampleId}`,
    },
    lessonRef: sample.material.lessonRef,
    title: sample.material.title,
    assignmentState: status === 'completed' ? 'completed' : 'active',
    sessionStatus: status === 'completed' ? 'completed' : 'active',
    segmentRef: status === 'completed' ? null : segmentRef,
    segmentOrdinal: status === 'completed' ? null : segmentOrdinal,
    completedSegmentRefs: segmentRefs.slice(0, status === 'completed' ? 3 : segmentOrdinal - 1),
    remainingSegmentRefs: status === 'completed' ? [] : segmentRefs.slice(segmentOrdinal - 1),
    elapsedActiveSecondsInSegment: 0,
    checkpointRef: null,
    checkpointRevision: 0,
    presentationProgressRef: cursor,
    lastAcceptedEventRef: null,
    masteryAuthority: 'completion-only',
    tutorBridgeAvailable: false,
    requiredWorkCompletionPercent: Math.round(answered.length / Math.max(1, responseModel.segments.flatMap((segment) => segment.items).filter((item) => item.required).length) * 100),
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
  const segmentContent = {
    title: unanswered?.title,
    instruction: unanswered?.instruction,
    prompt: unanswered?.prompt,
    example: unanswered?.example,
    lessonRef: sample.material.lessonRef,
    sectionRef: unanswered?.sectionRef,
    itemRef: unanswered?.itemRef,
    responseKind: unanswered?.responseType ?? 'none' as const,
    choices: unanswered?.choices.map((choice) => ({ id: choice.choiceRef, label: choice.label })),
    pendingAssessmentCount: answered.length,
    answeredItemRefs: answered,
    requiredItemRefs: roleItems.filter((item) => item.required).map((item) => item.itemRef),
    canCompleteSegment: !unanswered,
    assessmentDecisions: Object.fromEntries(answered.map((itemRef) => [itemRef, 'REVIEW_REQUIRED' as const])),
  }
  const advanceSegment = () => {
    setCursor(null)
    if (segmentOrdinal < 3) setSegmentOrdinal((value) => value + 1)
    else setStatus('completed')
  }
  const reviewLesson = () => {
    setStatus('active')
    setSegmentOrdinal(1)
    setCursor(renderModel.pages.find((page) => page.role === 'LEARN')?.progressRef ?? null)
  }

  return (
    <div className="director-review director-review--lesson">
      <header className="director-review__lesson-header">
        <div>
          <p className="director-review__kicker">Director Review · ephemeral session</p>
          <h1>Grade {sample.grade} · {sample.subject}</h1>
          <p>{sample.course} · {sample.topic}</p>
        </div>
        <button type="button" onClick={() => navigate(null)}>Back to gallery</button>
      </header>

      <nav className="director-review__navigator" aria-label="Director sample navigation">
        <button type="button" disabled={!neighbors.previous} onClick={() => navigate(neighbors.previous?.sampleId ?? null)}>← Previous sample</button>
        <button type="button" disabled={!neighbors.previousGrade} onClick={() => navigate(neighbors.previousGrade?.sampleId ?? null)}>Previous grade</button>
        <button type="button" disabled={!neighbors.nextGrade} onClick={() => navigate(neighbors.nextGrade?.sampleId ?? null)}>Next grade</button>
        <button type="button" disabled={!neighbors.next} onClick={() => navigate(neighbors.next?.sampleId ?? null)}>Next sample →</button>
      </nav>

      <div className="director-review__boundary" role="note">
        Review controls end here. The lesson below is the real Rich Study Player. Responses exist only in memory and reset when this sample is reopened.
      </div>

      <section className="director-review__player" aria-label={`Grade ${sample.grade} ${sample.subject} Rich Study Player`}>
        <FamilyPilotLessonPlayer
          status={status}
          snapshot={snapshot}
          segmentContent={segmentContent}
          renderModel={renderModel}
          tutorHelpAvailable={false}
          onSubmitAction={() => { if (unanswered) setAnswered((held) => held.includes(unanswered.itemRef) ? held : [...held, unanswered.itemRef]) }}
          onPause={(progressRef) => setCursor(progressRef ?? null)}
          onResume={() => undefined}
          onNext={advanceSegment}
          onCompleteSegment={advanceSegment}
          onOpenTutor={() => undefined}
          onExit={(progressRef) => { setCursor(progressRef ?? null); navigate(null) }}
          onReviewLesson={reviewLesson}
        />
      </section>

      <ReviewNotesPanel sample={sample} notes={notes} onChange={onNotesChange} />
    </div>
  )
}

function GalleryHome({ order, setOrder, notes }: {
  readonly order: 'grade' | 'subject'
  readonly setOrder: (order: 'grade' | 'subject') => void
  readonly notes: ReviewNotes
}) {
  const [subject, setSubject] = useState<'ALL' | DirectorReviewSubject>('ALL')
  const [grade, setGrade] = useState<'ALL' | DirectorReviewGrade>('ALL')
  const samples = orderedSamples(order).filter((sample) =>
    (subject === 'ALL' || sample.subject === subject) && (grade === 'ALL' || sample.grade === grade))
  return (
    <main className="director-review">
      <header className="director-review__hero">
        <p className="director-review__kicker">Manuel Academy · non-production approval surface</p>
        <h1>Director Sample R2 Review Gallery</h1>
        <p>Review all 36 samples through the exact Rich Study Player used by learners. No assignment, learner progress, School Plan, or Family Cloud record is created here.</p>
        <div className="director-review__summary" aria-label="Sample inventory">
          <span><strong>36</strong> samples</span><span><strong>4</strong> subjects</span><span><strong>9</strong> grades</span><span><strong>0</strong> Grade 6</span>
        </div>
      </header>

      <section className="director-review__filters" aria-label="Gallery filters">
        <label>Subject
          <select value={subject} onChange={(event) => setSubject(event.target.value as typeof subject)}>
            <option value="ALL">All subjects</option>
            {DIRECTOR_REVIEW_SUBJECTS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Grade
          <select value={grade} onChange={(event) => setGrade(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value) as DirectorReviewGrade)}>
            <option value="ALL">All grades</option>
            {DIRECTOR_REVIEW_GRADES.map((value) => <option key={value} value={value}>Grade {value}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Review order</legend>
          <label><input type="radio" name="review-order" checked={order === 'grade'} onChange={() => setOrder('grade')} /> Grade first</label>
          <label><input type="radio" name="review-order" checked={order === 'subject'} onChange={() => setOrder('subject')} /> Subject first</label>
        </fieldset>
      </section>

      <p className="director-review__results" role="status">Showing {samples.length} of 36 samples</p>
      <section className="director-review__grid" aria-label="Director samples">
        {samples.map((sample) => {
          const status = notes[sample.sampleId]?.status ?? sample.directorStatus
          return (
            <article key={sample.sampleId} className="director-review__tile">
              <div className="director-review__tile-top"><span>Grade {sample.grade}</span><span>{sample.subject}</span></div>
              <h2>{sample.topic}</h2>
              <p><strong>Course:</strong> {sample.course}</p>
              <p><strong>Standards:</strong> {sample.standard.join(', ')}</p>
              <p className={`director-review__status director-review__status--${status.toLowerCase()}`}>{statusLabel(status)}</p>
              <button type="button" onClick={() => navigate(sample.sampleId)}>Open in Rich Study Player</button>
            </article>
          )
        })}
      </section>
    </main>
  )
}

export function DirectorReviewGallery() {
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('sample'))
  const [order, setOrder] = useState<'grade' | 'subject'>('grade')
  const [notes, setNotes] = useState<ReviewNotes>(loadNotes)
  useEffect(() => {
    const sync = () => setSelectedId(new URLSearchParams(window.location.search).get('sample'))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const selected = directorReviewSample(selectedId)
  if (selectedId && !selected) {
    return <main className="director-review"><h1>Sample not found</h1><p>The requested Director sample identifier is not in the R2 convergence manifest.</p><button type="button" onClick={() => navigate(null, true)}>Back to gallery</button></main>
  }
  return selected
    ? <ReviewLesson key={selected.sampleId} sample={selected} order={order} notes={notes} onNotesChange={setNotes} />
    : <GalleryHome order={order} setOrder={setOrder} notes={notes} />
}

export default DirectorReviewGallery
