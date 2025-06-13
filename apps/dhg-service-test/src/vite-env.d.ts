/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CLAUDE_API_KEY: string
  readonly VITE_CLAUDE_MODEL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_CLIENT_SECRET: string
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_GOOGLE_DRIVE_FOLDER_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}