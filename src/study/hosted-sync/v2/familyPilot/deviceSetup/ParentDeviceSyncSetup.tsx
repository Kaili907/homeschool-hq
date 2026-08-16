import { useEffect, useMemo, useRef, useState } from 'react'
import { parentSyncStatusLabelR1 } from '../status'
import { ParentDeviceSyncSetupCoordinator } from './coordinator'
import type {
  ParentDeviceSyncIntent,
  ParentDeviceSyncSetupRuntime,
  ParentDeviceSyncSetupViewProps,
  ParentDeviceSyncSetupViewState,
  ParentDeviceSyncStatusListener,
} from './types'

const PRIVACY_EXCLUSIONS = Object.freeze([
  'PINs and PIN verifiers',
  'tokens, secrets, and sign-in credentials',
  'answer authority and answer material',
  'Tutor transcripts and conversations',
  'excluded raw learner responses',
  'emotional or personality data',
] as const)

function intentLabel(intent: ParentDeviceSyncIntent): string {
  return intent === 'FIRST_LINK' ? 'Set up sync for this family' : 'Connect another family device'
}

export function ParentDeviceSyncSetupView({ state, onChoose, onConfirm, onBack }: ParentDeviceSyncSetupViewProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [state.step])

  if (state.step === 'CHOOSE') {
    return (
      <section className="mt-6 rounded-2xl border bg-white p-5" aria-labelledby="parent-device-sync-title" data-testid="parent-device-sync-setup">
        <p className="font-bold text-cyan-700">Sync across devices</p>
        <h3 ref={titleRef} tabIndex={-1} id="parent-device-sync-title" className="mt-1 text-2xl font-extrabold outline-none">Keep family work available on your devices</h3>
        <p className="mt-2 max-w-2xl text-slate-600">Choose how you want to connect. Nothing changes until you review and approve it.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" className="min-h-11 rounded-xl border border-cyan-700 bg-cyan-50 p-4 text-left font-bold text-cyan-950" onClick={() => onChoose('FIRST_LINK')}>
            Set up this family
            <span className="mt-1 block text-sm font-normal">Make existing work from this device available across devices.</span>
          </button>
          <button type="button" className="min-h-11 rounded-xl border border-slate-300 p-4 text-left font-bold" onClick={() => onChoose('OTHER_DEVICE')}>
            Connect another device
            <span className="mt-1 block text-sm font-normal text-slate-600">Bring approved family work to this authenticated device.</span>
          </button>
        </div>
      </section>
    )
  }

  if (state.step === 'CONNECTING') {
    return (
      <section className="mt-6 rounded-2xl border bg-white p-5" aria-labelledby="parent-device-sync-connecting" aria-busy="true">
        <h3 ref={titleRef} tabIndex={-1} id="parent-device-sync-connecting" className="text-2xl font-extrabold outline-none">Connecting</h3>
        <p className="mt-2 font-semibold text-slate-600" role="status" aria-live="polite">Checking family access and preparing a safe preview…</p>
      </section>
    )
  }

  if (state.step === 'PREVIEW') {
    const source = state.preview.intent === 'FIRST_LINK' ? state.preview.thisDevice : state.preview.acrossDevices
    return (
      <section className="mt-6 rounded-2xl border bg-white p-5" aria-labelledby="parent-device-sync-preview" data-testid="parent-device-sync-preview">
        <p className="font-bold text-cyan-700">Review before connecting</p>
        <h3 ref={titleRef} tabIndex={-1} id="parent-device-sync-preview" className="mt-1 text-2xl font-extrabold outline-none">{intentLabel(state.preview.intent)}</h3>
        <p className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-bold text-emerald-950">Existing work on this device will be preserved.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" aria-label="Work that will be linked">
          <p className="rounded-xl bg-slate-100 p-4"><strong className="block text-2xl">{source.learners}</strong><span className="text-sm">Learners</span></p>
          <p className="rounded-xl bg-slate-100 p-4"><strong className="block text-2xl">{source.assignments}</strong><span className="text-sm">Assignments</span></p>
          <p className="rounded-xl bg-slate-100 p-4"><strong className="block text-2xl">{source.savedProgressItems}</strong><span className="text-sm">Saved progress items</span></p>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <h4 className="font-extrabold">Private information that stays out of sync</h4>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {PRIVACY_EXCLUSIONS.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" className="min-h-11 rounded-lg border px-4 py-2 font-bold" onClick={onBack}>Back</button>
          <button type="button" className="min-h-11 rounded-lg bg-cyan-700 px-4 py-2 font-extrabold text-white" onClick={onConfirm}>Approve and connect</button>
        </div>
      </section>
    )
  }

  if (state.step === 'UP_TO_DATE') {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5" aria-labelledby="parent-device-sync-complete">
        <h3 ref={titleRef} tabIndex={-1} id="parent-device-sync-complete" className="text-2xl font-extrabold outline-none">Up to date</h3>
        <p className="mt-2 font-semibold">This device is connected. Existing work on this device was preserved.</p>
        <button type="button" className="mt-4 min-h-11 rounded-lg border border-emerald-700 bg-white px-4 py-2 font-bold" onClick={onBack}>Done</button>
      </section>
    )
  }

  const conflict = state.step === 'CONFLICT'
  const offline = state.step === 'OFFLINE'
  return (
    <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-labelledby="parent-device-sync-attention">
      <p className="font-bold text-amber-800">{parentSyncStatusLabelR1('NEEDS_ATTENTION')}</p>
      <h3 ref={titleRef} tabIndex={-1} id="parent-device-sync-attention" className="mt-1 text-2xl font-extrabold outline-none">
        {conflict ? 'We found changes from another device.' : offline ? "You're offline — your work is still saved on this device." : 'We could not connect this device yet.'}
      </h3>
      <p className="mt-2 font-semibold text-slate-700">
        {conflict
          ? 'Nothing was overwritten. Work from both devices is still saved and needs a Parent review.'
          : offline
            ? 'Reconnect when you can, then try again. No local work was removed.'
            : 'Parent family access needs attention. No local work was changed.'}
      </p>
      <button type="button" className="mt-4 min-h-11 rounded-lg border border-amber-700 bg-white px-4 py-2 font-bold" onClick={onBack}>Back to device setup</button>
    </section>
  )
}

export function ParentDeviceSyncSetup({ runtime, onStatusChange }: {
  readonly runtime: ParentDeviceSyncSetupRuntime
  readonly onStatusChange?: ParentDeviceSyncStatusListener
}) {
  const coordinator = useMemo(() => new ParentDeviceSyncSetupCoordinator(runtime), [runtime])
  const [state, setState] = useState<ParentDeviceSyncSetupViewState>({ step: 'CHOOSE', status: 'SYNC_READY' })

  useEffect(() => { onStatusChange?.(state.status) }, [onStatusChange, state.status])

  const prepare = async (intent: ParentDeviceSyncIntent) => {
    setState({ step: 'CONNECTING', status: 'SYNCING', intent })
    const result = await coordinator.prepare(intent)
    if (result.status === 'READY') setState({ step: 'PREVIEW', status: 'SYNC_READY', preview: result.preview })
    else if (result.status === 'OFFLINE') setState({ step: 'OFFLINE', status: 'NEEDS_ATTENTION', intent })
    else setState({ step: 'ATTENTION', status: 'NEEDS_ATTENTION', intent })
  }
  const connect = async () => {
    if (state.step !== 'PREVIEW') return
    const preview = state.preview
    setState({ step: 'CONNECTING', status: 'SYNCING', intent: preview.intent })
    const result = await coordinator.connect(preview)
    if (result.status === 'UP_TO_DATE') setState({ step: 'UP_TO_DATE', status: 'UP_TO_DATE', intent: preview.intent })
    else if (result.status === 'CONFLICT') setState({ step: 'CONFLICT', status: 'NEEDS_ATTENTION', intent: preview.intent })
    else if (result.status === 'OFFLINE') setState({ step: 'OFFLINE', status: 'NEEDS_ATTENTION', intent: preview.intent })
    else setState({ step: 'ATTENTION', status: 'NEEDS_ATTENTION', intent: preview.intent })
  }
  const reset = () => setState({ step: 'CHOOSE', status: 'SYNC_READY' })

  return <ParentDeviceSyncSetupView state={state} onChoose={(intent) => { void prepare(intent) }} onConfirm={() => { void connect() }} onBack={reset} />
}
