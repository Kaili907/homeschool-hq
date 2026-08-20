import {
  createProductionFinalAssessmentProjectionRequest,
  parseProductionFinalAssessmentProjection,
  projectProductionFinalAssessmentPackage,
  resolveProductionFinalAssessmentBinding,
  type ProductionFinalAssessmentBinding,
  type ProductionFinalAssessmentProjection,
  type ProductionFinalAssessmentProjectionRequest,
} from './finalAssessment'

export interface ProductionFinalAssessmentPackageLoader {
  load(input: {
    readonly request: ProductionFinalAssessmentProjectionRequest
    readonly binding: ProductionFinalAssessmentBinding
  }): Promise<unknown>
}

/**
 * Resolves identity from the admitted catalog, loads only its learner package, and
 * accepts either that canonical package or an already-minimized matching projection.
 */
export async function loadProductionFinalAssessment(
  loader: ProductionFinalAssessmentPackageLoader,
  input: {
    readonly assignmentRef: string
    readonly assessmentRef: string
    readonly releaseVersion?: string
  },
): Promise<ProductionFinalAssessmentProjection> {
  const request = createProductionFinalAssessmentProjectionRequest(input)
  if (!request) throw new Error('production_final_assessment_binding_not_found')
  const binding = resolveProductionFinalAssessmentBinding(
    request.assessmentRef,
    request.releaseVersion,
  )
  if (!binding) throw new Error('production_final_assessment_binding_not_found')
  const loaded = await loader.load({ request, binding })
  const projection =
    parseProductionFinalAssessmentProjection(loaded) ??
    projectProductionFinalAssessmentPackage(loaded)
  if (!projection)
    throw new Error('production_final_assessment_projection_contract')
  return projection
}
