import { useMemo, useState } from 'react'
import { ScheduleRecoveryWorkspace } from './ScheduleRecoveryWorkspace'
import {
  applyDemoRecoveryAction,
  createDemoScheduleRecoveryModel,
} from './sampleData'
import type { ScheduleRecoveryHandlers } from './types'

/**
 * A stateful browser demo. Production integrations should render
 * ScheduleRecoveryWorkspace with engine-backed model and handlers instead.
 */
export function ScheduleRecoveryPrototype() {
  const [model, setModel] = useState(createDemoScheduleRecoveryModel)
  const handlers = useMemo<ScheduleRecoveryHandlers>(
    () => ({
      onApprove: (input) =>
        setModel((current) =>
          applyDemoRecoveryAction(current, { type: 'approve', input }),
        ),
      onOverride: (input) =>
        setModel((current) =>
          applyDemoRecoveryAction(current, { type: 'override', input }),
        ),
      onManualPlacement: (input) =>
        setModel((current) =>
          applyDemoRecoveryAction(current, { type: 'manual', input }),
        ),
      onUndo: (input) =>
        setModel((current) =>
          applyDemoRecoveryAction(current, { type: 'undo', input }),
        ),
    }),
    [],
  )

  return (
    <div className="sr-prototype">
      <div className="sr-demo-bar">
        <div>
          <strong>Interactive sample</strong>
          <span>Three students · local demo state · no persistence</span>
        </div>
        <button
          type="button"
          className="sr-button sr-button-quiet"
          onClick={() => setModel(createDemoScheduleRecoveryModel())}
        >
          Reset sample
        </button>
      </div>
      <ScheduleRecoveryWorkspace model={model} handlers={handlers} />
    </div>
  )
}

