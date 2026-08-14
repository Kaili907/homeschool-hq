/**
 * Semantic consistency guard for PE transfer lessons.
 *
 * The former depth audit inferred conflict from Grade 9-12 lesson position.
 * This guard ignores grade, unit, and lesson number. It compares the actual
 * learner transfer demand with equal-credit completion text and the paired
 * adult RUBRIC authority. Canonical repaired families also carry one authored
 * evidence rule that must survive every learner/adult projection channel.
 */

function text(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(text).join(' ')
  if (typeof value === 'object') return Object.values(value).map(text).join(' ')
  return String(value)
}

function finding(classification, code, message) {
  return { classification, code, message }
}

const CONTRADICTIONS = [
  {
    classification: 'SCORING_AUTHORITY_CONFLICT',
    code: 'LIVE_OPPONENT_VS_SOLO_AUTHORITY',
    demand: /against an opponent who is genuinely competing/i,
    authority: /solo learner|without another participant|game size.*not.*assessed|tactical understanding.*not the game size/i,
    message: 'learner/rubric demand requires a genuinely competing opponent while adult authority grants full solo evidence',
  },
  {
    classification: 'SCORING_AUTHORITY_CONFLICT',
    code: 'UNINTERRUPTED_VS_STOP_REST_AUTHORITY',
    demand: /complete sequence run without stopping/i,
    authority: /pause or rest|stopping or resting.*counts|rest.*without (losing|loss of) credit/i,
    message: 'learner/rubric demand requires uninterrupted performance while safety authority requires equal-status stop/rest handling',
  },
  {
    classification: 'SCORING_AUTHORITY_CONFLICT',
    code: 'REQUIRED_OUTING_VS_INDOOR_AUTHORITY',
    demand: /on an outing .*where (?:the )?(?:weather|terrain|timing)|on a planned outing with a real contingency/i,
    authority: /no outdoor trip.*required|full indoor|indoor (?:or home-(?:yard|area) )?equivalent|not approved|fully describes one controlled|describing\/gesturing/i,
    message: 'learner/rubric demand requires a real outing condition while adult authority grants a full indoor or non-execution route',
  },
  {
    classification: 'SCORING_AUTHORITY_CONFLICT',
    code: 'LIVE_PARTICIPANTS_VS_PLAN_AUTHORITY',
    demand: /inside a real activity with other people present|actually leading a segment for other people|coached to another person who has to succeed|running the event for real|facilitated live for a real group/i,
    authority: /written plan|diagrammed|practical trial is optional|solo learner completes|no participants are available|group size is never a requirement|leading a group is never required|one person.*meets the standard|fully describes one controlled|describing\/gesturing|described version/i,
    message: 'learner/rubric demand requires live participants while adult authority grants full plan, solo, or smaller-participant evidence',
  },
  {
    classification: 'SCORING_AUTHORITY_CONFLICT',
    code: 'UNSUPERVISED_BLOCK_VS_MODEL_GUARDIAN_AUTHORITY',
    demand: /unsupervised habit across a full training block, including one real stop decision/i,
    authority: /may be written, tabled, or described|guardian input|guardian.*review|supervision/i,
    message: 'learner/rubric demand requires unsupervised execution while adult authority grants modelled evidence and retains guardian boundaries',
  },
  {
    classification: 'CONTENT_TRANSFER_CONFLICT',
    code: 'SCORED_CONTEST_VS_NO_SCORE_COMPLETION',
    demand: /in a scored rally, round, or innings|across a full scored contest|score itself is the pressure/i,
    authority: /no score.*needed|one controlled practice-and-application sequence/i,
    message: 'learner transfer demand requires a scored contest while learner completion grants generic no-score evidence',
  },
  {
    classification: 'CONTENT_TRANSFER_CONFLICT',
    code: 'EXTENDED_EXECUTION_VS_ONE_SEQUENCE_COMPLETION',
    demand: /learner[’']s own real training week|genuine trial session|run unsupervised across a full cycle|actual attempt at the goal, including a setback/i,
    authority: /one controlled practice-and-application sequence|fully describes one controlled|describing\/gesturing the movement when movement is not appropriate/i,
    message: 'learner transfer demand requires extended or actual execution while learner completion grants one generic described sequence',
  },
]

export function evaluatePeTransferConsistency({ sourceLesson, learnerTask, completionCriteria, equipmentAlternative, accessibleAdaptation, activitySteps, adultSuccessCriteria, adultScoringGuidance, adultAdaptiveRoutes, adultSafetyAndPrivacy, guardianSafetyReview }) {
  const transferRequirement = text(sourceLesson?.transfer_condition).trim()
  if (!transferRequirement) return { status: 'CONSISTENT', classifications: [], findings: [] }

  const authoredEvidence = text(sourceLesson?.transfer_evidence_requirement).trim()
  const learnerDemand = `${transferRequirement} ${text(learnerTask)}`
  const learnerCredit = text([completionCriteria, equipmentAlternative, accessibleAdaptation, activitySteps])
  const adultAuthority = text([adultSuccessCriteria, adultScoringGuidance, adultAdaptiveRoutes, adultSafetyAndPrivacy, guardianSafetyReview])
  const combinedAuthority = `${learnerCredit} ${adultAuthority}`
  const findings = []

  for (const rule of CONTRADICTIONS) {
    if (rule.demand.test(learnerDemand) && rule.authority.test(combinedAuthority)) {
      findings.push(finding(rule.classification, rule.code, rule.message))
    }
  }

  if (authoredEvidence) {
    const channels = [
      ['learner task', learnerTask],
      ['learner completion/evidence expectation', completionCriteria],
      ['equal-credit equipment expectation', equipmentAlternative],
      ['equal-credit adaptation expectation', accessibleAdaptation],
      ['adult success criteria', adultSuccessCriteria],
      ['adult scoring guidance', adultScoringGuidance],
      ['adult alternate-route authority', adultAdaptiveRoutes],
    ]
    for (const [label, value] of channels) {
      if (!text(value).includes(authoredEvidence)) {
        findings.push(finding(
          label.startsWith('adult') ? 'SCORING_AUTHORITY_CONFLICT' : 'CONTENT_TRANSFER_CONFLICT',
          'AUTHORED_TRANSFER_EVIDENCE_DROPPED',
          `${label} does not preserve the canonical transfer/equal-credit evidence requirement`,
        ))
      }
    }
    if (!text(learnerTask).includes(transferRequirement) || !text(adultSuccessCriteria).includes(transferRequirement)) {
      findings.push(finding(
        'SCORING_AUTHORITY_CONFLICT',
        'TRANSFER_REQUIREMENT_DROPPED',
        'learner task and adult success criteria do not preserve the same authored transfer requirement',
      ))
    }
  }

  const classifications = [...new Set(findings.map((item) => item.classification))]
  return {
    status: findings.length === 0 ? 'CONSISTENT' : 'CONFLICT',
    classifications,
    findings,
  }
}
