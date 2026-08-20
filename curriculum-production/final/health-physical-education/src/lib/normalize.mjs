/**
 * Field-name variants differ slightly across the three source branches
 * (e.g. `adapted_alternative` vs `inclusive_adaptation`, `guardian_safety_review`
 * vs `guardian_safety`). These helpers pick the first present field so the
 * generator can treat all three sources uniformly.
 */

export function pickAdaptedAlternativeText(lesson, unit) {
  const fromLesson = lesson.adapted_alternative ?? lesson.inclusive_adaptation
  if (typeof fromLesson === 'string' && fromLesson.trim()) return fromLesson.trim()

  const fromUnit = unit?.inclusive_adaptation
  if (typeof fromUnit === 'string' && fromUnit.trim()) return fromUnit.trim()

  // Canonical grade 5/7/8 lessons fold the adapted path into the general
  // accessibility/accommodations list rather than a dedicated field.
  const acc = Array.isArray(lesson.accessibility_and_accommodations)
    ? lesson.accessibility_and_accommodations.join(' ')
    : ''
  if (acc.trim()) return acc.trim()
  return null
}

export function pickPrivacyGuardText(lesson, unit) {
  const fromUnit = unit?.privacy_guard
  return typeof fromUnit === 'string' && fromUnit.trim() ? fromUnit.trim() : null
}

export function pickGuardianSafety(lesson, unit) {
  return lesson.guardian_safety_review ?? lesson.guardian_safety ?? unit?.guardian_safety ?? unit?.guardian_safety_review ?? null
}

export function pickScenarioText(lesson, unit) {
  if (typeof lesson.practice_scenario === 'string' && lesson.practice_scenario.trim()) {
    return lesson.practice_scenario.trim()
  }
  const topic = Array.isArray(unit?.topic_content)
    ? unit.topic_content.find((t) => t.name === lesson.focus)
    : null
  if (topic?.scenario) return topic.scenario
  if (typeof unit?.performance_task === 'string' && unit.performance_task.trim()) {
    return unit.performance_task.trim()
  }
  return null
}

export function pickKeyPointsText(lesson, unit) {
  if (Array.isArray(lesson.key_points) && lesson.key_points.length) return lesson.key_points.join(' ')
  if (Array.isArray(lesson.cues) && lesson.cues.length) return lesson.cues.join(' ')
  const topic = Array.isArray(unit?.topic_content)
    ? unit.topic_content.find((t) => t.name === lesson.focus)
    : null
  if (Array.isArray(topic?.key_points) && topic.key_points.length) return topic.key_points.join(' ')
  if (Array.isArray(topic?.cues) && topic.cues.length) return topic.cues.join(' ')
  return null
}

export function pickSafetyAndPrivacyText(lesson) {
  const block = lesson.safety_and_privacy
  if (Array.isArray(block)) return block.join(' ')
  if (typeof block === 'string') return block
  return ''
}

/**
 * Combined, always-substantive text describing the private-safe / adapted
 * path for a lesson, used as the gate's `safeAlternative` content and shown
 * to students/families as the adaptation choice or trusted-adult note.
 */
export function buildSafeAlternativeText(lesson, unit) {
  const parts = []
  const adapted = pickAdaptedAlternativeText(lesson, unit)
  if (adapted) parts.push(adapted)
  const privacyGuard = pickPrivacyGuardText(lesson, unit)
  if (privacyGuard) parts.push(privacyGuard)
  const privacy = pickSafetyAndPrivacyText(lesson)
  if (privacy) parts.push(privacy)
  const guardian = pickGuardianSafety(lesson, unit)
  if (guardian && typeof guardian === 'object') {
    const bits = [guardian.equipment, guardian.environment, guardian.movement_hazards, guardian.food_or_allergy_note, guardian.sensitive_content_note]
      .filter((v) => typeof v === 'string' && v.trim())
    if (bits.length) parts.push(`Guardian safety review: ${bits.join(' ')}`)
  }
  return parts.join(' ')
}

export function pickRemediationText(lesson) {
  const routes = Array.isArray(lesson.adaptive_tutor_routes) ? lesson.adaptive_tutor_routes : []
  const prereq = routes.find((r) => r.signal === 'prerequisite gap')
    ?? routes.find((r) => r.signal === 'repeated error pattern')
    ?? routes[0]
  return prereq?.action ?? null
}

export function unitStandardsFor(units, unitNumber) {
  const unit = units.find((u) => u.unit_number === unitNumber)
  return new Set(unit?.standards ?? [])
}
