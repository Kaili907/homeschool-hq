import type {
  ScheduleRecoveryAdapter,
  ScheduleRecoveryHandlers,
  ScheduleRecoveryViewModel,
} from './types'

/**
 * Keeps the browser feature independent from persistence and engine internals.
 * An integration maps its canonical recovery state to the view model, then
 * translates the callbacks back to engine decisions.
 */
export function createScheduleRecoveryAdapter<TSource>(
  adapter: ScheduleRecoveryAdapter<TSource>,
): ScheduleRecoveryAdapter<TSource> {
  return adapter
}

export interface ScheduleRecoveryIntegration<TSource> {
  source: TSource
  adapter: ScheduleRecoveryAdapter<TSource>
  handlers: ScheduleRecoveryHandlers
}

export function resolveScheduleRecoveryIntegration<TSource>({
  source,
  adapter,
  handlers,
}: ScheduleRecoveryIntegration<TSource>): {
  model: ScheduleRecoveryViewModel
  handlers: ScheduleRecoveryHandlers
} {
  return { model: adapter(source), handlers }
}

