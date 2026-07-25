import type { FinalizationGuard } from './coordination'
import { readDatasetProvenance } from './provenance'

/** Test setup helper only; production code never imports this module. */
export function finalizationGuardForTestSetup(
  householdId = 'test-household',
): FinalizationGuard {
  return {
    operationId: 'test-setup-operation',
    householdId,
    importEpoch: readDatasetProvenance()?.importEpoch ?? 'test-import-epoch',
    cloudRevision: '',
    assertCurrent: async () => undefined,
    assertCurrentNow: () => undefined,
    updateExpectedDataset: () => undefined,
    adoptCurrentHouseholdBinding: () => undefined,
    isCurrent: async () => true,
  }
}
