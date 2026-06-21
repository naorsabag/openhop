declare global {
  interface Window {
    umami?: {
      track: (
        event?: string | ((props: Record<string, unknown>) => Record<string, unknown>)
      ) => void
    }
  }
}

/** Hash-routed flow links on Pages — Umami script in <head> handles the first view. */
export function initUmamiHashTracking(): void {
  if (import.meta.env.VITE_FRAGMENT_MODE !== '1') return
  if (!import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim()) return

  window.addEventListener('hashchange', trackPageView)
}

export function trackPageView(): void {
  if (!window.umami?.track) return
  window.umami.track((props) => ({
    ...props,
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }))
}

export {}
