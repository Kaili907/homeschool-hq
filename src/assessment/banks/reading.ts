import type { FixedTest } from '../types'

// Transcribed VERBATIM from HS-English-Reading-Placement.md, Part 1 (2 passages,
// 15 questions). All reading items are human-graded ("score judgment answers
// generously if reasoned from the text"); the source key is preserved per item
// in keyNote for Dad's results screen. Passages render on-screen above questions.

const PASSAGE_A = `The Bridge That Joined a State

For most of Michigan's history, the state was really two states. The Upper and Lower Peninsulas, separated by the Straits of Mackinac, might as well have been different countries. Travelers who wanted to cross the five miles of water between them waited for ferries — sometimes for hours, and during hunting season, sometimes for a full day, in lines of cars that stretched for miles. In winter, ice could stop the boats entirely. Business owners in the Upper Peninsula watched customers and opportunities stay south. Politicians had talked about a bridge since the 1880s, but the Straits seemed to forbid one: the water ran deep, the winds howled through the gap between two Great Lakes, and winter ice heaved and ground against anything humans put in its way.

Engineers were not sure such a bridge could be built. Some proposals were dismissed as fantasies; one plan even suggested a floating tunnel. The project finally moved forward in the early 1950s, when the state created an authority to finance the bridge with bonds — money borrowed from investors, to be repaid with tolls — rather than waiting for tax dollars that never seemed to arrive. The designer, David Steinman, had spent his career building suspension bridges, and he drew up a structure meant not merely to survive the Straits but to shrug them off. Its roadway grating was designed to let fierce winds pass through instead of pushing against a solid deck. Its towers were set on foundations sunk deep into the lakebed.

Construction began in 1954 and took three and a half years. Thousands of workers labored through brutal winters, and five of them lost their lives building it. When the Mackinac Bridge opened to traffic in 1957, it stretched nearly five miles from shore to shore, with a main span of 3,800 feet suspended between its towers — an engineering feat that transformed a day-long wait into a ten-minute drive.

The bridge changed more than travel times. The two peninsulas, long strangers, became neighbors. Tourism in the Upper Peninsula grew as downstate families discovered how easily they could now reach its forests and waterfalls. And the "Mighty Mac" itself became the state's most recognizable landmark — proof, Michiganders like to say, that the thing everyone calls impossible is sometimes just waiting for someone stubborn enough to design it properly.`

const PASSAGE_B = `Mara stood at the edge of the mat, tugging at the cuff of her sleeve the way she always did before a match she expected to lose. Across from her, the girl from Riverside rolled her shoulders like someone who had never once considered losing anything. The referee raised his hand. Mara's coach said something from the corner — she couldn't hear it over the blood in her ears, but she knew what it was, because he only ever said one thing: Position before submission. Slow is smooth. She stopped tugging her sleeve. The whistle blew, and for the first two seconds, Mara did nothing at all — she just watched the other girl rush in, exactly the way film said she would.`

export const HS_READING: FixedTest = {
  id: 'hs-reading',
  title: 'Reading Comprehension',
  forGrades: ['10', '12'],
  intro:
    'Read each passage, then answer its questions. Short answers are fine. If you genuinely ' +
    "don't know how to start, press SKIP — a skip shows where the gap is, a guess hides it. This " +
    "test can't be failed.",
  sections: [
    {
      name: 'Passage A — nonfiction',
      passage: PASSAGE_A,
      items: [
        { id: 'r1', kind: 'text', prompt: 'What is the central idea of the passage?', keyNote: "The Mackinac Bridge overcame doubts and physical obstacles to unite Michigan's two peninsulas, changing the state." },
        { id: 'r2', kind: 'text', prompt: 'What specific problem did travelers face before the bridge? Give two details from the text.', keyNote: 'Hours-to-day-long ferry waits, miles-long car lines, ice stopping boats.' },
        { id: 'r3', kind: 'text', prompt: 'Why did some engineers doubt the bridge could be built? Name two reasons the passage gives.', keyNote: 'Deep water, severe winds, grinding ice (any two).' },
        { id: 'r4', kind: 'text', prompt: 'How was the bridge paid for, and why was that approach chosen?', keyNote: 'Bonds repaid by tolls; tax money never materialized.' },
        { id: 'r5', kind: 'text', prompt: 'In paragraph 2, what does the phrase "shrug them off" suggest about Steinman\'s design goals?', keyNote: 'He aimed for a design that would master the conditions easily, not just endure them.' },
        { id: 'r6', kind: 'text', prompt: "What design feature dealt with the Straits' winds, and how did it work?", keyNote: 'Open roadway grating lets wind pass through the deck instead of pushing on it.' },
        { id: 'r7', kind: 'text', prompt: "What is the author's purpose in the final paragraph?", keyNote: "To show the bridge's larger meaning/legacy beyond transportation." },
        { id: 'r8', kind: 'text', prompt: 'How is the passage organized: (a) comparison, (b) problem and solution told chronologically, (c) cause listed after effect, (d) pure description? Briefly defend your choice.', keyNote: '(b) — problem established, then solution unfolds in time order.' },
        { id: 'r9', kind: 'text', prompt: 'Identify one sentence in the passage that is opinion rather than fact, and explain how you know.', keyNote: 'e.g., "the state\'s most recognizable landmark" or the closing "proof..." claim — evaluative claims, not verifiable in the text.' },
        { id: 'r10', kind: 'text', prompt: 'In the last sentence, what does the author imply about how Michiganders view the bridge beyond its practical use?', keyNote: "It's a symbol of stubborn achievement/state identity." },
      ],
    },
    {
      name: 'Passage B — fiction',
      passage: PASSAGE_B,
      items: [
        { id: 'r11', kind: 'text', prompt: 'What can you infer about how Mara feels at the start of the scene? Cite the detail that shows it.', keyNote: 'Nervous/expects to lose — sleeve-tugging habit "before a match she expected to lose."' },
        { id: 'r12', kind: 'text', prompt: "What does the contrast between Mara and the Riverside girl's body language accomplish?", keyNote: 'Highlights the confidence gap; sets up underdog stakes.' },
        { id: 'r13', kind: 'text', prompt: 'What does Mara\'s decision to "do nothing at all" for two seconds reveal about her? What earlier detail supports this?', keyNote: "Discipline/strategy over panic — she studied film and follows her coach's patience principle; supported by her stopping the sleeve-tugging." },
        { id: 'r14', kind: 'text', prompt: "What is the effect of italicizing the coach's saying rather than putting it in quotation marks?", keyNote: 'Presents it as internalized memory/mantra rather than spoken words.' },
        { id: 'r15', kind: 'text', prompt: 'Based on the final sentence, what do you predict happens next, and what in the text supports your prediction?', keyNote: 'Reasonable: she counters the rush because she prepared for it; supported by "exactly the way film said she would."' },
      ],
    },
  ],
}
