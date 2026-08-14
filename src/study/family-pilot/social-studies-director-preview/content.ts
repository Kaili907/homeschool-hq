export const SOCIAL_STUDIES_SAMPLE_LESSON_REF = 'ma-g5-social-studies-u08-l03' as const
export const SOCIAL_STUDIES_SAMPLE_CANONICAL_TITLE = 'Guided practice A: protest and loyalism' as const
export const SOCIAL_STUDIES_SAMPLE_DISPLAY_TITLE = 'Why Did Viewpoints About British Rule Differ?' as const

export type PreviewSource = Readonly<{
  sourceRef: string
  label: string
  title: string
  creator: string
  date: string
  repository: string
  url: string
  form: string
  treatment: string
  context: string
  evidence: string
  imageUrl?: string
  imageAlt?: string
  limitation: string
}>

export const PREVIEW_SOURCES: Readonly<Record<'model' | 'parliament' | 'revere' | 'repair' | 'retry', PreviewSource>> = Object.freeze({
  model: Object.freeze({
    sourceRef: 'nara-lee-resolution',
    label: 'Model source',
    title: 'Lee Resolution (1776)',
    creator: 'Second Continental Congress record',
    date: '1776',
    repository: 'U.S. National Archives',
    url: 'https://www.archives.gov/milestone-documents/lee-resolution',
    form: 'Official transcript and digitized original',
    treatment: 'Short verbatim excerpt from the official transcript',
    context: 'Congress considered a proposal to declare the colonies independent. This later event is used only to model a historian\'s evidence move, not to answer today\'s comparison.',
    evidence: '“free and independent States”',
    limitation: 'This phrase shows the proposed change in political status. By itself, it does not explain every person\'s reason for supporting or opposing independence.',
  }),
  parliament: Object.freeze({
    sourceRef: 'avalon-stamp_act',
    label: 'Source A',
    title: 'Great Britain : Parliament - The Stamp Act, March 22, 1765',
    creator: 'Parliament of Great Britain; transcript hosted by the Avalon Project',
    date: 'March 22, 1765',
    repository: 'The Avalon Project, Yale Law School',
    url: 'https://avalon.law.yale.edu/18th_century/stamp_act_1765.asp',
    form: 'Law; verified transcript',
    treatment: 'Short verbatim excerpt; original spelling retained',
    context: 'The law states Parliament\'s official reason for raising revenue in Britain\'s American colonies. It is evidence of Parliament\'s position, not a Loyalist colonist\'s personal view.',
    evidence: '“defending, protecting, and securing, the British colonies”',
    limitation: 'An official law states what Parliament claimed and required. It does not tell us how every colonist understood the law.',
  }),
  revere: Object.freeze({
    sourceRef: 'loc-2008661777',
    label: 'Source B',
    title: 'The bloody massacre perpetrated in King Street Boston on March 5th 1770 by a party of the 29th Regt.',
    creator: 'Paul Revere, engraver, printer, and seller',
    date: '1770',
    repository: 'Library of Congress',
    url: 'https://www.loc.gov/item/2008661777/',
    form: 'Engraving with watercolor on laid paper; digital image from the original',
    treatment: 'Full source image shown from the Library of Congress service copy',
    context: 'The print portrays British soldiers firing toward Boston civilians. The Library of Congress describes the portrayal as sensationalized, so historians inspect both its details and its persuasive choices.',
    evidence: 'Notice the title, the organized line of soldiers, the civilians, and the blood shown in the foreground.',
    imageUrl: 'https://tile.loc.gov/storage-services/service/pnp/ppmsca/01600/01657v.jpg',
    imageAlt: 'Paul Revere\'s 1770 print. At right, a line of uniformed soldiers fires toward civilians at left. Several civilians lie or are carried in the foreground. Buildings line the background. The title calls the event a bloody massacre.',
    limitation: 'The print is evidence of how Revere chose to portray the event. It is not a complete or neutral record of everything that happened.',
  }),
  repair: Object.freeze({
    sourceRef: 'nara-treaty-of-paris',
    label: 'Repair model source',
    title: 'Treaty of Paris (1783)',
    creator: 'Peace commissioners for Great Britain and the United States',
    date: '1783',
    repository: 'U.S. National Archives',
    url: 'https://www.archives.gov/milestone-documents/treaty-of-paris',
    form: 'Treaty; official transcript and digitized original',
    treatment: 'Short verbatim excerpt from Article 1',
    context: 'The peace treaty came after the Revolutionary War. It is a different source and a different moment, used to reteach how evidence limits a claim.',
    evidence: '“free sovereign and independent states”',
    limitation: 'The treaty supports a claim about the war\'s political outcome. It cannot, by itself, prove why people protested or stayed loyal years earlier.',
  }),
  retry: Object.freeze({
    sourceRef: 'nara-declaration-of-independence',
    label: 'Fresh retry source',
    title: 'Declaration of Independence (1776)',
    creator: 'Second Continental Congress record',
    date: '1776',
    repository: 'U.S. National Archives',
    url: 'https://www.archives.gov/milestone-documents/declaration-of-independence',
    form: 'Declaration; official transcript and digitized original',
    treatment: 'Short verbatim excerpt from the official transcript',
    context: 'This document states a principle used to justify changing government. It is fresh evidence for the retry, not a source from the failed task.',
    evidence: '“deriving their just powers from the consent of the governed”',
    limitation: 'The statement presents the Declaration\'s argument. It does not show that every colonist agreed with it.',
  }),
})

export const TIMELINE = Object.freeze([
  Object.freeze({ year: '1765', title: 'Stamp Act', note: 'Parliament states duties will help pay colonial defense expenses.', sourceRef: 'avalon-stamp_act' }),
  Object.freeze({ year: '1770', title: 'Revere print', note: 'A Boston print portrays British troops firing on civilians.', sourceRef: 'loc-2008661777' }),
  Object.freeze({ year: '1776', title: 'Independence documents', note: 'Congress records a claim for independent states.', sourceRef: 'nara-lee-resolution' }),
  Object.freeze({ year: '1783', title: 'Treaty of Paris', note: 'The peace treaty recognizes the United States as independent.', sourceRef: 'nara-treaty-of-paris' }),
])

export const VOCABULARY = Object.freeze([
  Object.freeze({ term: 'protest', definition: 'An action or statement that shows disagreement with a rule, decision, or condition.' }),
  Object.freeze({ term: 'loyalism', definition: 'Continued support for British rule during the conflict.' }),
  Object.freeze({ term: 'perspective', definition: 'A viewpoint shaped by a person\'s position, experience, purpose, and information.' }),
  Object.freeze({ term: 'primary source', definition: 'Evidence made during the time being studied or by someone directly involved.' }),
  Object.freeze({ term: 'corroborate', definition: 'To compare sources and check where their evidence agrees, differs, or leaves a gap.' }),
])

export type PreviewStage = Readonly<{
  id: string
  shortLabel: string
  eyebrow: string
  title: string
  kind: 'welcome' | 'context' | 'model' | 'source-a' | 'guided-a' | 'source-b' | 'guided-b' | 'compare' | 'independent' | 'mastery-a' | 'mastery-b' | 'repair-menu' | 'repair' | 'retry' | 'complete'
}>

export const PREVIEW_STAGES: readonly PreviewStage[] = Object.freeze([
  { id: 'welcome', shortLabel: 'Get ready', eyebrow: 'Launch', title: 'Two sources can show different positions—and different limits.', kind: 'welcome' },
  { id: 'context', shortLabel: 'Context', eyebrow: 'Background', title: 'Place the disagreement in time and place.', kind: 'context' },
  { id: 'model', shortLabel: 'Watch a model', eyebrow: 'Historian move', title: 'Move from a source detail to a careful claim.', kind: 'model' },
  { id: 'source-a', shortLabel: 'Source A', eyebrow: 'Official record', title: 'Read Parliament\'s stated reason.', kind: 'source-a' },
  { id: 'guided-a', shortLabel: 'Try with help', eyebrow: 'Guided analysis 1', title: 'Use an exact phrase before making an inference.', kind: 'guided-a' },
  { id: 'source-b', shortLabel: 'Source B', eyebrow: 'Persuasive print', title: 'Read an image as evidence.', kind: 'source-b' },
  { id: 'guided-b', shortLabel: 'Try with less help', eyebrow: 'Guided analysis 2', title: 'Notice, infer, and name a limit.', kind: 'guided-b' },
  { id: 'compare', shortLabel: 'Compare', eyebrow: 'Perspective check', title: 'Keep the viewpoints in separate evidence lanes.', kind: 'compare' },
  { id: 'independent', shortLabel: 'Build a claim', eyebrow: 'Independent evidence work', title: 'What do the sources show—and not show—about disagreement over British rule?', kind: 'independent' },
  { id: 'mastery-a', shortLabel: 'Fresh check 1', eyebrow: 'Mastery evidence', title: 'Use a fresh detail from the Stamp Act.', kind: 'mastery-a' },
  { id: 'mastery-b', shortLabel: 'Fresh check 2', eyebrow: 'Mastery evidence', title: 'Decide what another source would need to add.', kind: 'mastery-b' },
  { id: 'repair-menu', shortLabel: 'Choose next', eyebrow: 'Responsive next step', title: 'Choose a repair or finish the review path.', kind: 'repair-menu' },
  { id: 'repair', shortLabel: 'Reteach', eyebrow: 'Different model', title: 'A source detail sets the boundary of a claim.', kind: 'repair' },
  { id: 'retry', shortLabel: 'Fresh retry', eyebrow: 'New evidence', title: 'Build the evidence link with a different source.', kind: 'retry' },
  { id: 'complete', shortLabel: 'Complete', eyebrow: 'Lesson complete', title: 'Your evidence is saved on this device for review.', kind: 'complete' },
])

export const RESPONSE_PROMPTS: Readonly<Record<string, Readonly<{ label: string; prompt: string; hint?: string }>>> = Object.freeze({
  'guided-a': Object.freeze({
    label: 'Your evidence link',
    prompt: 'Copy the short phrase that tells Parliament\'s stated purpose. Then explain what that phrase supports—and one thing it does not prove.',
    hint: 'Frame: The words “…” support the idea that Parliament said ____. They do not prove ____.',
  }),
  'guided-b': Object.freeze({
    label: 'Your source note',
    prompt: 'Name one detail in the print. What message might that detail send a viewer? Why should a historian check another source?',
  }),
  independent: Object.freeze({
    label: 'Your claim, evidence, and reasoning',
    prompt: 'Make a careful claim about why viewpoints toward British rule could differ. Use one identifiable detail from Source A and one from Source B. Explain how each detail supports or limits your claim. End by naming the missing Loyalist-colonist evidence.',
    hint: 'Use your own words. A neutral frame is available: My claim is ____. Source A shows ____. Source B shows ____. Together, this evidence suggests ____. A limit is ____.',
  }),
  'mastery-a': Object.freeze({
    label: 'Fresh cause-and-effect check',
    prompt: 'A different Stamp Act clause placed duties on pamphlets and newspapers. Explain one possible cause-and-effect connection between a tax on printed material and protest. Label any step that is an inference, not a fact stated by the law.',
  }),
  'mastery-b': Object.freeze({
    label: 'Fresh corroboration check',
    prompt: 'A learner uses only Revere\'s print to explain both protest and loyalism. What kind of verified source should the learner add, and what question should it help answer? Explain why.',
  }),
  retry: Object.freeze({
    label: 'Fresh evidence link',
    prompt: 'Use the Declaration phrase shown here. Write one claim it supports about an argument for changing government, then state one claim it cannot support about all colonists.',
    hint: 'Detail → claim it supports → claim it cannot support.',
  }),
})
