import { describe, expect, it } from 'vitest'
import {
  buildScoringGuide,
  buildStudentPackage,
  buildTextBankIndex,
  loadCourse,
  adaptG34,
  adaptCanonical,
  adaptHs912,
  verifyTextIntegrity,
  toStudentVoice,
} from '../src/lib.mjs'
import { sha256 } from '../src/contentRepair.mjs'

const WORKTREES = process.env.ELA_SOURCE_WORKTREES ?? '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees'
const G34_ELA = `${WORKTREES}/mac-g34-ela-r1/curriculum-authoring/full-family-grade34/subjects/english-language-arts`
const CANON5 = `${WORKTREES}/mac-ela-production-r1/curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts`
const HS9 = `${WORKTREES}/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses/english-9`

const FORBIDDEN_PACKAGE_KEYS = ['scoringAuthority', 'rubric', 'acceptableAnswerCriteria', 'masteryCriteria', 'doNotUse']

describe('toStudentVoice', () => {
  it('rewrites third-person learner references without breaking sentences that never mention a verb', () => {
    expect(toStudentVoice("Judge whether the learner's own evidence is sufficient.")).toBe(
      "Judge whether your own evidence is sufficient.",
    )
  })
})

describe('source adapters', () => {
  it('adaptG34 normalizes a grade-3 lesson with a package-supplied original text', () => {
    const irs = loadCourse({
      courseDir: `${G34_ELA}/grades/grade-3`,
      adapter: adaptG34,
      textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/original-text-bank.json`),
      pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/public-domain-register.json`, 'id'),
    })
    expect(irs).toHaveLength(180)
    const l01 = irs.find((l) => l.lessonId === 'ma-g3-english-language-arts-u01-l01')
    expect(l01?.textRefs[0]?.textId).toBe('g3-text-01')
    expect(l01?.textRefs[0]?.sourceIntegrityStatus).toBe('VERIFIED')
  })

  it('adaptCanonical marks source integrity not-applicable when no text bank ships', () => {
    const irs = loadCourse({ courseDir: CANON5, adapter: adaptCanonical })
    expect(irs).toHaveLength(180)
    expect(irs.every((l) => l.textRefs.length === 0)).toBe(true)
  })

  it('adaptHs912 verifies assigned texts against the course text bank', () => {
    const irs = loadCourse({
      courseDir: HS9,
      adapter: adaptHs912,
      textBankIndex: buildTextBankIndex(`${HS9}/text-bank.json`, 'text_id'),
    })
    const l01 = irs.find((l) => l.lessonId === 'ma-g9-english-language-arts-u01-l01')
    expect(l01?.textRefs.length).toBeGreaterThan(0)
    expect(l01?.textRefs.every((t: any) => t.sourceIntegrityStatus === 'VERIFIED')).toBe(true)
  })

  it('flags a source-integrity gap for a text id that is not in the bank', () => {
    expect(verifyTextIntegrity('does-not-exist', new Map([['g3-text-01', {}]]))).toBe('GAP')
  })
})

describe('buildStudentPackage / buildScoringGuide separation', () => {
  const irs = loadCourse({
    courseDir: `${G34_ELA}/grades/grade-3`,
    adapter: adaptG34,
    textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/original-text-bank.json`),
    pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/public-domain-register.json`, 'id'),
  })

  it('never leaks scoring-guide-only keys into the student package', () => {
    for (const ir of irs) {
      const pkg = buildStudentPackage(ir)
      const json = JSON.stringify(pkg)
      for (const forbidden of FORBIDDEN_PACKAGE_KEYS) {
        expect(json.includes(`"${forbidden}"`)).toBe(false)
      }
    }
  })

  it('never fabricates a fixed answer key: scoring authority is always RUBRIC for ELA', () => {
    for (const ir of irs) {
      const guide = buildScoringGuide(ir)
      expect(guide.scoringAuthority.kind).toBe('RUBRIC')
    }
  })

  it('every package has all five student-facing components present with real text', () => {
    for (const ir of irs) {
      const pkg = buildStudentPackage(ir)
      for (const key of ['studentTask', 'guidedSupport', 'independentEvidenceTask', 'remediation', 'extension'] as const) {
        expect(pkg[key].present).toBe(true)
        expect(pkg[key].text?.length ?? 0).toBeGreaterThan(10)
      }
    }
  })

  it('every scoring guide states the no-ghostwriting authorship policy', () => {
    for (const ir of irs) {
      const guide = buildScoringGuide(ir)
      expect(guide.authorshipPolicy).toBeTruthy()
      expect(guide.doNotUse.length).toBeGreaterThan(0)
    }
  })

  it('delivers a complete, hash-verifiable Academy-original reading in every package', () => {
    for (const ir of irs) {
      const pkg = buildStudentPackage(ir)
      const ref = pkg.sourceReference.refs[0]
      expect(pkg.sourceReference.mode).toBe('academy-original-inline')
      expect(pkg.sourceReference.text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(80)
      expect(ref.rightsCategory).toBe('original')
      expect(ref.author).toBe('Manuel Academy')
      expect(ref.deliveryMode).toBe('inline_full_text')
      expect(ref.learnerAvailable).toBe(true)
      expect(ref.fullTextIncluded).toBe(true)
      expect(sha256(pkg.sourceReference.text)).toBe(ref.sha256)
    }
  })
})
