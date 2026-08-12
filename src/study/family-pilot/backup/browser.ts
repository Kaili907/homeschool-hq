import { serializeFamilyPilotBackup, type FamilyPilotBackupV1 } from './schema'

// FAMILY-PILOT-BACKUP: thin, dependency-free browser helpers. Neither function
// does anything a household couldn't do by hand with the exported functions
// above; they exist only to save Dad the click-through on the common path.

/** No-op outside a browser (no `document`), matching src/study/family-pilot/core/store.ts's guard style. */
export function downloadFamilyPilotBackup(backup: FamilyPilotBackupV1, filename?: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([serializeFamilyPilotBackup(backup)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? `family-pilot-backup-${backup.createdAt.replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Reads a File/Blob picked by the household into text for restoreFamilyPilotBackup. */
export function readFamilyPilotBackupFile(file: Blob): Promise<string> {
  return file.text()
}
