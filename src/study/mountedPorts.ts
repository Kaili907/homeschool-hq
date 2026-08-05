import {
  createLocalDevelopmentStudyPorts,
  type LocalDevelopmentStudyServices,
} from './localDevelopmentPorts'
import type { StudyPortBundle } from './ports'
import {
  createMountedStudySafetyPort,
  type StudySafetyClientDeps,
} from './safety/mountedPort'

/**
 * Mounted preview composition: academic preview state remains explicitly local,
 * while both safety decisions and safety-proposal capture use the authenticated
 * server boundary. The local #outbox is not used by the Tutor safety path.
 */
export function createMountedStudyPorts(
  safetyDeps: StudySafetyClientDeps = {},
): { readonly ports: StudyPortBundle; readonly services: LocalDevelopmentStudyServices } {
  const local = createLocalDevelopmentStudyPorts()
  return Object.freeze({
    services: local.services,
    ports: Object.freeze({
      ...local.ports,
      safety: createMountedStudySafetyPort(safetyDeps),
    }),
  })
}
