export type ReadyForLifeRisk = 'trip' | 'poison' | 'shock' | 'fire' | 'choke' | 'safe-or-unsure'

export type ReadyForLifeStageId =
  | 'goal'
  | 'model'
  | 'guided'
  | 'independent'
  | 'evidence'
  | 'retry'
  | 'signoff'

export interface ReadyForLifeSceneCard {
  readonly id: string
  readonly title: string
  readonly description: string
}

export interface ReadyForLifeLessonSample {
  readonly identity: {
    readonly lessonId: string
    readonly grade: 3
    readonly course: 'ready-for-life'
    readonly unit: 1
    readonly phase: 'Application or project'
    readonly title: string
    readonly version: string
    readonly authorityBasis: 'MANUEL_ACADEMY_LOCAL_COMPOSITION'
  }
  readonly purpose: {
    readonly primary: 'SAFETY'
    readonly secondary: readonly ['PRACTICAL_TASK', 'PERSONAL_RESPONSIBILITY']
  }
  readonly goal: string
  readonly readiness: readonly string[]
  readonly materials: readonly {
    readonly id: string
    readonly label: string
    readonly delivery: 'embedded' | 'adult-local'
    readonly usedFor: string
  }[]
  readonly riskWords: readonly {
    readonly value: ReadyForLifeRisk
    readonly label: string
    readonly cue: string
  }[]
  readonly model: {
    readonly title: string
    readonly startingCondition: string
    readonly actions: readonly { readonly label: string; readonly detail: string }[]
    readonly criteriaCheck: string
  }
  readonly guidedAttempt: {
    readonly title: string
    readonly scenario: string
    readonly prompt: string
    readonly choices: readonly { readonly id: string; readonly label: string; readonly feedback: string; readonly releasesLearner: boolean }[]
    readonly correctionTurn: string
    readonly releaseCondition: string
  }
  readonly independentTask: {
    readonly realPath: {
      readonly title: string
      readonly permissionRule: string
      readonly steps: readonly string[]
      readonly checkpoints: readonly string[]
      readonly completionCondition: string
    }
    readonly simulationPath: {
      readonly title: string
      readonly equalCredit: true
      readonly completionAuthority: 'learner'
      readonly directions: string
      readonly scenes: readonly ReadyForLifeSceneCard[]
      readonly completionCondition: string
    }
  }
  readonly evidence: {
    readonly masteryKinds: readonly ['KNOWLEDGE', 'PROCEDURE', 'COMPLETION', 'REFLECTION', 'ADULT_SIGNOFF', 'ARTIFACT_EVIDENCE']
    readonly learnerEvidence: readonly string[]
    readonly reflectionPrompt: string
    readonly observableCriteria: readonly string[]
    readonly doNotCollect: readonly string[]
  }
  readonly retry: {
    readonly trigger: string
    readonly targetedReteach: string
    readonly supportedReattempt: string
    readonly feedback: string
    readonly parallelReattempt: string
    readonly exitCriterion: string
    readonly returnPath: string
  }
  readonly safety: {
    readonly stopRule: string
    readonly adultOnly: readonly string[]
    readonly unavailablePath: string
  }
  readonly duration: {
    readonly activeLearnerTime: string
    readonly elapsedWindow: string
    readonly sessionPattern: string
    readonly checkInPlan: string
    readonly adultTime: string
    readonly simulationDuration: string
  }
  readonly completion: {
    readonly realPathAuthority: 'guardian'
    readonly simulationPathAuthority: 'learner'
    readonly certifyingActor: 'household-authorized guardian'
    readonly learnerSelfReport: 'recorded-but-not-certifying'
    readonly minimumGuardianEvidence: readonly string[]
  }
  readonly tutor: {
    readonly coachScope: readonly string[]
    readonly hintLadder: readonly string[]
    readonly modelRef: string
    readonly resourceRefs: readonly string[]
    readonly evidenceExpected: string
    readonly completionAuthority: string
    readonly guardianHandoff: string
    readonly privacyDoNotAsk: readonly string[]
    readonly currentSourcePolicy: 'NOT_REQUIRED'
    readonly missingResourceAction: string
  }
}
