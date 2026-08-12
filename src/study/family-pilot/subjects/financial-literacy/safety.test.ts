import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAssignments } from './catalog'
import { loadFinancialLiteracyCatalog } from './source.node'
import { financialLiteracyCurriculumPort, hostLessonFor } from './studyAdapter'

const CONTENT_ROOT = fileURLToPath(new URL('../../../../../curriculum-content/manuel-academy/', import.meta.url))
// Real value FORMATS (a plausible card/SSN/routing number), not topic
// vocabulary — the curriculum legitimately teaches ABOUT fraud, passwords,
// and credit cards (e.g. a "fraud and password safety" lesson title), and a
// keyword scan over that prose would only produce false positives. What must
// never appear is an actual-looking sensitive value, or a prompt that asks
// the learner to supply their own real one.
const REAL_VALUE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-shaped
  /\b(?:\d[ -]?){13,19}\b/, // card/account-number-shaped run of digits
]
const SOLICITS_REAL_CREDENTIAL =
  /\b(enter|provide|type|share|give)\b[^.]{0,40}\b(your|a)\b[^.]{0,40}\b(real|actual)?\s*(password|account number|social security|routing number|credit card number|brokerage (account|login))/i
const CATALOG_KEY_BANNED = /account.?number|routing.?number|social.?security|\bssn\b|credit.?card.?number|password|tax.?id|brokerage.?(account|credential)/i

describe('FAMILY-PILOT-FINLIT-1 safety: no real-finance fields, no auto-credit', () => {
  it('never finds a real-looking financial identifier or a request for one in the raw content on disk', () => {
    for (const grade of ['5', '7', '8']) {
      const base = join(CONTENT_ROOT, '1.0.0', 'grades', `grade-${grade}`, 'courses', 'financial-literacy')
      for (const file of ['units.json', 'lessons.jsonl', 'assessments.json']) {
        const raw = readFileSync(join(base, file), 'utf8')
        for (const pattern of REAL_VALUE_PATTERNS) expect(pattern.test(raw)).toBe(false)
        expect(SOLICITS_REAL_CREDENTIAL.test(raw)).toBe(false)
      }
    }
  })

  it('never captures a real-finance field key on the loaded, typed catalog', () => {
    const catalog = loadFinancialLiteracyCatalog()
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) expect(Object.keys(lesson).some((key) => CATALOG_KEY_BANNED.test(key))).toBe(false)
      for (const unit of course.units) expect(Object.keys(unit).some((key) => CATALOG_KEY_BANNED.test(key))).toBe(false)
    }
  })

  it('lesson presence in the catalog carries no completion, mastery, or credit field (no auto-credit)', () => {
    const catalog = loadFinancialLiteracyCatalog()
    const lesson = getAssignments(catalog, { studentRef: 'stu-1', grade: '8' })[0]
    const forbiddenKeys = ['state', 'completed', 'mastery', 'score', 'credit', 'proficient']
    for (const key of forbiddenKeys) {
      expect(key in lesson).toBe(false)
    }
  })

  it('the Study curriculum port lists lesson descriptors that carry no completion or mastery state', () => {
    const catalog = loadFinancialLiteracyCatalog()
    const host = financialLiteracyCurriculumPort(catalog).listLessons('8')
    for (const lesson of host) {
      expect('state' in lesson).toBe(false)
      expect('mastery' in lesson).toBe(false)
      expect('completed' in lesson).toBe(false)
    }
  })

  it('hostLessonFor never grants tutor-core mastery authority by construction (only the reviewed adapter decides that)', () => {
    const catalog = loadFinancialLiteracyCatalog()
    const lesson = getAssignments(catalog, { studentRef: 'stu-1', grade: '8' })[0]
    const host = hostLessonFor(lesson)
    expect(host.kind).toBe('parent-created')
  })
})
