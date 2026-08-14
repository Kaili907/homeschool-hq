import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ARTS_MUSIC_DIRECTOR_PREVIEW_PATH,
  isArtsMusicDirectorPreviewPath,
} from '../src/study/family-pilot/arts-music-director-preview/route'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LESSON_REF = 'ma-g9-arts-and-music-u01-l02'
const packagePath = resolve(ROOT, `curriculum-production/student-work/technology-arts-lessons/packages/arts-music/grade-09/${LESSON_REF}.task-package.json`)
const scoringPath = resolve(ROOT, `curriculum-production/student-work/technology-arts-lessons/scoring-guides/arts-music/grade-09/${LESSON_REF}.scoring-guide.json`)
const lesson = JSON.parse(readFileSync(packagePath, 'utf8'))
const scoring = JSON.parse(readFileSync(scoringPath, 'utf8'))

const TUTOR_MANIFEST_ALLOWLIST = new Set([
  'concept_ids',
  'technique_ids',
  'prerequisite_concept_ids',
  'prerequisite_technique_ids',
  'common_technique_error_ids',
  'reference_refs',
  'model_refs',
  'rubric_refs',
  'phase',
  'allowed_support',
  'age_policy_ref',
])

describe('Grade 9 visual hierarchy Arts/Music Director sample R1', () => {
  it('authors exactly the requested identity as a focus-specific visual-art concept lesson', () => {
    expect(lesson.lesson_id).toBe(LESSON_REF)
    expect(lesson.grade).toBe(9)
    expect(lesson.subject).toBe('arts-music')
    expect(lesson.task_type).toBe('VISUAL_ART_CONCEPT')
    expect(lesson.r1_sample).toMatchObject({
      lesson_type: 'VISUAL_ART_CONCEPT',
      phase: 'MODEL_A',
    })
    expect(lesson.r1_sample.learning_goal).toMatch(/visual-hierarchy variables.*intentional order of attention/i)
  })

  it('delivers the required perceptual reference with rights and meaningful access parallels', () => {
    expect(lesson.media).toMatchObject({ required: true, kind: 'SVG_VISUAL_MODEL' })
    const assetPath = resolve(ROOT, lesson.media.locator)
    expect(existsSync(assetPath)).toBe(true)
    const svg = readFileSync(assetPath, 'utf8')
    expect(svg).toMatch(/role="img"/)
    expect(svg).toMatch(/aria-labelledby="model-title model-description"/)
    expect(svg).toMatch(/<title id="model-title">Three Stops/)
    expect(svg).toMatch(/<desc id="model-description">[^<]{200,}/)
    expect(svg).toMatch(/VALID VARIATION/)
    expect(svg).not.toMatch(/(?:href|xlink:href)=["']https?:\/\//)
    expect(lesson.sourceReference).toMatch(/Access parallel:/)
    expect(lesson.sourceReference).toMatch(/tactile/i)
    expect(lesson.sourceReference).toMatch(/Manuel Academy original; licensed CC BY 4\.0/)
  })

  it('separates guided skill work, independent creation, reflection, critique, and checking', () => {
    const types = lesson.r1_sample.work_blocks.map((block) => block.type)
    expect(types).toEqual([
      'GUIDED_PRACTICE',
      'INDEPENDENT_CREATION',
      'REFLECTION',
      'CRITIQUE',
      'KNOWLEDGE_CHECK',
    ])
    expect(new Set(lesson.r1_sample.work_blocks.map((block) => block.id)).size).toBe(5)
    const guided = lesson.r1_sample.work_blocks[0]
    expect(guided.attempt_before_support).toMatch(/before opening/i)
    expect(guided.support_fade).toMatch(/Close the model and cue/i)
    const independent = lesson.r1_sample.work_blocks[1]
    expect(independent.objective_constraints).toHaveLength(5)
    expect(independent.learner_owned_choices).toContain('the final visual path')
    expect(independent.permitted_support).toMatch(/No one else may choose the focal point/i)
  })

  it('uses a focus-specific rubric and never turns legitimate creative variation into error', () => {
    expect(scoring.rubric_ref).toBe(lesson.r1_sample.rubric_ref)
    expect(scoring.rubric.map((row) => row.dimension)).toEqual([
      'Objective constraints',
      'Visual-hierarchy evidence',
      'Intent and interpretation',
      'Process and learner-owned revision',
    ])
    expect(scoring.rubric.map((row) => row.criterion_kind)).toEqual([
      'OBJECTIVE',
      'JUDGMENT_BASED',
      'JUDGMENT_BASED',
      'JUDGMENT_BASED',
    ])
    expect(scoring.legitimate_variation).toHaveLength(5)
    expect(JSON.stringify(scoring.legitimate_variation)).toMatch(/Difference from the Academy model is never an error/i)
    expect(scoring.answer_or_scoring_guidance).toMatch(/no fixed composition or answer/i)
  })

  it('provides different instruction and fresh evidence for each observable retry signal', () => {
    const errors = lesson.r1_sample.common_technique_errors
    const remediation = lesson.r1_sample.remediation_paths
    expect(errors).toHaveLength(2)
    expect(remediation).toHaveLength(2)
    expect(new Set(remediation.map((path) => path.for_error_id))).toEqual(new Set(errors.map((error) => error.id)))
    for (const path of remediation) {
      expect(path.different_instruction.length).toBeGreaterThan(80)
      expect(path.supported_attempt.length).toBeGreaterThan(50)
      expect(path.self_noticing_cue.length).toBeGreaterThan(40)
      expect(path.fresh_retry).toMatch(/new|fresh/i)
    }
    expect(errors.every((error) => /learner|intent/i.test(error.not_an_error_when))).toBe(true)
  })

  it('keeps the Tutor-readiness manifest data-only, allowlisted, and internally resolvable', () => {
    const manifest = lesson.r1_sample.tutor_readiness_manifest
    expect(Object.keys(manifest).every((key) => TUTOR_MANIFEST_ALLOWLIST.has(key))).toBe(true)
    const conceptIds = new Set(lesson.r1_sample.concept_registry.map((entry) => entry.id))
    const techniqueIds = new Set(lesson.r1_sample.technique_registry.map((entry) => entry.id))
    const referenceRefs = new Set(lesson.r1_sample.reference_registry.map((entry) => entry.ref))
    const modelRefs = new Set(lesson.r1_sample.model_registry.map((entry) => entry.ref))
    expect([...manifest.concept_ids, ...manifest.prerequisite_concept_ids].every((id) => conceptIds.has(id))).toBe(true)
    expect([...manifest.technique_ids, ...manifest.prerequisite_technique_ids].every((id) => techniqueIds.has(id))).toBe(true)
    expect(manifest.reference_refs.every((ref) => referenceRefs.has(ref))).toBe(true)
    expect(manifest.model_refs.every((ref) => modelRefs.has(ref))).toBe(true)
    expect(manifest.rubric_refs).toEqual([scoring.rubric_ref])
    expect(manifest.common_technique_error_ids).toEqual(lesson.r1_sample.common_technique_errors.map((error) => error.id))
    expect(manifest.age_policy_ref).toBe(lesson.r1_sample.age_policy.ref)
    expect(JSON.stringify(manifest)).not.toMatch(/provider|mastery_decision|scoring_command|runtime_parameter|answer_delivery/i)
  })

  it('keeps the review shortcut exact-path and development-only', () => {
    expect(ARTS_MUSIC_DIRECTOR_PREVIEW_PATH).toBe('/__review/g9-visual-hierarchy')
    expect(isArtsMusicDirectorPreviewPath(ARTS_MUSIC_DIRECTOR_PREVIEW_PATH, true)).toBe(true)
    expect(isArtsMusicDirectorPreviewPath(`${ARTS_MUSIC_DIRECTOR_PREVIEW_PATH}/`, true)).toBe(true)
    expect(isArtsMusicDirectorPreviewPath(ARTS_MUSIC_DIRECTOR_PREVIEW_PATH, false)).toBe(false)
    expect(isArtsMusicDirectorPreviewPath('/family-pilot', true)).toBe(false)
    expect(isArtsMusicDirectorPreviewPath('/__review/g9-visual-hierarchy/extra', true)).toBe(false)
  })
})
