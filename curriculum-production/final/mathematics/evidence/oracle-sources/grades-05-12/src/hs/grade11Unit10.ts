import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 11 Unit 10 — Statistical Inference Capstone (S-ID.4, S-IC.1-5). */

export const GRADE11_UNIT10 = makeHsUnitBank(11, 10, [
  spec<{ mean: number; sd: number; deviations: number }>({
    itemType: 'normal-empirical-rule',
    standard: 'S-ID.4',
    lessonFocus: 'the normal model and the empirical rule',
    build: (difficulty) => {
      const mean = rand(40, difficulty === 3 ? 200 : 120)
      const sd = rand(3, difficulty === 3 ? 20 : 12)
      const deviations = rand(1, 3)
      const percentages = [68, 95, 99.7]
      return {
        prompt: `A quantity is approximately normal with mean ${mean} and standard deviation ${sd}. Approximately what percentage of values lie between ${mean - deviations * sd} and ${mean + deviations * sd}?`,
        parameters: { mean, sd, deviations },
        answer: `about ${percentages[deviations - 1]}%`,
        distractors: percentages
          .filter((_, index) => index !== deviations - 1)
          .map((value) => `about ${value}%`)
          .concat(['about 50%', 'about 100%']),
        solutionSteps: [
          `The interval runs from ${mean - deviations * sd} to ${mean + deviations * sd}, which is ${mean} ± ${deviations * sd}.`,
          `Since the standard deviation is ${sd}, that is ${deviations} standard deviation${deviations === 1 ? '' : 's'} either side of the mean.`,
          `The empirical rule gives about 68% within one standard deviation, 95% within two, and 99.7% within three.`,
          `So approximately ${percentages[deviations - 1]}% of values lie in this interval.`,
        ],
        commonErrors: [
          {
            observed: 'Counted the number of units rather than the number of standard deviations.',
            likelyCause: 'The interval width was not divided by the standard deviation.',
            remediation:
              'Always convert the interval to standard deviations before applying the rule.',
          },
        ],
      }
    },
    oracle: ({ deviations }) => `about ${[68, 95, 99.7][deviations - 1]}%`,
    referenceExample: {
      prompt: 'Mean 100, sd 15. What percentage lies between 70 and 130?',
      steps: ['That is 100 ± 30, which is two standard deviations.', 'About 95%.'],
      answer: 'about 95%',
    },
  }),

  spec<{ which: number }>({
    itemType: 'study-design-and-inference',
    standard: 'S-IC.3',
    lessonFocus: 'matching study design to the conclusion it supports',
    build: () => {
      const cases = [
        {
          text: 'a sample survey with randomly selected participants',
          answer: 'It supports generalising from the sample to the population, but not a causal claim.',
        },
        {
          text: 'a randomised controlled experiment with participants randomly assigned to treatments',
          answer: 'It supports a causal conclusion about the treatment, within the population studied.',
        },
        {
          text: 'an observational study of volunteers who chose their own group',
          answer: 'It supports neither generalisation nor causation, because self-selection can bias both.',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `A researcher runs ${entry.text}. What kind of conclusion does this design support?`,
        parameters: { which },
        answer: entry.answer,
        distractors: cases
          .filter((_, index) => index !== which)
          .map((other) => other.answer)
          .concat(['It supports both generalisation and causation, provided the sample is large.']),
        solutionSteps: [
          `Two separate features matter: random selection of who is studied, and random assignment of what is done to them.`,
          `Random selection is what licenses generalisation to a population; random assignment is what licenses causal claims.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Treated a large sample as sufficient for a causal conclusion.',
            likelyCause: 'Sample size was confused with study design.',
            remediation:
              'Ask whether the researcher assigned the treatment; if participants chose, causation is not supported however large the sample.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'It supports generalising from the sample to the population, but not a causal claim.',
        'It supports a causal conclusion about the treatment, within the population studied.',
        'It supports neither generalisation nor causation, because self-selection can bias both.',
      ][which],
    referenceExample: {
      prompt: 'What does a randomised experiment support?',
      steps: ['Random assignment balances other variables.', 'A causal conclusion is supported.'],
      answer: 'a causal conclusion',
    },
  }),

  spec<{ proportionPercent: number; sampleSize: number }>({
    itemType: 'margin-of-error-interpretation',
    standard: 'S-IC.4',
    lessonFocus: 'estimating a population proportion with a margin of error',
    build: (difficulty) => {
      const proportionPercent = rand(20, 80)
      const sampleSize = [100, 400, 625, 2500][rand(0, difficulty === 1 ? 1 : 3)]
      const margin = Math.round((100 / Math.sqrt(sampleSize)) * 10) / 10
      return {
        prompt: `A random sample of ${sampleSize} people gives a sample proportion of ${proportionPercent}%. Using the conservative margin of error 1/√n, give the approximate margin of error and the resulting interval.`,
        parameters: { proportionPercent, sampleSize },
        answer: `±${margin}%, giving ${Math.round((proportionPercent - margin) * 10) / 10}% to ${Math.round((proportionPercent + margin) * 10) / 10}%`,
        distractors: [
          `±${Math.round((100 / sampleSize) * 10) / 10}%, giving ${Math.round((proportionPercent - 100 / sampleSize) * 10) / 10}% to ${Math.round((proportionPercent + 100 / sampleSize) * 10) / 10}%`,
          `±${margin * 2}%, giving ${Math.round((proportionPercent - margin * 2) * 10) / 10}% to ${Math.round((proportionPercent + margin * 2) * 10) / 10}%`,
          `±${proportionPercent}%, giving 0% to ${proportionPercent * 2}%`,
          `±${Math.round(Math.sqrt(sampleSize) * 10) / 10}%, giving a much wider interval`,
        ],
        solutionSteps: [
          `The conservative margin of error is 1/√n, expressed as a percentage.`,
          `√${sampleSize} = ${Math.sqrt(sampleSize)}, so 1/√n = ${1 / Math.sqrt(sampleSize)}, which is ${margin}%.`,
          `The interval is the sample proportion plus or minus that margin: ${proportionPercent}% ± ${margin}%.`,
          `That gives ${Math.round((proportionPercent - margin) * 10) / 10}% to ${Math.round((proportionPercent + margin) * 10) / 10}%. Quadrupling the sample size would halve this margin.`,
        ],
        commonErrors: [
          {
            observed: 'Divided by n instead of by √n.',
            likelyCause: 'The square root in the formula was omitted.',
            remediation:
              'Check the scaling behaviour: quadrupling the sample must halve the margin, which only the square root gives.',
          },
        ],
      }
    },
    oracle: ({ proportionPercent, sampleSize }) => {
      const margin = Math.round((100 / Math.sqrt(sampleSize)) * 10) / 10
      const low = Math.round((proportionPercent - margin) * 10) / 10
      const high = Math.round((proportionPercent + margin) * 10) / 10
      return `±${margin}%, giving ${low}% to ${high}%`
    },
    referenceExample: {
      prompt: 'n = 400, sample proportion 55%. Margin and interval?',
      steps: ['1/√400 = 0.05 = 5%.', '55% ± 5% gives 50% to 60%.'],
      answer: '±5%, giving 50% to 60%',
    },
  }),

  spec<{ observed: number; simulations: number }>({
    itemType: 'simulation-based-significance',
    standard: 'S-IC.5',
    lessonFocus: 'using simulation to decide whether a result is surprising',
    build: (difficulty) => {
      const simulations = [100, 500, 1000][rand(0, difficulty === 1 ? 1 : 2)]
      const atLeastAsExtreme = rand(1, Math.floor(simulations / 20))
      const proportion = atLeastAsExtreme / simulations
      const significant = proportion < 0.05
      return {
        prompt: `In ${simulations} simulations under the assumption of no difference, ${atLeastAsExtreme} produced a result at least as extreme as the one observed. What should be concluded?`,
        parameters: { observed: atLeastAsExtreme, simulations },
        answer: significant
          ? `The observed result is statistically significant: it occurred in only ${Math.round(proportion * 1000) / 10}% of simulations, below the usual 5% threshold.`
          : `The observed result is not statistically significant: it occurred in ${Math.round(proportion * 1000) / 10}% of simulations, which is not unusual.`,
        distractors: [
          significant
            ? `The observed result is not statistically significant: it occurred in ${Math.round(proportion * 1000) / 10}% of simulations, which is not unusual.`
            : `The observed result is statistically significant: it occurred in only ${Math.round(proportion * 1000) / 10}% of simulations, below the usual 5% threshold.`,
          'The simulation proves that the observed difference is real.',
          'The simulation proves that there is no difference.',
          'Nothing can be concluded without repeating the experiment itself.',
        ],
        solutionSteps: [
          `The simulation models what would happen if there were genuinely no difference.`,
          `Out of ${simulations} simulated trials, ${atLeastAsExtreme} were at least as extreme as the observed result, a proportion of ${Math.round(proportion * 1000) / 10}%.`,
          `Compare that against the conventional 5% threshold.`,
          significant
            ? `Because ${Math.round(proportion * 1000) / 10}% is below 5%, the observed result would rarely arise by chance alone, so it is statistically significant.`
            : `Because ${Math.round(proportion * 1000) / 10}% is at or above 5%, a result this extreme is not unusual under chance alone, so it is not statistically significant.`,
        ],
        commonErrors: [
          {
            observed: 'Described a significant result as proving the effect is real.',
            likelyCause: 'Statistical significance was read as proof rather than as evidence.',
            remediation:
              'State conclusions as strength of evidence against the no-difference assumption, never as proof.',
          },
        ],
      }
    },
    oracle: ({ observed, simulations }) => {
      const proportion = observed / simulations
      const percentage = Math.round(proportion * 1000) / 10
      return proportion < 0.05
        ? `The observed result is statistically significant: it occurred in only ${percentage}% of simulations, below the usual 5% threshold.`
        : `The observed result is not statistically significant: it occurred in ${percentage}% of simulations, which is not unusual.`
    },
    referenceExample: {
      prompt: '3 of 500 simulations were as extreme. Conclusion?',
      steps: ['3/500 = 0.6%.', 'Below 5%, so the result is significant.'],
      answer: 'statistically significant',
    },
  }),
])
