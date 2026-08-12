import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  admitCandidate,
  buildBrowserCatalogProjection,
  buildCandidateFixture,
  buildCanonicalCandidateFixture,
  buildReadinessEvidence,
  buildReleaseRegistryEntry,
  type ReleaseCandidate,
} from '../../src/curriculum/release-admission/index.ts'

/**
 * CURRICULUM-RELEASE-ADMISSION — the operator surface.
 *
 * Run:
 *   node --experimental-strip-types scripts/curriculum-release-admission/admitCli.node.ts \
 *     --format operator --candidate <path.json>
 *
 * --fixture admits a generated candidate instead of a file, which is how the
 * workflow is exercised before the grade and high-school packages exist.
 *
 * Local and read-only: it reads one candidate file, writes nothing, and makes
 * no network or database contact. Exit 0 admitted, 2 rejected, 1 bad usage.
 */

export interface AdmitCliOptions {
  readonly format: 'operator' | 'json'
  readonly candidatePath: string | null
  readonly fixture: 'canonical' | 'minimal' | null
  readonly generatedAt: string
}

const USAGE =
  'Usage: admitCli --format operator|json (--candidate <path> | --fixture canonical|minimal) [--generated-at <iso8601>]'

export function parseAdmitCliArguments(
  args: readonly string[],
  now: () => string,
): AdmitCliOptions {
  let format: AdmitCliOptions['format'] | null = null
  let candidatePath: string | null = null
  let fixture: AdmitCliOptions['fixture'] = null
  let generatedAt: string | null = null

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (value === undefined) throw new Error(`${flag} needs a value. ${USAGE}`)
    if (flag === '--format') {
      if (value !== 'operator' && value !== 'json') throw new Error(USAGE)
      format = value
    } else if (flag === '--candidate') {
      candidatePath = value
    } else if (flag === '--fixture') {
      if (value !== 'canonical' && value !== 'minimal') throw new Error(USAGE)
      fixture = value
    } else if (flag === '--generated-at') {
      generatedAt = value
    } else {
      throw new Error(`Unknown flag ${flag}. ${USAGE}`)
    }
  }

  if (!format) throw new Error(USAGE)
  if ((candidatePath === null) === (fixture === null)) {
    throw new Error(`Give exactly one of --candidate or --fixture. ${USAGE}`)
  }
  return { format, candidatePath, fixture, generatedAt: generatedAt ?? now() }
}

function loadCandidate(options: AdmitCliOptions): ReleaseCandidate {
  if (options.fixture === 'canonical') return buildCanonicalCandidateFixture()
  if (options.fixture === 'minimal') return buildCandidateFixture()
  const path = resolve(options.candidatePath as string)
  return JSON.parse(readFileSync(path, 'utf8')) as ReleaseCandidate
}

/** The whole workflow: admit, then build the three artifacts admission unlocks. */
export function runAdmitCli(options: AdmitCliOptions, candidate: ReleaseCandidate) {
  const decision = admitCandidate(candidate)
  if (decision.status === 'REJECTED') {
    return {
      status: 'REJECTED' as const,
      validation: decision.validation,
      rejection_codes: decision.rejection_codes,
    }
  }
  return {
    status: 'ADMITTED' as const,
    validation: decision.validation,
    registry_entry: buildReleaseRegistryEntry(decision.release),
    readiness_evidence: buildReadinessEvidence(decision.release, {
      generatedAt: options.generatedAt,
    }),
    browser_catalog_projection: buildBrowserCatalogProjection(decision.release),
  }
}

export function formatOperatorResult(result: ReturnType<typeof runAdmitCli>): string {
  const { validation } = result
  const lines = [
    'Curriculum release admission',
    'Scope: LOCAL VALIDATION ONLY (no hosted contact)',
    `Candidate: ${validation.candidate_id}`,
    `Release version: ${validation.release_version}`,
    `Status: ${result.status}`,
  ]
  if (result.status === 'ADMITTED') {
    const entry = result.registry_entry
    lines.push(
      `Grades: ${entry.grades.map((grade) => grade.grade).join(', ') || 'none'}`,
      `Subjects: ${entry.subjects.join(', ') || 'none'}`,
      `Counts: ${entry.counts.courses} course(s), ${entry.counts.units} unit(s), ${entry.counts.lessons} lesson(s)`,
      `Graduation complete: ${entry.graduation_complete ? 'YES' : 'NO'}`,
      `Readiness: ${result.readiness_evidence.ready ? 'READY' : 'NOT READY'}`,
      `Projected courses: ${result.browser_catalog_projection.courses.length}`,
    )
  } else {
    lines.push('', 'Rejections:')
    for (const rejection of validation.rejections) {
      lines.push(`- code=${rejection.code} path=${rejection.path} detail=${JSON.stringify(rejection.detail)}`)
    }
  }
  lines.push('', `Operator result: ${result.status}`)
  return `${lines.join('\n')}\n`
}

function main(): void {
  const options = parseAdmitCliArguments(process.argv.slice(2), () => new Date().toISOString())
  const result = runAdmitCli(options, loadCandidate(options))
  process.stdout.write(
    options.format === 'json'
      ? `${JSON.stringify(result, null, 2)}\n`
      : formatOperatorResult(result),
  )
  if (result.status !== 'ADMITTED') process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(
      `curriculum_release_admission_failed: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  }
}
