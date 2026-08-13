import { describe, expect, it } from 'vitest'
import { composeScoringRecord, composeTaskSheet } from '../src/compose.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'
import { checkPrivacy } from '../src/validate.ts'

const source = sourceLessonMap()

/**
 * The privacy scan runs over everything this lane emits, learner-facing and
 * adult-facing alike. The rule is narrower and blunter than the general safety
 * boundary: no lesson anywhere in grade 12 may solicit the real-world financial
 * artefacts the brief names, and nothing shaped like a credential or an account
 * identifier may appear at all.
 */
const CREDENTIAL_SHAPES: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: 'a value shaped like a Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'a value shaped like a full payment card number', re: /\b(?:\d[ -]?){15,18}\b/ },
  { label: 'a password or credential assignment', re: /\b(password|passcode|pin|api[_ ]?key|routing number)\s*[:=]\s*\S+/i },
  { label: 'an IBAN-shaped value', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/ },
]

describe('privacy across the whole grade 12 corpus', () => {
  it('solicits no real personal financial artefact in any authored lesson', () => {
    expect(ALL_SPECS.flatMap(checkPrivacy).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('carries nothing shaped like a credential or account identifier in anything emitted', () => {
    const offences: string[] = []
    for (const spec of ALL_SPECS) {
      const src = source.get(spec.lessonId)!
      for (const [label, doc] of [
        ['task sheet', composeTaskSheet(spec, src)],
        ['scoring record', composeScoringRecord(spec, src)],
      ] as const) {
        const text = JSON.stringify(doc)
        for (const c of CREDENTIAL_SHAPES) {
          if (c.re.test(text)) offences.push(`${spec.lessonId} ${label}: contains ${c.label}`)
        }
      }
    }
    expect(offences).toEqual([])
  })

  it('declares every lesson a fictional simulation requiring no real-world action', () => {
    for (const spec of ALL_SPECS) {
      const sheet = composeTaskSheet(spec, source.get(spec.lessonId)!) as Record<string, unknown>
      expect(sheet.isFictionalSimulation).toBe(true)
      expect(sheet.realWorldAction).toBe(false)
      expect(sheet.completionAuthority).toBe('learner')
      expect(sheet.signOff).toBeNull()
      expect(sheet.financialSafety).toEqual({ neverRequestsRealCredentials: true, noIndividualizedAdvice: true })
    }
  })

  it('states in every scenario that the case is fictional or simulated', () => {
    const silent = ALL_SPECS.filter((s) => !/\b(fictional|simulated)\b/i.test(s.scenario)).map((s) => s.lessonId)
    expect(silent).toEqual([])
  })

  it('gives no individualised financial advice in any learner-facing text', () => {
    const advice = [
      /\bwhat should you personally\b/i,
      /\byou should (invest|borrow|buy|open an account|refinance)\b/i,
      /\bwe recommend that you\b/i,
      /\bfor your own (money|savings|investments?|retirement)\b/i,
    ]
    const offences: string[] = []
    for (const spec of ALL_SPECS) {
      const learnerText = [
        spec.scenario, spec.objective, spec.remediation, spec.extension,
        ...spec.tasks.flatMap((t) => [t.directions, ...t.items.map((i) => i.text)]),
      ].join(' \n ')
      for (const re of advice) {
        if (re.test(learnerText)) offences.push(`${spec.lessonId}: ${re}`)
      }
    }
    expect(offences).toEqual([])
  })
})
