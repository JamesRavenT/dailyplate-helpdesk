/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_ACCESS_PROJECT_ID?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
