/// <reference types="vite/client" />

declare module '*.txt?raw' {
  const src: string;
  export default src;
}
