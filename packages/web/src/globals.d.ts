/** Global ambient declarations for OpenHop's web bundle. */

// Vite's `?raw` query — load a file as its raw text contents at build
// time. Used by example-flows.ts to embed YAML examples in the bundle.
declare module '*.yaml?raw' {
  const content: string
  export default content
}

declare global {
  interface Window {
    /** Test/debug hook: scales animation speed (default 1, e.g. 4 for 4× faster). */
    __flowSpeed?: number
  }
}

export {}
