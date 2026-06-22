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
    /** Test/debug hook: set the canvas's max zoom from the browser console. */
    __setMaxZoom?: (n: number) => void
    /** Umami analytics — injected into <head> on GitHub Pages builds only. */
    umami?: {
      track: (
        event?: string | ((props: Record<string, unknown>) => Record<string, unknown>)
      ) => void
    }
  }
}

export {}
