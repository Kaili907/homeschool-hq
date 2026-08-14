import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { build, loadConfigFromFile, mergeConfig } from 'vite'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const configPath = resolve(root, 'vite.config.ts')
const normalizedRoot = `${root.split(sep).join('/')}/`

process.env.VITE_FAMILY_PILOT_ENABLED = 'true'

const loaded = await loadConfigFromFile(
  { command: 'build', mode: 'production' },
  configPath,
)
if (!loaded) throw new Error('Could not load the production Vite configuration.')

const result = await build(mergeConfig(loaded.config, {
  configFile: false,
  root,
  logLevel: 'silent',
  build: {
    write: false,
    manifest: false,
    emptyOutDir: false,
  },
}))

const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output)
const chunks = outputs.filter((entry) => entry.type === 'chunk')
const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))

function normalizedModuleId(value) {
  return value.split(sep).join('/').replace(normalizedRoot, '')
}

function chunkForFacade(suffix) {
  const chunk = chunks.find((candidate) =>
    candidate.facadeModuleId?.split(sep).join('/').endsWith(suffix))
  if (!chunk) {
    throw new Error(`Production bundle is missing ${suffix}. Facades: ${chunks
      .map((candidate) => candidate.facadeModuleId)
      .filter(Boolean)
      .join(', ')}`)
  }
  return chunk
}

function chunkContainingModule(suffix) {
  const chunk = chunks.find((candidate) => Object.keys(candidate.modules).some((moduleId) =>
    moduleId.split(sep).join('/').endsWith(suffix)))
  if (!chunk) throw new Error(`Production bundle is missing module ${suffix}.`)
  return chunk
}

function staticClosure(entry) {
  const found = new Map()
  const pending = [entry]
  while (pending.length) {
    const chunk = pending.pop()
    if (!chunk || found.has(chunk.fileName)) continue
    found.set(chunk.fileName, chunk)
    for (const imported of chunk.imports) pending.push(byFileName.get(imported))
  }
  return [...found.values()]
}

function moduleSet(closure) {
  return new Set(closure.flatMap((chunk) => Object.keys(chunk.modules).map(normalizedModuleId)))
}

const rootChunk = chunkForFacade('/index.html')
const familyChunk = chunkForFacade('/src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx')
const legacyChunk = chunkContainingModule('/src/LegacyApp.tsx')
const rootModules = moduleSet(staticClosure(rootChunk))
const familyClosure = staticClosure(familyChunk)
const familyModules = moduleSet(familyClosure)

const forbidden = [
  ['legacy-root', (id) => id === 'src/LegacyApp.tsx'],
  ['whole-profile-state', (id) => id === 'src/appState.ts'],
  ['whole-profile-sync-or-upload', (id) => id.startsWith('src/sync/')],
  ['legacy-answer-scoring', (id) => id === 'src/engine.ts' || id.startsWith('src/generators')],
  ['legacy-tutor-profile-state', (id) => id === 'src/tutor/tutorState.ts'],
  ['legacy-tutor-transcript-ui', (id) =>
    id === 'src/components/QuizSession.tsx' || id.startsWith('src/components/tutor/')],
]

function violations(modules) {
  return forbidden.flatMap(([system, matches]) =>
    [...modules].filter(matches).map((moduleId) => ({ system, moduleId })))
}

const rootViolations = violations(rootModules)
const familyViolations = violations(familyModules)
if (rootViolations.length || familyViolations.length) {
  throw new Error(JSON.stringify({ rootViolations, familyViolations }, null, 2))
}

const acceptedFamilyPilotAdapters = [
  'src/study/family-pilot/tutor/tutorBridge.ts',
  'src/tutor/tutorEngine.ts',
  'src/tutor/tutorApi.ts',
  'src/auth/supabaseSession.ts',
].filter((moduleId) => familyModules.has(moduleId))

console.log(JSON.stringify({
  classification: 'FAMILY_PILOT_RUNTIME_GRAPH_ISOLATED',
  rootEntry: rootChunk.fileName,
  familyEntry: familyChunk.fileName,
  legacyEntry: legacyChunk.fileName,
  legacyIsDynamicFromRoot: rootChunk.dynamicImports.includes(legacyChunk.fileName),
  familyIsDynamicFromRoot: rootChunk.dynamicImports.includes(familyChunk.fileName),
  familyImportsLegacyEntry: familyClosure.some((chunk) => chunk.fileName === legacyChunk.fileName),
  rootStaticChunks: staticClosure(rootChunk).length,
  familyStaticChunks: familyClosure.length,
  familyStaticModules: familyModules.size,
  forbiddenFamilyModules: familyViolations,
  acceptedFamilyPilotAdapters,
}, null, 2))
