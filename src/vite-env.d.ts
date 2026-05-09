/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTIVE_CASE_ID?: string;
  readonly VITE_CONVEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
