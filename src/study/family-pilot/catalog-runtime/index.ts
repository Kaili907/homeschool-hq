/**
 * FF-M11 — the Family Pilot browser catalog runtime.
 *
 * Import the provider from here. Consumers that later need the catalog — the
 * assignment planner, daily schedule, subject adapters, the Study content
 * bridge, parent assignment controls — should depend on the
 * FamilyPilotCatalogProvider interface rather than on the generated modules,
 * so the storage shape can change without touching them.
 */
export type {
  CatalogCourse,
  CatalogLesson,
  CatalogUnit,
  CourseRef,
  FamilyPilotCatalogProvider,
  LessonRef,
  UnitRef,
} from './types'
export type { CatalogProviderSource } from './provider'
export { createCatalogProvider, familyPilotCatalog } from './provider'
