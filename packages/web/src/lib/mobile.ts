/**
 * Mobile-viewport detection for collapse-by-default chrome.
 *
 * Tailwind's `md` breakpoint is 768px, so we treat anything below
 * that as "mobile" — narrow enough that the FLOWS sidebar + INSPECT
 * panel can't sit alongside the canvas without crushing it. Used
 * once at mount, via `useState(() => !isMobileViewport())`, to set
 * the initial open/closed state of both bookmark-tabbed panels.
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}
