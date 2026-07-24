/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** D1 deploy: 'true' routes the tutor + voice calls through the serverless proxy. */
  readonly VITE_USE_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
