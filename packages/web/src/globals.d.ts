/** Global ambient declarations for OpenHop's web bundle. */

declare global {
  interface Window {
    /** Test/debug hook: scales animation speed (default 1, e.g. 4 for 4× faster). */
    __flowSpeed?: number
  }
}

export {}
