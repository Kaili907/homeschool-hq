type ReadyForLifeLessonSample = any
type ReadyForLifeRisk = 'trip' | 'poison' | 'shock' | 'fire' | 'choke' | 'safe-or-unsure'

export const READY_FOR_LIFE_SAMPLE: ReadyForLifeLessonSample = Object.freeze({
  identity: Object.freeze({
    lessonId: 'ma-g3-ready-for-life-u01-l04',
    grade: 3,
    course: 'ready-for-life',
    unit: 1,
    phase: 'Application or project',
    title: 'Spot, Stop, Ask: A Safe-Space Check',
    version: 'director-sample-r1',
    authorityBasis: 'MANUEL_ACADEMY_LOCAL_COMPOSITION',
  }),
  purpose: Object.freeze({
    primary: 'SAFETY',
    secondary: Object.freeze(['PRACTICAL_TASK', 'PERSONAL_RESPONSIBILITY'] as const),
  }),
  goal: 'I can check a space for a trip, poison, shock, fire, or choke risk. I will point without touching, name the risk or say “I am not sure,” and ask a guardian to handle anything unsafe.',
  readiness: Object.freeze([
    'You can match a pictured situation to a risk word or say “I am not sure.”',
    'For the Home Check, a household-authorized guardian must give permission, choose the area, stay with you, and handle every item.',
    'If a guardian or approved space is unavailable, use the complete Scene Check simulation for equal credit.',
  ]),
  materials: Object.freeze([
    Object.freeze({ id: 'risk-strip-r1', label: 'Five risk words and “safe or unsure” cues', delivery: 'embedded', usedFor: 'model, guided attempt, both independent paths, and retry' }),
    Object.freeze({ id: 'scene-set-r1', label: 'Six complete room-scene cards', delivery: 'embedded', usedFor: 'equal-credit independent simulation' }),
    Object.freeze({ id: 'retry-pair-r1', label: 'Two fresh retry scenes', delivery: 'embedded', usedFor: 'supported and parallel reattempts' }),
    Object.freeze({ id: 'authorized-guardian', label: 'Household-authorized guardian', delivery: 'adult-local', usedFor: 'permission, supervision, adult handling, and physical-event signoff on the Home Check only' }),
    Object.freeze({ id: 'approved-area', label: 'One guardian-selected indoor area', delivery: 'adult-local', usedFor: 'optional Home Check; the Scene Check replaces it when unavailable' }),
  ]),
  riskWords: Object.freeze([
    Object.freeze({ value: 'trip', label: 'Trip', cue: 'Could this make someone fall?' }),
    Object.freeze({ value: 'poison', label: 'Poison', cue: 'Is this an unknown cleaner, medicine, or chemical?' }),
    Object.freeze({ value: 'shock', label: 'Shock', cue: 'Is a cord, plug, or electrical item damaged or wet?' }),
    Object.freeze({ value: 'fire', label: 'Fire', cue: 'Is heat, flame, or a hot item close to something that can burn?' }),
    Object.freeze({ value: 'choke', label: 'Choke', cue: 'Could a very small object be reached by a young child?' }),
    Object.freeze({ value: 'safe-or-unsure', label: 'Safe or unsure', cue: 'If you cannot tell, do not touch. Point and ask.' }),
  ]),
  model: Object.freeze({
    title: 'Watch the four moves',
    startingCondition: 'A lamp cord stretches across the middle of a pictured walking path. The lamp is switched off.',
    actions: Object.freeze([
      Object.freeze({ label: '1. Spot', detail: 'I look from where I am standing. I see a cord crossing the path.' }),
      Object.freeze({ label: '2. Stop', detail: 'I do not step over it or touch the cord.' }),
      Object.freeze({ label: '3. Name', detail: 'I choose “trip” because a foot could catch on the cord.' }),
      Object.freeze({ label: '4. Ask and check', detail: 'I ask the guardian to handle it. After the adult moves it, I check that the walking path is clear.' }),
    ]),
    criteriaCheck: 'The sample succeeds because the learner notices a specific condition, names how harm could happen, follows the no-touch rule, and leaves the physical fix to the guardian.',
  }),
  guidedAttempt: Object.freeze({
    title: 'Try the first move with a coach',
    scenario: 'Picture card: An open cleaning bottle is sitting on a low table. You do not know what is inside.',
    prompt: 'What should you do first?',
    choices: Object.freeze([
      Object.freeze({ id: 'touch-and-read', label: 'Pick it up so I can read it.', feedback: 'Stop. An unknown product is adult-only. Point without touching and ask the adult.', releasesLearner: false }),
      Object.freeze({ id: 'point-name-ask', label: 'Point, say “poison or unsure,” and ask the adult.', feedback: 'That follows all three boundaries: point, name the possible risk, and ask.', releasesLearner: true }),
      Object.freeze({ id: 'walk-away', label: 'Walk away without telling anyone.', feedback: 'Noticing is a good start. Add the ask step so the authorized adult knows what you saw.', releasesLearner: false }),
    ]),
    correctionTurn: 'Fresh coached card: A closed book is flat on a shelf and does not block a path. Say “safe in this picture” or “I am not sure,” then give one reason.',
    releaseCondition: 'Move to independent work after the learner gives a reason and uses the point-without-touching boundary on the fresh card.',
  }),
  independentTask: Object.freeze({
    realPath: Object.freeze({
      title: 'Home Check — real-life path',
      permissionRule: 'Do not begin until a household-authorized guardian chooses one indoor area, gives permission, and is ready to stay with you.',
      steps: Object.freeze([
        'Stand at the guardian-chosen starting place. Do not open, move, or pick up anything.',
        'Check the five checkpoints shown in the lesson: walking path, exit, heat area, products, and small objects.',
        'At each checkpoint, say the risk word, say “safe in this check,” or say “I am not sure.” Give one reason.',
        'Point out concerns. The guardian decides what counts and handles every physical item or change.',
        'After the guardian is finished, look again from a safe place and say what condition changed. Do not record the room, item, or household details.',
      ]),
      checkpoints: Object.freeze(['Walking path', 'Doorway or exit', 'Heat or lamp area', 'Cleaners, medicines, or unknown products', 'Very small objects']),
      completionCondition: 'Complete all five checks. Finding no hazard is a valid result when each check includes a risk-based reason. The guardian, not the learner or Tutor, certifies that the physical walkthrough and no-touch boundary occurred.',
    }),
    simulationPath: Object.freeze({
      title: 'Scene Check — equal-credit simulation',
      equalCredit: true,
      completionAuthority: 'learner',
      directions: 'For each complete scene, choose a risk word or “safe or unsure,” give one short reason, and state the safe next move. These are invented scenes; do not compare them with your home.',
      scenes: Object.freeze([
        Object.freeze({ id: 'scene-1', title: 'Hallway', description: 'A backpack strap lies across the walking path. The doorway is open.' }),
        Object.freeze({ id: 'scene-2', title: 'Side table', description: 'An unlabeled spray bottle sits on a low table. No adult is in the picture.' }),
        Object.freeze({ id: 'scene-3', title: 'Play area', description: 'Three tiny building pieces are on the floor beside a baby toy.' }),
        Object.freeze({ id: 'scene-4', title: 'Reading corner', description: 'A paper decoration touches the shade of a lamp that is switched on.' }),
        Object.freeze({ id: 'scene-5', title: 'Bookshelf', description: 'A closed book lies flat on a shelf. The walking path is clear.' }),
        Object.freeze({ id: 'scene-6', title: 'Desk', description: 'A power cord has a split cover with wire showing. The learner stands several steps away.' }),
      ]),
      completionCondition: 'Submit a response for all six scenes. A trusted human evaluates the risk reasoning; the browser and Tutor do not certify a physical event.',
    }),
  }),
  evidence: Object.freeze({
    masteryKinds: Object.freeze(['KNOWLEDGE', 'PROCEDURE', 'COMPLETION', 'REFLECTION', 'ADULT_SIGNOFF', 'ARTIFACT_EVIDENCE'] as const),
    learnerEvidence: Object.freeze([
      'A five-check Home Check record with only risk words and check status, or six completed invented Scene Check responses.',
      'One short reflection about the Spot–Stop–Name–Ask process.',
      'Learner self-report may record the selected path, but it never certifies a physical walkthrough.',
    ]),
    reflectionPrompt: 'Which move—spot, stop, name, or ask—helped you make a careful decision? Explain using an invented scene or only the risk word. Do not describe a private household item or room.',
    observableCriteria: Object.freeze([
      'Names a specific risk mechanism or gives a supported safe/unsure decision.',
      'Uses point-without-touching and adult-handling boundaries.',
      'Completes every checkpoint or scene and revises a missed safety step when prompted.',
      'Gives a relevant reflection without needing a preferred opinion or private detail.',
    ]),
    doNotCollect: Object.freeze(['room names or layout', 'home address or location', 'household products or medicines', 'photos, audio, or video', 'names, schedules, or family circumstances']),
  }),
  retry: Object.freeze({
    trigger: 'Start retry when a response has no risk mechanism, treats ordinary untidiness as danger, skips the ask step, or says the learner should touch or move an unknown or hazardous item.',
    targetedReteach: 'Contrast two embedded pictures: a strap across a path can cause a trip; a closed book flat on a shelf does not block a path. “Messy” is not a risk word. Name how harm could happen.',
    supportedReattempt: 'Coach card: A toy bin is beside the path, but one long strap reaches into the path. Point to the condition and name the risk or say unsure.',
    feedback: 'Confirm only observable moves: risk mechanism named, no-touch boundary used, and adult handoff stated. If a live-task safety error occurred, stop the live task and continue in simulation.',
    parallelReattempt: 'Fresh card: A dry, unbroken cord runs along the wall and does not cross the path. Decide “risk,” “safe in this picture,” or “unsure,” and give one reason.',
    exitCriterion: 'On both fresh cards, the learner gives a risk-based reason and keeps the point-without-touching/ask boundary.',
    returnPath: 'Resume with the next unfinished independent scene. A Home Check resumes only when the guardian says it is safe; otherwise finish the equal-credit Scene Check.',
  }),
  safety: Object.freeze({
    stopRule: 'Stop, step back, do not touch, and tell the guardian whenever an item is unknown, sharp, hot, electrical, chemical, medicinal, broken, or hard to reach safely.',
    adultOnly: Object.freeze(['moving or opening any product or medicine', 'handling plugs, cords, electricity, heat, glass, or sharp items', 'deciding whether and how a physical condition should be changed']),
    unavailablePath: 'Use the embedded Scene Check. Lack of permission, adult time, a particular household space, or any planted hazard never lowers credit.',
  }),
  duration: Object.freeze({
    activeLearnerTime: '30–40 minutes',
    elapsedWindow: 'One session; no waiting or overnight observation',
    sessionPattern: '8–10 minutes learn/model, 5–7 minutes guided attempt, 12–18 minutes independent task, 5 minutes evidence/reflection',
    checkInPlan: 'Guardian signs immediately after the Home Check; no later check-in for Scene Check',
    adultTime: '12–18 minutes for Home Check permission, supervision, handling, and signoff',
    simulationDuration: '30–35 active minutes in one session; no adult required for the independent simulation',
  }),
  completion: Object.freeze({
    realPathAuthority: 'guardian',
    simulationPathAuthority: 'learner',
    certifyingActor: 'household-authorized guardian',
    learnerSelfReport: 'recorded-but-not-certifying',
    minimumGuardianEvidence: Object.freeze(['guardian gave permission and stayed present', 'learner used point-without-touching', 'guardian handled every physical change', 'all five checkpoints were considered']),
  }),
  tutor: Object.freeze({
    coachScope: Object.freeze(['read risk-word cues aloud', 'rehearse Spot–Stop–Name–Ask', 'ask for a risk mechanism on invented scenes', 'coach the documented retry loop']),
    hintLadder: Object.freeze(['Ask: “What could happen in this picture?”', 'Offer the five risk words plus safe/unsure.', 'Re-read the matching public model step.', 'Route to the embedded contrast-and-retry pair.']),
    modelRef: 'embedded:model:spot-stop-name-ask:r1',
    resourceRefs: Object.freeze(['embedded:risk-strip-r1', 'embedded:scene-set-r1', 'embedded:retry-pair-r1']),
    evidenceExpected: 'Risk-word/check-status artifact and a non-sensitive process reflection; guardian attestation only for the real path.',
    completionAuthority: 'Tutor may acknowledge saved learner evidence. Tutor cannot grant permission, observe the home, certify a physical walkthrough, or create guardian attestation.',
    guardianHandoff: 'Pause here. A household-authorized guardian must give permission, stay with you, handle every item, and sign the Home Check. You can choose the Scene Check instead.',
    privacyDoNotAsk: Object.freeze(['what room the learner checked', 'what products, medicines, cords, or objects exist at home', 'photos or recordings', 'address, names, schedules, or household circumstances']),
    currentSourcePolicy: 'NOT_REQUIRED',
    missingResourceAction: 'Stop and identify the missing embedded item. Do not invent a replacement; route to the other fully delivered path only when its materials resolve.',
  }),
})

export const READY_FOR_LIFE_SAMPLE_STAGES = Object.freeze([
  Object.freeze({ id: 'goal', label: 'Goal & materials', shortLabel: 'Get ready' }),
  Object.freeze({ id: 'model', label: 'Real model', shortLabel: 'Watch' }),
  Object.freeze({ id: 'guided', label: 'Guided first try', shortLabel: 'Try together' }),
  Object.freeze({ id: 'independent', label: 'Independent task', shortLabel: 'Your turn' }),
  Object.freeze({ id: 'evidence', label: 'Evidence & reflection', shortLabel: 'Show it' }),
  Object.freeze({ id: 'retry', label: 'Retry path', shortLabel: 'Try again' }),
  Object.freeze({ id: 'signoff', label: 'Completion boundary', shortLabel: 'Finish' }),
] as const)

export function countCompleteReadyForLifeSceneEvidence(
  sceneIds: readonly string[],
  risks: Readonly<Record<string, ReadyForLifeRisk | ''>>,
  notes: Readonly<Record<string, string>>,
): number {
  return sceneIds.filter((sceneId) => Boolean(risks[sceneId]) && (notes[sceneId]?.trim().length ?? 0) >= 8).length
}
