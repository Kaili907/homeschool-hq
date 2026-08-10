import { readFile } from 'node:fs/promises'

/** Immutable evidence bundle consumed by the canonical ADMIN-12 projection. */
export async function loadAdminCurriculumValidationEvidence() {
  const root = new URL('../../../curriculum-content/manuel-academy/1.0.0/', import.meta.url)
  const [validation, curriculumManifest, packageManifest, checksumManifest, manifestVerification] = await Promise.all([
    readFile(new URL('validation/validation.json', root), 'utf8'),
    readFile(new URL('curriculum-manifest.json', root), 'utf8'),
    readFile(new URL('MANIFEST.json', root), 'utf8'),
    readFile(new URL('SHA256SUMS.txt', root), 'utf8'),
    readFile(new URL('validation/manifest-verification.txt', root), 'utf8'),
  ])
  return {
    validation: JSON.parse(validation),
    curriculumManifest: JSON.parse(curriculumManifest),
    packageManifest: JSON.parse(packageManifest),
    checksumManifest,
    manifestVerification,
  }
}
