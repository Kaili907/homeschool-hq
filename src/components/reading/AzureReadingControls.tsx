import { useState } from 'react'
import {
  AZURE_SPEECH_ENDPOINT_BASE,
  clearAzureSpeechKey,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  maskAzureSpeechKey,
  setAzureSpeechKey,
  setAzureSpeechRegion,
} from '../../reading/azure'

/** Device-local Azure Speech setup. These values never enter AppState. */
export function AzureReadingControls() {
  const [keyDraft, setKeyDraft] = useState('')
  const [regionDraft, setRegionDraft] = useState(getAzureSpeechRegion() ?? '')
  const [savedKey, setSavedKey] = useState(getAzureSpeechKey())
  const proxyMode = AZURE_SPEECH_ENDPOINT_BASE !== ''

  const save = () => {
    setAzureSpeechKey(keyDraft)
    setAzureSpeechRegion(regionDraft)
    setSavedKey(getAzureSpeechKey())
    setKeyDraft('')
  }

  const remove = () => {
    clearAzureSpeechKey()
    setSavedKey(null)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-bold text-slate-800">Azure reading assessment</div>
      <div className="mt-0.5 text-xs text-slate-500">
        Optional word-level pronunciation scores with automatic browser fallback.
        The key stays on this device, outside backups and cloud sync. Sound is never saved.
      </div>

      {proxyMode ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Server proxy configured — no Azure key is stored in this browser.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
            placeholder={savedKey ? 'Enter a new key to replace' : 'Azure Speech key'}
            aria-label="Azure Speech key"
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm text-slate-800"
          />
          <input
            value={regionDraft}
            onChange={(event) => setRegionDraft(event.target.value)}
            placeholder="Region (for example, eastus)"
            aria-label="Azure Speech region"
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm text-slate-800"
          />
          <button
            onClick={save}
            disabled={!keyDraft.trim() || !regionDraft.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save Azure setup
          </button>
          {savedKey && (
            <button
              onClick={remove}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
            >
              Remove key
            </button>
          )}
          <span className="text-xs font-semibold text-slate-500">
            {savedKey
              ? `Key set · ${maskAzureSpeechKey(savedKey)} · ${getAzureSpeechRegion()}`
              : 'Not configured — browser recognition stays active'}
          </span>
        </div>
      )}
    </div>
  )
}
