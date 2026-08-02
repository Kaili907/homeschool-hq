import { describe, expect, it } from 'vitest'
import appStateSource from '../appState.ts?raw'
import source from './useSync.ts?raw'

describe('sync operation lifecycle guards', () => {
  it('registers one auth listener and unsubscribes it on cleanup', () => {
    expect(source.match(/onAuthSessionChange\(/g)).toHaveLength(1)
    expect(source).toContain('unsubscribe()')
  })

  it('uses one explicit operation mutex for automatic and decision actions', () => {
    expect(source).toContain('if (operationRef.current)')
    expect(source).toMatch(/beginOperation\(["']automatic["']\)/)
    expect(source).toMatch(/beginOperation\(["']upload["']\)/)
    expect(source).toMatch(/beginOperation\(["']replace["']\)/)
    expect(source).toMatch(/beginOperation\(["']merge["']\)/)
  })

  it('aborts async work and blocks state updates after unmount', () => {
    expect(source).toContain('mountedRef.current = false')
    expect(source).toContain('abortOperation()')
    expect(source).toContain('if (mountedRef.current) setUser')
    expect(source).toContain('!mountedRef.current')
  })

  it('keys initial reconciliation to user id so token refresh does not duplicate it', () => {
    expect(source).toContain('user?.id,')
    expect(source).toContain('const householdChanged =')
    expect(source).toContain('if (householdChanged) setRecoveryReady(false)')
  })

  it('observes import, AppState, binding, transition, and lease changes', () => {
    expect(source).toMatch(
      /window\.addEventListener\(APP_STATE_IMPORT_EVENT, importApplying\)/,
    )
    expect(source).toMatch(
      /window\.addEventListener\(["']storage["'], storageChanged\)/,
    )
    expect(source).toContain('key !== APP_STATE_STORAGE_KEY')
    expect(source).toMatch(
      /key\?\.startsWith\(["']homeschool-hq:sync:household:["']\)/,
    )
    expect(source).toMatch(
      /key\?\.startsWith\(["']homeschool-hq:sync:transition:["']\)/,
    )
    expect(source).toContain('isLeaseStorageKey(key)')
  })

  it('serializes persisted AppState writes with the final mutation window', () => {
    expect(source).toContain('withDatasetLock:')
    expect(source).toContain('DATASET_WRITE_LOCK_NAME')
    expect(appStateSource).toContain('DATASET_WRITE_LOCK_NAME')
    expect(appStateSource).toContain('waitForAppStatePersistence')
  })

  it('stops replacement and merge when their safety backup fails', () => {
    expect(source.match(/if \(!backupLocalForHousehold\(/g)).toHaveLength(2)
    expect(source).toContain('cloud data was not applied')
    expect(source).toContain('the merge was not applied')
  })
})
