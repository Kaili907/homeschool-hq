import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  CurriculumResourceKind,
  CurriculumResourceLibrary,
  CurriculumResourceLibraryItem,
  CurriculumResourceReference,
  CurriculumResourceReferenceStatus,
} from '../curriculum-authoring/contracts'
import {
  CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT,
  CURRICULUM_RESOURCE_REFERENCE_LIMIT,
  filterCurriculumResourceLibrary,
} from './resourceLibraryModel'

const KINDS: readonly CurriculumResourceKind[] = [
  'text', 'image', 'audio', 'video', 'interactive', 'document', 'physical',
]

const REFERENCE_STATUSES: readonly CurriculumResourceReferenceStatus[] = [
  'referenced', 'unreferenced', 'missing-reference', 'tombstoned-but-referenced', 'invalid-reference',
]

export function CurriculumResourceLibraryView({
  library,
  writeAllowed,
  onCreateResource,
  onOpenResource,
  onJumpToReference,
}: {
  readonly library: CurriculumResourceLibrary
  readonly writeAllowed: boolean
  readonly onCreateResource: () => void
  readonly onOpenResource: (resourceId: string) => void
  readonly onJumpToReference: (reference: CurriculumResourceReference) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<CurriculumResourceKind | 'all'>('all')
  const [origin, setOrigin] = useState<'all' | 'base' | 'base_override' | 'draft_created'>('all')
  const [status, setStatus] = useState<'all' | CurriculumResourceReferenceStatus | 'tombstoned'>('all')
  const [requirement, setRequirement] = useState<'all' | 'required' | 'optional'>('all')
  const [validation, setValidation] = useState<'all' | 'valid' | 'invalid' | 'not-applicable'>('all')
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState(library.items[0]?.key ?? '')
  const filters = useMemo(
    () => ({ query, kind, origin, status, requirement, validation }),
    [kind, origin, query, requirement, status, validation],
  )
  const filtered = useMemo(
    () => filterCurriculumResourceLibrary(
      library,
      filters,
      CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT,
      page * CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT,
    ),
    [filters, library, page],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.total / CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT))
  const selected = filtered.items.find((item) => item.key === selectedKey) ?? filtered.items[0] ?? null

  useEffect(() => { setPage(0) }, [filters])
  useEffect(() => {
    if (page < pageCount) return
    setPage(pageCount - 1)
  }, [page, pageCount])

  return (
    <section className="curriculum-resource-library" aria-labelledby="curriculum-resource-library-title">
      <header className="curriculum-resource-library-heading">
        <div>
          <p className="curriculum-studio-eyebrow">Revision-bound inventory</p>
          <h3 id="curriculum-resource-library-title">Resource Library</h3>
          <p>
            {library.source.origin === 'draft'
              ? `Draft revision ${library.source.draftRevision}`
              : `Published base ${library.source.baseReleaseVersion}`}
            {' · '}Schema v2 media_resource
          </p>
        </div>
        <div className="curriculum-resource-heading-actions">
          <p className="curriculum-resource-safety-note">Schema v2 media metadata only; protected/system classes stay excluded. No uploads, downloads, or storage-provider actions.</p>
          {writeAllowed && <button type="button" onClick={onCreateResource}>Create via structured editor</button>}
        </div>
      </header>

      <dl className="curriculum-resource-totals" aria-label="Resource library totals">
        <ResourceTotal label="Resources" value={library.totals.resources} detail={`${library.totals.active} active`} />
        <ResourceTotal label="Referenced" value={library.totals.referenced} detail={`${library.totals.referenceOccurrences} occurrences`} />
        <ResourceTotal label="Unreferenced" value={library.totals.unreferenced} detail="Not a publication error" />
        <ResourceTotal label="Draft changes" value={library.totals.overridden + library.totals.draftCreated} detail={`${library.totals.overridden} overrides`} />
        <ResourceTotal label="Needs attention" value={library.totals.validationInvalid} detail={`${library.totals.missingReferences} missing · ${library.totals.tombstoned} tombstoned`} />
      </dl>

      <div className="curriculum-resource-filters" role="search" aria-label="Filter resource inventory">
        <label className="curriculum-resource-query"><span>Search</span><input type="search" value={query} placeholder="Title, ID, rights, or referencing entity" onChange={(event) => setQuery(event.target.value)} /></label>
        <ResourceSelect label="Type / category" value={kind} onChange={(value) => setKind(value as typeof kind)}>
          <option value="all">All types</option>{KINDS.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </ResourceSelect>
        <ResourceSelect label="Origin" value={origin} onChange={(value) => setOrigin(value as typeof origin)}>
          <option value="all">All origins</option><option value="base">Published base</option><option value="base_override">Draft override</option><option value="draft_created">Draft-created</option>
        </ResourceSelect>
        <ResourceSelect label="Reference status" value={status} onChange={(value) => setStatus(value as typeof status)}>
          <option value="all">All statuses</option>{REFERENCE_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}<option value="tombstoned">Tombstoned</option>
        </ResourceSelect>
        <ResourceSelect label="Requirement" value={requirement} onChange={(value) => setRequirement(value as typeof requirement)}>
          <option value="all">Required or optional</option><option value="required">Required</option><option value="optional">Optional</option>
        </ResourceSelect>
        <ResourceSelect label="Validation" value={validation} onChange={(value) => setValidation(value as typeof validation)}>
          <option value="all">All validation</option><option value="valid">Valid</option><option value="invalid">Invalid</option><option value="not-applicable">Not applicable</option>
        </ResourceSelect>
      </div>

      <div className="curriculum-resource-layout">
        <section className="curriculum-resource-results" aria-labelledby="curriculum-resource-results-title">
          <header><h4 id="curriculum-resource-results-title">Inventory</h4><span>{filtered.total.toLocaleString()} matches</span></header>
          {filtered.items.length === 0 ? (
            <div className="curriculum-resource-empty" role="status"><strong>No resources match these filters.</strong><span>Clear or broaden a filter to restore the inventory.</span></div>
          ) : (
            <ul aria-label="Resource inventory results">
              {filtered.items.map((item) => (
                <li key={item.key}>
                  <button type="button" aria-pressed={selected?.key === item.key} onClick={() => setSelectedKey(item.key)}>
                    <span className="curriculum-resource-result-title"><strong>{item.title}</strong><small>{item.resourceId ?? 'Invalid reference value withheld'}</small></span>
                    <span className="curriculum-resource-result-meta"><ResourceBadge value={item.kind ?? item.lifecycle} /><ResourceBadge value={item.referenceStatus} warning={item.validationStatus === 'invalid'} /><small>{item.referenceCount} refs</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered.searchIncomplete && (
            <p className="curriculum-resource-unavailable" role="status">
              Reference-name search is incomplete because one or more resources exceed the bounded reference sample. Resource metadata filters and authoritative reference totals remain available.
            </p>
          )}
          {filtered.total > CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT && (
            <nav className="curriculum-resource-pagination" aria-label="Resource inventory pages">
              <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
              <span>Page {page + 1} of {pageCount} · at most {CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT} rows rendered</span>
              <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</button>
            </nav>
          )}
        </section>

        <ResourceDetails item={selected} writeAllowed={writeAllowed} onOpenResource={onOpenResource} onJumpToReference={onJumpToReference} />
      </div>
    </section>
  )
}

function ResourceTotal({ label: title, value, detail }: { readonly label: string; readonly value: number; readonly detail: string }) {
  return <div><dt>{title}</dt><dd><strong>{value.toLocaleString()}</strong><small>{detail}</small></dd></div>
}

function ResourceSelect({
  label: title,
  value,
  onChange,
  children,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly children: ReactNode
}) {
  return <label><span>{title}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>
}

function ResourceDetails({
  item,
  writeAllowed,
  onOpenResource,
  onJumpToReference,
}: {
  readonly item: CurriculumResourceLibraryItem | null
  readonly writeAllowed: boolean
  readonly onOpenResource: (resourceId: string) => void
  readonly onJumpToReference: (reference: CurriculumResourceReference) => void
}) {
  if (!item) {
    return <aside className="curriculum-resource-details curriculum-resource-empty" role="status"><strong>No resource selected.</strong><span>Select an inventory row to inspect its exact-snapshot metadata and references.</span></aside>
  }
  const metadata = item.metadata
  return (
    <aside className="curriculum-resource-details" aria-labelledby="curriculum-resource-detail-title">
      <header>
        <div><p>{resourceOriginLabel(item.origin)} · {label(item.lifecycle)}</p><h4 id="curriculum-resource-detail-title">{item.title}</h4><span>{item.resourceId ?? 'No valid resource ID'}</span></div>
        <ResourceBadge value={item.validationStatus} warning={item.validationStatus === 'invalid'} />
      </header>
      <dl>
        <div><dt>Type</dt><dd>{metadata?.kind ? label(metadata.kind) : 'Unavailable'}</dd></div>
        <div><dt>Requirement</dt><dd>{metadata ? (metadata.required ? 'Required' : 'Optional') : 'Unavailable'}</dd></div>
        <div><dt>Origin</dt><dd>{resourceOriginLabel(item.origin)}</dd></div>
        <div><dt>Entity revision</dt><dd>{item.revision ?? 'Base'}</dd></div>
        <div><dt>Reference status</dt><dd>{label(item.referenceStatus)}</dd></div>
        <div><dt>Referencing entities</dt><dd>{item.referencingEntityCount}</dd></div>
        {metadata && <>
          <div className="is-wide"><dt>Rights statement</dt><dd>{metadata.rights}</dd></div>
          <div className="is-wide"><dt>Text fallback</dt><dd>{metadata.text_fallback}</dd></div>
          {metadata.caption_or_transcript && <div className="is-wide"><dt>Caption or transcript</dt><dd>{metadata.caption_or_transcript}</dd></div>}
          {metadata.alt_text && <div className="is-wide"><dt>Alternative text</dt><dd>{metadata.alt_text}</dd></div>}
          {metadata.long_description && <div className="is-wide"><dt>Long description</dt><dd>{metadata.long_description}</dd></div>}
        </>}
      </dl>
      {item.resourceId && item.lifecycle === 'active' ? (
        <button type="button" className="curriculum-resource-primary-action" onClick={() => onOpenResource(item.resourceId!)}>
          Open in structured editor{writeAllowed ? '' : ' (read-only)'}
        </button>
      ) : <p className="curriculum-resource-unavailable" role="status">A missing, invalid, or tombstoned resource cannot be opened as an active structured entity.</p>}

      <section className="curriculum-resource-reference-section">
        <h5>Referencing lessons and assessments</h5>
        {item.references.length === 0 ? <p role="status">No lesson or assessment references this resource in this exact snapshot.</p> : (
          <ul>
            {item.references.map((reference, index) => (
              <li key={`${reference.path}:${index}`}>
                <div><strong>{reference.entityTitle}</strong><span>{label(reference.entityType)} · {reference.entityRef}{reference.promptRef ? ` · prompt ${reference.promptRef}` : ''}</span><small>{reference.path}</small></div>
                <button type="button" onClick={() => onJumpToReference(reference)}>Jump to {reference.entityType}</button>
              </li>
            ))}
          </ul>
        )}
        {item.referencesLimited && (
          <p role="status">
            Showing the first {CURRICULUM_RESOURCE_REFERENCE_LIMIT} of {item.referenceCount} references. The total is authoritative; additional reference details are unavailable in this bounded response.
          </p>
        )}
      </section>

      <section className="curriculum-resource-validation-section">
        <h5>Validation findings</h5>
        {item.validationFindingCount === 0 ? <p role="status">No resource finding was reported by the existing validation rules for this exact snapshot.</p> : (
          <ul>{item.validationFindings.slice(0, 20).map((finding) => <li key={finding.id}><strong>{finding.rule}</strong><span>{finding.explanation}</span><small>{finding.path}</small></li>)}</ul>
        )}
        {item.validationFindingCount > 20 && <p>Showing the first 20 of {item.validationFindingCount} findings. Use the separate Validation workspace for the complete report.</p>}
        {item.validationFindingsLimited && <p role="note">Additional finding details are unavailable in this bounded Resource Library projection.</p>}
      </section>
      <p className="curriculum-resource-authority-note">Reference analysis is diagnostic only. It never repairs references; the existing validation run remains authoritative for publication blocking.</p>
    </aside>
  )
}

function ResourceBadge({ value, warning = false }: { readonly value: string; readonly warning?: boolean }) {
  return <span className={`curriculum-resource-badge${warning ? ' is-warning' : ''}`}>{label(value)}</span>
}

function label(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function resourceOriginLabel(value: CurriculumResourceLibraryItem['origin']): string {
  if (value === 'base') return 'Published base'
  if (value === 'base_override') return 'Draft override'
  if (value === 'draft_created') return 'Draft-created'
  return label(value)
}
