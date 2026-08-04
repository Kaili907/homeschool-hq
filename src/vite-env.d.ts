/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Session 12: opt-in host gate. Exact 'true' only; absent is disabled. */
  readonly VITE_STUDY_ENGINE_ENABLED?: string
  /** Explicit development/test-only Study composition; ignored by production builds. */
  readonly VITE_STUDY_ENGINE_PREVIEW?: string
  /** D1 deploy: 'true' routes the tutor + voice calls through the serverless proxy. */
  readonly VITE_USE_PROXY?: string
  /** Explicit local development seam; ignored by production builds. */
  readonly VITE_ALLOW_BROWSER_PROVIDER_KEYS?: string
  /** M6 sync: Supabase project URL. Absent → keyless local mode (no sync). */
  readonly VITE_SUPABASE_URL?: string
  /** M6 sync: Supabase ANON key (public by design). The service key must NEVER be here. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** CURR-1: per-grade Manuel Academy curriculum gates. Exact 'true' only; absent is disabled. */
  readonly VITE_ACADEMY_GRADE_5_ENABLED?: string
  readonly VITE_ACADEMY_GRADE_7_ENABLED?: string
  readonly VITE_ACADEMY_GRADE_8_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
