import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildLearnerAnalyticsSnapshot } from '../../admin/learnerAnalyticsModel'
import { emptyProfile } from '../../migration'
import { LearnerAnalytics, moveLearnerSelection } from './LearnerAnalytics'

const TODAY = '2026-09-09'

function readyState() {
  const first = emptyProfile('first', 'Ada', '6')
  first.missions[TODAY] = { items: [{ id: 'math', label: 'Math', done: false }] }
  first.skills.ratio6 = { attempts: 4, correct: 3, mastery: 78, lastSeen: TODAY }
  first.attendance = { log: [{ date: TODAY, hours: 3.5 }] }
  first.tutorFlags = { ratio6: { since: TODAY, reason: 'PRIVATE REASON', sessionCount: 3, weekCount: 3 } }
  const second = emptyProfile('second', 'Grace', '5')
  return {
    status: 'ready' as const,
    snapshot: buildLearnerAnalyticsSnapshot({ profiles: [first, second], today: TODAY, observedAt: '2026-09-09T18:00:00.000Z' }),
  }
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

  it('renders the list and all requested learner detail sections read-only', () => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={readyState()} />)
    for (const text of ['Learners', 'Ada', 'Grade 6', 'Learning', 'Assessment', 'Study', 'Attendance', 'Interventions', 'Future integrations', 'Needs Dad']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('0/1')
    expect(html).toContain('0% complete')
    expect(html).toContain('1 days')
    expect(html).toContain('3.5h YTD')
    expect(html).toContain('78%')
    expect(html).toContain('Study evidence unavailable')
    expect(html).toContain('AI cost per learner')
    expect(html).toContain('Unavailable until reconciled learner attribution is available')
    expect(html).not.toContain('PRIVATE REASON')
    expect(html).not.toMatch(/ADMIN-[23]/)
    expect(html).not.toMatch(/\b\d+\s+(?:input|output)?\s*tokens?\b/i)
  })

  it('uses native controls, landmarks, labels, and deterministic keyboard navigation', () => {
    const html = renderToStaticMarkup(<LearnerAnalytics state={readyState()} />)
    expect(html).not.toContain('<main')
    expect(html).toContain('<table')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-controls="learner-detail"')
    expect(html).toContain('id="learner-detail"')
    expect(html).toContain('aria-labelledby="learner-detail-title"')
    expect(moveLearnerSelection(['first', 'second'], 'first', 'ArrowDown')).toBe('second')
    expect(moveLearnerSelection(['first', 'second'], 'first', 'ArrowUp')).toBe('second')
    expect(moveLearnerSelection(['first', 'second'], 'second', 'Home')).toBe('first')
    expect(moveLearnerSelection(['first', 'second'], 'first', 'End')).toBe('second')
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
