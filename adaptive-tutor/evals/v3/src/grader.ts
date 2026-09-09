import type {
  DeterministicAcademicGrader,
  EvalCase,
  EvalPolicyOutcome,
  EvalScore,
} from "./contracts.js";

export interface GraderInvocation {
  readonly caseId: string;
  readonly disposition: EvalPolicyOutcome["disposition"];
}

export class ScriptedDeterministicGrader implements DeterministicAcademicGrader {
  public readonly graderRef: string;
  public readonly invocations: GraderInvocation[] = [];
  readonly #scores: ReadonlyMap<string, readonly EvalScore[]>;

  public constructor(graderRef: string, scores: ReadonlyMap<string, readonly EvalScore[]>) {
    this.graderRef = graderRef;
    this.#scores = new Map([...scores].map(([caseId, values]) => [caseId, structuredClone(values)]));
  }

  public async grade(input: {
    readonly evalCase: EvalCase;
    readonly policyOutcome: EvalPolicyOutcome;
  }): Promise<readonly EvalScore[]> {
    this.invocations.push({
      caseId: input.evalCase.caseId,
      disposition: input.policyOutcome.disposition,
    });
    return structuredClone(this.#scores.get(input.evalCase.caseId) ?? []);
  }
}
