import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'

const ROOT = new URL('../', import.meta.url)
const ADMITTED = new URL('../curriculum-release-admitted/family-pilot-r1/', import.meta.url)
const OUTPUT = new URL('../public/family-pilot-final/2.0.0/', import.meta.url)

const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))
const runtimeManifest = await readJson(new URL('runtime/runtime-manifest.json', ADMITTED))
const lessonRowsByCourse = await readJson(new URL('runtime/lesson-rows-by-course.json', ADMITTED))
const releaseManifest = await readJson(new URL('MANIFEST.json', ADMITTED))
const bindings = (await readFile(new URL('production-bindings.jsonl', ADMITTED), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))

const scalarKeys = [
  'objective',
  'scenario',
  'privacySafeScenario',
  'studentTask',
  'knowledgeCheck',
  'adaptationChoices',
  'extensionChallenge',
  'trustedAdultNote',
  'task_brief',
  'primary_task',
  'deliverable',
  'essential_question',
  'remediation',
  'extension',
  'copyright_and_authorship',
]

const arrayKeys = [
  'materials',
  'keyPoints',
  'movementCues',
  'completionCriteria',
  'accessibilitySupports',
  'neverRequires',
  'safetyNotes',
  'learning_objectives',
  'lesson_success_criteria',
  'task_steps',
  'requirements',
  'critique_criteria',
  'test_or_check_criteria',
  'safety_and_privacy_rules',
  'accessibility_options',
  'task_accessibility_provisions',
]

function asText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string' && value.text.trim()) {
    return value.text.trim()
  }
  return null
}

function jsonTitle(value, fallback) {
  return value.lessonRef?.title || value.title || value.lesson_title || fallback
}

function projectJsonMaterial(value, binding, fallbackTitle) {
  const sections = []
  const add = (title, body, prompts = []) => {
    const text = asText(body)
    const safePrompts = prompts.filter((item) => typeof item === 'string' && item.trim())
    if (text || safePrompts.length) sections.push({ title, ...(text ? { body: text } : {}), prompts: safePrompts })
  }

  add('Lesson goal', value.objective)
  add('Scenario', value.scenario)
  for (const key of scalarKeys) {
    if (key === 'objective' || key === 'scenario') continue
    add(key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), value[key])
  }
  for (const key of arrayKeys) {
    if (!Array.isArray(value[key])) continue
    add(key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), null, value[key].filter((item) => typeof item === 'string'))
  }

  if (Array.isArray(value.sections)) {
    for (const section of value.sections) {
      const prompts = []
      for (const item of Array.isArray(section.items) ? section.items : []) {
        if (typeof item.prompt === 'string') {
          const choices = Array.isArray(item.choices) ? `\nChoices: ${item.choices.join(' · ')}` : ''
          prompts.push(`${item.prompt}${choices}`)
        }
        if (Array.isArray(item.workedSolution?.steps)) prompts.push(...item.workedSolution.steps)
      }
      add(section.title || section.kind || 'Lesson work', section.directions, prompts)
    }
  }

  if (Array.isArray(value.tasks)) {
    for (const task of value.tasks) {
      add(
        String(task.kind || task.taskId || 'Task').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        task.directions,
        (Array.isArray(task.prompts) ? task.prompts : []).map((prompt) => prompt.text).filter(Boolean),
      )
    }
  }

  add('Source or reading', value.sourceReference)
  add('Guided support', value.guidedSupport)
  add('Independent evidence', value.independentEvidenceTask)
  add('Equal-credit alternative', value.simulationAlternative?.description)
  add('Optional reflection', value.optionalReflection?.prompt)
  add('Media fallback', value.media?.fallback)

  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: jsonTitle(value, fallbackTitle),
    subject: binding.subject,
    format: 'structured',
    sections,
  }
}

function projectMarkdownMaterial(markdown, binding, fallbackTitle) {
  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle,
    subject: binding.subject,
    format: 'markdown',
    markdown,
  }
}

function packagePath(ref) {
  const separator = ref.indexOf(':')
  if (!ref.startsWith('git+') || separator < 0) throw new Error(`Invalid production package ref: ${ref}`)
  const relative = ref.slice(separator + 1)
  if (relative.includes('/answer-key') || relative.includes('/scoring-guide')) {
    throw new Error(`Adult material cannot be used as a learner package: ${ref}`)
  }
  return new URL(relative, ROOT)
}

const bindingsByCourse = new Map()
for (const binding of bindings) {
  const bucket = bindingsByCourse.get(binding.courseRef) ?? []
  bucket.push(binding)
  bindingsByCourse.set(binding.courseRef, bucket)
}

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(new URL('courses/', OUTPUT), { recursive: true })

for (const course of runtimeManifest.courses) {
  const rows = lessonRowsByCourse[course.courseRef]
  const courseBindings = bindingsByCourse.get(course.courseRef) ?? []
  if (!Array.isArray(rows) || rows.length !== course.lessonCount || courseBindings.length !== course.lessonCount) {
    throw new Error(`Incomplete admitted course ${course.courseRef}`)
  }
  const rowByLesson = new Map(rows.map((row) => [row.lessonRef, row]))
  const safeRows = rows.map((row) => ({
    ...row,
    // Adult answer/scoring resource locators are not needed to render or start
    // the learner lesson and therefore never enter its lazy browser payload.
    resourceRefs: row.resourceRefs.filter((ref) =>
      !/answer-keys|answer_key|scoring-guide|teacher-guide/i.test(ref)),
  }))
  const safeBindings = {}
  const materials = {}
  for (const binding of courseBindings) {
    const row = rowByLesson.get(binding.lessonRef)
    if (!row) throw new Error(`Binding ${binding.lessonRef} is missing its admitted lesson row`)
    const file = packagePath(binding.productionPackageRef)
    const raw = await readFile(file, 'utf8')
    const material = extname(file.pathname) === '.json'
      ? projectJsonMaterial(JSON.parse(raw), binding, row.title)
      : projectMarkdownMaterial(raw, binding, row.title)
    safeBindings[binding.lessonRef] = {
      lessonRef: binding.lessonRef,
      courseRef: binding.courseRef,
      grade: binding.grade,
      subject: binding.subject,
      productionPackageRef: binding.productionPackageRef,
      productionSourceCommit: binding.productionSourceCommit,
      completionAuthority: binding.completionAuthority,
      sourceReadinessKind: binding.sourceReadinessKind,
      sourceRuntimeState: binding.sourceRuntimeState,
    }
    materials[binding.lessonRef] = material
  }
  const payload = JSON.stringify({ courseRef: course.courseRef, lessons: safeRows, bindings: safeBindings, materials })
  if (/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer-keys|scoring-guide|teacher-guide/i.test(payload)) {
    throw new Error(`Learner payload for ${course.courseRef} contains an adult/scoring field`)
  }
  await writeFile(new URL(`courses/${course.courseRef}.json`, OUTPUT), payload)
}

await writeFile(
  new URL('manifest.json', OUTPUT),
  JSON.stringify({
    releaseId: releaseManifest.releaseId,
    classification: releaseManifest.classification,
    admissionStatus: releaseManifest.admissionStatus,
    counts: releaseManifest.counts,
    productionBindings: bindings.length,
    dynamicSocialSources: releaseManifest.dynamicSocialSources,
    runtime: runtimeManifest,
  }),
)

console.log(`Built final Family Pilot browser data: ${bindings.length} lessons across ${runtimeManifest.courses.length} lazy course payloads.`)
