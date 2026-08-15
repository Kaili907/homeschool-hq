import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ADMIN_WORKING_GRADE_CHOICES, buildLearnerAnalyticsSnapshot, type LearnerAnalyticsSnapshot } from '../../admin/learnerAnalyticsModel'
import type { AcademyCatalog } from '../../academy/contentTypes'
import { emptyProfile } from '../../migration'
import {
  LearnerAnalytics,
  filterLearnerOperations,
  learnerWorkingGradeChange,
  moveLearnerSelection,
} from './LearnerAnalytics'

const TODAY = '2026-09-09'

function academyCatalog(): AcademyCatalog {
  return {
    releaseVersion: '1.0.0', grade: '5',
    courses: [{
      courseId: 'ma-g5-mathematics', subject: 'mathematics', lessonCount: 2,
      units: [{
        unitId: 'ma-g5-mathematics-u01', unitNumber: 1, title: 'Whole Numbers', days: 2,
        essentialQuestion: 'How do numbers work?', performanceTask: 'Solve problems',
        lessonIds: ['lesson-1', 'lesson-2'], hasAssessment: false,
      }],
    }],
  }
}

function readyState() {
  const first = emptyProfile('p1', 'Ada', '6')
  first.missions[TODAY] = { items: [{ id: 'math', label: 'Math', done: false }] }
  first.skills.ratio6 = { attempts: 4, correct: 3, mastery: 78, lastSeen: TODAY }
  first.attendance = { log: [{ date: TODAY, hours: 3.5 }] }
  first.tutorFlags = { ratio6: { since: TODAY, reason: 'PRIVATE REASON', sessionCount: 3, weekCount: 3 } }
  first.workingLevels = { mathematics: '5' }
  first.academy = {
    releaseVersion: '1.0.0', grade: '5', enrolledAt: '2026-09-01T12:00:00.000Z',
    courseIds: ['ma-g5-mathematics'], lessons: {}, assessments: {},
  }
  const second = emptyProfile('p2', 'Grace', '5')
  return {
    status: 'ready' as const,
    snapshot: buildLearnerAnalyticsSnapshot({ profiles: [first, second], today: TODAY, observedAt: '2026-09-09T18:00:00.000Z', academyCatalogs: [academyCatalog()] }),
  }
}

function highSchoolState(grade: '9' | '10' | '11' | '12') {
  const state = readyState()
  const learner = state.snapshot.learners[0]
  const detail = state.snapshot.details.p1
  const snapshot = {
    ...state.snapshot,
    learners: [{ ...learner, nominalGrade: grade }],
    details: { p1: { ...detail, nominalGrade: grade, workingLevels: detail.workingLevels.map((level) => ({ ...level, level: grade, source: 'nominal-grade' as const })) } },
  } as unknown as LearnerAnalyticsSnapshot
  return { status: 'ready' as const, snapshot }
}

describe('LearnerAnalytics', () => {
  it('hides every learner field while authorization is resolving or unauthorized', () => {
    const resolving = renderToStaticMarkup(<LearnerAnalytics state={{ status: 'resolving' }} />)
    const unauthorized = renderToStaticMarkup(<LearnerAnalytics state={{ status: 'unauthorized', reasonCode: 'learners_read_required' }} />)
    for (const html of [resolving, unauthorized]) {
      expect(html).not.toContain('Ada')
      expect(html).not.toContain('Grade 6')
      expect(html).not.toContain('Ratios &amp; Rates')
    }
    expect(resolving).toContain('aria-busy="true"')
    expect(unauthorized).toContain('learners:read')
    expect(unauthorized).toContain('href="/academy"')
  })

  it('renders the operations list, release pin, and supported learner detail sections read-only', () => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={readyState()} />)
    for (const text of ['Learners', 'Ada', 'Grade 6', 'Overview', 'Curriculum', 'Progress / Mastery', 'Assessments', 'Study', 'Operational status', 'Needs Dad']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('Curriculum release pin')
    expect(html).toContain('1.0.0')
    expect(html).toContain('Data state meanings')
    for (const state of ['Available', 'Partial', 'Unavailable', 'Not configured', 'Not applicable']) expect(html).toContain(state)
    expect(html).toContain('0/1')
    expect(html).toContain('0% complete')
    expect(html).toContain('Instructional days YTD')
    expect(html).toContain('Instructional hours YTD')
    expect(html).toContain('3.5h')
    expect(html).toContain('78%')
    expect(html).toContain('Study evidence unavailable')
    expect(html).toContain('Learner cost unavailable')
    expect(html).toContain('Usage and cost are not inferred')
    expect(html).toContain('Course assignments &amp; working grades')
    expect(html).toContain('Nominal Grade 6 remains reporting truth')
    expect(html).toContain('Grade 5 Mathematics')
    expect(html).toContain('Academy course assigned')
    expect(html).toContain('0 of 2 complete (0%)')
    expect(html).not.toContain('ma-g5-mathematics')
    expect(html).not.toContain('PRIVATE REASON')
    expect(html).not.toMatch(/ADMIN-[23]/)
    expect(html).not.toMatch(/\b\d+\s+(?:input|output)?\s*tokens?\b/i)
  })

  it('offers exactly the expanded working-grade choices and never assigns Grade 6', () => {
    expect(ADMIN_WORKING_GRADE_CHOICES).toEqual(['3', '4', '5', '7', '8', '9', '10', '11', '12'])
    const html = renderToStaticMarkup(<LearnerAnalytics state={readyState()} onWorkingGradeChange={() => undefined} />)
    for (const grade of ADMIN_WORKING_GRADE_CHOICES) expect(html).toContain(`<option value="${grade}">Grade ${grade}</option>`)
    expect(html).not.toContain('<option value="6">Grade 6</option>')
    expect(html).toContain('Grade 6 may remain the nominal grade')
    expect(html).toContain('Not assignable at nominal Grade 6')
  })

  it('builds a working-grade change without a nominal-grade mutation', () => {
    expect(learnerWorkingGradeChange({ learnerRef: 'p1', nominalGrade: '6' }, 'mathematics', '9')).toEqual({
      learnerRef: 'p1', subject: 'mathematics', workingGrade: '9', expectedNominalGrade: '6',
    })
    expect(learnerWorkingGradeChange({ learnerRef: 'p1', nominalGrade: '6' }, 'mathematics', '')).toMatchObject({ workingGrade: null, expectedNominalGrade: '6' })
    expect(() => learnerWorkingGradeChange({ learnerRef: 'p1', nominalGrade: '6' }, 'mathematics', '6')).toThrow('Unsupported Academy working grade')
  })

  it.each(['9', '10', '11', '12'] as const)('renders nominal Grade %s as a first-class learner', (grade) => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={highSchoolState(grade)} />)
    expect(html).toContain(`nominal grade ${grade}`)
    expect(html).toContain(`Nominal Grade ${grade} remains reporting truth`)
    expect(html).toContain(`Use nominal Grade ${grade}`)
  })

  it('uses responsive native controls, routed links, labels, and deterministic keyboard navigation', () => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={readyState()} />)
    expect(html).not.toContain('<main')
    expect(html).toContain('<table')
    expect(html).toContain('md:block')
    expect(html).toContain('md:hidden')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
    expect(html).toContain('type="search"')
    expect(html).toContain('<select')
    expect(html).toContain('href="/academy/admin/learners/p1"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('aria-controls="learner-detail"')
    expect(html).toContain('id="learner-detail"')
    expect(html).toContain('aria-labelledby="learner-detail-title"')
    expect(moveLearnerSelection(['p1', 'p2'], 'p1', 'ArrowDown')).toBe('p2')
    expect(moveLearnerSelection(['p1', 'p2'], 'p1', 'ArrowUp')).toBe('p2')
    expect(moveLearnerSelection(['p1', 'p2'], 'p2', 'Home')).toBe('p1')
    expect(moveLearnerSelection(['p1', 'p2'], 'p1', 'End')).toBe('p2')
  })

  it('searches safe list fields and applies meaningful operational filters', () => {
    const learners = readyState().snapshot.learners
    expect(filterLearnerOperations(learners, 'ada', 'all').map((item) => item.learnerRef)).toEqual(['p1'])
    expect(filterLearnerOperations(learners, 'grade 5', 'all').map((item) => item.learnerRef)).toEqual(['p1', 'p2'])
    expect(filterLearnerOperations(learners, 'grade 6', 'all').map((item) => item.learnerRef)).toEqual(['p1'])
    expect(filterLearnerOperations(learners, '', 'needs-attention').map((item) => item.learnerRef)).toEqual(['p1'])
    expect(filterLearnerOperations(learners, '', 'enrolled').map((item) => item.learnerRef)).toEqual(['p1'])
    expect(filterLearnerOperations(learners, '', 'not-configured').map((item) => item.learnerRef)).toEqual(['p2'])
  })

  it('keeps the root list closed, opens a routed detail, and handles an out-of-scope reference truthfully', () => {
    const root = renderToStaticMarkup(<LearnerAnalytics state={readyState()} selectedLearnerRef={null} />)
    expect(root).toContain('Select a learner')
    expect(root).not.toContain('Curriculum release pin')
    const detail = renderToStaticMarkup(<LearnerAnalytics state={readyState()} selectedLearnerRef="p1" />)
    expect(detail).toContain('Learner operations detail')
    expect(detail).toContain('Back to learners')
    const missing = renderToStaticMarkup(<LearnerAnalytics state={readyState()} selectedLearnerRef="p5" />)
    expect(missing).toContain('Learner detail unavailable')
    expect(missing).not.toContain('Curriculum release pin')
  })

  it('offers retry only for a recoverable load error', () => {
    const error = renderToStaticMarkup(<LearnerAnalytics state={{ status: 'error', message: 'unavailable' }} onRetry={() => undefined} />)
    expect(error).toContain('Try again')
    expect(error).not.toContain('<main')
  })

  it('renders a truthful empty authorized state', () => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={{ status: 'ready', snapshot: buildLearnerAnalyticsSnapshot({ profiles: [], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z` }) }} />)
    expect(html).toContain('No learner records are available')
  })
})
