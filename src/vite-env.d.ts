/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** D1 deploy: routes tutor, voice, and Azure token calls through serverless proxies. */
  readonly VITE_USE_PROXY?: string
  /** M6 sync: Supabase project URL. Absent → keyless local mode (no sync). */
  readonly VITE_SUPABASE_URL?: string
  /** M6 sync: Supabase ANON key (public by design). The service key must NEVER be here. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
