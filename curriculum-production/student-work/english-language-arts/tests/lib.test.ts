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

const WORKTREES = '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees'
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

  it('repairs the g34 source-branch "vocabulary <focus clause> requires" grammar defect', () => {
    // Every grade 3-4 lesson's `focus` field is a clause (median 9 words),
    // and the source branch's own lesson_flow/adaptive_tutor_routes prose
    // literally substitutes that clause into short-noun-phrase templates
    // ("the vocabulary <focus> requires", "the smallest prerequisite <focus>
    // depends on"), which reads as broken English. Confirmed present in 100%
    // of grade 3 and grade 4 lessons before the fix in repairFocusSubstitution.
    const broken = /\bvocabulary\b\s+.{5,60}?\brequires\b|\bsmallest prerequisite\b\s+.{5,60}?\bdepends on\b/
    for (const ir of irs) {
      const pkg = buildStudentPackage(ir)
      const blob = JSON.stringify([pkg.guidedSupport, pkg.independentEvidenceTask, pkg.remediation, pkg.extension])
      const match = blob.match(broken)
      if (match) {
        expect(match[0], `${ir.lessonId}: "${match[0]}" reads as the unrepaired source defect`).toContain("today's lesson")
      }
    }
  })

  it('text references are pointers only — no full text body is embedded', () => {
    for (const ir of irs) {
      const pkg = buildStudentPackage(ir)
      const json = JSON.stringify(pkg.sourceReference)
      // A reference block should be far shorter than a ~200+ word story body.
      expect(json.length).toBeLessThan(2000)
    }
  })
})
