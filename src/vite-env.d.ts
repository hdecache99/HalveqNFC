/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface Window {
  NDEFReader?: new () => {
    scan: (options?: { signal?: AbortSignal }) => Promise<void>
    onreading: ((event: { message: { records: Array<{ recordType?: string; data?: ArrayBuffer; mediaType?: string; id?: string }> } }) => void) | null
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
