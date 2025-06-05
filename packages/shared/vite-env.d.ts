/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY: string
  readonly VITE_ANTHROPIC_API_KEY: string
  readonly VITE_DISABLE_TELEMETRY: string
  readonly VITE_CLAUDE_MODEL: string
  readonly VITE_PDF_PROCESSING_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}