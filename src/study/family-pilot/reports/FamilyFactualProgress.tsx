import type { AcademySubject } from '../../../types'
import { FAMILY_PILOT_INSTRUCTIONAL_TIME_POLICY } from '../core'
import type { FamilyFactualProgressModel, FactualAssessmentProgress, FactualStudyTime } from './factualProgress'

const SUBJECT_LABEL: Readonly<Record<AcademySubject, string>> = Object.freeze({
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology / Computer Science',
  'arts-and-music': 'Arts / Music',
  'financial-literacy': 'Financial Literacy',
})

function formatStudyTime(time: FactualStudyTime): string {
  if (time.activeSeconds === null) return 'Not recorded for this period'
  const minutes = Math.floor(time.activeSeconds / 60)
  const seconds = time.activeSeconds % 60
  const value = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  return time.coverage === 'partial' ? `${value} (partial recorded history)` : value
}

function assessmentText(assessments: FactualAssessmentProgress): string {
  if (assessments.assigned === 0) return 'No assessments assigned'
  return `${assessments.certified} certified · ${assessments.pending} pending`
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return <div className="rounded-xl bg-slate-100 p-4"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div>
}

/** Parent-facing, per-learner factual report. */
export function FamilyFactualProgress({ model }: { readonly model: FamilyFactualProgressModel }) {
  return (
    <div className="space-y-5" data-family-progress-student-ref={model.learner.studentRef}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-extrabold">{model.learner.displayName}&rsquo;s progress</h3>
        <p className="mt-1 text-sm text-slate-600">Counts come from saved Study lessons and assessment status records.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Today" value={`${model.today.lessonsCompleted} lessons · ${formatStudyTime(model.today.studyTime)}`} />
          <Fact label="This week" value={`${model.thisWeek.lessonsCompleted} lessons · ${formatStudyTime(model.thisWeek.studyTime)}`} />
          <Fact label="Lessons" value={`${model.lessons.completed} of ${model.lessons.assigned} assigned complete`} />
          <Fact label="Assessments" value={assessmentText(model.assessments)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={`subject-progress-${model.learner.studentRef}`}>
        <h3 id={`subject-progress-${model.learner.studentRef}`} className="text-xl font-extrabold">By subject</h3>
        <ul className="mt-3 space-y-3">{model.subjects.map((subject) => (
          <li key={subject.subject} className="rounded-xl border border-slate-200 p-4">
            <p className="font-extrabold">{SUBJECT_LABEL[subject.subject]} · Working Grade {subject.workingGrade}</p>
            <p className="mt-1 text-sm text-slate-700">{subject.completedLessons} of {subject.assignedLessons} assigned lessons complete{subject.totalCourseLessons !== null ? ` · ${subject.totalCourseLessons} lessons in the current course catalog` : ''}</p>
            <p className="mt-1 text-sm text-slate-700">Current position: {subject.currentUnit ? `Unit ${subject.currentUnit.unitNumber}: ${subject.currentUnit.title}` : 'No current unit'}{subject.currentLesson ? ` · ${subject.currentLesson.title} (${subject.currentLesson.state})` : ''}</p>
            <p className="mt-1 text-sm text-slate-700">This week: {formatStudyTime(subject.studyTimeThisWeek)} · Assessments: {assessmentText(subject.assessments)}</p>
          </li>
        ))}</ul>
      </section>

      <p className="text-sm text-slate-600">Certified means the saved assessment record is certified. No GPA or report-card grade is calculated here.</p>
      <p className="text-sm text-slate-600">Study time counts only bounded intervals while Study is active and the lesson is visible. Paused and hidden time is excluded. No keyboard, pointer, or inferred-idle tracking is stored (policy: {FAMILY_PILOT_INSTRUCTIONAL_TIME_POLICY.idleDetection}).</p>
    </div>
  )
}

/** Learner-facing facts with encouraging, non-comparative copy. */
export function LearnerFactualProgress({ model }: { readonly model: FamilyFactualProgressModel }) {
  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5" data-learner-progress-student-ref={model.learner.studentRef}>
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Your saved progress</p>
      <h2 className="mt-1 text-xl font-extrabold">Keep building from what you&rsquo;ve completed</h2>
      <p className="mt-2">This week you completed {model.thisWeek.lessonsCompleted} {model.thisWeek.lessonsCompleted === 1 ? 'lesson' : 'lessons'} and recorded {formatStudyTime(model.thisWeek.studyTime)} of Study time.</p>
      <p className="mt-1 text-sm text-slate-600">{model.assessments.certified} certified assessments · {model.assessments.pending} pending. This is your own record; it is not a comparison or rank.</p>
    </section>
  )
}
