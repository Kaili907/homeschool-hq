import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../../../src/migration'
import { TodayView } from '../../../src/components/hub/TodayView'
import { StatusView } from '../../../src/components/hub/StatusView'
import { loadPlans } from '../../../src/curriculum/loader'
import { defaultSchoolYear } from '../../../src/curriculum/pacing'

// PILOT ACCEPTANCE: "see the pilot learner" and "see relevant assigned/current
// work or status." A single-learner pilot household has exactly one profile;
// this pins that the existing Today and Status views (already exercised by
// src/App.*.test.tsx and friends) actually surface that one learner's name
// and current standing without any extra pilot-only wiring.
describe('pilot adult can see the pilot learner and their current status', () => {
  const today = '2026-08-12'
  const pilotProfile = emptyProfile('pilot-learner-1', 'Pilot Learner', '5')
  pilotProfile.streaks = { current: 3, best: 5, lastActiveDate: today }
  pilotProfile.totals = { questionsAnswered: 12, correct: 10, bestStreak: 5, sessions: 4 }

  it('shows the pilot learner on the Today view', () => {
    const docs = loadPlans()
    const sy = defaultSchoolYear('')
    const html = renderToStaticMarkup(createElement(TodayView, {
      profiles: [pilotProfile],
      docs,
      sy,
      today,
      state: { schemaVersion: 1, profiles: { [pilotProfile.id]: pilotProfile }, activeProfileId: null, parentPin: '' },
    }))
    expect(html).toContain('Pilot Learner')
  })

  it('shows the pilot learner\'s current status (streak and answered count) on the Status view', () => {
    const html = renderToStaticMarkup(createElement(StatusView, {
      profiles: [pilotProfile],
      today,
      onPatchProfile: () => {},
    }))
    expect(html).toContain('Pilot Learner')
    expect(html).toContain('3-day')
    expect(html).toContain('12 answered')
  })
})
