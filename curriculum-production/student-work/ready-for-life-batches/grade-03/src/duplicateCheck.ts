import type { CorpusEntry } from './types.ts'

export interface DuplicateFinding {
  readonly rule: string
  readonly packageIds: readonly [string, string]
  readonly detail: string
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'your', 'you', 'is', 'are', 'it', 'this',
  'that', 'or', 'be', 'as', 'at', 'by', 'from', 'one', 'each', 'their', 'they', 'not', 'do', 'does', 'so',
])

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Mass-templating catches itself here: this course's source lessons.jsonl
 * only varies a "focus" phrase across a single boilerplate template, so a
 * lazy authoring pass (find/replace the focus phrase into fixed scaffolding)
 * would leave objective/scenario text with very high word overlap across
 * lessons. A genuinely authored lesson names different objects, settings,
 * and steps each time and stays well below this threshold. Threshold picked
 * empirically: two genuinely distinct grade-3 RFL lessons about different
 * skills share under ~0.35 content-word overlap even when both are about
 * household routines; near-duplicate/templated pairs cross 0.55 easily.
 */
const SIMILARITY_THRESHOLD = 0.55

function checkFieldPairwise(entries: readonly CorpusEntry[], field: 'objective' | 'scenario' | 'remediation' | 'extension'): DuplicateFinding[] {
  const findings: DuplicateFinding[] = []
  const words = entries.map((e) => contentWords(e.pkg[field]))
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const sim = jaccard(words[i], words[j])
      if (sim >= SIMILARITY_THRESHOLD) {
        findings.push({
          rule: `duplicate-${field}`,
          packageIds: [entries[i].pkg.packageId, entries[j].pkg.packageId],
          detail: `${field} content-word Jaccard similarity ${sim.toFixed(2)} >= ${SIMILARITY_THRESHOLD} — likely templated or copy-adjusted rather than independently authored`,
        })
      }
    }
  }
  return findings
}

const GENERIC_PHRASES = [
  /\bcomplete the task\b/i,
  /\bdo your best\b/i,
  /\bfollow the steps\b/i,
  /\bthink about what you learned\b/i,
]

function checkGenericPhrasing(entries: readonly CorpusEntry[]): DuplicateFinding[] {
  const findings: DuplicateFinding[] = []
  for (const entry of entries) {
    const text = `${entry.pkg.objective} ${entry.pkg.scenario}`
    for (const pattern of GENERIC_PHRASES) {
      if (pattern.test(text)) {
        findings.push({
          rule: 'generic-phrasing',
          packageIds: [entry.pkg.packageId, entry.pkg.packageId],
          detail: `objective/scenario matches a generic scaffold phrase ${pattern} instead of concrete, lesson-specific content`,
        })
      }
    }
    if (contentWords(entry.pkg.objective).size < 6) {
      findings.push({
        rule: 'thin-objective',
        packageIds: [entry.pkg.packageId, entry.pkg.packageId],
        detail: `objective has fewer than 6 distinct content words — too thin to be a genuine, specific lesson objective`,
      })
    }
  }
  return findings
}

export function checkDuplicatesAndGenericContent(entries: readonly CorpusEntry[]): DuplicateFinding[] {
  return [
    ...checkFieldPairwise(entries, 'objective'),
    ...checkFieldPairwise(entries, 'scenario'),
    ...checkGenericPhrasing(entries),
  ]
}
