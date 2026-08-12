import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState } from '../core/schema'
import { exportFamilyPilotBackup, parseFamilyPilotBackup } from './schema'
import { downloadFamilyPilotBackup, readFamilyPilotBackupFile } from './browser'

describe('family pilot backup browser helpers', () => {
  it('downloadFamilyPilotBackup is a no-op without a document (e.g. this test environment)', () => {
    const backup = exportFamilyPilotBackup(emptyFamilyPilotState('2026-08-12T09:00:00.000Z'), '2026-08-12T09:00:00.000Z')
    expect(() => downloadFamilyPilotBackup(backup)).not.toThrow()
  })

  it('readFamilyPilotBackupFile reads a picked file into a parseable backup', async () => {
    const backup = exportFamilyPilotBackup(emptyFamilyPilotState('2026-08-12T09:00:00.000Z'), '2026-08-12T09:00:00.000Z')
    const file = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const text = await readFamilyPilotBackupFile(file)
    expect(parseFamilyPilotBackup(JSON.parse(text))).toEqual(backup)
  })
})
