import { applyParentControlEvent } from "./controls.js";
import type {
  ParentControlEvent,
  ParentDashboardAdapter,
  ParentDashboardModel,
} from "./contracts.js";

function cloneModel(model: ParentDashboardModel): ParentDashboardModel {
  return structuredClone(model);
}

/**
 * Working, memory-only demonstration adapter.
 *
 * It requests no credentials and performs no network, storage, identity,
 * calendar, profile, or database writes.
 */
export class InMemoryParentDashboardAdapter
  implements ParentDashboardAdapter
{
  private model: ParentDashboardModel;

  public constructor(initialModel: ParentDashboardModel) {
    this.model = cloneModel(initialModel);
  }

  public async load(): Promise<ParentDashboardModel> {
    return cloneModel(this.model);
  }

  public async dispatch(
    event: ParentControlEvent,
  ): Promise<ParentDashboardModel> {
    this.model = applyParentControlEvent(this.model, event);
    return cloneModel(this.model);
  }
}
