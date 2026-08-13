import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import {
  createStudyBoundContentAuthority,
  StudyBoundContentAuthorityDeniedError,
} from './_shared/study-content/authority.js'
import { createTrustedStudySessionVerifier } from './_shared/study-identity/supabase.js'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/
const GIT_PATH = /^git\+[0-9a-f]{40}:(curriculum-production\/[A-Za-z0-9._/-]+)$/
const SHA256 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ANSWER_AUTHORITY_KEYS = /(?:answer(?:index|key|text)?|expected|solution|scoringauthorityref|productionpackageref|path)/i

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeRef(value) {
  return typeof value === 'string' && REF.test(value)
}

function lessonId(value) {
  if (typeof value?.lessonId === 'string') return value.lessonId
  if (typeof value?.lesson_id === 'string') return value.lesson_id
  if (typeof value?.lessonRef?.lessonId === 'string') return value.lessonRef.lessonId
  return null
}

function authorityKind(binding, scoring) {
  return scoring?.scoringAuthority?.kind ?? scoring?.scoringAuthority ??
    binding?.scoringMetadata?.authority ?? binding?.scoringMetadata?.kind ?? null
}

export function classifyProductionBinding(binding, scoring = null) {
  if (!record(binding) || binding.productionGate?.status !== 'READY' ||
      binding.sourceRuntimeState !== 'READY') return 'unsupported'
  if (binding.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED' ||
      scoring?.completionAuthority === 'guardian') return 'guardian-attestation'
  const kind = authorityKind(binding, scoring)
  if (kind === 'ANSWER_KEY') return 'fixed-short-response'
  if (kind === 'RUBRIC' || kind === 'SCORING_JUDGMENT') return 'constructed-rubric-review'
  if (binding.scoringMetadata?.fixedAuthority === true ||
      binding.scoringMetadata?.responseScoringMode === 'FIXED_OR_COMPUTATIONAL') {
    return 'deterministic-computational'
  }
  if (binding.scoringMetadata?.rubricAuthority === true ||
      ['english-language-arts', 'science', 'social-studies', 'health',
        'physical-education', 'ready-for-life', 'technology',
        'arts-and-music'].includes(binding.subject)) return 'constructed-rubric-review'
  if (kind === 'COMPLETION_ONLY' || binding.scoringMetadata?.authority === 'COMPLETION_ONLY') {
    return 'completion-only'
  }
  return 'unsupported'
}

function choiceRef(itemRef, index) {
  return `${itemRef}:choice-${index + 1}`
}

function learnerProjection(resolved) {
  const disposition = resolved.scoringMode === 'fixed-multiple-choice' ||
      resolved.scoringMode === 'fixed-short-response' ||
      resolved.scoringMode === 'deterministic-computational'
    ? 'trusted-auto-score'
    : resolved.scoringMode === 'constructed-rubric-review'
      ? 'adult-review'
      : resolved.scoringMode === 'guardian-attestation'
        ? 'guardian-attestation'
        : resolved.scoringMode === 'completion-only'
          ? 'completion-only'
          : 'unsupported'
  const responseKind = resolved.scoringMode === 'fixed-multiple-choice'
    ? 'choice'
    : ['fixed-short-response', 'deterministic-computational', 'constructed-rubric-review'].includes(resolved.scoringMode)
      ? 'text'
      : ['guardian-attestation', 'completion-only'].includes(resolved.scoringMode)
        ? 'completion'
        : 'unsupported'
  return Object.freeze({
    schemaVersion: 1,
    releaseId: resolved.releaseId,
    lessonRef: resolved.lessonRef,
    sectionRef: resolved.sectionRef,
    itemRef: resolved.itemRef,
    prompt: resolved.prompt,
    responseKind,
    disposition,
    ...(resolved.choices ? {
      choices: Object.freeze(resolved.choices.map((label, index) => Object.freeze({
        choiceRef: choiceRef(resolved.itemRef, index),
        label,
      }))),
    } : {}),
  })
}

function assertLearnerSafe(value) {
  const pending = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!record(current) && !Array.isArray(current)) continue
    for (const [key, nested] of Object.entries(current)) {
      if (ANSWER_AUTHORITY_KEYS.test(key)) throw new Error('learner_projection_leak')
      if (record(nested) || Array.isArray(nested)) pending.push(nested)
    }
  }
  return value
}

function mathItem({ releaseId, lessonRef, sectionRef, itemRef, packageValue, scoring }) {
  if (!Array.isArray(packageValue.sections) || !Array.isArray(scoring?.answers)) return null
  const section = packageValue.sections.find((candidate) => candidate?.sectionId === sectionRef)
  const item = section?.items?.find((candidate) => candidate?.ref === itemRef)
  if (!item || typeof item.prompt !== 'string' || item.kind === 'worked-example') return null
  const authority = scoring.answers.find((candidate) => candidate?.ref === itemRef)
  if (!authority || typeof authority.answer !== 'string') return null
  if (Array.isArray(item.choices)) {
    if (item.choices.some((choice) => typeof choice !== 'string') ||
        item.choices.filter((choice) => choice === authority.answer).length !== 1) return null
    return Object.freeze({
      releaseId, lessonRef, sectionRef, itemRef, prompt: item.prompt,
      scoringMode: 'fixed-multiple-choice',
      choices: Object.freeze([...item.choices]),
      expected: authority.answer,
    })
  }
  return Object.freeze({
    releaseId, lessonRef, sectionRef, itemRef, prompt: item.prompt,
    scoringMode: authority.verification?.computation
      ? 'deterministic-computational'
      : 'fixed-short-response',
    expected: authority.answer,
  })
}

function evaluateComputation(node) {
  if (!record(node) || typeof node.op !== 'string') return null
  if (node.op === 'money' && Number.isSafeInteger(node.cents)) return node.cents / 100
  if (node.op === 'number' && typeof node.value === 'number' && Number.isFinite(node.value)) return node.value
  if (node.op === 'sum' && Array.isArray(node.of) && node.of.length > 0) {
    const values = node.of.map(evaluateComputation)
    return values.some((value) => value === null) ? null : values.reduce((total, value) => total + value, 0)
  }
  if (node.op === 'diff') {
    const from = evaluateComputation(node.from)
    const less = evaluateComputation(node.less)
    return from === null || less === null ? null : from - less
  }
  if (node.op === 'product' && Array.isArray(node.of) && node.of.length > 0) {
    const values = node.of.map(evaluateComputation)
    return values.some((value) => value === null) ? null : values.reduce((total, value) => total * value, 1)
  }
  if (node.op === 'quotient') {
    const dividend = evaluateComputation(node.dividend)
    const divisor = evaluateComputation(node.divisor)
    return dividend === null || divisor === null || divisor === 0 ? null : dividend / divisor
  }
  return null
}

function taskItem({ releaseId, lessonRef, sectionRef, itemRef, packageValue, scoring, binding }) {
  if (!Array.isArray(packageValue.tasks)) return null
  const task = packageValue.tasks.find((candidate) => candidate?.taskId === sectionRef)
  const prompt = task?.prompts?.find((candidate) => candidate?.ref === itemRef)
  if (!prompt || typeof prompt.text !== 'string') return null
  const configured = packageValue.responseScoring?.items?.find((candidate) => candidate?.ref === itemRef)
  const answer = scoring?.scoringAuthority?.items?.find((candidate) => candidate?.ref === itemRef)
  let scoringMode = classifyProductionBinding(binding, scoring)
  let expected
  if (configured?.responseMode === 'FIXED' && typeof answer?.answer === 'string') {
    const computed = evaluateComputation(answer.verification?.computation)
    if (computed !== null) {
      const authored = numericValue(answer.answer)
      if (authored === null || authored !== computed) return null
      scoringMode = 'deterministic-computational'
      expected = String(computed)
    } else {
      scoringMode = 'fixed-short-response'
      expected = answer.answer
    }
  } else if (configured?.responseMode === 'OPEN') {
    scoringMode = 'constructed-rubric-review'
  }
  return Object.freeze({
    releaseId, lessonRef, sectionRef, itemRef, prompt: prompt.text, scoringMode,
    ...(expected === undefined ? {} : { expected }),
  })
}

function markdownProductionItem({ releaseId, lessonRef, sectionRef, itemRef, source, binding }) {
  if (sectionRef !== 'production-evidence' || itemRef !== `${lessonRef}#production-evidence`) return null
  const scienceTask = /\*\*The task\.\*\*\s*([^\n]+)/.exec(source)?.[1]
  const independent = /##\s+3\.\s+Independent response\s*\n+([\s\S]*?)(?=\n##\s|$)/.exec(source)?.[1]
  const prompt = (scienceTask ?? independent)?.trim()
  if (!prompt || prompt.length > 5_000) return null
  return Object.freeze({
    releaseId, lessonRef, sectionRef, itemRef, prompt,
    scoringMode: classifyProductionBinding(binding),
  })
}

function genericJsonItem({ releaseId, lessonRef, sectionRef, itemRef, packageValue, scoring, binding }) {
  const canonicalItemRef = `${lessonRef}#production-evidence`
  if (sectionRef !== 'production-evidence' || itemRef !== canonicalItemRef) return null
  const prompt = packageValue.independentEvidenceTask?.prompt ??
    packageValue.independentEvidenceTask?.task ?? packageValue.independentEvidenceTask?.text ??
    packageValue.primary_task ??
    packageValue.studentTask ?? packageValue.knowledgeCheck?.prompt ??
    packageValue.task_brief
  if (typeof prompt !== 'string' || prompt.trim().length === 0) return null
  return Object.freeze({
    releaseId, lessonRef, sectionRef, itemRef, prompt,
    scoringMode: classifyProductionBinding(binding, scoring),
  })
}

function normalizeShortResponse(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function numericValue(value) {
  const normalized = value.normalize('NFKC').trim().replace(/[$,\s]/g, '')
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function scoreResolvedProductionItem(resolved, response) {
  if (!record(resolved) || !record(response)) throw new Error('invalid_scoring_input')
  if (resolved.scoringMode === 'fixed-multiple-choice') {
    if (response.kind !== 'choice' || !safeRef(response.choiceRef)) throw new Error('response_kind_mismatch')
    const index = resolved.choices.findIndex((_, candidate) =>
      choiceRef(resolved.itemRef, candidate) === response.choiceRef)
    if (index < 0) throw new Error('choice_binding_mismatch')
    return resolved.choices[index] === resolved.expected ? 'correct' : 'incorrect'
  }
  if (resolved.scoringMode === 'fixed-short-response') {
    if (response.kind !== 'text' || typeof response.text !== 'string') throw new Error('response_kind_mismatch')
    return normalizeShortResponse(response.text) === normalizeShortResponse(resolved.expected)
      ? 'correct' : 'incorrect'
  }
  if (resolved.scoringMode === 'deterministic-computational') {
    if (response.kind !== 'text' || typeof response.text !== 'string') throw new Error('response_kind_mismatch')
    const actual = numericValue(response.text)
    const expected = numericValue(resolved.expected)
    if (actual !== null && expected !== null) return actual === expected ? 'correct' : 'incorrect'
    return normalizeShortResponse(response.text) === normalizeShortResponse(resolved.expected)
      ? 'correct' : 'incorrect'
  }
  if (resolved.scoringMode === 'constructed-rubric-review') {
    if (response.kind !== 'text' || typeof response.text !== 'string' || response.text.trim() === '') {
      throw new Error('response_kind_mismatch')
    }
    return 'review-required'
  }
  if (resolved.scoringMode === 'guardian-attestation') {
    if (response.kind !== 'completion' || response.completed !== true) throw new Error('response_kind_mismatch')
    return 'guardian-attestation-required'
  }
  if (resolved.scoringMode === 'completion-only') {
    if (response.kind !== 'completion' || response.completed !== true) throw new Error('response_kind_mismatch')
    return 'completion-recorded'
  }
  return 'unsupported'
}

export function createFilesystemProductionItemResolver(options = {}) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const releaseRoot = resolve(options.releaseRoot ??
    `${workspaceRoot}/curriculum-release-admitted/family-pilot-r1`)
  const manifestPath = resolve(releaseRoot, 'MANIFEST.json')
  const bindingsPath = resolve(releaseRoot, 'production-bindings.jsonl')
  let cache = null

  function trustedSourcePath(reference) {
    const match = typeof reference === 'string' ? GIT_PATH.exec(reference) : null
    if (!match) throw new Error('authority_locator_invalid')
    const candidate = resolve(workspaceRoot, match[1])
    const root = resolve(workspaceRoot, 'curriculum-production')
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) throw new Error('authority_locator_escape')
    return candidate
  }

  function load() {
    if (cache) return cache
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (!safeRef(manifest.releaseId) || typeof manifest.releaseVersion !== 'string' ||
        manifest.admissionStatus !== 'ADMITTED') throw new Error('release_not_admitted')
    const bindings = readFileSync(bindingsPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    cache = Object.freeze({ manifest: Object.freeze(manifest), bindings: Object.freeze(bindings) })
    return cache
  }

  return Object.freeze({
    isReady() {
      try {
        return statSync(manifestPath).isFile() && statSync(bindingsPath).isFile() && Boolean(load())
      } catch {
        return false
      }
    },
    releaseIdentity() {
      const { manifest } = load()
      return Object.freeze({ releaseId: manifest.releaseId, releaseVersion: manifest.releaseVersion })
    },
    compatibility() {
      const { bindings } = load()
      return Object.freeze(bindings.map((binding) => Object.freeze({
        lessonRef: binding.lessonRef,
        subject: binding.subject,
        scoringMode: classifyProductionBinding(binding),
      })))
    },
    resolve(input) {
      if (![input?.releaseId, input?.lessonRef, input?.sectionRef, input?.itemRef].every(safeRef)) return null
      const { manifest, bindings } = load()
      if (input.releaseId !== manifest.releaseId) return null
      const binding = bindings.find((candidate) => candidate.lessonRef === input.lessonRef)
      if (!binding || binding.productionGate?.status !== 'READY' || binding.sourceRuntimeState !== 'READY') return null
      const packagePath = trustedSourcePath(binding.productionPackageRef)
      const scoringPath = trustedSourcePath(binding.scoringAuthorityRef)
      if (packagePath.endsWith('.md') && scoringPath.endsWith('.md')) {
        const resolved = markdownProductionItem({
          ...input,
          source: readFileSync(packagePath, 'utf8'),
          binding,
        })
        return resolved ? Object.freeze({ ...resolved, learnerItem: assertLearnerSafe(learnerProjection(resolved)) }) : null
      }
      if (!packagePath.endsWith('.json') || !scoringPath.endsWith('.json')) return null
      const packageValue = JSON.parse(readFileSync(packagePath, 'utf8'))
      const scoring = JSON.parse(readFileSync(scoringPath, 'utf8'))
      if (lessonId(packageValue) !== input.lessonRef || lessonId(scoring) !== input.lessonRef) return null
      const params = { ...input, packageValue, scoring, binding }
      const resolved = mathItem(params) ?? taskItem(params) ?? genericJsonItem(params)
      return resolved ? Object.freeze({ ...resolved, learnerItem: assertLearnerSafe(learnerProjection(resolved)) }) : null
    },
  })
}

export function createProductionItemAuthority(options = {}) {
  const env = options.env ?? process.env
  const verifier = options.verifier ?? createTrustedStudySessionVerifier(options)
  const boundContentAuthority = options.boundContentAuthority ?? createStudyBoundContentAuthority(options)
  const admittedReleaseId = env.ACADEMY_PRODUCTION_ITEM_ADMITTED_RELEASE_ID ?? 'family-pilot-r1'
  const admittedReleaseVersion = env.ACADEMY_PRODUCTION_ITEM_RELEASE_VERSION ?? '2.0.0'
  const boundReleaseId = env.ACADEMY_PRODUCTION_ITEM_BOUND_RELEASE_ID ?? ''
  const boundManifestSha256 = env.ACADEMY_PRODUCTION_ITEM_BOUND_MANIFEST_SHA256 ?? ''
  return Object.freeze({
    isReady: () => verifier?.isReady?.() === true && boundContentAuthority?.isReady?.() === true &&
      UUID.test(boundReleaseId) && SHA256.test(boundManifestSha256),
    async authorize({ sessionReference, assignmentRef, releaseId, lessonRef }) {
      if (!safeRef(assignmentRef) || !safeRef(releaseId) || !safeRef(lessonRef) ||
          releaseId !== admittedReleaseId) return { status: 'denied' }
      let verified
      let bound
      try {
        [verified, bound] = await Promise.all([
          verifier.verify({ sessionReference, requiredCapability: 'student:attempts:create' }),
          boundContentAuthority.read({ sessionReference, sessionId: assignmentRef }),
        ])
      } catch (error) {
        if (error instanceof StudyBoundContentAuthorityDeniedError) return { status: 'denied' }
        throw error
      }
      if (verified?.status !== 'verified' || bound?.status !== 'ready' ||
          bound.session.sessionRef !== assignmentRef || bound.session.lessonRef !== lessonRef ||
          bound.curriculumBinding.releaseId !== boundReleaseId ||
          bound.curriculumBinding.releaseVersion !== admittedReleaseVersion ||
          bound.curriculumBinding.curriculumManifestSha256 !== boundManifestSha256) {
        return { status: 'denied' }
      }
      return Object.freeze({ status: 'authorized', studentRef: verified.studentId })
    },
  })
}

function resultShape(resultKind) {
  if (resultKind === 'correct' || resultKind === 'incorrect') {
    return { status: 'assessed', evidenceKind: 'auto-score' }
  }
  if (resultKind === 'review-required') {
    return { status: 'pending-review', evidenceKind: 'adult-review-request' }
  }
  if (resultKind === 'guardian-attestation-required') {
    return { status: 'pending-guardian-attestation', evidenceKind: 'guardian-attestation-request' }
  }
  if (resultKind === 'completion-recorded') {
    return { status: 'recorded-completion', evidenceKind: 'completion' }
  }
  return { status: 'unsupported', evidenceKind: 'unsupported' }
}

function receiptRef(request, resultKind) {
  const digest = createHash('sha256').update([
    request.releaseId, request.assignmentRef, request.lessonRef, request.sectionRef,
    request.itemRef, request.attemptRef, resultKind,
  ].join('\u001f')).digest('hex')
  return `pai:${digest}`
}

export function createProductionItemAssessmentService(options = {}) {
  const resolver = options.resolver ?? createFilesystemProductionItemResolver(options)
  const authority = options.authority ?? createProductionItemAuthority(options)
  const evidencePort = options.evidencePort ?? null
  const adultReviewPort = options.adultReviewPort ?? null
  return Object.freeze({
    isReady: () => resolver?.isReady?.() === true && authority?.isReady?.() === true,
    async project({ sessionReference, request }) {
      const authorized = await authority.authorize({ sessionReference, ...request })
      if (authorized.status !== 'authorized') return { status: 'denied' }
      const resolved = resolver.resolve(request)
      return resolved ? { status: 'ready', item: resolved.learnerItem } : { status: 'not-found' }
    },
    async assess({ sessionReference, request }) {
      const authorized = await authority.authorize({ sessionReference, ...request })
      if (authorized.status !== 'authorized') return { status: 'denied' }
      const resolved = resolver.resolve(request)
      if (!resolved) return { status: 'not-found' }
      const resultKind = scoreResolvedProductionItem(resolved, request.response)
      if (resultKind === 'review-required' && !adultReviewPort) {
        throw new Error('adult_review_unavailable')
      }
      if (resultKind === 'review-required') {
        const accepted = await adultReviewPort.submitProtectedResponse({
          studentRef: authorized.studentRef,
          assignmentRef: request.assignmentRef,
          lessonRef: request.lessonRef,
          sectionRef: request.sectionRef,
          itemRef: request.itemRef,
          attemptRef: request.attemptRef,
          response: request.response.text,
        })
        if (accepted?.status !== 'accepted') throw new Error('adult_review_unavailable')
      }
      const shape = resultShape(resultKind)
      const evidence = Object.freeze({
        schemaVersion: 1,
        ...shape,
        receiptRef: receiptRef(request, resultKind),
        releaseId: request.releaseId,
        studentRef: authorized.studentRef,
        assignmentRef: request.assignmentRef,
        lessonRef: request.lessonRef,
        sectionRef: request.sectionRef,
        itemRef: request.itemRef,
        attemptRef: request.attemptRef,
        resultKind,
        rawResponseIncluded: false,
      })
      if (evidencePort) {
        const stored = await evidencePort.appendProductionItemEvidence(evidence)
        if (!['accepted', 'duplicate'].includes(stored?.status)) throw new Error('evidence_unavailable')
      }
      const { releaseId: _releaseId, studentRef: _studentRef, ...browserResult } = evidence
      return { status: 'ready', result: Object.freeze(browserResult), evidence }
    },
  })
}
