import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ADMIN_ACCESS_REASON_CODES,
  type AdminAccessMutationRequest,
  type AdminAccessPrincipal,
  type AdminAccessReadState,
  type AdminAccessReasonCode,
} from '../../admin/accessModel'
import { AdminAccessError, type AdminAccessHttpSource } from '../../admin/accessHttpSource'
import {
  ADMIN_OPERATIONAL_CAPABILITIES,
  ADMIN_OWNER_CAPABILITIES,
  ADMIN_READ_CAPABILITIES,
  ADMIN_ROLES,
  type AdminCapability,
  type AdminRole,
} from '../../admin/contracts'
import './admin-access-permissions.css'

const ROLE_DETAILS: Readonly<Record<AdminRole, { title: string; description: string }>> = {
  owner: {
    title: 'Owner',
    description: 'Full read and operational access, plus protected authority for roles, global configuration, publishing, and releases.',
  },
  admin: {
    title: 'Admin',
    description: 'Read access plus approved operational actions. Admins cannot manage Admin access or owner-only controls.',
  },
  viewer: {
    title: 'Viewer',
    description: 'Read-only access to authorized Admin operational views. Viewers cannot perform operational or access changes.',
  },
}

const REASON_LABELS: Readonly<Record<AdminAccessReasonCode, string>> = {
  'operator.request': 'Operator request',
  'policy.enforcement': 'Policy enforcement',
  'corrective.action': 'Corrective action',
  'emergency.response': 'Emergency response',
}

type AuthorizedAdmin = {
  readonly role: AdminRole
  readonly capabilities: readonly AdminCapability[]
}

interface PendingConfirmation {
  readonly principal: AdminAccessPrincipal
  readonly action: 'change-role' | 'revoke'
  readonly newRole?: AdminRole
  readonly reasonCode: AdminAccessReasonCode
}

export function AdminAccessPermissions({
  authorization,
  state,
  source,
  onMutated,
}: {
  readonly authorization: AuthorizedAdmin
  readonly state: AdminAccessReadState
  readonly source: AdminAccessHttpSource
  readonly onMutated: () => void
}) {
  const canManage = authorization.capabilities.includes('admin_roles:manage')
  const [selectedRoles, setSelectedRoles] = useState<Readonly<Record<string, AdminRole>>>({})
  const [reasons, setReasons] = useState<Readonly<Record<string, AdminAccessReasonCode>>>({})
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null)
  const [mutationState, setMutationState] = useState<
    | { readonly status: 'idle' }
    | { readonly status: 'saving' }
    | { readonly status: 'success'; readonly message: string }
    | { readonly status: 'error'; readonly message: string }
  >({ status: 'idle' })
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmation) confirmButtonRef.current?.focus()
  }, [confirmation])

  useEffect(() => {
    if (state.status !== 'ready') return
    setSelectedRoles(Object.fromEntries(
      state.projection.principals.map((principal) => [principal.assignmentRef, principal.role]),
    ))
  }, [state])

  const activeOwnerCount = useMemo(() => state.status === 'ready'
    ? state.projection.principals.filter((principal) => principal.role === 'owner').length
    : 0, [state])

  async function commit(pending: PendingConfirmation) {
    setMutationState({ status: 'saving' })
    const requestId = crypto.randomUUID()
    const base = {
      assignmentRef: pending.principal.assignmentRef,
      expectedRevision: pending.principal.revision,
      reasonCode: pending.reasonCode,
      requestId,
    }
    const request: AdminAccessMutationRequest = pending.action === 'change-role'
      ? { action: 'change-role', ...base, newRole: pending.newRole! }
      : { action: 'revoke', ...base }
    try {
      const result = await source.mutate(request)
      setConfirmation(null)
      setMutationState({
        status: 'success',
        message: result.status === 'revoked'
          ? 'Admin access was revoked and audited.'
          : `The canonical ${result.role} role is now active and audited.`,
      })
      onMutated()
    } catch (error) {
      setConfirmation(null)
      setMutationState({ status: 'error', message: safeMutationMessage(error) })
      if (error instanceof AdminAccessError
        && (error.code === 'access_conflict' || error.code === 'access_timeout')) onMutated()
    }
  }

  return (
    <div className="admin-access" aria-labelledby="admin-access-heading">
      <section className="admin-access__intro">
        <div>
          <p className="admin-access__eyebrow">Canonical authorization</p>
          <h2 id="admin-access-heading">Access &amp; Permissions</h2>
          <p>Admin authority comes only from the server-controlled owner, admin, and viewer roles. Effective capabilities are derived from those roles on the server.</p>
        </div>
        <span className={`admin-access__mode ${canManage ? 'is-manage' : ''}`}>
          {canManage ? 'Owner management' : 'Read only'}
        </span>
      </section>

      {!canManage && (
        <div className="admin-access__notice" role="note">
          <strong>Read-only access</strong>
          <span>Your current role can inspect this minimized permissions view but cannot change Admin access.</span>
        </div>
      )}

      <section className="admin-access__roles" aria-labelledby="admin-role-guide-heading">
        <div className="admin-access__section-heading">
          <div><p>Role guide</p><h3 id="admin-role-guide-heading">What each role can do</h3></div>
          <span>Capabilities are not directly assignable</span>
        </div>
        <div className="admin-access__role-grid">
          {ADMIN_ROLES.map((role) => (
            <article key={role} className={`admin-access__role-card is-${role}`}>
              <div><span className="admin-access__role-dot" aria-hidden="true" /><h4>{ROLE_DETAILS[role].title}</h4></div>
              <p>{ROLE_DETAILS[role].description}</p>
              <CapabilitySummary role={role} />
            </article>
          ))}
        </div>
      </section>

      <section className="admin-access__principals" aria-labelledby="admin-principals-heading">
        <div className="admin-access__section-heading">
          <div><p>Current authority</p><h3 id="admin-principals-heading">Admin principals</h3></div>
          {state.status === 'ready' && <span>{state.projection.principals.length} active</span>}
        </div>

        {state.status === 'loading' && <AccessState busy title="Loading Admin access" message="Principal data remains hidden until the authorized projection is ready." />}
        {state.status === 'unauthorized' && <AccessState title="Access view unavailable" message="The current server-resolved assignment does not include access to this view." />}
        {state.status === 'error' && (
          <AccessState
            title={state.code === 'access_timeout' ? 'Access read timed out' : state.code === 'access_malformed' ? 'Access response rejected' : 'Access view unavailable'}
            message={state.code === 'access_malformed'
              ? 'The response did not match the minimized access contract. No partial or raw data was shown.'
              : 'The authorized access source could not be read. No cached principal data is shown.'}
          />
        )}
        {state.status === 'ready' && state.projection.principals.length === 0 && (
          <AccessState title="No active principals" message="No current Admin assignments were returned by the authorized projection." />
        )}
        {state.status === 'ready' && state.projection.principals.length > 0 && (
          <div className="admin-access__principal-list">
            {state.projection.principals.map((principal) => {
              const selectedRole = selectedRoles[principal.assignmentRef] ?? principal.role
              const reason = reasons[principal.assignmentRef] ?? 'operator.request'
              const soleOwner = principal.role === 'owner' && activeOwnerCount === 1
              const busy = mutationState.status === 'saving'
              return (
                <article className="admin-access__principal" key={principal.assignmentRef}>
                  <div className="admin-access__principal-identity">
                    <div>
                      <strong>Admin principal</strong>
                      {principal.isCurrent && <span className="admin-access__you">Current session</span>}
                      {soleOwner && <span className="admin-access__protected">Sole owner protected</span>}
                    </div>
                    <code>{principal.principalRef}</code>
                  </div>
                  <dl className="admin-access__principal-facts">
                    <div><dt>Canonical role</dt><dd><RoleBadge role={principal.role} /></dd></div>
                    <div><dt>Status</dt><dd><span className="admin-access__active"><span aria-hidden="true" />Active</span></dd></div>
                    <div><dt>Effective access</dt><dd>{summaryLabel(principal.role)}</dd></div>
                  </dl>
                  {canManage && (
                    <div className="admin-access__controls" aria-label={`Manage ${principal.principalRef}`}>
                      <label>
                        Canonical role
                        <select
                          value={selectedRole}
                          disabled={busy}
                          onChange={(event) => setSelectedRoles((current) => ({
                            ...current,
                            [principal.assignmentRef]: event.target.value as AdminRole,
                          }))}
                        >
                          {ADMIN_ROLES.map((role) => (
                            <option
                              key={role}
                              value={role}
                              disabled={soleOwner && role !== 'owner'}
                            >{ROLE_DETAILS[role].title}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Reason
                        <select
                          value={reason}
                          disabled={busy}
                          onChange={(event) => setReasons((current) => ({
                            ...current,
                            [principal.assignmentRef]: event.target.value as AdminAccessReasonCode,
                          }))}
                        >
                          {ADMIN_ACCESS_REASON_CODES.map((code) => <option key={code} value={code}>{REASON_LABELS[code]}</option>)}
                        </select>
                      </label>
                      <div className="admin-access__actions">
                        <button
                          type="button"
                          disabled={busy || selectedRole === principal.role}
                          onClick={() => setConfirmation({
                            principal,
                            action: 'change-role',
                            newRole: selectedRole,
                            reasonCode: reason,
                          })}
                        >Review role change</button>
                        <button
                          type="button"
                          className="is-danger"
                          disabled={busy || soleOwner}
                          onClick={() => setConfirmation({ principal, action: 'revoke', reasonCode: reason })}
                        >Revoke access</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {mutationState.status !== 'idle' && mutationState.status !== 'saving' && (
        <div className={`admin-access__result is-${mutationState.status}`} role={mutationState.status === 'error' ? 'alert' : 'status'}>
          {mutationState.message}
        </div>
      )}
      {mutationState.status === 'saving' && <div className="admin-access__result" role="status">Saving and auditing the access change…</div>}

      {confirmation && (
        <div
          className="admin-access__confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-access-confirm-title"
          aria-describedby="admin-access-confirm-description"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && mutationState.status !== 'saving') setConfirmation(null)
            if (event.key === 'Tab') {
              const first = cancelButtonRef.current
              const last = confirmButtonRef.current
              if (!first || !last) return
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
              }
            }
          }}
        >
          <div>
            <p className="admin-access__eyebrow">Confirm privileged action</p>
            <h3 id="admin-access-confirm-title">
              {confirmation.action === 'revoke' ? 'Revoke Admin access?' : `Change role to ${confirmation.newRole}?`}
            </h3>
            <p id="admin-access-confirm-description">
              {confirmation.action === 'revoke'
                ? 'This principal will lose Admin access on the next server request.'
                : `The server will revoke the current assignment and derive the exact ${confirmation.newRole} capabilities from a new assignment.`}
              {' '}The database will reauthorize and audit the operation atomically.
            </p>
            <code>{confirmation.principal.principalRef}</code>
            <div className="admin-access__confirm-actions">
              <button ref={cancelButtonRef} type="button" onClick={() => setConfirmation(null)} disabled={mutationState.status === 'saving'}>Cancel</button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={confirmation.action === 'revoke' ? 'is-danger' : ''}
                disabled={mutationState.status === 'saving'}
                onClick={() => void commit(confirmation)}
              >Confirm and audit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CapabilitySummary({ role }: { role: AdminRole }) {
  return (
    <details>
      <summary>{summaryLabel(role)}</summary>
      <ul>
        {roleCapabilities(role).map((capability) => <li key={capability}><code>{capability}</code></li>)}
      </ul>
    </details>
  )
}

function roleCapabilities(role: AdminRole): readonly AdminCapability[] {
  if (role === 'viewer') return ADMIN_READ_CAPABILITIES
  if (role === 'admin') return [...ADMIN_READ_CAPABILITIES, ...ADMIN_OPERATIONAL_CAPABILITIES]
  return [...ADMIN_READ_CAPABILITIES, ...ADMIN_OPERATIONAL_CAPABILITIES, ...ADMIN_OWNER_CAPABILITIES]
}

function summaryLabel(role: AdminRole): string {
  if (role === 'viewer') return `${ADMIN_READ_CAPABILITIES.length} read capabilities`
  if (role === 'admin') return `${ADMIN_READ_CAPABILITIES.length} read + ${ADMIN_OPERATIONAL_CAPABILITIES.length} operational`
  return `${ADMIN_READ_CAPABILITIES.length} read + ${ADMIN_OPERATIONAL_CAPABILITIES.length} operational + ${ADMIN_OWNER_CAPABILITIES.length} owner`
}

function RoleBadge({ role }: { role: AdminRole }) {
  return <span className={`admin-access__role is-${role}`}>{ROLE_DETAILS[role].title}</span>
}

function AccessState({ busy = false, title, message }: { busy?: boolean; title: string; message: string }) {
  return (
    <div className="admin-access__state" aria-busy={busy} role="status">
      {busy && <span className="admin-access__spinner" aria-hidden="true" />}
      <div><strong>{title}</strong><span>{message}</span></div>
    </div>
  )
}

function safeMutationMessage(error: unknown): string {
  if (!(error instanceof AdminAccessError)) return 'The access change could not be completed. No change was shown.'
  if (error.code === 'sole_owner_protected') return 'This change was refused because it would leave no valid Owner.'
  if (error.code === 'access_conflict') return 'The assignment changed before this request completed. The access list will be refreshed.'
  if (error.code === 'idempotency_conflict') return 'This request identifier was already used for a different access change.'
  if (error.code === 'access_unauthorized') return 'Owner management authority is no longer available.'
  if (error.code === 'access_timeout') return 'The access change timed out without a confirmed result. Refresh before retrying.'
  if (error.code === 'access_malformed') return 'The server result did not match the access contract. Refresh before retrying.'
  return 'The access change could not be completed. No raw authorization details were exposed.'
}
