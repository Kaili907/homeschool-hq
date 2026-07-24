import type { AppState, MissionTemplate, Profile } from './types'

/**
 * Grade 5 uses its own concrete template so the existing mission module remains
 * untouched. Persisting the template also keeps imported grade-5 profiles safe.
 */
export const GRADE5_TEMPLATE: MissionTemplate = {
  weekday: [
    { id: 'typing', label: '⌨️ Typing — 5 minutes', auto: true, autoKind: 'typing' },
    { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
    { id: 'math-check', label: 'Check answers with Dad' },
    { id: 'reading', label: 'Reading 20 minutes' },
    { id: 'writing', label: 'Writing' },
    { id: 'science-ss', label: 'Science or Social Studies' },
    { id: 'planner', label: 'Plan tomorrow in your planner' },
    {
      id: 'mindset-lesson',
      label: '🧠 Mindset lesson (1×/week)',
      auto: true,
      autoKind: 'mindset',
      weeklyOnce: true,
    },
  ],
  friday: [
    { id: 'typing', label: '⌨️ Typing — 5 minutes', auto: true, autoKind: 'typing' },
    { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
    { id: 'reading', label: 'Reading 20 minutes' },
    { id: 'project', label: 'Friday project time' },
  ],
}

export function ensureGrade5Template(profile: Profile): Profile {
  return profile.grade === '5' && profile.template === undefined
    ? { ...profile, template: GRADE5_TEMPLATE }
    : profile
}

export function ensureGrade5Profiles(state: AppState): AppState {
  let changed = false
  const profiles = Object.fromEntries(
    Object.entries(state.profiles).map(([id, profile]) => {
      const next = ensureGrade5Template(profile)
      if (next !== profile) changed = true
      return [id, next]
    }),
  )
  return changed ? { ...state, profiles } : state
}
