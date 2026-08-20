export const FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_PACKAGE_ID = 'swk-fl-g8-u04-l03'
export const FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION = 'FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1'

const STATEMENTS = Object.freeze({
  mika: Object.freeze({ startingBalanceCents: 125000, monthlyRateBps: 120, paymentCents: 5000 }),
  ariMinimum: Object.freeze({ startingBalanceCents: 97550, monthlyRateBps: 160, paymentCents: 4500 }),
  ariLarger: Object.freeze({ startingBalanceCents: 97550, monthlyRateBps: 160, paymentCents: 7000 }),
  taylor: Object.freeze({ startingBalanceCents: 114025, monthlyRateBps: 140, paymentCents: 5000 }),
  nia: Object.freeze({ startingBalanceCents: 50000, monthlyRateBps: 200, paymentCents: 2500 }),
  omar: Object.freeze({ startingBalanceCents: 72000, monthlyRateBps: 125, paymentCents: 3500 }),
})

const FIXED_ITEM_SPECS = Object.freeze({
  't1-p1': Object.freeze({
    kind: 'choice',
    value: 'Interest is rounded to cents first; the payment covers that interest before the rest reduces the balance.',
    reasoning: 'The shared statement rule posts and rounds interest before allocating the payment. The remaining payment, not the whole payment, reduces principal.',
  }),
  't2-p1': Object.freeze({ kind: 'interest', statement: 'mika' }),
  't2-p2': Object.freeze({ kind: 'principal', statement: 'mika' }),
  't2-p3': Object.freeze({ kind: 'ending', statement: 'mika' }),
  't3-p1': Object.freeze({ kind: 'interest', statement: 'ariMinimum' }),
  't3-p2': Object.freeze({ kind: 'principal', statement: 'ariMinimum' }),
  't3-p3': Object.freeze({ kind: 'ending', statement: 'ariMinimum' }),
  't4-p1': Object.freeze({ kind: 'ending', statement: 'ariLarger' }),
  't5-p1': Object.freeze({ kind: 'interest', statement: 'taylor' }),
  't5-p2': Object.freeze({ kind: 'principal', statement: 'taylor' }),
  't5-p3': Object.freeze({ kind: 'ending', statement: 'taylor' }),
  't6-p1': Object.freeze({ kind: 'interest', statement: 'nia' }),
  't6-p2': Object.freeze({ kind: 'principal', statement: 'nia' }),
  't6-p3': Object.freeze({ kind: 'ending', statement: 'nia' }),
  't7-p1': Object.freeze({ kind: 'interest', statement: 'omar' }),
  't7-p2': Object.freeze({ kind: 'principal', statement: 'omar' }),
  't7-p3': Object.freeze({ kind: 'ending', statement: 'omar' }),
})

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`)
}

export function computeFictionalStatementInCents(statement) {
  const { startingBalanceCents, monthlyRateBps, paymentCents } = statement
  assertSafeInteger(startingBalanceCents, 'startingBalanceCents')
  assertSafeInteger(monthlyRateBps, 'monthlyRateBps')
  assertSafeInteger(paymentCents, 'paymentCents')
  const interestNumerator = startingBalanceCents * monthlyRateBps
  assertSafeInteger(interestNumerator, 'interestNumerator')
  const interestCents = Math.floor((interestNumerator + 5000) / 10000)
  const principalReductionCents = paymentCents - interestCents
  if (principalReductionCents < 0) throw new Error('sample payment must cover rounded statement interest')
  const endingBalanceCents = startingBalanceCents - principalReductionCents
  return {
    startingBalanceCents,
    monthlyRateBps,
    paymentCents,
    interestNumerator,
    interestCents,
    principalReductionCents,
    endingBalanceCents,
  }
}

function formatUsd(cents) {
  assertSafeInteger(cents, 'cents')
  const dollars = Math.floor(cents / 100).toLocaleString('en-US')
  return `$${dollars}.${String(cents % 100).padStart(2, '0')}`
}

function exactInterestText(interestNumerator) {
  const wholeCents = Math.floor(interestNumerator / 10000)
  const fractional = String(interestNumerator % 10000).padStart(4, '0').replace(/0+$/, '')
  const dollars = Math.floor(wholeCents / 100)
  const cents = String(wholeCents % 100).padStart(2, '0')
  return fractional ? `$${dollars}.${cents}${fractional}` : `$${dollars}.${cents}`
}

function calculationResult(spec) {
  const statement = STATEMENTS[spec.statement]
  if (!statement) throw new Error(`unknown statement ${spec.statement}`)
  const computed = computeFictionalStatementInCents(statement)
  switch (spec.kind) {
    case 'interest': return { cents: computed.interestCents, computed }
    case 'principal': return { cents: computed.principalReductionCents, computed }
    case 'ending': return { cents: computed.endingBalanceCents, computed }
    default: throw new Error(`unknown calculation kind ${spec.kind}`)
  }
}

export function recomputeFinancialLiteracyDirectorSampleR1Item(ref) {
  const spec = FIXED_ITEM_SPECS[ref]
  if (!spec) throw new Error(`unknown fixed item ${ref}`)
  if (spec.kind === 'choice') return spec.value
  return formatUsd(calculationResult(spec).cents)
}

function verificationFor(spec) {
  if (spec.kind === 'choice') {
    return {
      method: 'independent-concept-rule-check',
      reasoning: spec.reasoning,
      computation: {
        rule: 'rounded interest + principal reduction = payment',
        timing: 'interest posts before payment allocation',
      },
      trace: 'interest first; payment = interest share + principal-reduction share',
    }
  }
  const { computed, cents } = calculationResult(spec)
  const interestExact = exactInterestText(computed.interestNumerator)
  const interest = formatUsd(computed.interestCents)
  const principal = formatUsd(computed.principalReductionCents)
  const ending = formatUsd(computed.endingBalanceCents)
  const start = formatUsd(computed.startingBalanceCents)
  const payment = formatUsd(computed.paymentCents)
  const rate = `${(computed.monthlyRateBps / 100).toFixed(2)}%`
  const trace = [
    `interest: ${start} × ${rate} = ${interestExact}; round half up once to ${interest}`,
    `principal reduction: ${payment} − ${interest} = ${principal}`,
    `ending balance: ${start} − ${principal} = ${ending}`,
    `payment check: ${interest} + ${principal} = ${payment}`,
  ].join('; ')
  return {
    method: 'independent-integer-cent-recompute',
    reasoning: `${trace}. The requested ${spec.kind} result is ${formatUsd(cents)}.`,
    computation: {
      op: 'fictional-credit-statement-period',
      startingBalanceCents: computed.startingBalanceCents,
      monthlyRateBps: computed.monthlyRateBps,
      interestNumerator: computed.interestNumerator,
      interestDenominator: 10000,
      interestRounding: 'nearest-cent-half-up-once',
      roundedInterestCents: computed.interestCents,
      paymentCents: computed.paymentCents,
      paymentAllocation: 'rounded-interest-then-principal',
      principalReductionCents: computed.principalReductionCents,
      endingBalanceCents: computed.endingBalanceCents,
      requestedResult: spec.kind,
      requestedResultCents: cents,
    },
    trace,
  }
}

function promptMap(samplePackage) {
  return new Map(samplePackage.tasks.flatMap((task) => task.prompts).map((prompt) => [prompt.ref, prompt.text]))
}

export function buildFinancialLiteracyDirectorSampleR1Scoring(samplePackage) {
  if (samplePackage.packageId !== FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_PACKAGE_ID) {
    throw new Error(`unexpected sample package ${samplePackage.packageId}`)
  }
  if (samplePackage.sampleRevision !== FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION) {
    throw new Error(`unexpected sample revision ${samplePackage.sampleRevision}`)
  }
  const prompts = promptMap(samplePackage)
  const fixedRefs = Object.keys(FIXED_ITEM_SPECS)
  const items = fixedRefs.map((ref) => {
    const promptText = prompts.get(ref)
    if (!promptText) throw new Error(`sample authority cannot resolve prompt ${ref}`)
    const spec = FIXED_ITEM_SPECS[ref]
    return {
      ref,
      promptText,
      answer: recomputeFinancialLiteracyDirectorSampleR1Item(ref),
      verification: verificationFor(spec),
    }
  })
  return {
    schemaVersion: '2.0',
    sampleRevision: FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_REVISION,
    packageId: samplePackage.packageId,
    lessonId: samplePackage.lessonRef.lessonId,
    adultOnly: true,
    authorityTag: {
      gate: 'DIRECTOR_SAMPLE_R1',
      authorityClass: 'FIXED_ANSWER_KEY_WITH_RUBRIC',
      answerTextPresent: true,
      fixedItemCount: items.length,
      rubricCriterionCount: 3,
      answerDerivation: 'independent-integer-cent-recompute',
      derivedFromSourceGenericGuidance: false,
      oracleId: 'finlit-director-sample-r1-oracle@1',
      oracleVerdict: 'AGREES',
    },
    completionAuthority: 'learner',
    nonDiagnosticGuard: 'Do not infer effort, motivation, diagnosis, responsibility, wealth, family behavior, or character from an error.',
    decisionNeutrality: 'Score the use of stated fictional facts, constraints, calculations, tradeoffs, and conditional reasoning. Do not require the adult scorer\'s preferred payment choice.',
    scoringAuthority: {
      kind: 'ANSWER_KEY',
      items,
      criteria: [
        {
          dimension: 'Explaining the payment split',
          itemRefs: ['t2-p4'],
          levels: [
            {
              label: 'Not yet',
              descriptor: 'The response treats the whole payment as principal reduction or does not distinguish interest from principal.',
            },
            {
              label: 'Approaching',
              descriptor: 'The response names interest and principal but does not use the payment-split check accurately.',
            },
            {
              label: 'Meets',
              descriptor: 'The response explains that rounded interest is covered before the remainder reduces principal and uses interest plus principal reduction equals payment as a valid check.',
            },
          ],
        },
        {
          dimension: 'Reasoning about Ari\'s payment tradeoff',
          itemRefs: ['t4-p2'],
          levels: [
            {
              label: 'Not yet',
              descriptor: 'The recommendation is unsupported, contradicts the fictional facts, or makes a personal judgment about Ari.',
            },
            {
              label: 'Approaching',
              descriptor: 'The response cites either debt reduction or cash available now but does not connect both to Ari\'s stated constraints.',
            },
            {
              label: 'Meets',
              descriptor: 'The response recommends either payment consistently, cites the computed balance effect, explains the cash-available tradeoff against the $35.00 fee, and names a plausible changed fact that could change the recommendation.',
            },
          ],
        },
        {
          dimension: 'Fresh mastery interpretation',
          itemRefs: ['t5-p4'],
          levels: [
            {
              label: 'Not yet',
              descriptor: 'The response reports an amount without explaining the interest-principal relationship or the payment tradeoff.',
            },
            {
              label: 'Approaching',
              descriptor: 'The response explains the payment split or the larger-payment effect, but not both.',
            },
            {
              label: 'Meets',
              descriptor: 'The response accurately interprets Taylor\'s interest and principal split and explains that, under unchanged statement conditions, an added payment amount increases principal reduction by that amount while reducing cash available now by the same amount.',
            },
          ],
        },
      ],
    },
    calculationAuthority: {
      representation: 'integer-cents-and-basis-points',
      interestRounding: 'nearest-cent-half-up-once-before-payment-allocation',
      floatingPointAsFinalAuthority: false,
      statementFacts: STATEMENTS,
    },
    integrity: {
      sourceRef: 'mac/finlit-director-sample-r1',
      sourcePath: 'curriculum-production/final/financial-literacy/samples/grade-08/financial-literacy-director-sample-r1-authority.mjs',
      verificationMethod: 'independent-integer-cent-recompute',
    },
  }
}
