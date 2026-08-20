/** The Family Pilot is opt-in and must never become enabled by a truthy typo. */
export function isFamilyPilotEnabled(value?: string): boolean {
  return value === 'true'
}

export function isFamilyPilotEnabledFromHost(): boolean {
  return isFamilyPilotEnabled(import.meta.env.VITE_FAMILY_PILOT_ENABLED)
}

/** Diagnostics are a development-only surface; the pilot gate alone never selects them. */
export function isFamilyPilotDiagnosticsEnabled(input: {
  readonly developmentBuild: boolean
  readonly pilotFlagValue?: string
  readonly diagnosticsFlagValue?: string
}): boolean {
  return input.developmentBuild &&
    isFamilyPilotEnabled(input.pilotFlagValue) &&
    input.diagnosticsFlagValue === 'true'
}

export function isFamilyPilotDiagnosticsEnabledFromHost(): boolean {
  return isFamilyPilotDiagnosticsEnabled({
    developmentBuild: import.meta.env.DEV,
    pilotFlagValue: import.meta.env.VITE_FAMILY_PILOT_ENABLED,
    diagnosticsFlagValue: import.meta.env.VITE_FAMILY_PILOT_DIAGNOSTICS,
  })
}
