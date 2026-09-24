/// <reference types="vite/client" />

// Declare every VITE_* variable here AND in `src/shared/config/env.schema.ts`.
// Never put secrets in VITE_* variables — they are inlined into the client bundle.
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_COMING_SOON?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
