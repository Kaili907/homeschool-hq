export const INSTALLATION_MANAGER_CAPABILITIES = Object.freeze([
  'parent_installation:claim',
  'parent_installation:recover',
] as const)

export type InstallationManagerCapability = typeof INSTALLATION_MANAGER_CAPABILITIES[number]

/**
 * Explicit capability evidence is required. Guardian status, household
 * membership, learner/Parent PINs, Study authority, and Admin/staff authority
 * are not substitutes for this evidence.
 */
export interface InstallationManagerAuthority {
  readonly kind: 'installation-manager'
  readonly verifiedActorId: string
  readonly householdId: string
  readonly capabilities: readonly InstallationManagerCapability[]
}

export type SecurityAuthorityDomain =
  | 'learner'
  | 'parent'
  | 'guardian-membership'
  | 'installation-manager'
  | 'study'
  | 'study-guardian'
  | 'supabase-identity'
  | 'admin'
  | 'staff'

export interface AuthoritySeparationRule {
  readonly source: SecurityAuthorityDomain
  readonly cannotEstablish: readonly SecurityAuthorityDomain[]
}

/** Boundary declarations only; these do not create an Admin/staff role or authorization path. */
export const AUTHORITY_SEPARATION_RULES: readonly AuthoritySeparationRule[] = Object.freeze([
  Object.freeze({ source: 'learner' as const, cannotEstablish: Object.freeze([
    'parent', 'installation-manager', 'study-guardian', 'admin', 'staff',
  ] as const) }),
  Object.freeze({ source: 'parent' as const, cannotEstablish: Object.freeze([
    'learner', 'guardian-membership', 'installation-manager', 'study', 'study-guardian',
    'supabase-identity', 'admin', 'staff',
  ] as const) }),
  Object.freeze({ source: 'guardian-membership' as const, cannotEstablish: Object.freeze([
    'installation-manager', 'study-guardian', 'admin', 'staff',
  ] as const) }),
  Object.freeze({ source: 'installation-manager' as const, cannotEstablish: Object.freeze([
    'study-guardian', 'admin', 'staff',
  ] as const) }),
  Object.freeze({ source: 'study' as const, cannotEstablish: Object.freeze([
    'parent', 'installation-manager', 'admin', 'staff',
  ] as const) }),
])

export function isAuthorityEstablishmentForbidden(
  source: SecurityAuthorityDomain,
  target: SecurityAuthorityDomain,
): boolean {
  return AUTHORITY_SEPARATION_RULES.some(
    (rule) => rule.source === source && rule.cannotEstablish.includes(target),
  )
}
