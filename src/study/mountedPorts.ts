import {
  createLocalDevelopmentStudyPorts,
  type LocalDevelopmentStudyServices,
} from './localDevelopmentPorts'
import type { StudyPortBundle } from './ports'
import {
  createMountedStudySafetyPort,
  type MountedStudySafetyPortDeps,
} from './safety/mountedPort'

/**
 * Mounted preview composition: academic preview state remains explicitly local,
 * while both safety decisions and safety-proposal capture use the authenticated
 * server boundary. The local #outbox is not used by the Tutor safety path.
 *
 * The parameter is the mounted safety port's own dependency type, so a caller
 * can pass `onSessionAuthorizationFailure` inline without a cast. The object is
 * forwarded unchanged; nothing here interprets or acts on the callback, because
 * clearing the adult bearer or re-issuing the Study session belongs to the App
 * composition, not to a port factory.
 */
export function createMountedStudyPorts(
  safetyDeps: MountedStudySafetyPortDeps = {},
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
