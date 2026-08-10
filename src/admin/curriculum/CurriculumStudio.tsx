import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { AdminCapability } from '../contracts'
import {
  CURRICULUM_AUTHORING_SCHEMA_VERSION,
  CurriculumDraftAuthoringError,
  validateCurriculumDraftEntity,
  type CurriculumDraftDetail,
  type CurriculumDraftEntityPayload,
  type CurriculumDraftEntityType,
  type CurriculumDraftMaterialization,
  type CurriculumDraftSummary,
  type CurriculumStudioEntityIndexEntry,
  type CreateCurriculumDraftEntityInput,
  type TombstoneCurriculumDraftEntityInput,
  type UpdateCurriculumDraftEntityInput,
} from '../curriculum-authoring/contracts'
import type { ValidationIssue } from '../../curriculum-authoring/v2/schema'
import type { CurriculumCatalog, CurriculumReadAuthorization } from './contracts'
import { CurriculumValidationWorkspace } from '../../components/admin/CurriculumValidationWorkspace'
import type { CurriculumDraftValidationResult } from '../curriculum-authoring/contracts'
import {
  buildMaterializedCurriculumStudioIndex,
  canWriteCurriculumDrafts,
  CURRICULUM_STUDIO_NAVIGATION_REQUEST,
  curriculumTreeKeyboardAction,
  expandedAncestorsFor,
  resolveCurriculumStudioEntity,
  visibleCurriculumStudioRows,
  type CurriculumStudioIndex,
  type CurriculumStudioRow,
  type CurriculumStudioSource,
  type CurriculumTreeKey,
} from './studioModel'
import { StructuredEntityEditor } from './StructuredEntityEditor'
import { createDraftEntityPayload, CURRICULUM_ENTITY_REF_PATTERN } from './studioEditorModel'
import './curriculum-studio.css'

const TREE_KEYS = new Set<CurriculumTreeKey>([
  'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ',
])

type SaveState =
  | { readonly kind: 'saved'; readonly message: string }
  | { readonly kind: 'unsaved'; readonly message: string }
  | { readonly kind: 'saving'; readonly message: string }
  | { readonly kind: 'conflict'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string }

type PendingOperation =
  | { readonly kind: 'create'; readonly input: CreateCurriculumDraftEntityInput }
  | { readonly kind: 'update'; readonly input: UpdateCurriculumDraftEntityInput }
  | {
    readonly kind: 'tombstone'
    readonly draftId: string
    readonly entry: CurriculumStudioEntityIndexEntry
    readonly payload: CurriculumDraftEntityPayload
    readonly expectedDraftRevision: number
    readonly createIdempotencyKey: string
    readonly tombstoneIdempotencyKey: string
  }

export interface CurriculumStudioProps {
  readonly authorization: CurriculumReadAuthorization
  readonly source: CurriculumStudioSource
}

export function CurriculumStudio({ authorization, source }: CurriculumStudioProps) {
  const canRead = authorization.status === 'authorized'
    && authorization.capabilities.includes('curriculum:read')
  const [catalog, setCatalog] = useState<CurriculumCatalog | null>(null)
  const [drafts, setDrafts] = useState<readonly CurriculumDraftSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!canRead) {
      setCatalog(null)
      setDrafts([])
      return
    }
    let current = true
    setCatalog(null)
    setError(null)
    Promise.all([source.loadPublishedCatalog(), source.listDrafts()]).then(
      ([nextCatalog, nextDrafts]) => {
        if (!current) return
        setCatalog(nextCatalog)
        setDrafts(nextDrafts.drafts)
      },
      (reason: unknown) => {
        if (current) setError(authoringErrorMessage(reason, 'The authorized Curriculum Studio service is unavailable.'))
      },
    )
    return () => { current = false }
  }, [canRead, reload, source])

  if (authorization.status === 'checking') {
    return <StudioState role="status" title="Checking Curriculum Studio access">Published curriculum has not been requested yet.</StudioState>
  }
  if (!canRead) {
    return (
      <StudioState role="alert" title="Curriculum Studio access unavailable">
        This Admin session does not have the curriculum:read capability. No hierarchy or draft metadata was loaded.
      </StudioState>
    )
  }
  if (error) {
    return <StudioState role="alert" title="Curriculum Studio unavailable" onRetry={() => setReload((value) => value + 1)}>{error}</StudioState>
  }
  if (!catalog) {
    return <StudioState role="status" title="Loading Curriculum Studio">Loading the published base and authorized draft list.</StudioState>
  }
  return (
    <CurriculumStudioView
      catalog={catalog}
      capabilities={authorization.capabilities}
      source={source}
      initialDrafts={drafts}
    />
  )
}

function StudioState({
  role,
  title,
  children,
  onRetry,
}: {
  readonly role: 'status' | 'alert'
  readonly title: string
  readonly children: ReactNode
  readonly onRetry?: () => void
}) {
  return (
    <section className="curriculum-studio-state" role={role} aria-labelledby="curriculum-studio-state-title">
      <p className="curriculum-studio-eyebrow">Curriculum Studio</p>
      <h2 id="curriculum-studio-state-title">{title}</h2>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function CurriculumStudioView({
  catalog,
  capabilities,
  source,
  initialDrafts = [],
  initialBaseEntries = [],
}: {
  readonly catalog: CurriculumCatalog
  readonly capabilities: readonly AdminCapability[]
  readonly source: CurriculumStudioSource
  readonly initialDrafts?: readonly CurriculumDraftSummary[]
  readonly initialBaseEntries?: readonly CurriculumStudioEntityIndexEntry[]
}) {
  const [drafts, setDrafts] = useState(initialDrafts)
  const [draftChoice, setDraftChoice] = useState(initialDrafts[0]?.draftId ?? '')
  const [draft, setDraft] = useState<CurriculumDraftDetail | null>(null)
  const [materialization, setMaterialization] = useState<CurriculumDraftMaterialization | null>(null)
  const [baseEntries, setBaseEntries] = useState<readonly CurriculumStudioEntityIndexEntry[]>(initialBaseEntries)
  const [workspaceMessage, setWorkspaceMessage] = useState('Select a draft or create a new workspace.')
  const [workspaceBusy, setWorkspaceBusy] = useState(initialBaseEntries.length === 0)
  const [targetVersion, setTargetVersion] = useState('')
  const [createRequestKey, setCreateRequestKey] = useState<string | null>(null)
  const [serverWriteAllowed, setServerWriteAllowed] = useState(true)
  const initialEntityToken = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('entity') ?? ''
  }, [])
  const [selectedId, setSelectedId] = useState(initialEntityToken)
  const [focusedId, setFocusedId] = useState(initialEntityToken)
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const [query, setQuery] = useState('')
  const [payload, setPayload] = useState<CurriculumDraftEntityPayload | null>(null)
  const [savedPayload, setSavedPayload] = useState<CurriculumDraftEntityPayload | null>(null)
  const [entityLoading, setEntityLoading] = useState(false)
  const [entityError, setEntityError] = useState<string | null>(null)
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([])
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'saved', message: 'Saved' })
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null)
  const [newEntityType, setNewEntityType] = useState<CurriculumDraftEntityType>('lesson')
  const [newEntityRef, setNewEntityRef] = useState('')
  const [validation, setValidation] = useState<CurriculumDraftValidationResult | null>(null)
  const [validationBusy, setValidationBusy] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const focusRequested = useRef(false)
  const nextLoadedSaveMessage = useRef('Saved')
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const draftCapable = canWriteCurriculumDrafts(capabilities)
  const writeAllowed = draftCapable && serverWriteAllowed && draft !== null
  const entries = materialization?.entities ?? baseEntries
  const index = useMemo(() => buildMaterializedCurriculumStudioIndex(entries), [entries])
  const visible = useMemo(() => visibleCurriculumStudioRows(index, expandedIds, query), [expandedIds, index, query])
  const selected = resolveCurriculumStudioEntity(index, selectedId) ?? index.rows[0] ?? null
  const effectiveFocusedId = focusedId || selected?.id || ''
  const selectedEntry = selected?.entity.kind === 'authoring' ? selected.entity.entry : null
  const dirty = curriculumPayloadDirty(payload, savedPayload)
  const validationStale = validation !== null && draft !== null && validation.draftRevision !== draft.revision

  useEffect(() => {
    if (initialBaseEntries.length > 0) return
    let current = true
    setWorkspaceBusy(true)
    source.readBaseIndex(catalog.source.version).then(
      (value) => {
        if (!current) return
        setBaseEntries(value.entities)
        setWorkspaceBusy(false)
      },
      (reason) => {
        if (!current) return
        setWorkspaceBusy(false)
        setWorkspaceMessage(authoringErrorMessage(reason, 'The immutable base materialization is unavailable.'))
      },
    )
    return () => { current = false }
  }, [catalog.source.version, initialBaseEntries.length, source])

  useEffect(() => {
    const fallback = index.rows[0]
    if (!fallback) {
      setSelectedId('')
      setFocusedId('')
      return
    }
    if (index.byId.has(selectedId)) return
    setSelectedId(fallback.id)
    setFocusedId(fallback.id)
    const expanded = new Set(expandedAncestorsFor(index, fallback.id))
    if (fallback.hasChildren) expanded.add(fallback.id)
    setExpandedIds(expanded)
  }, [index, selectedId])

  useEffect(() => {
    if (!selectedEntry) {
      setPayload(null)
      setSavedPayload(null)
      setEntityError(null)
      return
    }
    let current = true
    setEntityLoading(true)
    setEntityError(null)
    setIssues([])
    const request = selectedEntry.origin === 'base'
      ? source.readBaseEntity(catalog.source.version, selectedEntry.entityType, selectedEntry.entityRef)
          .then((value) => value.payload)
      : draft
        ? source.readEntity(draft.draftId, selectedEntry.entityType, selectedEntry.entityRef).then((value) => value.payload)
        : Promise.reject(new CurriculumDraftAuthoringError('not-found'))
    request.then(
      (nextPayload) => {
        if (!current) return
        setPayload(structuredClone(nextPayload))
        setSavedPayload(structuredClone(nextPayload))
        setSaveState({ kind: 'saved', message: nextLoadedSaveMessage.current })
        nextLoadedSaveMessage.current = 'Saved'
        setPendingOperation(null)
        setEntityLoading(false)
      },
      (reason) => {
        if (!current) return
        if (isPermissionLoss(reason)) setServerWriteAllowed(false)
        setEntityError(authoringErrorMessage(reason, 'This entity is unavailable.'))
        setEntityLoading(false)
      },
    )
    return () => { current = false }
  }, [catalog.source.version, draft, selectedEntry?.entityRef, selectedEntry?.entityType, selectedEntry?.origin, selectedEntry?.revision, source])

  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    const navigationRequest = (event: Event) => {
      if (!confirmDiscard(true)) event.preventDefault()
    }
    window.addEventListener(CURRICULUM_STUDIO_NAVIGATION_REQUEST, navigationRequest)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener(CURRICULUM_STUDIO_NAVIGATION_REQUEST, navigationRequest)
    }
  }, [dirty])

  useEffect(() => {
    if (!focusRequested.current) return
    focusRequested.current = false
    itemRefs.current.get(focusedId)?.focus()
  }, [focusedId, visible.rows])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      const token = new URLSearchParams(window.location.search).get('entity')
      const row = resolveCurriculumStudioEntity(index, token)
      if (!row || !confirmDiscard(dirty)) return
      setSelectedId(row.id)
      setFocusedId(row.id)
      setExpandedIds((current) => unionSets(current, expandedAncestorsFor(index, row.id)))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [dirty, index])

  function selectRow(row: CurriculumStudioRow, updateHistory = true) {
    if (row.id !== selectedId && !confirmDiscard(dirty)) return
    setSelectedId(row.id)
    setFocusedId(row.id)
    setExpandedIds((current) => unionSets(current, expandedAncestorsFor(index, row.id)))
    if (updateHistory) writeStudioEntityLocation(row.id)
  }

  function toggleRow(row: CurriculumStudioRow) {
    if (!row.hasChildren) return
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function handleTreeKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!TREE_KEYS.has(event.key as CurriculumTreeKey)) return
    event.preventDefault()
    const action = curriculumTreeKeyboardAction(
      visible.rows,
      event.currentTarget.dataset.entityId ?? focusedId,
      expandedIds,
      event.key as CurriculumTreeKey,
    )
    if (!action) return
    if (action.toggleId) {
      const row = index.byId.get(action.toggleId)
      if (row) toggleRow(row)
    }
    if (action.selectId) {
      const row = index.byId.get(action.selectId)
      if (row) selectRow(row)
    }
    focusRequested.current = true
    setFocusedId(action.focusId)
  }

  async function openDraft(draftId: string) {
    if (!draftId || !confirmDiscard(dirty)) return
    setWorkspaceBusy(true)
    setWorkspaceMessage('Opening revision-bound draft materialization…')
    try {
      const nextDraft = await source.readDraft(draftId)
      const nextMaterialization = await source.readMaterialization(draftId, nextDraft.revision)
      setDraft(nextDraft)
      setMaterialization(nextMaterialization)
      setDraftChoice(draftId)
      setWorkspaceMessage(`Draft revision ${nextDraft.revision} is open.`)
      setServerWriteAllowed(true)
    } catch (reason) {
      if (isPermissionLoss(reason)) setServerWriteAllowed(false)
      setWorkspaceMessage(authoringErrorMessage(reason, 'The draft could not be opened.'))
    } finally {
      setWorkspaceBusy(false)
    }
  }

  async function refreshDraft(options: { readonly selectId?: string } = {}) {
    if (!draft || !confirmDiscard(dirty)) return
    setWorkspaceBusy(true)
    try {
      const nextDraft = await source.readDraft(draft.draftId)
      const nextMaterialization = await source.readMaterialization(draft.draftId, nextDraft.revision)
      setDraft(nextDraft)
      setMaterialization(nextMaterialization)
      setDrafts((current) => replaceDraftSummary(current, nextDraft))
      if (options.selectId) {
        setSelectedId(options.selectId)
        setFocusedId(options.selectId)
      }
      setWorkspaceMessage(`Draft revision ${nextDraft.revision} is current.`)
      setPendingOperation(null)
      setSaveState({ kind: 'saved', message: 'Saved' })
    } catch (reason) {
      setWorkspaceMessage(authoringErrorMessage(reason, 'The draft could not be refreshed.'))
    } finally {
      setWorkspaceBusy(false)
    }
  }

  async function createDraft() {
    if (!draftCapable || !serverWriteAllowed || !targetVersion.trim() || !confirmDiscard(dirty)) return
    const key = createRequestKey ?? uuid()
    setCreateRequestKey(key)
    setWorkspaceBusy(true)
    setWorkspaceMessage('Creating a draft from the immutable published base…')
    try {
      const result = await source.createDraft({
        baseReleaseVersion: catalog.source.version,
        targetVersion: targetVersion.trim(),
        authoringSchemaVersion: CURRICULUM_AUTHORING_SCHEMA_VERSION,
        idempotencyKey: key,
      })
      setCreateRequestKey(null)
      const nextDraft = await source.readDraft(result.draftId)
      const nextMaterialization = await source.readMaterialization(result.draftId, nextDraft.revision)
      setDraft(nextDraft)
      setMaterialization(nextMaterialization)
      setDrafts((current) => replaceDraftSummary(current, nextDraft))
      setDraftChoice(result.draftId)
      setWorkspaceMessage(result.replayed ? 'Draft creation replay confirmed.' : 'Draft created and opened.')
    } catch (reason) {
      if (isPermissionLoss(reason)) setServerWriteAllowed(false)
      setWorkspaceMessage(authoringErrorMessage(reason, 'Draft creation failed. Retry preserves the same idempotency key.'))
    } finally {
      setWorkspaceBusy(false)
    }
  }

  function editPayload(next: CurriculumDraftEntityPayload) {
    setPayload(next)
    setIssues([])
    setSaveState({ kind: 'unsaved', message: 'Unsaved changes' })
  }

  async function save() {
    if (!draft || !selectedEntry || !payload || !writeAllowed) return
    const validationResult = validateCurriculumDraftEntity(selectedEntry.entityType, selectedEntry.entityRef, payload)
    if (!validationResult.success) {
      setIssues(validationResult.issues)
      setSaveState({ kind: 'failed', message: 'Save failed: Schema v2 validation rejected the entity.' })
      return
    }
    const operation: PendingOperation = selectedEntry.origin === 'base'
      ? {
        kind: 'create',
        input: {
          draftId: draft.draftId,
          entityType: selectedEntry.entityType,
          entityRef: selectedEntry.entityRef,
          origin: 'base_override',
          position: selectedEntry.position,
          payload: validationResult.payload,
          expectedDraftRevision: draft.revision,
          idempotencyKey: uuid(),
        },
      }
      : {
        kind: 'update',
        input: {
          draftId: draft.draftId,
          entityType: selectedEntry.entityType,
          entityRef: selectedEntry.entityRef,
          position: selectedEntry.position,
          payload: validationResult.payload,
          expectedRevision: selectedEntry.revision!,
          expectedDraftRevision: draft.revision,
          idempotencyKey: uuid(),
        },
      }
    await execute(operation)
  }

  async function execute(operation: PendingOperation) {
    setPendingOperation(operation)
    setSaveState({ kind: 'saving', message: 'Saving' })
    setIssues([])
    try {
      let replayed = false
      if (operation.kind === 'create') {
        replayed = (await source.createEntity(operation.input)).replayed
      } else if (operation.kind === 'update') {
        replayed = (await source.updateEntity(operation.input)).replayed
      } else if (operation.entry.origin === 'base') {
        const created = await source.createEntity({
          draftId: operation.draftId,
          entityType: operation.entry.entityType,
          entityRef: operation.entry.entityRef,
          origin: 'base_override',
          position: operation.entry.position,
          payload: operation.payload,
          expectedDraftRevision: operation.expectedDraftRevision,
          idempotencyKey: operation.createIdempotencyKey,
        })
        const tombstoned = await source.tombstoneEntity({
          draftId: operation.draftId,
          entityType: operation.entry.entityType,
          entityRef: operation.entry.entityRef,
          expectedRevision: created.entity!.revision,
          expectedDraftRevision: created.draftRevision,
          idempotencyKey: operation.tombstoneIdempotencyKey,
        })
        replayed = created.replayed || tombstoned.replayed
      } else {
        const input: TombstoneCurriculumDraftEntityInput = {
          draftId: operation.draftId,
          entityType: operation.entry.entityType,
          entityRef: operation.entry.entityRef,
          expectedRevision: operation.entry.revision!,
          expectedDraftRevision: operation.expectedDraftRevision,
          idempotencyKey: operation.tombstoneIdempotencyKey,
        }
        replayed = (await source.tombstoneEntity(input)).replayed
      }
      setPendingOperation(null)
      setSavedPayload(payload ? structuredClone(payload) : null)
      nextLoadedSaveMessage.current = curriculumSavedMessage(replayed)
      setSaveState({ kind: 'saved', message: nextLoadedSaveMessage.current })
      const selection = operation.kind === 'tombstone'
        ? undefined
        : operation.kind === 'create'
          ? `${operation.input.entityType}:${operation.input.entityRef}`
          : `${operation.input.entityType}:${operation.input.entityRef}`
      await refreshAfterMutation(selection)
    } catch (reason) {
      await handleMutationFailure(reason, operation)
    }
  }

  async function refreshAfterMutation(selectId?: string) {
    if (!draft) return
    const nextDraft = await source.readDraft(draft.draftId)
    const nextMaterialization = await source.readMaterialization(draft.draftId, nextDraft.revision)
    setDraft(nextDraft)
    setMaterialization(nextMaterialization)
    setDrafts((current) => replaceDraftSummary(current, nextDraft))
    if (selectId) {
      setSelectedId(selectId)
      setFocusedId(selectId)
    }
    setWorkspaceMessage(`Draft revision ${nextDraft.revision} is current.`)
  }

  async function handleMutationFailure(reason: unknown, operation: PendingOperation) {
    if (reason instanceof CurriculumDraftAuthoringError && reason.code === 'conflict') {
      let classification = reason.reason === 'idempotency-conflict'
        ? 'Conflicting reuse of an idempotency key was rejected.'
        : 'The workspace revision is stale.'
      if (reason.reason !== 'idempotency-conflict' && draft && selectedEntry) {
        try {
          const latestDraft = await source.readDraft(draft.draftId)
          const latestEntity = selectedEntry.origin === 'base'
            ? null
            : await source.readEntity(draft.draftId, selectedEntry.entityType, selectedEntry.entityRef)
          if (latestEntity && latestEntity.revision !== selectedEntry.revision) {
            classification = latestDraft.revision !== draft.revision
              ? 'Both workspace and entity revisions are stale.'
              : 'The entity revision is stale.'
          } else if (latestDraft.revision !== draft.revision) {
            classification = 'The workspace revision is stale.'
          }
        } catch {
          // The safe generic conflict remains when classification cannot be refreshed.
        }
      }
      setPendingOperation(null)
      setSaveState({ kind: 'conflict', message: `Conflict: ${classification} Reload the server version before reapplying changes.` })
      return
    }
    if (isPermissionLoss(reason)) {
      setServerWriteAllowed(false)
      setPendingOperation(null)
      setSaveState({ kind: 'failed', message: 'Save failed: draft write permission was lost. The workspace is now read-only.' })
      return
    }
    if (reason instanceof CurriculumDraftAuthoringError && reason.code === 'invalid') {
      setPendingOperation(null)
      setSaveState({ kind: 'failed', message: 'Save failed: the server rejected this Schema v2 mutation.' })
      return
    }
    setPendingOperation(operation)
    setSaveState({ kind: 'failed', message: 'Save failed: the server is unavailable. Retry will reuse the same idempotency key.' })
  }

  async function tombstone() {
    if (!draft || !selectedEntry || !savedPayload || !writeAllowed) return
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${selectedEntry.label} from this draft snapshot?`)) return
    await execute({
      kind: 'tombstone',
      draftId: draft.draftId,
      entry: selectedEntry,
      payload: savedPayload,
      expectedDraftRevision: draft.revision,
      createIdempotencyKey: uuid(),
      tombstoneIdempotencyKey: uuid(),
    })
  }

  async function createEntity() {
    if (!draft || !writeAllowed || !CURRICULUM_ENTITY_REF_PATTERN.test(newEntityRef)) return
    const selectedAuthoring = selected?.entity.kind === 'authoring' ? selected.entity.entry : null
    const nextPayload = createDraftEntityPayload(newEntityType, newEntityRef, selectedAuthoring, entries)
    const position = Math.max(-1, ...entries.filter((entry) => entry.entityType === newEntityType).map((entry) => entry.position)) + 1
    await execute({
      kind: 'create',
      input: {
        draftId: draft.draftId,
        entityType: newEntityType,
        entityRef: newEntityRef,
        origin: 'draft_created',
        position,
        payload: nextPayload,
        expectedDraftRevision: draft.revision,
        idempotencyKey: uuid(),
      },
    })
    setNewEntityRef('')
  }

  async function runValidation() {
    if (!draft) return
    setValidationBusy(true)
    setValidationError(null)
    try {
      const result = await source.validateDraft(draft.draftId, draft.revision)
      setValidation(result)
    } catch (reason) {
      setValidationError(
        reason instanceof CurriculumDraftAuthoringError && reason.code === 'conflict'
          ? 'The draft changed before validation could bind to this revision. Refresh and validate again.'
          : authoringErrorMessage(reason, 'Validation is unavailable.'),
      )
    } finally {
      setValidationBusy(false)
    }
  }

  function jumpToValidationEntity(entity: { readonly type: string; readonly id: string | null }) {
    if (!entity.id) return
    const type = entity.type === 'resource' ? 'media_resource' : entity.type
    const row = index.byId.get(`${type}:${entity.id}`)
    if (row) selectRow(row)
  }

  return (
    <div className="curriculum-studio" data-draft-service="connected">
      <header className="curriculum-studio-header">
        <div>
          <p className="curriculum-studio-eyebrow">Draft authoring · Schema v2</p>
          <h2>Curriculum Studio</h2>
          <p>Immutable base <strong>{catalog.source.version}</strong> · no active release is implied</p>
        </div>
        <div className="curriculum-studio-connection is-connected" role="status"><span aria-hidden="true" />Draft service connected</div>
      </header>

      <section className="curriculum-draft-toolbar" aria-label="Draft workspace controls">
        <div className="curriculum-draft-open">
          <label htmlFor="curriculum-draft-choice">Draft workspace</label>
          <select id="curriculum-draft-choice" value={draftChoice} onChange={(event) => setDraftChoice(event.target.value)}>
            <option value="">Select a draft</option>
            {drafts.map((item) => <option key={item.draftId} value={item.draftId}>{item.targetVersion} · rev {item.revision}</option>)}
          </select>
          <button type="button" disabled={!draftChoice || workspaceBusy} onClick={() => void openDraft(draftChoice)}>Open</button>
          {draft && <button type="button" disabled={workspaceBusy} onClick={() => void refreshDraft()}>Refresh</button>}
        </div>
        {draftCapable && serverWriteAllowed ? (
          <div className="curriculum-draft-create">
            <label htmlFor="curriculum-target-version">Target-version intent</label>
            <input id="curriculum-target-version" value={targetVersion} placeholder="2.0.0-draft.1" onChange={(event) => { setTargetVersion(event.target.value); setCreateRequestKey(null) }} />
            <button type="button" disabled={!targetVersion.trim() || workspaceBusy} onClick={() => void createDraft()}>Create from {catalog.source.version}</button>
          </div>
        ) : <p className="curriculum-readonly-toolbar">Read-only: curriculum:drafts:write is unavailable.</p>}
        <p className="curriculum-workspace-message" role="status" aria-live="polite">{workspaceBusy ? 'Working… ' : ''}{workspaceMessage}</p>
      </section>

      {draft && (
        <dl className="curriculum-draft-facts" aria-label="Open draft facts">
          <div><dt>Base release</dt><dd>{draft.baseReleaseVersion}</dd></div>
          <div><dt>Target intent</dt><dd>{draft.targetVersion}</dd></div>
          <div><dt>Workspace revision</dt><dd>{draft.revision}</dd></div>
          <div><dt>Lifecycle</dt><dd>{draft.lifecycleState}</dd></div>
          <div><dt>Access</dt><dd>{writeAllowed ? 'Editable' : 'Read-only'}</dd></div>
        </dl>
      )}

      <div className="curriculum-studio-grid">
        <aside className="curriculum-studio-pane curriculum-studio-tree-pane" aria-label="Curriculum hierarchy">
          <div className="curriculum-studio-pane-heading"><div><p>Navigator</p><h3>Materialized snapshot</h3></div><span>{entries.length.toLocaleString()} entities</span></div>
          <label className="curriculum-studio-search"><span className="admin-sr-only">Filter curriculum hierarchy</span><input type="search" value={query} placeholder="Find an entity" onChange={(event) => setQuery(event.target.value)} /></label>
          <p className="curriculum-tree-help" id="curriculum-tree-help">Arrow keys navigate. Right and left expand or collapse. Enter selects.</p>
          {workspaceBusy && entries.length === 0 ? <div className="curriculum-tree-empty" role="status">Loading the immutable authoring index.</div> : visible.rows.length === 0 ? (
            <div className="curriculum-tree-empty" role="status">No entities match “{query}”.</div>
          ) : (
            <ul className="curriculum-tree" role="tree" aria-label="Draft materialized curriculum hierarchy" aria-describedby="curriculum-tree-help">
              {visible.rows.map((row) => {
                const expanded = row.hasChildren ? expandedIds.has(row.id) : undefined
                return (
                  <li key={row.id} role="none"><div className={`curriculum-tree-row${selected?.id === row.id ? ' is-selected' : ''}`} style={{ '--curriculum-tree-depth': row.depth } as CSSProperties}>
                    {row.hasChildren ? <button type="button" className="curriculum-tree-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.label}`} tabIndex={-1} onClick={() => toggleRow(row)}><span aria-hidden="true">{expanded ? '−' : '+'}</span></button> : <span className="curriculum-tree-leaf" aria-hidden="true">•</span>}
                    <button
                      type="button" role="treeitem"
                      ref={(node) => { if (node) itemRefs.current.set(row.id, node); else itemRefs.current.delete(row.id) }}
                      data-entity-id={row.id} aria-level={row.depth} aria-expanded={expanded} aria-selected={selected?.id === row.id}
                      tabIndex={effectiveFocusedId === row.id ? 0 : -1} onFocus={() => setFocusedId(row.id)} onKeyDown={handleTreeKey} onClick={() => selectRow(row)}
                    ><span>{row.label}</span><small>{row.context}</small></button>
                  </div></li>
                )
              })}
            </ul>
          )}
          {visible.limited && <p className="curriculum-tree-limit" role="status">Showing {visible.rows.length} of {visible.total} matching rows. Refine the filter or collapse branches.</p>}
          {draft && writeAllowed && (
            <fieldset className="curriculum-create-entity">
              <legend>Create draft entity</legend>
              <select aria-label="New entity type" value={newEntityType} onChange={(event) => setNewEntityType(event.target.value as CurriculumDraftEntityType)}>
                <option value="course">Course</option><option value="unit">Unit</option><option value="lesson">Lesson</option><option value="assessment">Assessment</option><option value="media_resource">Media resource</option>
              </select>
              <input aria-label="New stable entity ID" value={newEntityRef} placeholder="stable-entity-id" onChange={(event) => setNewEntityRef(event.target.value)} />
              <button type="button" disabled={!CURRICULUM_ENTITY_REF_PATTERN.test(newEntityRef) || saveState.kind === 'saving'} onClick={() => void createEntity()}>Create</button>
              <small>Protected classes remain server-owned. New standards stay human-review until verified.</small>
            </fieldset>
          )}
        </aside>

        <section className="curriculum-studio-pane curriculum-studio-editor" aria-label="Selected entity editor workspace">
          {selectedEntry ? (
            <>
              <header className="curriculum-editor-heading"><div><p>{entityTypeLabel(selectedEntry.entityType)} · {originLabel(selectedEntry.origin)}</p><h3>{selectedEntry.label}</h3><span>{selectedEntry.entityRef}</span></div><span className={writeAllowed ? 'curriculum-editable-badge' : 'curriculum-readonly-badge'}>{writeAllowed ? 'Schema v2 editor' : 'Read-only'}</span></header>
              {!draft && <div className="curriculum-draft-notice" role="status"><strong>No draft is open</strong><p>This is the immutable published base. Open or create a draft before editing.</p></div>}
              {!draftCapable && <div className="curriculum-draft-notice" role="status"><strong>Viewer mode</strong><p>You can open and validate drafts, but curriculum:drafts:write is required to mutate them.</p></div>}
              {draftCapable && !serverWriteAllowed && <div className="curriculum-draft-notice" role="alert"><strong>Write permission unavailable</strong><p>The server rejected draft write authority. The current snapshot remains readable.</p></div>}
              <div className={`curriculum-save-state is-${saveState.kind}`} role={saveState.kind === 'conflict' || saveState.kind === 'failed' ? 'alert' : 'status'} aria-live="polite"><strong>{saveState.message}</strong>{dirty && saveState.kind === 'saved' && <span>Unsaved changes</span>}</div>
              {entityLoading ? <p role="status">Loading the structured entity payload…</p> : entityError ? <p role="alert">{entityError}</p> : payload ? (
                <>
                  <StructuredEntityEditor entityType={selectedEntry.entityType} payload={payload} disabled={!writeAllowed || saveState.kind === 'saving' || pendingOperation !== null && saveState.kind === 'failed'} issues={issues} onChange={editPayload} />
                  <div className="curriculum-editor-actions">
                    <button type="button" disabled={!dirty || !writeAllowed || saveState.kind === 'saving' || pendingOperation !== null} onClick={() => void save()}>Save changes</button>
                    <button type="button" disabled={!dirty || saveState.kind === 'saving'} onClick={() => { if (savedPayload && confirmDiscard(true)) { setPayload(structuredClone(savedPayload)); setIssues([]); setPendingOperation(null); setSaveState({ kind: 'saved', message: 'Saved' }) } }}>Discard edits</button>
                    {pendingOperation && saveState.kind === 'failed' && <button type="button" onClick={() => void execute(pendingOperation)}>Retry save</button>}
                    {pendingOperation && saveState.kind === 'failed' && <button type="button" onClick={() => { setPendingOperation(null); setSaveState({ kind: 'unsaved', message: 'Unsaved changes' }) }}>Edit again</button>}
                    {saveState.kind === 'conflict' && <button type="button" onClick={() => void refreshDraft()}>Reload server version</button>}
                    <button type="button" className="curriculum-tombstone-button" disabled={!writeAllowed || saveState.kind === 'saving' || dirty} onClick={() => void tombstone()}>Remove from draft</button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="curriculum-studio-empty" role="status"><h3>{selected?.label ?? 'No curriculum entity available'}</h3><p>Select a course, unit, lesson, assessment, or media resource to inspect its structured fields.</p></div>
          )}
        </section>

        <aside className="curriculum-studio-pane curriculum-studio-inspector" aria-label="Curriculum metadata and status inspector">
          <div className="curriculum-inspector-content">
            <div className="curriculum-studio-pane-heading"><div><p>Inspector</p><h3>Metadata & status</h3></div></div>
            <InspectorSection title="Lifecycle"><StatusLine label="Published base" value={catalog.source.version} tone="positive" /><StatusLine label="Draft" value={draft ? draft.targetVersion : 'Not open'} tone={draft ? 'positive' : 'warning'} /><StatusLine label="Save state" value={dirty ? 'Unsaved changes' : saveState.message} tone={saveState.kind === 'failed' || saveState.kind === 'conflict' ? 'warning' : 'neutral'} /></InspectorSection>
            <InspectorSection title="Selection"><dl className="curriculum-inspector-list"><div><dt>Type</dt><dd>{selectedEntry ? entityTypeLabel(selectedEntry.entityType) : 'Group'}</dd></div><div><dt>Stable ID</dt><dd>{selectedEntry?.entityRef ?? selected?.id ?? 'None'}</dd></div><div><dt>Origin</dt><dd>{selectedEntry ? originLabel(selectedEntry.origin) : 'Virtual navigation'}</dd></div><div><dt>Entity rev</dt><dd>{selectedEntry?.revision ?? 'Base'}</dd></div></dl></InspectorSection>
            <InspectorSection title="Authorization"><p>{writeAllowed ? 'Draft authoring enabled' : 'Read-only mode'}</p><small>All reads require curriculum:read. Every mutation is reauthorized for curriculum:drafts:write by the server.</small></InspectorSection>
            <InspectorSection title="Protected classes"><p>Server-owned and read-only</p><small>Schedules, policy sets, standards frameworks, protected assessment interpretations, schema versions, and entity identities are not exposed as unrestricted JSON.</small></InspectorSection>
            <InspectorSection title="Validation"><StatusLine label="Revision" value={validation ? String(validation.draftRevision) : 'Not run'} tone={validationStale ? 'warning' : validation ? 'positive' : 'neutral'} /><button type="button" disabled={!draft || validationBusy} onClick={() => void runValidation()}>{validationBusy ? 'Validating…' : `Validate${draft ? ` revision ${draft.revision}` : ''}`}</button>{validationError && <p role="alert">{validationError}</p>}</InspectorSection>
            {draft && <InspectorSection title="Preview / Diff"><p>Inspect the exact saved candidate</p><a href={curriculumPreviewHref(draft.draftId, draft.revision)}>Preview revision {draft.revision}</a><small>The preview is read-only and remains bound to this revision.</small></InspectorSection>}
          </div>
        </aside>
      </div>

      {validation && (
        <section className="curriculum-studio-validation" aria-label="Revision-bound draft validation">
          {validationStale && <div className="curriculum-validation-stale" role="alert"><strong>Validation is stale.</strong> This result is bound to revision {validation.draftRevision}; the open draft is revision {draft?.revision}. Run validation again before relying on it.</div>}
          <CurriculumValidationWorkspace run={validation.run} onJumpToEntity={jumpToValidationEntity} />
        </section>
      )}
    </div>
  )
}

export function curriculumPreviewHref(draftId: string, revision: number): string {
  return `/academy/admin/curriculum/preview?draft=${encodeURIComponent(draftId)}&revision=${revision}`
}

function InspectorSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <section className="curriculum-inspector-section"><h4>{title}</h4>{children}</section>
}

function StatusLine({ label, value, tone = 'neutral' }: { readonly label: string; readonly value: string; readonly tone?: 'neutral' | 'positive' | 'warning' }) {
  return <div className={`curriculum-status-line is-${tone}`}><span>{label}</span><strong>{value}</strong></div>
}

function entityTypeLabel(type: CurriculumDraftEntityType): string {
  return type === 'media_resource' ? 'Media resource' : type[0].toUpperCase() + type.slice(1)
}

function originLabel(origin: CurriculumStudioEntityIndexEntry['origin']): string {
  if (origin === 'base') return 'Immutable base'
  if (origin === 'base_override') return 'Draft override'
  return 'Draft-created'
}

function replaceDraftSummary(
  drafts: readonly CurriculumDraftSummary[],
  detail: CurriculumDraftDetail,
): readonly CurriculumDraftSummary[] {
  const { entities: _entities, ...summary } = detail
  return [...drafts.filter((draft) => draft.draftId !== detail.draftId), summary]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function authoringErrorMessage(reason: unknown, fallback: string): string {
  if (!(reason instanceof CurriculumDraftAuthoringError)) return fallback
  if (reason.code === 'unauthenticated') return 'The Admin session is no longer authenticated.'
  if (reason.code === 'forbidden') return 'The server denied the required curriculum permission.'
  if (reason.code === 'not-found') return 'The requested draft or entity no longer exists.'
  if (reason.code === 'conflict') return 'The requested revision is stale.'
  if (reason.code === 'invalid') return 'The server rejected the request as invalid.'
  return fallback
}

function isPermissionLoss(reason: unknown): boolean {
  return reason instanceof CurriculumDraftAuthoringError
    && (reason.code === 'forbidden' || reason.code === 'unauthenticated')
}

export function curriculumPayloadDirty(
  payload: CurriculumDraftEntityPayload | null,
  savedPayload: CurriculumDraftEntityPayload | null,
): boolean {
  return payload !== null && savedPayload !== null && JSON.stringify(payload) !== JSON.stringify(savedPayload)
}

export function confirmCurriculumNavigation(dirty: boolean, confirm: () => boolean): boolean {
  return !dirty || confirm()
}

export function curriculumSavedMessage(replayed: boolean): string {
  return replayed ? 'Saved · replay confirmed' : 'Saved'
}

function confirmDiscard(dirty: boolean): boolean {
  return confirmCurriculumNavigation(
    dirty,
    () => typeof window === 'undefined' || window.confirm('Discard unsaved curriculum changes?'),
  )
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function writeStudioEntityLocation(entityId: string): void {
  if (typeof window === 'undefined') return
  const next = new URL(window.location.href)
  next.searchParams.set('entity', entityId)
  window.history.pushState({}, '', `${next.pathname}${next.search}${next.hash}`)
}

function unionSets(left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...left, ...right])
}
