import type { CanonicalCourseCompletion } from './model'

function completionDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value))
}

export function ParentCourseCompletionReport({
  courses,
}: {
  readonly courses: readonly CanonicalCourseCompletion[]
}) {
  return (
    <section className="rounded-2xl border bg-white p-5" data-testid="family-pilot-course-completion-report">
      <h3 className="text-xl font-extrabold">Course completion and next course</h3>
      <p className="mt-2 text-sm text-slate-600">Completion is factual only after every canonical lesson and required assessment is certified. Working levels change only through an authorized Parent action in Preferences.</p>
      <ul className="mt-4 space-y-3">
        {courses.map((course) => (
          <li key={course.courseRef ?? course.subject} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-slate-900">{course.title}</h4>
                <p className="text-sm font-semibold text-slate-600">Current working level: Grade {course.workingGrade}</p>
              </div>
              <strong className={course.status === 'COMPLETE' ? 'text-emerald-700' : course.status === 'UNAVAILABLE' ? 'text-amber-800' : 'text-slate-700'}>
                {course.status === 'COMPLETE'
                  ? 'Course completed'
                  : course.status === 'PENDING_CERTIFICATION'
                    ? 'Course not complete — certification pending'
                    : course.status === 'UNAVAILABLE'
                      ? 'Canonical curriculum unavailable'
                      : course.status === 'NOT_STARTED'
                        ? 'Not started'
                        : 'In progress'}
              </strong>
            </div>
            {course.completedAt ? <p className="mt-2 font-semibold">Completion date: {completionDate(course.completedAt)}</p> : null}
            {course.status === 'UNAVAILABLE' && course.workingGrade === '6' ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Grade 6 has no admitted Manuel Academy curriculum. No Grade 6 course has been invented.</p> : null}
            {course.pendingAssessment ? <p className="mt-2 text-sm font-semibold text-amber-800">Final assessment pending: this course is not complete yet.</p> : null}
            {course.guardianGate ? <p className="mt-2 text-sm font-semibold text-amber-800">Guardian certification pending: this course is not complete yet.</p> : null}
            <p className="mt-2 text-sm text-slate-600">{course.completedLessonCount}/{course.requiredLessonCount} required lessons complete · {course.certifiedAssessmentCount}/{course.requiredAssessmentCount} required assessments certified</p>
            {course.status === 'COMPLETE' ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="font-bold">Canonical next-course choices</p>
                {course.nextCourseOptions.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-sm">{course.nextCourseOptions.map((option) => <li key={option.courseRef}>{option.title} · Grade {option.grade}</li>)}</ul>
                ) : <p className="mt-1 text-sm text-slate-600">No higher canonical course is available for this subject.</p>}
                <p className="mt-2 text-sm font-semibold">Nothing starts automatically. A parent may change this subject’s working level in Preferences.</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
