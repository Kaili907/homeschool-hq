import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectMarkdownLearnerMaterial } from '../scripts/learner-projection/structured-projection-r1.mjs'
import {
  createScienceSamplePresentation,
  SCIENCE_DIRECTOR_SAMPLE_LESSON_REF,
  SCIENCE_DIRECTOR_SAMPLE_TITLE,
} from '../src/study/family-pilot/science-director-preview/model'
import { isScienceDirectorSamplePath, SCIENCE_DIRECTOR_SAMPLE_PATH } from '../src/study/family-pilot/science-director-preview/route'

const LESSON_REF = 'ma-g3-science-u01-l02'
const studentPath = new URL('../curriculum-production/final/science/packages/ma-g3-science/student-sheets/ma-g3-science-u01-l02.md', import.meta.url)
const packagePath = new URL('../curriculum-production/final/science/packages/ma-g3-science/work-packages.jsonl', import.meta.url)
const advisoryPath = new URL('../docs/curriculum-quality/science/sample-r1/ma-g3-science-u01-l02.advisory.json', import.meta.url)

const markdown = readFileSync(studentPath, 'utf8')
const packages = readFileSync(packagePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const canonical = packages.find((row) => row.lesson_id === LESSON_REF)
const { material } = projectMarkdownLearnerMaterial(markdown, { lessonRef: LESSON_REF, subject: 'science' }, SCIENCE_DIRECTOR_SAMPLE_TITLE)

describe('Science Director sample R1', () => {
  it('repairs exactly the audit-designated real lesson and keeps its canonical identity', () => {
    expect(SCIENCE_DIRECTOR_SAMPLE_LESSON_REF).toBe(LESSON_REF)
    expect(SCIENCE_DIRECTOR_SAMPLE_TITLE).toBe('Concept model A: testable questions')
    expect(canonical.title).toBe(SCIENCE_DIRECTOR_SAMPLE_TITLE)
    expect(canonical.director_sample_r1.sample_version).toBe('science-director-sample-r1')
    expect(packages.filter((row) => row.director_sample_r1)).toHaveLength(1)
    expect(canonical.director_sample_r1.hands_on).toBe(false)
  })

  it('delivers explanation, vocabulary, a worked model, guided fade, CER, and different remediation', () => {
    const transcript = canonical.director_sample_r1.sections.map((section) => `${section.title}\n${section.body}`).join('\n')
    expect(transcript).toMatch(/Words scientists use/)
    expect(transcript).toMatch(/QUESTION -> PLAN -> RECORD -> DECIDE/)
    expect(transcript).toMatch(/Worked scientific reasoning/)
    expect(transcript).toMatch(/\*\*Claim:\*\*[\s\S]*\*\*Evidence:\*\*[\s\S]*\*\*Reasoning:\*\*/)
    expect(transcript).toMatch(/Support fades across Q1–Q3/)
    expect(transcript).toMatch(/evidence-door test/)
    expect(canonical.remediation.adult_routes.every((route) => /^SCI-/.test(route.signal))).toBe(true)
  })

  it('keeps supplied descriptions honest and never fabricates learner experimental results', () => {
    expect(canonical.assurances.supplies_no_observations).toBe(true)
    expect(canonical.assurances.supplies_no_expected_values).toBe(true)
    expect(canonical.executable_content.physical_result_disclosed_before_collection).toBe(false)
    expect(canonical.executable_content.supplied_evidence.rows.map((row) => row.origin)).toEqual([
      'DESCRIBED_OBSERVATION',
      'PROPOSED_PLAN',
      'PROPOSED_RECORD',
    ])
    expect(canonical.executable_content.supplied_evidence.rows.map((row) => row.information))
      .not.toEqual(canonical.executable_content.science_brief)
    expect(markdown).toMatch(/No learner experimental result is supplied or implied/)
    for (const error of canonical.scientific_correctness_authority.disqualifying_errors) {
      expect(markdown).not.toContain(error)
    }
  })

  it('projects the canonical Markdown into seven distinct response items at their authored stages', () => {
    const presentation = createScienceSamplePresentation(material)
    expect(material.title).toBe(SCIENCE_DIRECTOR_SAMPLE_TITLE)
    expect(presentation.steps.map((step) => step.stage)).toEqual([
      'NOTICE', 'LEARN', 'MODEL', 'GUIDED', 'INDEPENDENT', 'MASTERY', 'REMEDIATION',
    ])
    expect(presentation.steps.map((step) => step.section.items?.length ?? 0)).toEqual([0, 0, 0, 3, 2, 2, 0])
    expect(presentation.steps.flatMap((step) => step.section.items ?? []).map((item) => item.itemRef)).toEqual([
      `${LESSON_REF}#Q1`, `${LESSON_REF}#Q2`, `${LESSON_REF}#Q3`, `${LESSON_REF}#Q4`,
      `${LESSON_REF}#Q5`, `${LESSON_REF}#Q6`, `${LESSON_REF}#Q7`,
    ])
  })

  it('uses fresh independent and mastery cases without repeating answer-bearing teaching', () => {
    const presentation = createScienceSamplePresentation(material)
    const independent = presentation.steps.find((step) => step.stage === 'INDEPENDENT').section.body
    const mastery = presentation.steps.find((step) => step.stage === 'MASTERY').section.body
    expect(independent).toMatch(/paper bridges/)
    expect(mastery).toMatch(/bird feeders/)
    expect(mastery).not.toMatch(/testable question is|Question\s*->\s*Plan|Worked scientific reasoning/i)
    const masteryPrompts = presentation.steps.find((step) => step.stage === 'MASTERY').section.items.map((item) => item.prompt).join(' ')
    expect(masteryPrompts).not.toMatch(/Question[–-]Plan[–-]Record[–-]Decide/)
    expect(canonical.director_sample_r1.phase_sequence.find((phase) => phase.phase === 'INDEPENDENT').answer_policy)
      .toBe('INDEPENDENT_WITHHOLD')
  })

  it('publishes the advisory curriculum metadata required by the draft standard', () => {
    const contract = JSON.parse(readFileSync(advisoryPath, 'utf8'))
    expect(contract.lessonId).toBe(LESSON_REF)
    expect(contract.primaryLessonType).toBe('CONCEPT_BUILD')
    expect(contract.conceptIds.length).toBeGreaterThan(0)
    expect(contract.prerequisiteConceptIds.length).toBeGreaterThan(0)
    expect(contract.misconceptionIds.length).toBeGreaterThan(0)
    expect(contract.phenomenonSourceRefs.length).toBeGreaterThan(0)
    expect(contract.representationRefs.length).toBeGreaterThan(0)
    expect(contract.teachingEvidence.workedTeachingObjectRefs).toHaveLength(2)
    expect(contract.evidencePlan.freshInputRef).toContain('fresh-bird-feeder-card')
    expect(contract.safetyPolicyRef).toContain('safety-floor.json')
  })

  it('keeps the Director shortcut development-only and exact-path', () => {
    expect(SCIENCE_DIRECTOR_SAMPLE_PATH).toBe('/__review/science/testable-questions')
    expect(isScienceDirectorSamplePath(SCIENCE_DIRECTOR_SAMPLE_PATH, true)).toBe(true)
    expect(isScienceDirectorSamplePath(`${SCIENCE_DIRECTOR_SAMPLE_PATH}/`, true)).toBe(true)
    expect(isScienceDirectorSamplePath(SCIENCE_DIRECTOR_SAMPLE_PATH, false)).toBe(false)
    expect(isScienceDirectorSamplePath('/family-pilot', true)).toBe(false)
    expect(isScienceDirectorSamplePath(`${SCIENCE_DIRECTOR_SAMPLE_PATH}/extra`, true)).toBe(false)
  })

  it('keeps the complete safety floor available but visually layers it behind today’s desk rule', () => {
    const presentation = createScienceSamplePresentation(material)
    expect(presentation.overview.body).toMatch(/Today’s safety:\*\* This is a desk lesson/)
    expect(presentation.safetyReference.body).toMatch(/Full course safety floor/)
    expect(presentation.safetyReference.body).toMatch(/Never, in any lesson/)
    const css = readFileSync(new URL('../src/study/family-pilot/science-director-preview/science-director-preview.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media \(max-width: 520px\)/)
    expect(css).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/focus-visible/)
  })
})
