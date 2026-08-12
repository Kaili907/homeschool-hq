import { describe, expect, it } from 'vitest'
import type { FamilyPilotHelpContext } from '../../tutor/types'
import { staticHelpMessage } from '../../tutor/staticFallback'
import { financialLiteracyHelpEligibility, financialLiteracyHelpText } from './tutorHelp'
import { getAssignments } from './catalog'
import { loadFinancialLiteracyCatalog } from './source.node'

const catalog = loadFinancialLiteracyCatalog()
const lesson = getAssignments(catalog, { studentRef: 'stu-1', grade: '8' })[0]

function context(): FamilyPilotHelpContext {
  return {
    scope: { householdRef: 'hh-1', learnerRef: 'stu-1', sessionRef: 'sess-1' },
    subject: 'other',
    grade: 8,
    noAudio: false,
    mediaAvailable: true,
  }
}

describe('FAMILY-PILOT-FINLIT-1 tutorHelp (Tutor boundaries + static-help capability)', () => {
  it('always resolves to the static fallback, never a live Tutor Core session (Tutor boundary)', () => {
    const eligibility = financialLiteracyHelpEligibility(context())
    expect(eligibility.path).toBe('static-fallback')
  })

  it('falls back to the exact reviewed generic copy when no lesson is known', () => {
    expect(financialLiteracyHelpText(context(), null)).toBe(staticHelpMessage(context()))
  })

  it('adds lesson-aware framing without dropping the reviewed fallback copy', () => {
    const text = financialLiteracyHelpText(context(), lesson)
    expect(text).toContain(lesson.title)
    expect(text).toContain(staticHelpMessage(context()))
  })
})
