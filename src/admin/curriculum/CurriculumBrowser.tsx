import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CURRICULUM_READ_CAPABILITY,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumGrade,
  type CurriculumLessonDetail,
  type CurriculumLessonSummary,
  type CurriculumReadAuthorization,
  type CurriculumSearchFilters,
} from './contracts'
import { buildStandardsCoverage, searchCurriculum } from './readModel'

export interface CurriculumBrowserLocation {
  readonly mode: 'hierarchy' | 'standards'
  readonly grade?: CurriculumGrade
  readonly courseId?: string
  readonly unitNumber?: number
  readonly lessonId?: string
}

const ROOT_LOCATION: CurriculumBrowserLocation = { mode: 'hierarchy' }

export interface CurriculumBrowserProps {
  readonly authorization: CurriculumReadAuthorization
  readonly source: CurriculumBrowserSource
}

export function hasCurriculumReadAccess(authorization: CurriculumReadAuthorization): boolean {
  return authorization.status === 'authorized'
    && authorization.capabilities.includes(CURRICULUM_READ_CAPABILITY)
}

export function CurriculumBrowser({ authorization, source }: CurriculumBrowserProps) {
  const canRead = hasCurriculumReadAccess(authorization)
  const [catalog, setCatalog] = useState<CurriculumCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [location, setLocation] = useState<CurriculumBrowserLocation>(ROOT_LOCATION)
  const [lesson, setLesson] = useState<CurriculumLessonDetail | null>(null)
  const [lessonError, setLessonError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CurriculumSearchFilters>({})

  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!canRead) {
      setCatalog(null)
      setLesson(null)
      return
    }
    let current = true
    setCatalogError(null)
    source.loadCatalog()
      .then((next) => {
        if (current) setCatalog(next)
      })
      .catch((error: unknown) => {
        if (current) setCatalogError(error instanceof Error ? error.message : 'Unknown curriculum source failure')
      })
    return () => { current = false }
  }, [canRead, reload, source])

  useEffect(() => {
    if (!canRead || !location.lessonId) {
      setLesson(null)
      setLessonError(null)
      return
    }
    let current = true
    setLesson(null)
    setLessonError(null)
    source.loadLesson(location.lessonId)
      .then((next) => {
        if (current) setLesson(next)
      })
      .catch((error: unknown) => {
        if (current) setLessonError(error instanceof Error ? error.message : 'Unknown lesson source failure')
      })
    return () => { current = false }
  }, [canRead, location.lessonId, source])

  if (authorization.status === 'checking') {
    return <CurriculumBrowserStateMessage role="status" title="Checking Admin access">Curriculum data has not been requested yet.</CurriculumBrowserStateMessage>
  }
  if (!canRead) {
    return (
      <CurriculumBrowserStateMessage role="alert" title="Curriculum access unavailable">
        {authorization.status === 'denied' && authorization.message
          ? authorization.message
          : 'This Admin session does not have the curriculum:read capability.'}
      </CurriculumBrowserStateMessage>
    )
  }
  if (catalogError) {
    return <CurriculumBrowserStateMessage role="alert" title="Curriculum source unavailable" onRetry={() => setReload((value) => value + 1)}>The published curriculum could not be validated: {catalogError}</CurriculumBrowserStateMessage>
  }
  if (!catalog) {
    return <CurriculumBrowserStateMessage role="status" title="Loading curriculum">Loading the authorized published curriculum read model.</CurriculumBrowserStateMessage>
  }
  return (
    <CurriculumBrowserView
      catalog={catalog}
      location={location}
      lesson={lesson}
      lessonError={lessonError}
      filters={filters}
      onLocationChange={setLocation}
      onFiltersChange={setFilters}
    />
  )
}

export function CurriculumBrowserStateMessage({ role, title, children, onRetry }: { role: 'status' | 'alert'; title: string; children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="bg-slate-950 py-6 text-slate-100">
      <div role={role} className="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-slate-300">{children}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">Try again</button>}
      </div>
    </div>
  )
}

export interface CurriculumBrowserViewProps {
  readonly catalog: CurriculumCatalog
  readonly location: CurriculumBrowserLocation
  readonly lesson: CurriculumLessonDetail | null
  readonly lessonError: string | null
  readonly filters: CurriculumSearchFilters
  readonly onLocationChange: (location: CurriculumBrowserLocation) => void
  readonly onFiltersChange: (filters: CurriculumSearchFilters) => void
}

export function CurriculumBrowserView({
  catalog,
  location,
  lesson,
  lessonError,
  filters,
  onLocationChange,
  onFiltersChange,
}: CurriculumBrowserViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const locationKey = `${location.mode}:${location.grade ?? ''}:${location.courseId ?? ''}:${location.unitNumber ?? ''}:${location.lessonId ?? ''}`
  useEffect(() => { headingRef.current?.focus() }, [locationKey])

  const selectedCourse = location.courseId
    ? catalog.courses.find((course) => course.courseId === location.courseId)
    : undefined
  const selectedUnit = selectedCourse && location.unitNumber !== undefined
    ? catalog.units.find((unit) => unit.courseId === selectedCourse.courseId && unit.unitNumber === location.unitNumber)
    : undefined
  const hasSearch = Boolean(
    filters.keyword?.trim() || filters.standard?.trim() || filters.grade
    || filters.courseId || filters.unitNumber,
  )
  const searchResult = useMemo(
    () => searchCurriculum(catalog, filters),
    [catalog, filters],
  )

  const openLesson = (summary: CurriculumLessonSummary) => onLocationChange({
    mode: 'hierarchy',
    grade: summary.grade,
    courseId: summary.courseId,
    unitNumber: summary.unitNumber,
    lessonId: summary.lessonId,
  })

  return (
    <div className="min-w-0 bg-slate-950 py-4 text-slate-100 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Admin Console · Read-only</p>
              <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold outline-none sm:text-3xl">
                Curriculum Browser
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Published package <strong>{catalog.source.packageId}</strong> · version <strong>{catalog.source.version}</strong>
                {' '}· authored {catalog.source.authoredOn} · validation {catalog.source.validationStatus}
              </p>
            </div>
            <span className="rounded-full border border-emerald-700 bg-emerald-950 px-3 py-1 text-sm font-bold text-emerald-300">
              {catalog.source.lifecycle}
            </span>
          </div>
          <nav aria-label="Curriculum browser views" className="mt-4 flex flex-wrap gap-2">
            <button type="button" aria-current={location.mode === 'hierarchy' ? 'page' : undefined} onClick={() => onLocationChange(ROOT_LOCATION)} className={navButton(location.mode === 'hierarchy')}>
              Curriculum hierarchy
            </button>
            <button type="button" aria-current={location.mode === 'standards' ? 'page' : undefined} onClick={() => onLocationChange({ mode: 'standards' })} className={navButton(location.mode === 'standards')}>
              Standards coverage
            </button>
            <a href="/academy/admin/curriculum/validation" className={navButton(false)}>
              Validation evidence
            </a>
            <a href="/academy/admin/curriculum/standards-review" className={navButton(false)}>
              Standards review
            </a>
          </nav>
        </header>

        <SearchPanel catalog={catalog} filters={filters} onChange={onFiltersChange} />
        {hasSearch && (
          <SearchResults
            result={searchResult}
            onOpenLesson={openLesson}
          />
        )}

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
          {location.mode === 'standards' ? (
            <StandardsView catalog={catalog} query={filters.standard ?? ''} onOpenLesson={openLesson} />
          ) : (
            <>
              <Breadcrumbs
                catalog={catalog}
                location={location}
                onChange={onLocationChange}
              />
              {location.lessonId ? (
                <LessonView detail={lesson} error={lessonError} />
              ) : selectedUnit ? (
                <UnitView catalog={catalog} unit={selectedUnit} onOpenLesson={openLesson} />
              ) : selectedCourse ? (
                <CourseView catalog={catalog} courseId={selectedCourse.courseId} onChange={onLocationChange} />
              ) : location.grade ? (
                <GradeView catalog={catalog} grade={location.grade} onChange={onLocationChange} />
              ) : (
                <GradePicker catalog={catalog} onChange={onLocationChange} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const navButton = (active: boolean) => `min-h-11 rounded-lg border px-4 py-2 text-sm font-bold ${active
  ? 'border-cyan-500 bg-cyan-950 text-cyan-200'
  : 'border-slate-600 bg-slate-950 text-slate-200 hover:border-slate-400'}`

function SearchPanel({ catalog, filters, onChange }: {
  catalog: CurriculumCatalog
  filters: CurriculumSearchFilters
  onChange: (filters: CurriculumSearchFilters) => void
}) {
  const courses = filters.grade
    ? catalog.courses.filter((course) => course.grade === filters.grade)
    : catalog.courses
  const units = catalog.units.filter((unit) => {
    if (filters.grade && unit.grade !== filters.grade) return false
    if (filters.courseId && unit.courseId !== filters.courseId) return false
    return true
  })
  return (
    <section aria-labelledby="curriculum-search-heading" className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <h2 id="curriculum-search-heading" className="font-bold">Search and filter</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm font-semibold text-slate-300 lg:col-span-2">
          Lesson, title, unit, or keyword
          <input
            type="search"
            value={filters.keyword ?? ''}
            onChange={(event) => onChange({ ...filters, keyword: event.target.value || undefined })}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Standard
          <input
            type="search"
            value={filters.standard ?? ''}
            onChange={(event) => onChange({ ...filters, standard: event.target.value || undefined })}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Grade
          <select
            value={filters.grade ?? ''}
            onChange={(event) => onChange({
              ...filters,
              grade: event.target.value ? Number(event.target.value) as CurriculumGrade : undefined,
              courseId: undefined,
              unitNumber: undefined,
            })}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
          >
            <option value="">All grades</option>
            {catalog.grades.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Course
          <select
            value={filters.courseId ?? ''}
            onChange={(event) => onChange({
              ...filters,
              courseId: event.target.value || undefined,
              unitNumber: undefined,
            })}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
          >
            <option value="">All courses</option>
            {courses.map((course) => <option key={course.courseId} value={course.courseId}>{course.title}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Unit
          <select
            value={filters.unitNumber ?? ''}
            onChange={(event) => onChange({
              ...filters,
              unitNumber: event.target.value ? Number(event.target.value) : undefined,
            })}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-slate-100"
          >
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit.unitId} value={unit.unitNumber}>
                {filters.courseId ? `Unit ${unit.unitNumber}: ${unit.title}` : `${unit.courseId} · Unit ${unit.unitNumber}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={() => onChange({})} className="mt-3 min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold hover:border-slate-400">
        Clear filters
      </button>
    </section>
  )
}

function SearchResults({ result, onOpenLesson }: {
  result: ReturnType<typeof searchCurriculum>
  onOpenLesson: (lesson: CurriculumLessonSummary) => void
}) {
  return (
    <section aria-labelledby="curriculum-search-results" className="mt-5 rounded-2xl border border-cyan-900 bg-slate-900 p-4">
      <h2 id="curriculum-search-results" className="font-bold">Search results</h2>
      <p role="status" className="mt-1 text-sm text-slate-400">
        {result.totalMatches} matching lessons{result.limited ? `; showing the first ${result.lessons.length}` : ''}.
      </p>
      {result.lessons.length === 0 ? (
        <p className="mt-3 text-slate-300">No published lessons match these filters.</p>
      ) : (
        <LessonButtons lessons={result.lessons} onOpenLesson={onOpenLesson} />
      )}
    </section>
  )
}

function Breadcrumbs({ catalog, location, onChange }: {
  catalog: CurriculumCatalog
  location: CurriculumBrowserLocation
  onChange: (location: CurriculumBrowserLocation) => void
}) {
  const course = catalog.courses.find((item) => item.courseId === location.courseId)
  const unit = catalog.units.find((item) => item.courseId === location.courseId && item.unitNumber === location.unitNumber)
  return (
    <nav aria-label="Curriculum breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={() => onChange(ROOT_LOCATION)} className="min-h-11 rounded px-2 font-bold text-cyan-300 hover:bg-slate-800">Grades</button>
      {location.grade && <><span aria-hidden="true">/</span><button type="button" onClick={() => onChange({ mode: 'hierarchy', grade: location.grade })} className="min-h-11 rounded px-2 font-bold text-cyan-300 hover:bg-slate-800">Grade {location.grade}</button></>}
      {course && <><span aria-hidden="true">/</span><button type="button" onClick={() => onChange({ mode: 'hierarchy', grade: course.grade, courseId: course.courseId })} className="min-h-11 rounded px-2 font-bold text-cyan-300 hover:bg-slate-800">{course.title}</button></>}
      {unit && <><span aria-hidden="true">/</span><button type="button" onClick={() => onChange({ mode: 'hierarchy', grade: unit.grade, courseId: unit.courseId, unitNumber: unit.unitNumber })} className="min-h-11 rounded px-2 font-bold text-cyan-300 hover:bg-slate-800">Unit {unit.unitNumber}</button></>}
      {location.lessonId && <><span aria-hidden="true">/</span><span aria-current="page" className="px-2 text-slate-300">Lesson {location.lessonId}</span></>}
    </nav>
  )
}

function GradePicker({ catalog, onChange }: { catalog: CurriculumCatalog; onChange: (location: CurriculumBrowserLocation) => void }) {
  return (
    <section aria-labelledby="curriculum-grades">
      <h2 id="curriculum-grades" className="text-xl font-bold">Choose a grade</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {catalog.grades.map((grade) => {
          const courses = catalog.courses.filter((course) => course.grade === grade)
          const lessons = catalog.lessons.filter((lesson) => lesson.grade === grade)
          return <button key={grade} type="button" onClick={() => onChange({ mode: 'hierarchy', grade })} className="min-h-24 rounded-xl border border-slate-600 bg-slate-950 p-4 text-left hover:border-cyan-500"><span className="block text-xl font-bold">Grade {grade}</span><span className="mt-1 block text-sm text-slate-400">{courses.length} courses · {lessons.length} lessons</span></button>
        })}
      </div>
    </section>
  )
}

function GradeView({ catalog, grade, onChange }: { catalog: CurriculumCatalog; grade: CurriculumGrade; onChange: (location: CurriculumBrowserLocation) => void }) {
  const courses = catalog.courses.filter((course) => course.grade === grade)
  return (
    <section aria-labelledby="curriculum-grade-heading">
      <h2 id="curriculum-grade-heading" className="text-xl font-bold">Grade {grade} courses</h2>
      {courses.length === 0 ? <Unavailable /> : <div className="mt-4 grid gap-3 md:grid-cols-2">{courses.map((course) => (
        <button key={course.courseId} type="button" onClick={() => onChange({ mode: 'hierarchy', grade, courseId: course.courseId })} className="min-h-24 rounded-xl border border-slate-600 bg-slate-950 p-4 text-left hover:border-cyan-500"><span className="block font-bold">{course.title}</span><span className="mt-1 block text-sm text-slate-400">{course.days} instructional days · {catalog.units.filter((unit) => unit.courseId === course.courseId).length} units</span>{course.description && <span className="mt-2 block text-sm text-slate-300">{course.description}</span>}</button>
      ))}</div>}
    </section>
  )
}

function CourseView({ catalog, courseId, onChange }: { catalog: CurriculumCatalog; courseId: string; onChange: (location: CurriculumBrowserLocation) => void }) {
  const course = catalog.courses.find((item) => item.courseId === courseId)!
  const units = catalog.units.filter((unit) => unit.courseId === courseId).sort((a, b) => a.unitNumber - b.unitNumber)
  return (
    <section aria-labelledby="curriculum-course-heading">
      <h2 id="curriculum-course-heading" className="text-xl font-bold">{course.title}</h2>
      <p className="mt-2 text-slate-300">{course.description ?? 'Course description unavailable.'}</p>
      <p className="mt-2 text-sm text-slate-400">Capstone: {course.capstone ?? 'Unavailable'}</p>
      {units.length === 0 ? <Unavailable /> : <ol className="mt-4 grid gap-3 md:grid-cols-2">{units.map((unit) => (
        <li key={unit.unitId}><button type="button" onClick={() => onChange({ mode: 'hierarchy', grade: course.grade, courseId, unitNumber: unit.unitNumber })} className="min-h-24 w-full rounded-xl border border-slate-600 bg-slate-950 p-4 text-left hover:border-cyan-500"><span className="block font-bold">Unit {unit.unitNumber}: {unit.title}</span><span className="mt-1 block text-sm text-slate-400">{unit.days} days · {unit.lessonIds.length} lessons · {unit.assessmentId ? 'assessment linked' : 'assessment unavailable'}</span></button></li>
      ))}</ol>}
    </section>
  )
}

function UnitView({ catalog, unit, onOpenLesson }: { catalog: CurriculumCatalog; unit: CurriculumCatalog['units'][number]; onOpenLesson: (lesson: CurriculumLessonSummary) => void }) {
  const lessons = catalog.lessons.filter((lesson) => lesson.courseId === unit.courseId && lesson.unitNumber === unit.unitNumber).sort((a, b) => a.dayInUnit - b.dayInUnit)
  return (
    <section aria-labelledby="curriculum-unit-heading">
      <h2 id="curriculum-unit-heading" className="text-xl font-bold">Unit {unit.unitNumber}: {unit.title}</h2>
      <p className="mt-2 text-slate-300">{unit.essentialQuestion ?? 'Essential question unavailable.'}</p>
      <p className="mt-2 text-sm text-slate-400">Standards: {unit.standards.join(', ') || 'Unavailable'}</p>
      <p className="mt-2 text-sm text-slate-400">Performance task: {unit.performanceTask ?? 'Unavailable'}</p>
      {lessons.length === 0 ? <Unavailable /> : <LessonButtons lessons={lessons} onOpenLesson={onOpenLesson} />}
    </section>
  )
}

function LessonButtons({ lessons, onOpenLesson }: { lessons: readonly CurriculumLessonSummary[]; onOpenLesson: (lesson: CurriculumLessonSummary) => void }) {
  return <ol className="mt-4 space-y-2">{lessons.map((lesson) => <li key={lesson.lessonId}><button type="button" onClick={() => onOpenLesson(lesson)} className="min-h-16 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-left hover:border-cyan-500"><span className="block font-bold">Day {lesson.dayInUnit}: {lesson.title}</span><span className="mt-1 block text-xs text-slate-400">{lesson.lessonId} · {lesson.standards.join(', ')}</span></button></li>)}</ol>
}

function LessonView({ detail, error }: { detail: CurriculumLessonDetail | null; error: string | null }) {
  if (error) return <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950 p-4"><h2 className="font-bold">Lesson unavailable</h2><p className="mt-1 text-amber-100">{error}</p></div>
  if (!detail) return <p role="status" className="text-slate-300">Loading authorized lesson detail.</p>
  const media = typeof detail.media === 'string' ? detail.media : detail.media?.description ?? detail.media?.suggestion
  const fallback = typeof detail.media === 'object' ? detail.media.fallback : undefined
  return (
    <article aria-labelledby="curriculum-lesson-heading" className="space-y-5">
      <div>
        <p className="text-sm font-bold text-cyan-300">{detail.lessonId}</p>
        <h2 id="curriculum-lesson-heading" className="mt-1 text-2xl font-bold">{detail.title}</h2>
        <p className="mt-2 text-sm text-slate-400">Grade {detail.grade} · {detail.courseId} · Unit {detail.unitNumber} · course day {detail.courseDay} · unit day {detail.dayInUnit} · {detail.estimatedMinutes ?? 'Duration unavailable'}</p>
        <p className="mt-1 text-sm text-slate-400">Curriculum {detail.source.version} · lesson schema {detail.schemaVersion} · published source {detail.source.packageId}</p>
      </div>
      <DetailSection title="Objectives"><StringList values={detail.learningObjectives} /></DetailSection>
      <DetailSection title="Standards"><StringList values={detail.standards} /></DetailSection>
      <DetailSection title="Lesson flow"><ol className="space-y-2">{detail.lessonFlow.map((segment, index) => <li key={`${segment.segment}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><strong>{segment.segment}</strong>{segment.minutes && <span className="text-slate-400"> · {segment.minutes}</span>}<p className="mt-1 text-slate-300">{segment.teacherOrTutorAction}</p></li>)}</ol></DetailSection>
      <DetailSection title="Student activity"><TextOrUnavailable value={detail.studentActivity} /></DetailSection>
      <DetailSection title="Formative check"><TextOrUnavailable value={detail.formativeCheck} /></DetailSection>
      <DetailSection title="Scoring and mastery guidance"><TextOrUnavailable value={detail.scoringGuidance} /><div className="mt-2"><TextOrUnavailable value={detail.masteryRule} /></div></DetailSection>
      <DetailSection title="Adaptive Tutor routes">{detail.adaptiveTutorRoutes.length ? <ul className="space-y-2">{detail.adaptiveTutorRoutes.map((route) => <li key={route.signal}><strong>{route.signal}:</strong> {route.action}</li>)}</ul> : <Unavailable />}</DetailSection>
      <DetailSection title="Accommodations"><StringList values={detail.accommodations} /></DetailSection>
      <DetailSection title="Safety and privacy"><StringList values={detail.safetyAndPrivacy} /></DetailSection>
      <DetailSection title="Media and fallback"><TextOrUnavailable value={media} /><p className="mt-2"><strong>Fallback:</strong> {fallback ?? 'Unavailable'}</p></DetailSection>
      <DetailSection title="Parent visibility"><TextOrUnavailable value={detail.parentVisibility} /></DetailSection>
      <DetailSection title="Home connection"><TextOrUnavailable value={detail.homeConnection} /></DetailSection>
      <DetailSection title="Assessment relationship">{detail.assessment ? <div><p><strong>{detail.assessment.assessmentId}</strong> · linked by the published unit index</p><p className="mt-1 text-sm text-slate-400">Relevant assessment standards: {detail.assessment.standards.filter((standard) => detail.standards.includes(standard)).join(', ') || 'No exact standard overlap proven'}</p></div> : <Unavailable />}</DetailSection>
    </article>
  )
}

function StandardsView({ catalog, query, onOpenLesson }: { catalog: CurriculumCatalog; query: string; onOpenLesson: (lesson: CurriculumLessonSummary) => void }) {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  const coverage = useMemo(() => buildStandardsCoverage(catalog), [catalog])
  if (!normalized) return <section aria-labelledby="standards-heading"><h2 id="standards-heading" className="text-xl font-bold">Standards coverage</h2><p className="mt-2 text-slate-300">Enter a standard in the search field to inspect exact lesson and assessment evidence.</p></section>
  const matches = coverage.filter((item) => item.standard.toLocaleLowerCase('en-US').includes(normalized)).slice(0, 50)
  return (
    <section aria-labelledby="standards-heading"><h2 id="standards-heading" className="text-xl font-bold">Standards coverage</h2><p className="mt-1 text-sm text-slate-400">Showing up to 50 published standards matching “{query}”.</p>{matches.length === 0 ? <p className="mt-4">No standard matches this identifier.</p> : <div className="mt-4 space-y-4">{matches.map((item) => <article key={item.standard} className="rounded-xl border border-slate-700 bg-slate-950 p-4"><h3 className="text-lg font-bold text-cyan-300">{item.standard}</h3><p className="mt-1 text-sm text-slate-400">{item.lessons.length} covering lessons · {item.assessmentEvidence.length} relevant unit assessments</p><LessonButtons lessons={item.lessons.slice(0, 50)} onOpenLesson={onOpenLesson} /><div className="mt-3"><h4 className="font-bold">Assessment evidence</h4>{item.assessmentEvidence.length ? <ul className="mt-1 list-disc pl-5 text-sm text-slate-300">{item.assessmentEvidence.map((assessment) => <li key={assessment.assessmentId}>{assessment.assessmentId} · Unit {assessment.unitNumber} · exact standard listed</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">No assessment relationship is proven by the published package.</p>}</div></article>)}</div>}</section>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-bold text-slate-100">{title}</h3><div className="mt-2 text-sm leading-6 text-slate-300">{children}</div></section>
}

function StringList({ values }: { values: readonly string[] }) {
  return values.length ? <ul className="list-disc space-y-1 pl-5">{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <Unavailable />
}

function TextOrUnavailable({ value }: { value?: string }) {
  return value ? <p>{value}</p> : <Unavailable />
}

function Unavailable() {
  return <p className="text-slate-400">Unavailable in this published curriculum source.</p>
}
