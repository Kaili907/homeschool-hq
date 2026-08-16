#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(ROOT, '../../..')
const PACKAGES = resolve(ROOT, 'packages/arts-music')
const GUIDES = resolve(ROOT, 'scoring-guides/arts-music')
const ALLOWED_TYPES = new Set(['VISUAL_ART_CONCEPT', 'TECHNIQUE', 'ART_ANALYSIS', 'ART_HISTORY_CONTEXT', 'DESIGN', 'CREATION_STUDIO', 'MUSIC_CONCEPT', 'RHYTHM', 'MELODY', 'LISTENING', 'PERFORMANCE', 'COMPOSITION', 'CRITIQUE_REFLECTION', 'REVIEW', 'REMEDIATION', 'MASTERY', 'PROJECT'])
const MANIFEST_FIELDS = new Set(['concept_ids', 'technique_ids', 'prerequisite_concept_ids', 'prerequisite_technique_ids', 'common_technique_error_ids', 'reference_refs', 'model_refs', 'rubric_refs', 'phase', 'allowed_support', 'age_policy_ref'])
const INSTRUCTION_EXEMPT = new Set(['PROBE', 'ASSESS'])
const failures = []
const fail = (id, message) => failures.push(`${id}: ${message}`)
const load = (path) => JSON.parse(readFileSync(path, 'utf8'))
const packages = []

for (const gradeDir of readdirSync(PACKAGES).sort()) {
  for (const file of readdirSync(resolve(PACKAGES, gradeDir)).filter((name) => name.endsWith('.task-package.json')).sort()) {
    packages.push({ gradeDir, pkg: load(resolve(PACKAGES, gradeDir, file)) })
  }
}

const grades = new Set()
const types = new Set()
const modes = new Set()
const blockCounts = new Set()
const gradeFamilyCoverage = new Map()
let generatedVisualAssets = 0

for (const { gradeDir, pkg } of packages) {
  const id = pkg.lesson_id
  const guide = load(resolve(GUIDES, gradeDir, `${id}.scoring-guide.json`))
  const depth = pkg.arts_music_r1
  if (!depth) { fail(id, 'missing arts_music_r1 production contract'); continue }
  grades.add(pkg.grade); types.add(depth.lesson_type); modes.add(pkg.work_mode); blockCounts.add(depth.work_blocks?.length)
  const coverage = gradeFamilyCoverage.get(pkg.grade) ?? new Set()
  coverage.add(depth.lesson_type); gradeFamilyCoverage.set(pkg.grade, coverage)

  if (!ALLOWED_TYPES.has(depth.lesson_type)) fail(id, `noncanonical lesson type ${depth.lesson_type}`)
  if (pkg.task_type !== depth.lesson_type) fail(id, 'task_type and production lesson_type disagree')
  if (depth.phase !== pkg.work_mode) fail(id, 'production phase and work_mode disagree')
  if (!depth.learning_goal?.toLowerCase().includes(pkg.focus.toLowerCase()) && id !== 'ma-g9-arts-and-music-u01-l02') fail(id, 'learning goal does not identify the focus')
  if (!Array.isArray(depth.vocabulary) || depth.vocabulary.length < 3 || depth.vocabulary.some((row) => !row.term || !row.definition)) fail(id, 'vocabulary is absent or thin')
  if (!INSTRUCTION_EXEMPT.has(pkg.work_mode) && (!Array.isArray(depth.concept_instruction) || depth.concept_instruction.length < 3)) fail(id, 'teaching phase lacks definition, mechanism, and tradeoff instruction')
  if (!Array.isArray(depth.work_blocks) || depth.work_blocks.length < 2) fail(id, 'fewer than two lesson-type work blocks')
  if (new Set((depth.work_blocks ?? []).map((row) => row.id)).size !== depth.work_blocks?.length) fail(id, 'work block IDs are not unique')
  if ((depth.work_blocks ?? []).some((row) => !row.prompt && !row.prompts && !row.protocol)) fail(id, 'work block lacks usable learner action')
  if (!Array.isArray(depth.legitimate_variation) || depth.legitimate_variation.length < 3 || !depth.legitimate_variation.some((line) => /model.*never an error|difference from.*model/i.test(line))) fail(id, 'legitimate creative variation is not protected')
  if (!Array.isArray(depth.common_technique_errors) || depth.common_technique_errors.length < 2) fail(id, 'observable technique mismatches are absent')
  if (!Array.isArray(depth.remediation_paths) || depth.remediation_paths.length !== depth.common_technique_errors?.length) fail(id, 'remediation paths do not resolve one-to-one')
  if (new Set((depth.remediation_paths ?? []).map((row) => row.different_instruction)).size !== depth.remediation_paths?.length) fail(id, 'retry routes repeat the same instruction')
  for (const path of depth.remediation_paths ?? []) {
    if (!path.different_instruction || !path.supported_attempt || !path.self_noticing_cue || !/(new|fresh|different)/i.test(path.fresh_retry ?? '')) fail(id, `remediation ${path.ref} lacks alternate teaching and new evidence`)
  }

  const conceptIds = new Set((depth.concept_registry ?? []).map((row) => row.id))
  const techniqueIds = new Set((depth.technique_registry ?? []).map((row) => row.id))
  const errorIds = new Set((depth.common_technique_errors ?? []).map((row) => row.id))
  const referenceRefs = new Set((depth.reference_registry ?? []).map((row) => row.ref))
  const modelRefs = new Set((depth.model_registry ?? []).map((row) => row.ref))
  const manifest = depth.tutor_readiness_manifest ?? {}
  if (Object.keys(manifest).some((key) => !MANIFEST_FIELDS.has(key))) fail(id, 'Tutor-readiness manifest contains a runtime or unapproved field')
  for (const value of [...(manifest.concept_ids ?? []), ...(manifest.prerequisite_concept_ids ?? [])]) if (!conceptIds.has(value)) fail(id, `unresolved concept ${value}`)
  for (const value of [...(manifest.technique_ids ?? []), ...(manifest.prerequisite_technique_ids ?? [])]) if (!techniqueIds.has(value)) fail(id, `unresolved technique ${value}`)
  for (const value of manifest.common_technique_error_ids ?? []) if (!errorIds.has(value)) fail(id, `unresolved technique error ${value}`)
  for (const value of manifest.reference_refs ?? []) if (!referenceRefs.has(value)) fail(id, `unresolved reference ${value}`)
  for (const value of manifest.model_refs ?? []) if (!modelRefs.has(value)) fail(id, `unresolved model ${value}`)
  if (manifest.rubric_refs?.length !== 1 || manifest.rubric_refs[0] !== guide.rubric_ref) fail(id, 'rubric manifest does not resolve to scoring guide')

  if (!Array.isArray(guide.rubric) || guide.rubric.length < 3 || guide.rubric.some((row) => !['OBJECTIVE', 'JUDGMENT_BASED'].includes(row.criterion_kind))) fail(id, 'rubric does not separate objective and judgment-based criteria')
  if (!guide.rubric.some((row) => row.criterion_kind === 'OBJECTIVE') || !guide.rubric.some((row) => row.criterion_kind === 'JUDGMENT_BASED')) fail(id, 'rubric lacks both authority kinds')
  if (!/not a fixed answer key|not a fixed|do not compare the work with the model/i.test(guide.scoring_judgment_guidance)) fail(id, 'scoring guidance does not protect open Arts answers')
  if (JSON.stringify(guide.rubric).match(/must (match|resemble|copy) the model/i)) fail(id, 'rubric penalizes model-different work')

  if ([3, 4, 5].includes(pkg.grade)) {
    if (!Array.isArray(pkg.task_steps) || pkg.task_steps.length < 3) fail(id, 'elementary directions are not chunked')
    if (Math.max(...pkg.task_steps.map((step) => step.split(/\s+/).length)) > 32) fail(id, 'elementary direction exceeds 32 words')
  } else if (pkg.task_steps) fail(id, 'secondary lesson was infantilized with elementary task_steps')

  if (pkg.media?.required && pkg.media.kind === 'SVG_VISUAL_MODEL') {
    const asset = resolve(REPO, pkg.media.locator)
    if (!existsSync(asset)) fail(id, `required visual asset is unresolved: ${pkg.media.locator}`)
    else {
      const svg = readFileSync(asset, 'utf8')
      if (!/role="img"/.test(svg) || !/<title/.test(svg) || !/<desc/.test(svg)) fail(id, 'required SVG lacks accessible image semantics')
      if (asset.endsWith('.arts-model.svg')) generatedVisualAssets += 1
    }
  }
}

const expectedGrades = [3, 4, 5, 7, 8, 9, 10, 11, 12]
if (packages.length !== 648) fail('corpus', `Arts/Music lessons ${packages.length} != 648`)
if (JSON.stringify([...grades].sort((a, b) => a - b)) !== JSON.stringify(expectedGrades)) fail('corpus', 'supported grade coverage drifted')
if (types.size < 14) fail('corpus', `only ${types.size} canonical lesson families are represented`)
if (modes.size !== 12) fail('corpus', `only ${modes.size} authored Arts/Music phases are represented`)
if (blockCounts.size < 4) fail('corpus', 'lesson types were mechanically assigned one block count')
for (const grade of expectedGrades) if ((gradeFamilyCoverage.get(grade)?.size ?? 0) < 7) fail('corpus', `grade ${grade} has thin lesson-family coverage`)
if (generatedVisualAssets < 1) fail('corpus', 'no generated visual reference assets were exercised')

const anchor = packages.find(({ pkg }) => pkg.lesson_id === 'ma-g9-arts-and-music-u01-l02')?.pkg
if (!anchor?.r1_sample || anchor.r1_sample.contract_version !== 'manuel-academy.arts-music-lesson-r1.sample-1') fail('anchor', 'approved sample contract was not preserved')
if (anchor?.r1_sample?.work_blocks?.map((row) => row.type).join(',') !== 'GUIDED_PRACTICE,INDEPENDENT_CREATION,REFLECTION,CRITIQUE,KNOWLEDGE_CHECK') fail('anchor', 'approved work-block sequence drifted')

if (failures.length) {
  console.error(`ARTS/MUSIC PRODUCTION DEPTH FAILURES (${failures.length})`)
  for (const finding of failures.slice(0, 80)) console.error(`  - ${finding}`)
  if (failures.length > 80) console.error(`  ... and ${failures.length - 80} more`)
  process.exitCode = 1
} else {
  console.log(`Arts/Music production depth: ${packages.length} lessons across grades ${expectedGrades.join(', ')}.`)
  console.log(`Canonical lesson families exercised: ${types.size}; authored phases: ${modes.size}; block-count shapes: ${[...blockCounts].sort().join(', ')}.`)
  console.log(`Generated accessible visual assets exercised: ${generatedVisualAssets}.`)
  console.log('ARTS/MUSIC PRODUCTION DEPTH: PASS')
}
