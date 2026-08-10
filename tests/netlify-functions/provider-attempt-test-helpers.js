import { vi } from 'vitest'

export const TEST_PROVIDER_ATTEMPT_ID = '90000000-0000-4000-8000-000000000001'

export function createTestProviderAttemptJournal(overrides = {}) {
  return {
    reserve: vi.fn(async () => ({
      status: 'created', attemptId: TEST_PROVIDER_ATTEMPT_ID, state: 'reserved',
    })),
    transition: vi.fn(async (input) => ({
      status: 'created', attemptId: input.attemptId, state: input.toState,
    })),
    linkLedger: vi.fn(async (input) => ({
      status: 'created', attemptId: input.attemptId, state: 'ledgered',
    })),
    ...overrides,
  }
}
