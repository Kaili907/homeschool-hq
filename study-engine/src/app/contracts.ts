export interface StudyEngineHostContext {
  learner: {
    id: string
    displayName: string
  }
  onExit: () => void
}
