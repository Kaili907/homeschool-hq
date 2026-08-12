/**
 * ARTS-MUSIC-1 — Family Pilot Arts & Music subject lane. Barrel export for
 * the browser-safe surface: types, pure catalog queries, Study segment
 * adaptation, curriculum port, portfolio, and Tutor/static-help support
 * covering grades 5, 7, and 8 (72 lessons / 6 units each — 216 lessons / 18
 * units total).
 *
 * source.node.ts is deliberately excluded (as src/curriculum/family-pilot's
 * equivalent math loader also has no barrel): it reads the frozen
 * curriculum tree with node:fs and must not be pulled into a browser
 * bundle. A Node-only caller imports loadArtsMusicCatalog from
 * './source.node' directly.
 */
export * from './types'
export * from './catalog'
export * from './studyAdapter'
export * from './curriculumPort'
export * from './portfolio'
export * from './tutorSupport'
