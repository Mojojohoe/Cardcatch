/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When `"1"`, enables Card Creator + artwork tools in production builds (e.g. `vite preview`). */
  readonly VITE_CARD_ART_TOOLS?: string;
}

declare module '*.txt?raw' {
  const src: string;
  export default src;
}
