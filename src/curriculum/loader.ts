import { parsePlanDoc, type PlanDoc } from './parser'

/**
 * MP — the shipped plan docs, loaded at build time from plans/*.md via Vite's glob.
 * Adding a plan later = drop a new md into plans/, no code change. This module is
 * Vite-only (import.meta.glob); the parser it calls is pure and unit-tested directly.
 */
const raws = import.meta.glob('./plans/*.md', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

let _cache: PlanDoc[] | null = null

/** All shipped plan docs, parsed once and memoized. Sorted by filename for stability. */
export function loadPlans(): PlanDoc[] {
  if (_cache) return _cache
  _cache = Object.entries(raws)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, raw]) => parsePlanDoc(raw, path.split('/').pop()!.replace(/\.md$/, '')))
  return _cache
}
