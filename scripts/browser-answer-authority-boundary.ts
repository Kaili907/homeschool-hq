import type { OutputChunk } from 'rollup'
import type { Plugin } from 'vite'

const FORBIDDEN_BROWSER_MODULES: readonly RegExp[] = [
  /\/netlify\/functions\/production-item-resolver\.js$/,
  /\/src\/study\/family-pilot\/practice\/practice\.ts$/,
  /\/src\/curriculum\/practice\/grade5MathPracticeUnits\.ts$/,
  /\/src\/curriculum\/grade\d+(?:Math|FinLit).*Generator\.ts$/,
  /\/src\/generators(?:4|6)?\.ts$/,
  /\/src\/assessment\/banks\//,
  /\/src\/assessment\/(?:attempts|normalizer|report)\.ts$/,
  /\/src\/study\/family-pilot\/tutor\/tutorBridge\.ts$/,
]

const AUTHORITY_NAME = [
  'answerIndex',
  'correctAnswer(?:Lookup|For|ByRef)?',
  'expectedAnswer',
  'acceptedAnswers',
  'solutionKey',
  'answerKey(?:Map)?',
  'correct(?:Choice|Option)(?:Lookup|For|ByRef)?',
].join('|')

const EXECUTABLE_AUTHORITY = new RegExp(
  String.raw`(?:\.|\?\.)\s*(?:${AUTHORITY_NAME})\b|\[\s*['"](?:${AUTHORITY_NAME})['"]\s*\]|(?:^|[,;{])\s*(?:['"](?:${AUTHORITY_NAME})['"]|(?:${AUTHORITY_NAME}))\s*:`,
  'm',
)

function cleanId(id: string): string {
  return id.replaceAll('\\', '/').split('?')[0]
}

function forbiddenModule(id: string): boolean {
  const normalized = cleanId(id)
  return FORBIDDEN_BROWSER_MODULES.some((pattern) => pattern.test(normalized))
}

function chunkModules(chunk: OutputChunk): readonly string[] {
  return Object.keys(chunk.modules).map(cleanId)
}

export function browserAnswerAuthorityBoundary(enabled = true): Plugin {
  return {
    name: 'browser-answer-authority-boundary',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (!enabled) return
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk') {
          const forbidden = chunkModules(output).find(forbiddenModule)
          if (forbidden) {
            this.error(`Browser chunk ${fileName} imports forbidden answer-authority module ${forbidden}`)
          }
          if (EXECUTABLE_AUTHORITY.test(output.code)) {
            this.error(`Browser chunk ${fileName} contains executable answer authority`)
          }
          continue
        }
        if (!fileName.endsWith('.map') || typeof output.source !== 'string') continue
        const map = JSON.parse(output.source) as { sources?: string[]; sourcesContent?: Array<string | null> }
        const forbidden = map.sources?.find(forbiddenModule)
        if (forbidden) this.error(`Browser source map ${fileName} exposes forbidden answer-authority module ${forbidden}`)
        if (map.sourcesContent?.some((source) => source !== null && EXECUTABLE_AUTHORITY.test(source))) {
          this.error(`Browser source map ${fileName} exposes executable answer authority`)
        }
      }
    },
  }
}
