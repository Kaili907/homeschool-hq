import type { CorpusEntry } from './types.ts'

export interface DuplicatePair {
  readonly a: string
  readonly b: string
  readonly kind: 'exact' | 'near'
  readonly jaccard: number
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'this', 'that', 'will', 'your', 'you', 'it', 'be', 'was', 'as',
  'at', 'by', 'from', 'has', 'have', 'if', 'not', 'one', 'so', 'their',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

/** Content-bearing text only — excludes titles/phase names/lessonRef metadata that are legitimately shared boilerplate. */
export function contentText(entry: CorpusEntry): string {
  const { pkg } = entry
  const taskText = pkg.tasks.map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`).join(' ')
  return [pkg.objective, pkg.scenario, taskText, pkg.remediation, pkg.extension].join(' ')
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Pairwise exact + near-duplicate detection across the corpus. "Exact"
 * means identical normalized content text (a copy-paste with only the
 * lessonRef changed). "Near" means high token-overlap (the same boilerplate
 * template with only the focus phrase swapped) above the given threshold.
 * O(n^2) is fine at this corpus size (36 lessons).
 */
export function findDuplicates(entries: readonly CorpusEntry[], nearThreshold = 0.55): DuplicatePair[] {
  const pairs: DuplicatePair[] = []
  const prepared = entries.map((e) => ({ id: e.pkg.packageId, tokens: tokenize(contentText(e)), raw: contentText(e).trim().toLowerCase() }))

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const x = prepared[i]
      const y = prepared[j]
      if (x.raw === y.raw) {
        pairs.push({ a: x.id, b: y.id, kind: 'exact', jaccard: 1 })
        continue
      }
      const sim = jaccard(x.tokens, y.tokens)
      if (sim >= nearThreshold) {
        pairs.push({ a: x.id, b: y.id, kind: 'near', jaccard: sim })
      }
    }
  }
  return pairs
}
