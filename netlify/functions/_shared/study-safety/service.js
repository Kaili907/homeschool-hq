import { deterministicSafetyAssessment, normalizeTransientText } from './deterministic.js'
import { validProviderClassification } from './contracts.js'

function severity(outcome) {
  return { clear: 0, uncertain: 1, urgent: 2, invalid: 3 }[outcome] ?? 3
}

function invalidDecision(reasonCode, classifierVersion = 'study-safety-validation-v1') {
  return Object.freeze({
    classificationVersion: 1,
    classifierVersion,
    outcome: 'invalid',
    categories: Object.freeze([]),
    reasonCodes: Object.freeze([reasonCode]),
  })
}

/** Runs normalization, deterministic review, async provider review, and non-downgrade merge. */
export async function classifyTransientSafety(transientText, classifier) {
  const normalizedTransientText = normalizeTransientText(transientText)
  if (!normalizedTransientText) return invalidDecision('safety-invalid-input-v1')
  const deterministic = deterministicSafetyAssessment(normalizedTransientText)
  if (!classifier || typeof classifier.classify !== 'function' || typeof classifier.classifierVersion !== 'string') {
    return invalidDecision('safety-invalid-provider-unavailable-v1')
  }

  let provider
  try {
    provider = await classifier.classify({
      classificationVersion: 1,
      normalizedTransientText,
      deterministicAssessment: deterministic,
    })
  } catch {
    return invalidDecision('safety-invalid-provider-unavailable-v1', classifier.classifierVersion)
  }
  if (!validProviderClassification(provider, classifier.classifierVersion)) {
    return invalidDecision('safety-invalid-provider-output-v1', classifier.classifierVersion)
  }
  if (provider.outcome === 'invalid') return Object.freeze({ ...provider })

  const outcome = severity(provider.outcome) >= severity(deterministic.outcome)
    ? provider.outcome
    : deterministic.outcome
  const categories = outcome === 'clear'
    ? []
    : [...new Set([...deterministic.categories, ...provider.categories])]
  const reasonCodes = [...new Set([...deterministic.ruleIds, ...provider.reasonCodes])].slice(0, 16)
  return Object.freeze({
    classificationVersion: 1,
    classifierVersion: provider.classifierVersion,
    outcome,
    categories: Object.freeze(categories),
    reasonCodes: Object.freeze(reasonCodes),
  })
}
