import { useEffect, useMemo, useState } from 'react'
import type { FinalAssessmentBinding } from '../../../curriculum/final-app-data'
import type { FinalCatalogLesson, FinalCatalogUnit, FinalCurriculumGrade } from '../../../curriculum/final-runtime'
import type { AcademyGrade, AcademySubject } from '../../../types'
import {
  assessmentCandidateStatus,
  lessonCandidateStatus,
  matchesManualLibrarySearch,
  type ManualAssignmentCandidateStatus,
  type ManualAssignmentLibraryStatus,
} from '../parent-assign/libraryModel'
import type { FamilyPilotAssignmentRecordV1 } from '../core'
import type { FamilySetupStudent } from '../setup'
import type { FinalFamilyPilotController } from './controller'
import type { FinalFamilyPilotAssessmentAssignment } from './state'

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

const STATUS_STYLE: Readonly<Record<ManualAssignmentLibraryStatus, string>> = Object.freeze({
  assigned: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  current: 'border-blue-200 bg-blue-50 text-blue-900',
  waiting: 'border-amber-200 bg-amber-50 text-amber-950',
  blocked: 'border-red-200 bg-red-50 text-red-900',
})

function workingGradeFor(student: FamilySetupStudent, subject: AcademySubject): number {
  return Number(student.workingGradeBySubject[subject] ?? student.nominalGrade)
}

function candidateAction(
  status: ManualAssignmentCandidateStatus | null,
  displayName: string,
  onOpen: (assignmentRef: string) => void,
  onAssign: () => void,
  disabled: boolean,
  assignLabel: string,
) {
  if (!status) {
    return <button type="button" disabled={disabled} className="min-h-11 w-full rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" onClick={onAssign}>{assignLabel}</button>
  }
  if (status.status === 'assigned' || status.status === 'current') {
    return <button type="button" className="min-h-11 w-full rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold text-slate-900 sm:w-auto" onClick={() => onOpen(status.assignmentRef)}>{status.status === 'current' ? `Continue for ${displayName}` : 'Open assignment'}</button>
  }
  return null
}

function StatusBadge({ value }: { readonly value: ManualAssignmentCandidateStatus }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${STATUS_STYLE[value.status]}`}>
      <p className="font-extrabold capitalize">{value.status}</p>
      <p>{value.detail}</p>
    </div>
  )
}

export function ParentAssignmentLibrary({
  controller,
  student,
  onOpen,
  refresh,
}: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly onOpen: (studentRef: string, assignmentRef: string) => void
  readonly refresh: () => void
}) {
  const initialSubject = student.enabledSubjects[0]!
  const [subject, setSubject] = useState<AcademySubject>(initialSubject)
  const supportedGrades = useMemo(() => controller.catalog.runtime.listGrades().filter((grade) =>
    controller.catalog.runtime.listCourses(grade).some((course) => course.subject === subject)), [controller, subject])
  const officialGrade = workingGradeFor(student, subject)
  const [browseGrade, setBrowseGrade] = useState<FinalCurriculumGrade | ''>(() =>
    supportedGrades.find((grade) => grade === officialGrade) ?? '')
  const courses = browseGrade === '' ? [] : controller.catalog.runtime.listCourses(browseGrade)
    .filter((course) => course.subject === subject)
  const [courseRef, setCourseRef] = useState('')
  const selectedCourse = courses.find((course) => course.courseRef === courseRef) ?? courses[0]
  const units = selectedCourse ? controller.catalog.runtime.listUnits(selectedCourse.courseRef) : []
  const [unitRef, setUnitRef] = useState('')
  const selectedUnit = units.find((unit) => unit.unitRef === unitRef) ?? units[0]
  const [lessons, setLessons] = useState<readonly FinalCatalogLesson[]>([])
  const [query, setQuery] = useState('')
  const [confirmDifferentLevel, setConfirmDifferentLevel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bindingKindByAssignment, setBindingKindByAssignment] = useState<Record<string, string>>({})
  const [blockedAssessmentRefs, setBlockedAssessmentRefs] = useState<ReadonlySet<string>>(new Set())

  const app = controller.appSnapshot.state
  const assignments = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)?.assignments ?? []
  const assessmentAssignments = controller.assessmentAssignments(student.studentRef)
  const assessmentBindings = selectedCourse ? controller.catalog.listAssessments(selectedCourse.courseRef) : []
  const pendingAssignmentRefs = useMemo(() => new Set(controller.pendingAttestations(student.studentRef).map((item) => item.assignmentRef)), [controller, app.attestations, student.studentRef])
  const heldSessionRefs = useMemo(() => new Set(controller.openSafetyHolds(student.studentRef).map((hold) => hold.sessionRef)), [controller, app.safety.holds, student.studentRef])
  const blockedAssignmentRefs = useMemo(() => {
    const refs = new Set(app.sessions.filter((session) =>
      session.studentRef === student.studentRef && heldSessionRefs.has(session.session.sessionRef))
      .map((session) => session.assignmentRef))
    for (const assignment of assignments) {
      const dynamic = bindingKindByAssignment[assignment.assignmentRef] === 'DYNAMIC_SOURCE_REQUIRED'
      const attached = app.sourceAttachments.some((item) =>
        item.studentRef === student.studentRef && item.assignmentRef === assignment.assignmentRef && item.status === 'ATTACHED_SATISFIED')
      if (dynamic && !attached) refs.add(assignment.assignmentRef)
    }
    return refs
  }, [app.sessions, app.sourceAttachments, assignments, bindingKindByAssignment, heldSessionRefs, student.studentRef])

  useEffect(() => {
    const nextOfficial = workingGradeFor(student, subject)
    setBrowseGrade(supportedGrades.find((grade) => grade === nextOfficial) ?? '')
    setCourseRef('')
    setUnitRef('')
    setQuery('')
    setConfirmDifferentLevel(false)
  }, [student.studentRef, subject])

  useEffect(() => {
    setCourseRef((current) => courses.some((course) => course.courseRef === current) ? current : courses[0]?.courseRef ?? '')
  }, [courses.map((course) => course.courseRef).join('|')])

  useEffect(() => {
    setUnitRef((current) => units.some((unit) => unit.unitRef === current) ? current : units[0]?.unitRef ?? '')
  }, [units.map((unit) => unit.unitRef).join('|')])

  useEffect(() => {
    let live = true
    setLessons([])
    if (!selectedCourse) return () => { live = false }
    setLoading(true)
    void controller.catalog.runtime.listLessons(selectedCourse.courseRef)
      .then((items) => { if (live) { setLessons(items); setError('') } })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : 'The selected course could not be loaded.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [controller, selectedCourse?.courseRef])

  useEffect(() => {
    let live = true
    void Promise.all(assignments.map(async (assignment) => [
      assignment.assignmentRef,
      (await controller.catalog.getBinding(assignment.lessonRef))?.sourceReadinessKind ?? '',
    ] as const)).then((entries) => { if (live) setBindingKindByAssignment(Object.fromEntries(entries)) })
    return () => { live = false }
  }, [controller, assignments.map((item) => `${item.assignmentRef}:${item.updatedAt}`).join('|')])

  useEffect(() => {
    let live = true
    void Promise.all(assessmentBindings.map(async (binding) => {
      const material = await controller.catalog.getAssessment(binding.assessmentRef)
      if (!material?.productionReadiness.requiresSourceAttachment) return null
      const attached = material.location.assessmentLessonRef && app.sourceAttachments.some((item) =>
        item.studentRef === student.studentRef && item.lessonRef === material.location.assessmentLessonRef && item.status === 'ATTACHED_SATISFIED')
      return attached ? null : binding.assessmentRef
    })).then((refs) => { if (live) setBlockedAssessmentRefs(new Set(refs.filter((ref): ref is string => Boolean(ref)))) })
    return () => { live = false }
  }, [controller, assessmentBindings.map((item) => item.assessmentRef).join('|'), app.sourceAttachments, student.studentRef])

  const differentLevel = browseGrade !== '' && browseGrade !== officialGrade
  const canAssignAtLevel = !differentLevel || confirmDifferentLevel
  const subjectTitle = SUBJECT_LABEL[subject]
  const searchedLessons = lessons.filter((lesson) => {
    const unit = units.find((item) => item.unitRef === lesson.unitRef)
    if (!unit) return false
    if (!query.trim() && selectedUnit && lesson.unitRef !== selectedUnit.unitRef) return false
    return matchesManualLibrarySearch(query, {
      title: lesson.title,
      unitTitle: unit.title,
      subjectTitle,
      unitNumber: unit.unitNumber,
      lessonNumber: lesson.dayInUnit,
    })
  })
  const searchedAssessments = assessmentBindings.filter((assessment) => {
    const unit = units.find((item) => item.unitRef === assessment.unitRef)
    if (!unit) return false
    if (!query.trim() && selectedUnit && assessment.unitRef !== selectedUnit.unitRef) return false
    return matchesManualLibrarySearch(query, {
      title: `${unit.title} assessment`,
      unitTitle: unit.title,
      subjectTitle,
      unitNumber: unit.unitNumber,
    })
  })
  const resultUnits = units.filter((unit) =>
    searchedLessons.some((lesson) => lesson.unitRef === unit.unitRef) ||
    searchedAssessments.some((assessment) => assessment.unitRef === unit.unitRef))
  const resultCount = searchedLessons.length + searchedAssessments.length
  const explicitBrowseGrade = differentLevel ? String(browseGrade) as AcademyGrade : undefined
  const assign = async (action: () => Promise<unknown>) => {
    try { await action(); setError(''); refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : 'That assignment could not be saved.') }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="manual-library-heading">
      <p className="text-sm font-extrabold uppercase tracking-wide text-cyan-700">Manual assignment library</p>
      <h3 id="manual-library-heading" className="mt-1 text-2xl font-extrabold text-slate-950">Choose an exact lesson or assessment</h3>
      <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-800">
        <p><strong>Auto Planner is the everyday scheduling path.</strong> Work assigned here is an extra or override. It takes manual precedence until it is resolved, so use this library for exceptions and supplements.</p>
        <p className="mt-2">Browsing or assigning from this page never changes {student.displayName}’s official subject working level.</p>
        <p className="mt-2">Assessment prompts are learner material; scoring and answer authority remain outside this browser view.</p>
      </div>

      <fieldset className="mt-5">
        <legend className="font-extrabold text-slate-900">Browse the admitted curriculum for {student.displayName}</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-bold text-slate-700">Subject
            <select aria-label="Subject" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950" value={subject} onChange={(event) => setSubject(event.target.value as AcademySubject)}>
              {student.enabledSubjects.map((value) => <option key={value} value={value}>{SUBJECT_LABEL[value]}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Working level to browse
            <select aria-label="Working level to browse" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950" value={browseGrade} onChange={(event) => { setBrowseGrade(event.target.value ? Number(event.target.value) as FinalCurriculumGrade : ''); setCourseRef(''); setUnitRef(''); setConfirmDifferentLevel(false) }}>
              <option value="">Choose a supported level</option>
              {supportedGrades.map((grade) => <option key={grade} value={grade}>Grade {grade}{grade === officialGrade ? ' — official working level' : ' — manual browse choice'}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Course
            <select aria-label="Course" disabled={!selectedCourse} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 disabled:bg-slate-100" value={selectedCourse?.courseRef ?? ''} onChange={(event) => { setCourseRef(event.target.value); setUnitRef(''); setQuery('') }}>
              {courses.map((course) => <option key={course.courseRef} value={course.courseRef}>{course.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Unit
            <select aria-label="Unit" disabled={!selectedUnit} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 disabled:bg-slate-100" value={selectedUnit?.unitRef ?? ''} onChange={(event) => { setUnitRef(event.target.value); setQuery('') }}>
              {units.map((unit) => <option key={unit.unitRef} value={unit.unitRef}>Unit {unit.unitNumber}: {unit.title}</option>)}
            </select>
          </label>
        </div>
      </fieldset>

      <p className="mt-3 text-sm text-slate-600">Official {subjectTitle} working level: <strong>Grade {officialGrade}</strong>.</p>
      {differentLevel ? (
        <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-950">
          <input className="mt-1 size-5 shrink-0" type="checkbox" checked={confirmDifferentLevel} onChange={(event) => setConfirmDifferentLevel(event.target.checked)} />
          <span>Use Grade {browseGrade} only for the manual item I choose here. Keep {student.displayName}’s official {subjectTitle} working level at Grade {officialGrade}.</span>
        </label>
      ) : null}

      <label className="mt-5 grid gap-1 font-bold text-slate-800" htmlFor={`manual-library-search-${student.studentRef}`}>Search this course
        <input id={`manual-library-search-${student.studentRef}`} type="search" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal text-slate-950" placeholder="Title, unit, lesson, or subject" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {query.trim() ? <p className="mt-1 text-sm text-slate-600">Search includes every unit in this selected course.</p> : null}
      <p className="mt-3 text-sm font-semibold text-slate-700" role="status" aria-live="polite">{loading ? 'Loading the selected canonical course…' : `${resultCount} exact ${resultCount === 1 ? 'item' : 'items'} shown.`}</p>

      {!browseGrade ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold">Grade {officialGrade} has no admitted {subjectTitle} course. Choose a supported level above; that explicit browse choice will not change the official working level.</p> : null}
      {!loading && selectedCourse && resultCount === 0 ? <p className="mt-4 rounded-lg bg-slate-100 p-4 text-slate-700">No exact lessons or assessments match this search.</p> : null}

      <div className="mt-5 space-y-6">
        {resultUnits.map((unit) => (
          <UnitCandidates
            key={unit.unitRef}
            unit={unit}
            lessons={searchedLessons.filter((lesson) => lesson.unitRef === unit.unitRef)}
            assessments={searchedAssessments.filter((assessment) => assessment.unitRef === unit.unitRef)}
            assignments={assignments}
            assessmentAssignments={assessmentAssignments}
            pendingAssignmentRefs={pendingAssignmentRefs}
            blockedAssignmentRefs={blockedAssignmentRefs}
            blockedAssessmentRefs={blockedAssessmentRefs}
            subjectTitle={subjectTitle}
            student={student}
            browseGrade={browseGrade as number}
            canAssignAtLevel={canAssignAtLevel}
            onOpen={(assignmentRef) => onOpen(student.studentRef, assignmentRef)}
            onAssignLesson={(lessonRef) => void assign(() => controller.assignLesson(student.studentRef, lessonRef, { explicitBrowseGrade }))}
            onAssignAssessment={(assessmentRef) => void assign(() => controller.assignAssessment(student.studentRef, assessmentRef, { explicitBrowseGrade }))}
          />
        ))}
      </div>
      {error ? <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold text-red-900" role="alert">{error}</p> : null}
    </section>
  )
}

function UnitCandidates({
  unit,
  lessons,
  assessments,
  assignments,
  assessmentAssignments,
  pendingAssignmentRefs,
  blockedAssignmentRefs,
  blockedAssessmentRefs,
  subjectTitle,
  student,
  browseGrade,
  canAssignAtLevel,
  onOpen,
  onAssignLesson,
  onAssignAssessment,
}: {
  readonly unit: FinalCatalogUnit
  readonly lessons: readonly FinalCatalogLesson[]
  readonly assessments: readonly Omit<FinalAssessmentBinding, 'state'>[]
  readonly assignments: readonly FamilyPilotAssignmentRecordV1[]
  readonly assessmentAssignments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly pendingAssignmentRefs: ReadonlySet<string>
  readonly blockedAssignmentRefs: ReadonlySet<string>
  readonly blockedAssessmentRefs: ReadonlySet<string>
  readonly subjectTitle: string
  readonly student: FamilySetupStudent
  readonly browseGrade: number
  readonly canAssignAtLevel: boolean
  readonly onOpen: (assignmentRef: string) => void
  readonly onAssignLesson: (lessonRef: string) => void
  readonly onAssignAssessment: (assessmentRef: string) => void
}) {
  return (
    <section aria-labelledby={`manual-unit-${unit.unitRef}`}>
      <div className="border-b border-slate-200 pb-2">
        <p className="text-sm font-bold text-cyan-700">Unit {unit.unitNumber}</p>
        <h4 id={`manual-unit-${unit.unitRef}`} className="text-xl font-extrabold text-slate-950">{unit.title}</h4>
        <p className="mt-1 text-sm text-slate-600">{unit.essentialQuestion}</p>
      </div>
      <ul className="mt-3 grid gap-3">
        {lessons.map((lesson) => {
          const status = lessonCandidateStatus({ lessonRef: lesson.lessonRef, assignments, waitingAssignmentRefs: pendingAssignmentRefs, blockedAssignmentRefs })
          return (
            <li key={lesson.lessonRef} data-lesson-ref={lesson.lessonRef} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <p className="text-sm font-bold text-slate-500">Lesson {lesson.dayInUnit} · Course day {lesson.courseDay}</p>
                  <h5 className="mt-1 text-lg font-extrabold text-slate-950">{lesson.title}</h5>
                  <p className="mt-1 text-sm text-slate-600">{subjectTitle} · Grade {lesson.grade} · {lesson.estimatedMinutes}</p>
                </div>
                {status ? <StatusBadge value={status} /> : null}
              </div>
              <div className="mt-3">{candidateAction(status, student.displayName, onOpen, () => onAssignLesson(lesson.lessonRef), !canAssignAtLevel, browseGrade === workingGradeFor(student, unit.subject) ? 'Assign lesson' : `Assign Grade ${browseGrade} lesson as override`)}</div>
            </li>
          )
        })}
        {assessments.map((assessment) => {
          const assigned = assessmentAssignments.find((item) => item.assessmentRef === assessment.assessmentRef)
          const blocked = assigned && blockedAssessmentRefs.has(assessment.assessmentRef) ? new Set([assigned.assignmentRef]) : new Set<string>()
          const status = assessmentCandidateStatus({ assessmentRef: assessment.assessmentRef, assignments: assessmentAssignments, blockedAssignmentRefs: blocked })
          return (
            <li key={assessment.assessmentRef} data-assessment-ref={assessment.assessmentRef} className="rounded-xl border-2 border-violet-200 bg-violet-50/40 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <p className="text-sm font-bold text-violet-700">Unit {unit.unitNumber} assessment</p>
                  <h5 className="mt-1 text-lg font-extrabold text-slate-950">{unit.title}</h5>
                  <p className="mt-1 text-sm text-slate-600">{subjectTitle} · Grade {assessment.grade} · {assessment.authorityClass.replaceAll('_', ' ').toLowerCase()}</p>
                </div>
                {status ? <StatusBadge value={status} /> : null}
              </div>
              <div className="mt-3">{candidateAction(status, student.displayName, onOpen, () => onAssignAssessment(assessment.assessmentRef), !canAssignAtLevel, browseGrade === workingGradeFor(student, unit.subject) ? 'Assign assessment' : `Assign Grade ${browseGrade} assessment as override`)}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
