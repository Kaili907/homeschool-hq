import validationText from '../../../curriculum-content/manuel-academy/1.0.0/validation/validation.json?raw'
import curriculumManifestText from '../../../curriculum-content/manuel-academy/1.0.0/curriculum-manifest.json?raw'
import packageManifestText from '../../../curriculum-content/manuel-academy/1.0.0/MANIFEST.json?raw'
import checksumManifestText from '../../../curriculum-content/manuel-academy/1.0.0/SHA256SUMS.txt?raw'
import manifestVerificationText from '../../../curriculum-content/manuel-academy/1.0.0/validation/manifest-verification.txt?raw'
import { buildCurriculumValidationReadModel } from './model'

function parseJsonEvidence(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Adapts the immutable 1.0.0 release evidence without modifying or re-running it.
 * Granular standards coverage is intentionally absent because the canonical
 * validation artifact does not record lesson/assessment coverage rows.
 */
export function buildCanonicalCurriculumValidationReadModel() {
  return buildCurriculumValidationReadModel({
    validation: parseJsonEvidence(validationText),
    curriculumManifest: parseJsonEvidence(curriculumManifestText),
    packageManifest: parseJsonEvidence(packageManifestText),
    checksumManifest: checksumManifestText,
    manifestVerification: manifestVerificationText,
  })
}
