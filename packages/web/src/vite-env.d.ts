/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_FRAGMENT_MODE?: string
  /** Umami website ID. Set in pages.yml only — not used locally. */
  readonly VITE_UMAMI_WEBSITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
