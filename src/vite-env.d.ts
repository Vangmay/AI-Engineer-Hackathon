/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTIVE_CASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
