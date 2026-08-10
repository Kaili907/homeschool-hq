import type { AdminEngineId } from '../../admin/contracts'
import type {
  EnginePerformanceMetric,
  EnginePerformanceWindowPreset,
} from '../../admin/enginePerformanceModel'
import type { EnginePerformanceReadState } from '../../admin/engine-performance/httpSource'
import './engine-performance-dashboard.css'

const ENGINE_LABELS: Readonly<Record<AdminEngineId, string>> = {
  tutor: 'Tutor', study: 'Study', assessment: 'Assessment', curriculum: 'Curriculum',
  jarvis: 'Jarvis', tts: 'TTS', gateway: 'Gateway', sync: 'Sync',
}

const WINDOW_LABELS: Readonly<Record<EnginePerformanceWindowPreset, string>> = {
  '7d': 'Last 7 days', '30d': 'Last 30 days',
}

function metricValue(metric: EnginePerformanceMetric): string {
  if (metric.availability === 'available' && metric.value !== null) {
    return metric.kind === 'rate' ? `${metric.value.toFixed(1)}%` : metric.value.toLocaleString()
  }
  if (metric.availability === 'insufficient_evidence') return 'Insufficient evidence'
  if (metric.availability === 'not_applicable') return 'Not applicable'
  return 'Unavailable'
}

export function EnginePerformanceDashboard({
  state,
  selectedEngine,
  selectedWindow,
  selectedVersion,
  onEngineChange,
  onWindowChange,
  onVersionChange,
  onRetry,
}: {
  readonly state: EnginePerformanceReadState
  readonly selectedEngine: AdminEngineId
  readonly selectedWindow: EnginePerformanceWindowPreset
  readonly selectedVersion: string | null
  readonly onEngineChange?: (engine: AdminEngineId) => void
  readonly onWindowChange?: (window: EnginePerformanceWindowPreset) => void
  readonly onVersionChange?: (version: string | null) => void
  readonly onRetry?: () => void
}) {
  if (state.status === 'loading') {
    return <div className="engine-performance" aria-busy="true"><p role="status">Loading engine performance evidence…</p></div>
  }
  if (state.status === 'unauthorized') {
    return <div className="engine-performance"><section role="alert"><h1>Engine analytics unavailable</h1><p>Your verified Admin assignment does not include <code>engines:read</code>.</p><a href="/academy">Back to Academy</a></section></div>
  }
  if (state.status === 'error') {
    const message = state.code === 'timeout'
      ? 'The authorized evidence read timed out.'
      : state.code === 'incomplete'
        ? 'The aggregate evidence exceeded its trustworthy group bound.'
        : state.code === 'malformed' || state.code === 'invalid_response'
          ? 'The authorized aggregate response was malformed.'
          : 'The authorized performance projection could not be loaded.'
    return <div className="engine-performance"><section role="alert"><h1>Engine analytics unavailable</h1><p>{message} No substitute data is shown.</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</section></div>
  }

  const selected = state.model.engines.find((engine) => engine.engineId === selectedEngine) ?? state.model.engines[0]
  const availableVersions = selected.versions
  return (
    <div className="engine-performance" aria-labelledby="engine-performance-title">
      <header className="engine-performance__header">
        <div>
          <p className="engine-performance__eyebrow">Educational and operational outcomes</p>
          <h1 id="engine-performance-title">Engine performance analytics</h1>
          <p>Performance evidence is separate from technical health. No composite quality score is calculated.</p>
        </div>
        <a href={selected.technicalHealthReference.path}>{selected.technicalHealthReference.label}</a>
      </header>

      {'limitReached' in state.model.source && state.model.source.limitReached && (
        <p className="engine-performance__notice" role="status">The canonical {state.model.source.limit.toLocaleString()}-event read limit was reached. Results describe the bounded returned evidence, not an assumed complete history.</p>
      )}
      {'rejectedRowCount' in state.model.source && state.model.source.rejectedRowCount > 0 && (
        <p className="engine-performance__notice" role="status">Some malformed stored evidence was rejected and is not represented.</p>
      )}
      {'mode' in state.model.source && state.model.source.grouping === 'partial' && (
        <p className="engine-performance__notice" role="status">The aggregate evidence is incomplete. Metrics describe only the represented groups and every affected engine remains qualified as partial.</p>
      )}
      {'mode' in state.model.source && state.model.source.retention.status === 'retention_limited' && (
        <p className="engine-performance__notice" role="status">Retention does not fully cover this evidence window. Metrics remain retention-limited and are not presented as complete history.</p>
      )}

      <section className="engine-performance__filters" aria-label="Performance filters">
        <label>Time range<select value={selectedWindow} onChange={(event) => onWindowChange?.(event.target.value as EnginePerformanceWindowPreset)}>{Object.entries(WINDOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Engine<select value={selectedEngine} aria-controls="selected-engine-panel" onChange={(event) => onEngineChange?.(event.target.value as AdminEngineId)}>{state.model.engines.map((engine) => <option key={engine.engineId} value={engine.engineId}>{ENGINE_LABELS[engine.engineId]}</option>)}</select></label>
        <label>Engine version<select value={selectedVersion ?? ''} onChange={(event) => onVersionChange?.(event.target.value || null)}><option value="">All recorded versions</option>{availableVersions.map((version) => <option key={version} value={version}>{version}</option>)}</select></label>
      </section>

      <nav aria-label="Canonical engines" className="engine-performance__engine-list">
        {state.model.engines.map((engine) => (
          <button key={engine.engineId} type="button" aria-controls="selected-engine-panel" aria-current={engine.engineId === selectedEngine ? 'page' : undefined} onClick={() => onEngineChange?.(engine.engineId)}>
            <strong>{ENGINE_LABELS[engine.engineId]}</strong><span>{engine.evidenceState.replaceAll('_', ' ')} · {engine.sampleCount.toLocaleString()} samples</span>
          </button>
        ))}
      </nav>

      <section id="selected-engine-panel" aria-labelledby="selected-engine-title" aria-live="polite">
        <div className="engine-performance__section-heading">
          <div><p className="engine-performance__eyebrow">Selected engine</p><h2 id="selected-engine-title">{ENGINE_LABELS[selected.engineId]}</h2></div>
          <p><strong>{selected.sampleCount.toLocaleString()}</strong> filtered evidence samples</p>
        </div>
        {selected.sampleCount === 0 && <p className="engine-performance__empty">No structured evidence was recorded in this window. Metrics remain unavailable rather than inferred.</p>}
        <div className="engine-performance__metrics">
          {selected.metrics.map((metric) => (
            <article key={metric.id} className={`engine-performance__metric is-${metric.availability}`}>
              <h3>{metric.label}</h3>
              <strong>{metricValue(metric)}</strong>
              <dl>
                <div><dt>Numerator</dt><dd>{metric.numerator ?? 'Not available'}</dd></div>
                <div><dt>Denominator</dt><dd>{metric.denominator ?? 'Not applicable'}</dd></div>
                <div><dt>Sample count</dt><dd>{metric.sampleCount.toLocaleString()}</dd></div>
                <div><dt>Window</dt><dd>{metric.observationWindow.start.slice(0, 10)} to {metric.observationWindow.end.slice(0, 10)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="version-comparison-title" className="engine-performance__panel">
        <h2 id="version-comparison-title">Version comparison</h2>
        {selected.versionComparison.previousVersion && selected.versionComparison.currentVersion ? (
          <>
            <p>Comparing {selected.versionComparison.previousVersion} with {selected.versionComparison.currentVersion}. Values are descriptive; no version is declared “better.”</p>
            <div className="engine-performance__table-wrap"><table><caption>Metrics supported by both version cohorts</caption><thead><tr><th scope="col">Metric</th><th scope="col">Previous</th><th scope="col">Current</th><th scope="col">Evidence</th></tr></thead><tbody>{selected.versionComparison.metrics.map((comparison) => <tr key={comparison.metricId}><th scope="row">{comparison.label}</th><td>{comparison.previous.value === null ? '—' : `${comparison.previous.value.toFixed(1)}%`} ({comparison.previous.sampleCount} samples)</td><td>{comparison.current.value === null ? '—' : `${comparison.current.value.toFixed(1)}%`} ({comparison.current.sampleCount} samples)</td><td>{comparison.availability.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
          </>
        ) : <p>Version comparison is unavailable until two versions have supported evidence in the selected window.</p>}
      </section>

      {selected.unsupportedMetrics.length > 0 && (
        <section aria-labelledby="unsupported-title" className="engine-performance__panel">
          <h2 id="unsupported-title">Unavailable evidence</h2>
          <ul>{selected.unsupportedMetrics.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.reasonCode === 'educational_quality_not_applicable' ? 'Not applicable as an educational-quality measure.' : 'Structured evidence is not recorded.'}</span>{item.futureInstrumentation && <small>Future requirement: {item.futureInstrumentation}</small>}</li>)}</ul>
        </section>
      )}

      <footer className="engine-performance__method">
        Rates require at least {state.model.thresholds.rateMinimumSample} denominator samples. Version comparisons require {state.model.thresholds.versionComparisonMinimumSample} samples per cohort. Safety stops are displayed separately and are not automatically classified as performance failures.
      </footer>
    </div>
  )
}
