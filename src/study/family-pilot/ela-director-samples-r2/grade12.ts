import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `Source A — Municipal Sustainability Office, Cool-Pavement Pilot Summary

The city applied a light-colored surface coating to six residential blocks in May. Six nearby blocks with similar width, tree cover, and traffic volume served as comparison sites. From June through August, surface sensors recorded temperatures at noon and 4:00 p.m. on clear days. Treated pavement averaged 10.8°F cooler at noon and 7.1°F cooler at 4:00 p.m. than untreated pavement.

Air-temperature sensors mounted six feet above the sidewalk showed a smaller difference: treated blocks averaged 0.7°F cooler at noon and 0.3°F cooler at 4:00 p.m. The pilot did not measure indoor temperatures, nighttime conditions, or heat exposure for individual residents. Maintenance crews reported no loss of traction during dry weather, but wet-weather testing was limited to two rain events.

The office recommends expanding the coating to twenty additional blocks while continuing air-temperature and durability monitoring. The report argues that lower surface temperatures can contribute to a broader heat strategy when combined with trees, shade structures, and building improvements. It does not claim that pavement treatment alone will eliminate neighborhood heat risk.

Source B — University Urban Climate Lab, Methodological Review of the Pilot

The reported surface-temperature difference is credible for the monitored times and weather conditions. The matched comparison blocks and repeated sensor readings make accidental one-day variation an unlikely explanation. However, the policy significance of that difference remains uncertain.

First, surface temperature is not the same as human heat exposure. The much smaller air-temperature difference may be meaningful when combined with other measures, but the study provides no evidence about shade, radiant heat at pedestrian height, indoor conditions, or nighttime recovery. Second, the light coating can increase reflected sunlight. Without measurements of radiant exposure, a cooler surface could still feel uncomfortable to a person standing in direct sun.

Third, the site selection may limit generalization. All twelve blocks had moderate tree cover and low-rise housing. Results may differ on wide commercial roads, blocks with little shade, or streets bordered by taller buildings. The review therefore supports continued testing but recommends adding pedestrian-level radiant sensors, nighttime readings, resident comfort surveys that protect privacy, and sites representing several street forms before broad expansion.

Source C — Public Works Cost and Operations Note

The pilot coating cost $38,400 for six blocks, excluding staff time already budgeted for street maintenance. Contractors estimate that expansion costs would fall by 12–18 percent per block because equipment setup could be shared across sites. The coating is warrantied for five years, but the city has only three months of local wear data.

Scheduling creates a second constraint. Each block must close for eight hours, and rain within twenty-four hours can delay application. Coordinating twenty additional blocks in one season would compete with crosswalk repainting and crack-sealing crews. Public Works recommends either a ten-block expansion with full monitoring or a twenty-block expansion spread across two seasons. The note takes no position on heat effectiveness; it addresses cost, durability uncertainty, and operational capacity.`

export const GRADE_12_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 12,
  canonicalLessonRef: 'ma-g12-english-language-arts-u08-l07',
  topic: 'Synthesis when authoritative sources disagree',
  standards: ['11-12.W.7', '11-12.RI.7', '11-12.RI.2', '11-12.SL.2', '11-12.SL.1', '11-12.W.8', '11-12.RI.3'],
  textType: 'Three-source policy evidence set',
  title: 'Synthesize Without Flattening Disagreement',
  welcome: 'Senior-level synthesis preserves distinctions among credible sources. You will integrate a municipal pilot report, an academic methods review, and an operations note to advise a decision without forcing the evidence into false agreement.',
  instruction: 'Synthesis is not a sequence of source summaries. Establish what the sources agree on, locate the exact source of disagreement or uncertainty, evaluate differences in method and purpose, and state a conclusion no broader than the evidence allows. A qualified recommendation can be stronger than a confident verdict.',
  vocabulary: [
    { term: 'synthesis', definition: 'an integrated account of how ideas or evidence from multiple sources relate' },
    { term: 'generalization', definition: 'a conclusion extended from studied cases to a broader population or setting' },
    { term: 'radiant heat', definition: 'heat energy transferred by radiation from the sun or surrounding surfaces' },
  ],
  model: 'Mini-source A finds that a later school start increased average sleep by 24 minutes. Mini-source B accepts the sleep finding but notes that the study covered one suburban district and did not measure transportation costs.\nReasoning: The sources do not disagree about the measured sleep change; they differ on whether that result justifies broader policy.\nModel synthesis: The trial supports a local sleep benefit, but it does not establish that the same schedule is feasible elsewhere. A warranted next step is replication across different transportation systems, not either immediate universal adoption or dismissal of the observed gain.',
  modelPrompt: 'Notice how the model locates disagreement at the level of policy inference rather than inventing a factual conflict.',
  passageTitle: 'Cooler Pavement, Unsettled Policy',
  passage: PASSAGE,
  passageDirections: 'Read each source for claim, method, scope, and purpose. Build a three-column note: established finding; unresolved question; decision constraint.',
  guidedDirections: 'Choose the conclusion that preserves both the findings and their limits.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which conclusion is best warranted by all three sources?',
    choices: [
      'Because treated pavement was more than 10°F cooler, the city should coat every street immediately.',
      'The pilot found credible daytime surface cooling, but uncertainty about pedestrian exposure, varied street forms, durability, and crew capacity supports a limited monitored expansion rather than citywide adoption.',
      'Because the air-temperature difference was less than 1°F, the surface-temperature findings have no policy value.',
    ],
  },
  guidedFeedback: 'The second conclusion integrates the credible measured effect, the methods review’s limits, and Public Works constraints. The first overgeneralizes from surface temperature and six sites. The third dismisses valid evidence simply because it does not answer every policy question.',
  independentDirections: 'Write as an analyst advising the city commission. Distinguish evidence, inference, uncertainty, and operational constraint.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Write a 3–4 paragraph synthesis memo recommending one of these actions: stop, repeat six blocks, expand to ten monitored blocks, or expand to twenty blocks over two seasons. Integrate all three sources, explain one genuine disagreement or difference in scope, and state at least two limits on your recommendation.',
  },
  processFeedback: 'The memo requires human review. Use a source-interaction audit: each paragraph should combine sources around an idea rather than march through A, B, then C. Label every causal or policy inference that goes beyond a direct finding. Verify that your recommendation responds to heat evidence, measurement gaps, and implementation capacity.',
  revisionDirections: 'Revise the synthesis so that qualifications sharpen the recommendation instead of being tacked onto the final sentence.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised 3–4 paragraph policy memo with an integrated evidence chain, a precise recommendation, two explicit limitations, and a next-data priority.',
  },
  rubricCriteria: ['accurate integration of all three sources', 'analysis of agreement and scope differences', 'warranted recommendation', 'explicit limitations', 'coherent source relationships'],
  review: {
    learned: 'Expert synthesis preserves what evidence establishes, identifies where inference begins, and uses disagreement or uncertainty to shape a proportionate next action.',
    howYouDid: 'The warranted-conclusion item returned immediate feedback. Your policy memo and revision await Parent Review; no automated system claims authority over the quality of your synthesis.',
    didWell: 'You integrated empirical findings, methodological critique, and operational constraints without reducing one source to the “correct” one.',
    practice: 'Organize paragraphs by contested issue or decision criterion, and use source names inside that shared reasoning frame.',
    reviewLesson: 'Synthesis sequence: common ground → difference in method or scope → warranted inference → limitation → proportionate action.',
    courseProgress: 'This Director fixture is isolated and awards no production credit. Reviewed memo evidence would support senior research, informational reading, and communication standards in the pilot.',
    nextAction: 'Request Parent Review, then write a one-sentence answer to this audit question: What new measurement would most change your recommendation, and why?',
  },
  readability: {
    instructionLength: 'Compressed scholarly framework with a multi-source analytical protocol',
    sentenceComplexity: 'Dense disciplinary prose with qualification, methodological contrast, and conditional policy reasoning',
    vocabularyLoad: 'Three defined concepts plus authentic technical and operational terms inferable from context',
    passageLength: '493 words across three sources with distinct institutional purposes',
    expectedWrittenResponse: '3–4 paragraph synthesis memo integrating all sources and limitations',
    scaffolding: 'Claim-method-scope-purpose notes, warranted-conclusion check, source-interaction audit, no template that predetermines the recommendation',
  },
})
